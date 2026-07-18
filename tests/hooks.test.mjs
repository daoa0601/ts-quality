import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { installHooks } from "../lib/hooks.mjs";

function repository() {
  const root = mkdtempSync(path.join(tmpdir(), "ts-quality-hooks-"));
  execFileSync("git", ["init", "--quiet"], { cwd: root });
  return root;
}

test("hook installer writes managed executable hooks and protects unmanaged hooks", (t) => {
  const root = repository();
  t.after(() => rmSync(root, { force: true, recursive: true }));

  const result = installHooks({ cwd: root });
  const preCommit = path.join(result.hooksDirectory, "pre-commit");
  assert.match(readFileSync(preCommit, "utf8"), /managed-by: agentic-orch-quality/u);
  assert.notEqual(statSync(preCommit).mode & 0o100, 0);

  writeFileSync(preCommit, "#!/bin/sh\nexit 0\n");
  assert.throws(() => installHooks({ cwd: root }), /Refusing to overwrite unmanaged Git hook/u);
});

test("hook installer preflights both hooks before changing either", (t) => {
  const root = repository();
  t.after(() => rmSync(root, { force: true, recursive: true }));
  const rawHooksDirectory = execFileSync("git", ["rev-parse", "--git-path", "hooks"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  const hooksDirectory = path.resolve(root, rawHooksDirectory);
  const preCommit = path.join(hooksDirectory, "pre-commit");
  const prePush = path.join(hooksDirectory, "pre-push");
  writeFileSync(prePush, "#!/bin/sh\nexit 0\n");

  assert.throws(() => installHooks({ cwd: root }), /Refusing to overwrite unmanaged Git hook/u);
  assert.equal(existsSync(preCommit), false);
  assert.equal(readFileSync(prePush, "utf8"), "#!/bin/sh\nexit 0\n");
});

test("hook installer preserves and uses a repository-local core.hooksPath", (t) => {
  const root = repository();
  t.after(() => rmSync(root, { force: true, recursive: true }));
  mkdirSync(path.join(root, ".custom-hooks"));
  execFileSync("git", ["config", "--local", "core.hooksPath", ".custom-hooks"], { cwd: root });

  const result = installHooks({ cwd: root });
  assert.equal(result.hooksDirectory, path.join(result.root, ".custom-hooks"));
  assert.equal(
    execFileSync("git", ["config", "--local", "--get", "core.hooksPath"], {
      cwd: root,
      encoding: "utf8",
    }).trim(),
    ".custom-hooks",
  );
  assert.match(
    readFileSync(path.join(root, ".custom-hooks", "pre-commit"), "utf8"),
    /managed-by: agentic-orch-quality/u,
  );
});
