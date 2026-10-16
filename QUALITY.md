# TypeScript quality module gates

This private local module pins pnpm 11.13.1 and has no runtime dependencies. TypeScript verifies the
declaration and preset contract; `.mjs`, declarations, JSON presets, and hook templates are used
directly from the source tree, so there is no build step.

| Command          | Purpose                                                                      |
| ---------------- | ---------------------------------------------------------------------------- |
| `pnpm test`      | Deterministic CLI, scanner, manifest, hook, and preset tests.                |
| `pnpm typecheck` | Strict consumer fixture against the exported declarations.                   |
| `pnpm check`     | Tests plus the strict consumer type check. Run it after every change.        |

The pnpm version is enforced by `packageManager`, `engines.pnpm`, and `pmOnFail: error` with
`engineStrict` in `pnpm-workspace.yaml`; there is no `preinstall` bootstrap script.
