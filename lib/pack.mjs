import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const defaultForbiddenPrefixes = Object.freeze([
  ".env",
  ".github/",
  ".githooks/",
  ".pnpm-store/",
  "coverage/",
  "node_modules/",
  "src/",
  "tests/",
]);

function normalizedPath(value) {
  return value.replace(/^\.\//u, "");
}

function stringArray(value, label) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new TypeError(`${label} must be an array of strings.`);
  }
  return value;
}

function packConfig(packageJson) {
  const config = packageJson.tsQuality?.pack;
  if (config === undefined) return {};
  if (config === null || typeof config !== "object" || Array.isArray(config)) {
    throw new TypeError("tsQuality.pack must be an object.");
  }
  return config;
}

export function parsePackManifest(stdout) {
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error("pnpm pack did not return valid JSON.");
  }
  const manifest = Array.isArray(parsed) ? parsed[0] : parsed;
  if (manifest === undefined || !Array.isArray(manifest.files)) {
    throw new Error("pnpm pack did not return a file manifest.");
  }
  return manifest;
}

export function inspectPackManifest(packageJson, manifest) {
  const config = packConfig(packageJson);
  const files = new Set(
    manifest.files
      .map((entry) => (typeof entry?.path === "string" ? normalizedPath(entry.path) : ""))
      .filter(Boolean),
  );
  const failures = [];
  const forbidden = [
    ...defaultForbiddenPrefixes,
    ...stringArray(config.forbiddenPrefixes, "tsQuality.pack.forbiddenPrefixes"),
  ].map(normalizedPath);

  for (const file of files) {
    if (forbidden.some((prefix) => file === prefix || file.startsWith(prefix))) {
      failures.push(`forbidden package entry: ${file}`);
    }
    if (/\.(?:key|p12|pem|pfx)$/iu.test(file)) {
      failures.push(`secret-bearing package entry: ${file}`);
    }
  }

  const requirePacked = (file, source) => {
    if (typeof file !== "string") return;
    const normalized = normalizedPath(file);
    if (!files.has(normalized)) failures.push(`missing ${source}: ${normalized}`);
  };

  requirePacked("package.json", "manifest");
  if (config.requireReadme !== false) requirePacked("README.md", "documentation");
  requirePacked(packageJson.main, "main entry");
  requirePacked(packageJson.types, "types entry");
  if (typeof packageJson.bin === "string") {
    requirePacked(packageJson.bin, "bin entry");
  } else {
    for (const [name, target] of Object.entries(packageJson.bin ?? {})) {
      requirePacked(target, `bin entry ${name}`);
    }
  }

  const visitExport = (value, label) => {
    if (typeof value === "string") {
      requirePacked(value, label);
      return;
    }
    if (value === null || typeof value !== "object") return;
    for (const [key, nested] of Object.entries(value)) {
      visitExport(nested, `${label}.${key}`);
    }
  };
  visitExport(packageJson.exports, "export");

  if (typeof packageJson.scripts?.preinstall === "string") {
    const localBootstrap = /(?:^|\s)node\s+([^\s;&|]+require-pnpm\.mjs)(?:\s|$)/u.exec(
      packageJson.scripts.preinstall,
    );
    if (localBootstrap !== null) requirePacked(localBootstrap[1], "preinstall");
  }

  for (const requiredFile of stringArray(config.requiredFiles, "tsQuality.pack.requiredFiles")) {
    requirePacked(requiredFile, "configured file");
  }

  return {
    failures: [...new Set(failures)].sort(),
    files,
  };
}

function pnpmInvocation() {
  const npmExecPath = process.env.npm_execpath;
  if (typeof npmExecPath === "string" && /(?:^|[\\/])pnpm(?:\.c?js)?$/iu.test(npmExecPath)) {
    return { args: [npmExecPath], command: process.execPath };
  }
  return { args: [], command: "pnpm" };
}

export function checkPack({ cwd = process.cwd() } = {}) {
  const root = path.resolve(cwd);
  const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  const invocation = pnpmInvocation();
  const packed = spawnSync(
    invocation.command,
    [...invocation.args, "pack", "--dry-run", "--json"],
    {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    },
  );

  if (packed.error !== undefined) throw packed.error;
  if (packed.status !== 0) {
    const error = new Error(`pnpm pack failed with exit code ${packed.status ?? 1}.`);
    error.cause = packed.stderr.trim();
    throw error;
  }

  const manifest = parsePackManifest(packed.stdout);
  return inspectPackManifest(packageJson, manifest);
}
