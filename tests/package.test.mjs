import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { accessSync, constants, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

function exportedTargets(value) {
  if (typeof value === "string") return [value];
  if (value === null || typeof value !== "object") return [];
  return Object.values(value).flatMap(exportedTargets);
}

test("CLI is directly executable without a build step", () => {
  const output = execFileSync(process.execPath, ["bin/ts-quality.mjs", "--version"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(output.trim(), "0.1.0");
});

test("published JSON presets are valid and path-independent", () => {
  const nodeConfig = JSON.parse(
    readFileSync(path.join(root, "presets/tsconfig.node.json"), "utf8"),
  );
  const buildConfig = JSON.parse(
    readFileSync(path.join(root, "presets/tsconfig.build.json"), "utf8"),
  );
  assert.equal(nodeConfig.compilerOptions.strict, true);
  assert.equal(buildConfig.compilerOptions.noEmit, false);
  assert.equal(buildConfig.compilerOptions.rootDir, undefined);
  assert.equal(buildConfig.compilerOptions.outDir, undefined);
});

test("every declared bin and export target exists in the source package", () => {
  const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  const targets = [
    packageJson.main,
    packageJson.types,
    ...Object.values(packageJson.bin),
    ...exportedTargets(packageJson.exports),
  ];
  for (const target of new Set(targets)) {
    assert.equal(typeof target, "string");
    accessSync(path.resolve(root, target), constants.R_OK);
  }
  accessSync(path.resolve(root, packageJson.bin["ts-quality"]), constants.X_OK);
});
