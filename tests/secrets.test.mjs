import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { scanSecrets } from "../lib/secrets.mjs";

function repository() {
  const root = mkdtempSync(path.join(tmpdir(), "ts-quality-secrets-"));
  execFileSync("git", ["init", "--quiet"], { cwd: root });
  return root;
}

test("secret scan accepts placeholders and reports only metadata for real-looking values", (t) => {
  const root = repository();
  t.after(() => rmSync(root, { force: true, recursive: true }));

  writeFileSync(path.join(root, "safe.json"), '{"API_KEY":"your-key"}\n');
  execFileSync("git", ["add", "safe.json"], { cwd: root });
  const safe = scanSecrets({ cwd: root });
  assert.deepEqual(safe.findings, []);

  const token = ["sk", "-", "A".repeat(24)].join("");
  writeFileSync(path.join(root, "unsafe.json"), JSON.stringify({ API_KEY: token }));
  writeFileSync(path.join(root, ".env"), "EXAMPLE=true\n");

  const unsafe = scanSecrets({ cwd: root });
  assert.ok(unsafe.findings.some((finding) => finding.includes("OpenAI-style secret token")));
  assert.ok(
    unsafe.findings.some((finding) => finding.includes("non-placeholder secret assignment")),
  );
  assert.ok(unsafe.findings.some((finding) => finding.startsWith(".env:1:")));
  assert.ok(unsafe.findings.every((finding) => !finding.includes(token)));
});

test("secret scan inspects the staged blob when the worktree copy is safe", (t) => {
  const root = repository();
  t.after(() => rmSync(root, { force: true, recursive: true }));
  const token = ["sk", "-", "B".repeat(24)].join("");

  writeFileSync(path.join(root, "partial.json"), JSON.stringify({ API_KEY: token }));
  execFileSync("git", ["add", "partial.json"], { cwd: root });
  writeFileSync(path.join(root, "partial.json"), '{"API_KEY":"your-key"}\n');

  const result = scanSecrets({ cwd: root });
  assert.ok(result.findings.some((finding) => finding.includes("OpenAI-style secret token")));
  assert.ok(result.findings.every((finding) => !finding.includes(token)));
});

test("secret scan does not follow symlinks and fails closed on oversized text", (t) => {
  const root = repository();
  const outside = mkdtempSync(path.join(tmpdir(), "ts-quality-outside-"));
  t.after(() => rmSync(root, { force: true, recursive: true }));
  t.after(() => rmSync(outside, { force: true, recursive: true }));
  const token = ["sk", "-", "C".repeat(24)].join("");

  writeFileSync(path.join(outside, "host-secret.txt"), token);
  symlinkSync(path.join(outside, "host-secret.txt"), path.join(root, "external-link"));
  execFileSync("git", ["add", "external-link"], { cwd: root });

  const symlinkResult = scanSecrets({ cwd: root });
  assert.deepEqual(symlinkResult.findings, []);

  writeFileSync(path.join(root, "large.txt"), "x".repeat(64));
  const boundedResult = scanSecrets({ cwd: root, maxFileBytes: 32 });
  assert.ok(
    boundedResult.findings.some((finding) => finding.includes("32-byte secret-scan limit")),
  );
});
