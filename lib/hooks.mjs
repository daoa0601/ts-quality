import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { resolveRepositoryRoot, runGit } from "./git.mjs";

const managedMarker = "# managed-by: agentic-orch-quality";
const templatesDirectory = fileURLToPath(new URL("../templates/githooks/", import.meta.url));

function readConfiguredHooksPath(root, scope = undefined) {
  const args = ["config"];
  if (scope !== undefined) args.push(scope);
  args.push("--path", "--get", "core.hooksPath");
  try {
    return runGit(args, { cwd: root }).trim();
  } catch {
    return undefined;
  }
}

function resolveHooksDirectory(root) {
  const effectivePath = readConfiguredHooksPath(root);
  const localPath = readConfiguredHooksPath(root, "--local");
  if (effectivePath !== undefined && localPath === undefined) {
    throw new Error(
      "Refusing to install into a non-local core.hooksPath; configure a repository-local path first.",
    );
  }
  if (localPath !== undefined) {
    return path.isAbsolute(localPath) ? localPath : path.resolve(root, localPath);
  }

  const rawHooksDirectory = runGit(["rev-parse", "--git-path", "hooks"], { cwd: root }).trim();
  return path.isAbsolute(rawHooksDirectory)
    ? rawHooksDirectory
    : path.resolve(root, rawHooksDirectory);
}

function inspectDestination(destination, expected) {
  if (!existsSync(destination)) return undefined;
  const metadata = lstatSync(destination);
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error(`Refusing to overwrite non-regular Git hook: ${destination}`);
  }
  const existing = readFileSync(destination, "utf8");
  if (existing !== expected && !existing.includes(managedMarker)) {
    throw new Error(`Refusing to overwrite unmanaged Git hook: ${destination}`);
  }
  return { content: existing, mode: metadata.mode & 0o777 };
}

function restoreDestination(destination, original) {
  if (original === undefined) {
    if (existsSync(destination)) unlinkSync(destination);
    return;
  }
  writeFileSync(destination, original.content, { mode: original.mode });
  chmodSync(destination, original.mode);
}

export function installHooks({ cwd = process.cwd() } = {}) {
  const currentDirectory = realpathSync(path.resolve(cwd));
  const root = resolveRepositoryRoot(currentDirectory);

  if (root !== currentDirectory) {
    throw new Error("Run this command from the repository root.");
  }

  const hooksDirectory = resolveHooksDirectory(root);
  mkdirSync(hooksDirectory, { recursive: true });

  const hooks = ["pre-commit", "pre-push"].map((hook, index) => {
    const expected = readFileSync(path.join(templatesDirectory, hook), "utf8");
    const destination = path.join(hooksDirectory, hook);
    return {
      destination,
      expected,
      original: inspectDestination(destination, expected),
      temporary: path.join(hooksDirectory, `.ts-quality-${process.pid}-${index}.tmp`),
    };
  });

  const replaced = [];
  try {
    for (const hook of hooks) {
      writeFileSync(hook.temporary, hook.expected, { flag: "wx", mode: 0o755 });
      chmodSync(hook.temporary, 0o755);
    }
    for (const hook of hooks) {
      renameSync(hook.temporary, hook.destination);
      replaced.push(hook);
    }
  } catch (error) {
    for (const hook of replaced.reverse()) {
      restoreDestination(hook.destination, hook.original);
    }
    for (const hook of hooks) {
      if (existsSync(hook.temporary)) unlinkSync(hook.temporary);
    }
    throw error;
  }

  return { hooksDirectory, root };
}
