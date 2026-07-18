import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readlinkSync,
  readSync,
} from "node:fs";
import path from "node:path";

import { resolveRepositoryRoot, runGit, runGitBuffer } from "./git.mjs";

export const DEFAULT_MAX_SECRET_SCAN_BYTES = 8 * 1024 * 1024;

function newlineOffsets(source) {
  const offsets = [];
  for (let index = 0; index < source.length; index += 1) {
    if (source.charCodeAt(index) === 10) offsets.push(index);
  }
  return offsets;
}

function lineAt(offsets, index) {
  let lower = 0;
  let upper = offsets.length;
  while (lower < upper) {
    const middle = Math.floor((lower + upper) / 2);
    if (offsets[middle] < index) lower = middle + 1;
    else upper = middle;
  }
  return lower + 1;
}

function displayPath(file) {
  return JSON.stringify(file).slice(1, -1);
}

function forbiddenSecretFile(file) {
  const base = path.basename(file).toLowerCase();
  return (
    base === ".env" ||
    base === "credentials.json" ||
    base.endsWith(".pem") ||
    base.endsWith(".key") ||
    base.endsWith(".p12") ||
    base.endsWith(".pfx")
  );
}

function safePlaceholder(raw) {
  const value = raw.replace(/^["']|["']$/gu, "");
  return (
    value.length === 0 ||
    /^(?:replace-|your-|example|dummy|test-|not-needed|redacted|undefined|null|none|false|true|<)/iu.test(
      value,
    ) ||
    value.startsWith("$") ||
    value.startsWith("process.env") ||
    /^[A-Z][A-Z0-9_]+$/u.test(value)
  );
}

function highConfidencePatterns() {
  return [
    {
      kind: "private key material",
      regex: new RegExp(
        ["-----BEGIN ", "(?:RSA |EC |OPENSSH )?", "PRIVATE KEY-----"].join(""),
        "gu",
      ),
    },
    {
      kind: "OpenAI-style secret token",
      regex: new RegExp(["sk-", "(?:proj-)?", "[A-Za-z0-9_-]{20,}"].join(""), "gu"),
    },
    {
      kind: "GitHub secret token",
      regex: new RegExp(["gh", "[pousr]_", "[A-Za-z0-9]{30,}"].join(""), "gu"),
    },
    {
      kind: "AWS access key",
      regex: new RegExp(["AK", "IA", "[0-9A-Z]{16}"].join(""), "gu"),
    },
  ];
}

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

function readIndexContent(root, file, maxFileBytes) {
  const object = `:0:${file}`;
  const sizeText = runGit(["cat-file", "-s", object], { cwd: root }).trim();
  const byteSize = Number.parseInt(sizeText, 10);
  if (!Number.isSafeInteger(byteSize) || byteSize < 0) {
    throw new Error("Git returned an invalid staged-object size.");
  }
  if (byteSize > maxFileBytes) return { byteSize, content: undefined };
  return {
    byteSize,
    content: runGitBuffer(["cat-file", "-p", object], {
      cwd: root,
      maxBuffer: maxFileBytes + 1024,
    }),
  };
}

function readWorktreeContent(root, file, maxFileBytes) {
  const absolutePath = path.join(root, file);
  let metadata;
  try {
    metadata = lstatSync(absolutePath);
  } catch {
    return { kind: "missing" };
  }

  if (metadata.isSymbolicLink()) {
    try {
      return { content: Buffer.from(readlinkSync(absolutePath)), kind: "content" };
    } catch {
      return { kind: "unreadable" };
    }
  }
  if (!metadata.isFile()) return { kind: "unsupported" };
  if (metadata.size > maxFileBytes) return { byteSize: metadata.size, kind: "oversized" };

  let descriptor;
  try {
    descriptor = openSync(
      absolutePath,
      constants.O_RDONLY | (constants.O_NOFOLLOW === undefined ? 0 : constants.O_NOFOLLOW),
    );
    const openedMetadata = fstatSync(descriptor);
    if (!openedMetadata.isFile()) return { kind: "unsupported" };
    if (openedMetadata.size > maxFileBytes) {
      return { byteSize: openedMetadata.size, kind: "oversized" };
    }

    const content = Buffer.alloc(openedMetadata.size);
    let offset = 0;
    while (offset < content.length) {
      const bytesRead = readSync(descriptor, content, offset, content.length - offset, offset);
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    return { content: content.subarray(0, offset), kind: "content" };
  } catch {
    return { kind: "unreadable" };
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function inspectContent(file, content, report) {
  if (content.includes(0)) return;
  const source = content.toString("utf8");
  const offsets = newlineOffsets(source);

  for (const { kind, regex } of highConfidencePatterns()) {
    for (const match of source.matchAll(regex)) {
      report(file, lineAt(offsets, match.index ?? 0), kind);
    }
  }

  if (!/(?:^|\/)(?:\.env[^/]*|[^/]+\.(?:json|ya?ml|toml|ini|properties))$/iu.test(file)) {
    return;
  }

  const assignment =
    /\b(?:PRIVATE_KEY|SECRET|PASSWORD|API_KEY|TOKEN|CLIENT_SECRET)\b["']?\s*[:=]\s*([^\s,;}]+)/giu;
  for (const match of source.matchAll(assignment)) {
    const value = match[1] ?? "";
    if (!safePlaceholder(value)) {
      report(file, lineAt(offsets, match.index ?? 0), "non-placeholder secret assignment");
    }
  }
}

export function scanSecrets({
  cwd = process.cwd(),
  maxFileBytes = DEFAULT_MAX_SECRET_SCAN_BYTES,
} = {}) {
  if (!Number.isSafeInteger(maxFileBytes) || maxFileBytes <= 0) {
    throw new TypeError("maxFileBytes must be a positive safe integer.");
  }

  const root = resolveRepositoryRoot(cwd);
  const tracked = runGit(["ls-files", "--cached", "-z"], { cwd: root }).split("\0").filter(Boolean);
  const untracked = runGit(["ls-files", "--others", "--exclude-standard", "-z"], { cwd: root })
    .split("\0")
    .filter(Boolean);
  const files = uniqueSorted([...tracked, ...untracked]);
  const trackedFiles = new Set(tracked);
  const findings = [];
  const report = (file, line, kind) => {
    findings.push(`${displayPath(file)}:${line}: ${kind}`);
  };

  for (const file of files) {
    if (forbiddenSecretFile(file)) {
      report(file, 1, "secret-bearing filename must not be committed");
    }

    let indexContent;
    if (trackedFiles.has(file)) {
      try {
        const indexed = readIndexContent(root, file, maxFileBytes);
        if (indexed.content === undefined) {
          report(file, 1, `staged file exceeds ${maxFileBytes}-byte secret-scan limit`);
        } else {
          indexContent = indexed.content;
          inspectContent(file, indexContent, report);
        }
      } catch {
        report(file, 1, "unable to inspect staged content");
      }
    }

    const worktree = readWorktreeContent(root, file, maxFileBytes);
    if (worktree.kind === "oversized") {
      report(file, 1, `working-tree file exceeds ${maxFileBytes}-byte secret-scan limit`);
    } else if (worktree.kind === "unreadable") {
      report(file, 1, "unable to inspect working-tree content safely");
    } else if (
      worktree.kind === "content" &&
      (indexContent === undefined || !worktree.content.equals(indexContent))
    ) {
      inspectContent(file, worktree.content, report);
    }
  }

  return {
    filesInspected: files.length,
    findings: uniqueSorted(findings),
    root,
  };
}
