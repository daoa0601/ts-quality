import assert from "node:assert/strict";
import test from "node:test";

import { inspectPackManifest, parsePackManifest } from "../lib/pack.mjs";

const packageJson = {
  bin: { tool: "./bin/tool.mjs" },
  exports: {
    ".": "./lib/index.mjs",
    "./config": "./presets/config.json",
  },
  main: "./lib/index.mjs",
  scripts: { preinstall: "node scripts/require-pnpm.mjs" },
};

const validFiles = [
  "package.json",
  "README.md",
  "bin/tool.mjs",
  "lib/index.mjs",
  "presets/config.json",
  "scripts/require-pnpm.mjs",
].map((path) => ({ path }));

test("parsePackManifest accepts pnpm array output", () => {
  const manifest = parsePackManifest(JSON.stringify([{ files: validFiles }]));
  assert.equal(manifest.files.length, validFiles.length);
});

test("package inspection checks declared entries and forbidden content", () => {
  const valid = inspectPackManifest(packageJson, { files: validFiles });
  assert.deepEqual(valid.failures, []);

  const invalid = inspectPackManifest(packageJson, {
    files: [
      ...validFiles.filter((entry) => entry.path !== "lib/index.mjs"),
      { path: "src/key.pem" },
    ],
  });
  assert.ok(invalid.failures.includes("missing main entry: lib/index.mjs"));
  assert.ok(invalid.failures.includes("missing export..: lib/index.mjs"));
  assert.ok(invalid.failures.includes("forbidden package entry: src/key.pem"));
  assert.ok(invalid.failures.includes("secret-bearing package entry: src/key.pem"));
});

test("package inspection supports additive repository policy", () => {
  const configured = {
    ...packageJson,
    tsQuality: {
      pack: {
        forbiddenPrefixes: ["native/worker/Tests/"],
        requiredFiles: ["SECURITY.md"],
      },
    },
  };
  const result = inspectPackManifest(configured, {
    files: [...validFiles, { path: "native/worker/Tests/example.swift" }],
  });
  assert.ok(result.failures.includes("forbidden package entry: native/worker/Tests/example.swift"));
  assert.ok(result.failures.includes("missing configured file: SECURITY.md"));
});
