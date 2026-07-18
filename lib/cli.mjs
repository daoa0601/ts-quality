import { readFileSync } from "node:fs";
import path from "node:path";

import { installHooks } from "./hooks.mjs";
import { checkPack } from "./pack.mjs";
import { scanSecrets } from "./secrets.mjs";

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

const usage = `Usage: ts-quality <command> [--root <directory>]

Commands:
  secrets, scan-secrets  Scan tracked and unignored repository files for secrets
  pack, check-pack       Validate the pnpm dry-run package manifest
  hooks, install-hooks   Install managed pre-commit and pre-push hooks

Options:
  --root <directory>     Repository or package root (defaults to the current directory)
  --help                 Show this help
  --version              Show the package version`;

function parseArguments(args) {
  let command;
  let root = process.cwd();

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--help" || argument === "-h") return { help: true, root };
    if (argument === "--version" || argument === "-v") return { root, version: true };
    if (argument === "--root") {
      const value = args[index + 1];
      if (value === undefined) throw new Error("--root requires a directory.");
      root = path.resolve(value);
      index += 1;
      continue;
    }
    if (argument.startsWith("-")) throw new Error(`Unknown option: ${argument}`);
    if (command !== undefined) throw new Error(`Unexpected argument: ${argument}`);
    command = argument;
  }

  return { command, root };
}

function writeFailures(title, failures) {
  console.error(title);
  for (const failure of failures) console.error(`- ${failure}`);
}

export async function main(args = process.argv.slice(2)) {
  try {
    const parsed = parseArguments(args);
    if (parsed.help === true) {
      console.log(usage);
      return 0;
    }
    if (parsed.version === true) {
      console.log(packageJson.version);
      return 0;
    }
    if (parsed.command === undefined) {
      console.log(usage);
      return 1;
    }

    if (parsed.command === "secrets" || parsed.command === "scan-secrets") {
      const result = scanSecrets({ cwd: parsed.root });
      if (result.findings.length > 0) {
        writeFailures("Secret scan failed:", result.findings);
        return 1;
      }
      console.log(`Secret scan passed (${result.filesInspected} repository files inspected).`);
      return 0;
    }

    if (parsed.command === "pack" || parsed.command === "check-pack") {
      const result = checkPack({ cwd: parsed.root });
      if (result.failures.length > 0) {
        writeFailures("Package manifest check failed:", result.failures);
        return 1;
      }
      console.log(
        `Package manifest check passed (${result.files.size} files, no forbidden entries).`,
      );
      return 0;
    }

    if (parsed.command === "hooks" || parsed.command === "install-hooks") {
      const result = installHooks({ cwd: parsed.root });
      console.log(`Installed managed pre-commit and pre-push hooks in ${result.hooksDirectory}.`);
      return 0;
    }

    console.error(`Unknown command: ${parsed.command}\n\n${usage}`);
    return 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}
