import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import path from "node:path";

const maxBuffer = 16 * 1024 * 1024;

export function runGit(args, { cwd, stdio = "pipe" } = {}) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer,
    stdio,
  });
}

export function runGitBuffer(args, { cwd, maxBuffer: bufferLimit = maxBuffer } = {}) {
  return execFileSync("git", args, {
    cwd,
    encoding: "buffer",
    maxBuffer: bufferLimit,
    stdio: "pipe",
  });
}

export function resolveRepositoryRoot(cwd = process.cwd()) {
  return realpathSync(path.resolve(runGit(["rev-parse", "--show-toplevel"], { cwd }).trim()));
}
