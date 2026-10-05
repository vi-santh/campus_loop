---
name: npm workspace migration
description: Lessons from moving this workspace from pnpm to npm.
---

When generating an npm lockfile after a pnpm install, remove generated `node_modules` directories at the repository root and inside each workspace first. Pnpm's linked workspace dependency trees can leave versionless entries that make npm's resolver fail.

**Why:** npm lockfile generation in this workspace failed against the stale pnpm layout; it succeeded after clearing only those generated dependency directories.

**How to apply:** On future package-manager migrations, regenerate the lockfile from package manifests with no old package-manager `node_modules` trees present. Do not remove project source files.
