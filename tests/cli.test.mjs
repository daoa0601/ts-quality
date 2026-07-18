import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const cli = path.join(root, "bin/ts-quality.mjs");

test("CLI returns a concise failure for an unknown command", () => {
  const result = spawnSync(process.execPath, [cli, "unknown"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /^Unknown command: unknown/u);
  assert.equal(result.stdout, "");
});

test("CLI help and version are successful", () => {
  const help = spawnSync(process.execPath, [cli, "--help"], { cwd: root, encoding: "utf8" });
  const version = spawnSync(process.execPath, [cli, "--version"], { cwd: root, encoding: "utf8" });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /^Usage: ts-quality/u);
  assert.equal(version.status, 0);
  assert.equal(version.stdout.trim(), "0.1.0");
});
