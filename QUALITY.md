# TypeScript quality module gates

This private local module pins pnpm 11.13.1 and has no runtime dependencies. TypeScript verifies the
declaration and preset contract; `.mjs`, declarations, JSON presets, documentation, and hook
templates are shipped directly.

| Command | Purpose |
| --- | --- |
| `pnpm test` | Deterministic CLI, scanner, manifest, hook, and preset tests. |
| `pnpm typecheck` | Strict consumer fixture against the exported declarations. |
| `pnpm pack:check` | Inspect the real pack manifest and verify every export and binary. |
| `pnpm check` | Tests plus the strict consumer type check. |

Run `pnpm check` and `pnpm pack:check` after changes. Packing is a local clean-room boundary test,
not a publication step.

Agent Blocks, Drone, Nexus, and Templar consume this module through `workspace:*` and sibling
`link:../ts-quality` lock entries. The local `preinstall` bootstrap remains in each consumer because
an external development dependency is not available at that lifecycle point.

The reusable workflow is reference infrastructure rather than a cross-repository dependency. A
relative reusable workflow cannot cross the independent Git repository boundaries in this folder,
so consumers retain their own pinned Actions workflows and copy reviewed improvements when useful.
