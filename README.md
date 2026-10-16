# @agentic-orch/ts-quality

Shared, runtime-dependency-free quality tooling for the TypeScript repositories in this workspace.
The package ships executable JavaScript and declarations directly, so linking it is sufficient;
consumers do not need to compile it first.

Sibling repositories link it as `"@agentic-orch/ts-quality": "workspace:*"` with `../ts-quality`
listed in their own `pnpm-workspace.yaml`. Required siblings and the shared layout are described in
the catalog README.

## Repository commands

Keep the existing repository-level command surface and delegate its shared mechanics:

```json
{
  "scripts": {
    "hooks:install": "ts-quality hooks",
    "secrets:scan": "ts-quality secrets"
  }
}
```

Every command accepts `--root <directory>` and otherwise operates on the current directory.
Long-form aliases (`install-hooks` and `scan-secrets`) are also supported.

The pnpm version is enforced natively: `packageManager` pins an exact pnpm, and
`pmOnFail: error` plus `engineStrict` in `pnpm-workspace.yaml` reject a mismatched pnpm.

### Secret scanning

`ts-quality secrets` inspects both staged Git blobs and their current working-tree copies, plus
unignored untracked files. Scanning both views prevents a safe unstaged edit from hiding a secret
that is about to be committed without ignoring an unstaged secret during an ordinary quality run.
Symlinks are inspected as links and never followed, and bounded reads fail closed for oversized
text. The scanner detects secret-bearing filenames, private-key material, common provider-token
shapes, and non-placeholder secret assignments in configuration files. Findings contain only
escaped file, line, and category metadata; the matched value is never printed.

This is a high-confidence local guardrail, not a replacement for host-level secret scanning or
credential rotation.

### Managed Git hooks

`ts-quality hooks` copies the package-owned pre-commit and pre-push templates into the active Git
hooks directory. The hooks run `pnpm quality:quick` and `pnpm quality:offline`, respectively. The
installer upgrades hooks carrying the `agentic-orch-quality` marker and refuses to overwrite an
unmanaged hook. It preflights both destinations before changing either. With no `core.hooksPath`,
it uses `git rev-parse --git-path hooks`. If `core.hooksPath` is set in the repository's local Git
config, it uses that configured path without changing the setting; a relative value is resolved
from the worktree root. More precisely, any effective `core.hooksPath` without a value in
repository-local (`--local`) config is rejected, including values from global, system, worktree, or
another non-local scope. “Local” here describes the Git config scope, not a guarantee that an
absolute or `..` path is physically beneath the repository.

Run the installer from the repository root. Once a repository delegates to this command, its
copied `.githooks` directory and local installer script can be removed.

## Shared configuration

For a Node.js project, extend the strict baseline and retain only project-owned paths and types:

```json
{
  "extends": "@agentic-orch/ts-quality/tsconfig/node.json",
  "compilerOptions": {
    "types": ["node"]
  },
  "include": ["src/**/*.ts", "tests/**/*.ts", "vitest.config.ts"]
}
```

The optional `@agentic-orch/ts-quality/tsconfig/build.json` preset adds declaration and source maps while
enabling emit. Consumers must still declare `rootDir`, `outDir`, `include`, and `exclude`, because
relative paths in an inherited config resolve from the package that defines them.

Prettier can load the ESM preset through `package.json`:

```json
{
  "prettier": "@agentic-orch/ts-quality/prettier"
}
```

The stable JSON form is also exported as `@agentic-orch/ts-quality/prettier.json` for tools that cannot
load ESM configurations.

The package root also exports the scanner and hook installer as a typed ESM API. The CLI remains
the preferred integration point for repository scripts because it provides a stable exit-code and
diagnostic contract.
