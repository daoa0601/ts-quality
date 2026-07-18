# Reusing the TypeScript quality workflow

`.github/workflows/reusable-quality.yml` centralizes the repeated Node matrix, frozen pnpm install,
offline gates, and dependency trust gates. It is a reference for this local collection, not a
published cross-repository service.

The projects in the parent folder are independent Git repositories. GitHub Actions cannot call a
relative workflow from a sibling checkout, and there is no standalone immutable remote for this
module. For now:

1. keep application-specific workflows in each repository;
2. copy a reviewed change from the reference workflow when it removes real duplication;
3. retain native, integration, coverage, and sibling-setup jobs owned by the consumer;
4. pin third-party actions and do not pass secrets to quality-only jobs.

If the repositories are later consolidated or this workflow gains a reviewed immutable remote,
consumers can switch the repeated TypeScript jobs to a callable workflow. That future deployment
choice is independent of npm publication.
