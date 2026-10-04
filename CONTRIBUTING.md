# Contributing to YT Zero

This is a personal fork of [Pelski/ytzero](https://github.com/Pelski/ytzero),
shared as is. It is currently a personal fork: issues and pull requests may
not be read, and for now nothing is promised (no support, review, merging or
releases). That may change. You are free to fork it and carry it on yourself. This guide is
kept for anyone doing that, and for the fork's own development.

## Project layout

```text
app/      # Backend — Hono on Bun, TypeScript (runtime, no build step)
ui/       # Frontend — React + Vite + TypeScript
scripts/  # setup / dev / build / start helpers
data/     # Local runtime data (SQLite + image cache), gitignored
```

The backend is TypeScript executed directly by Bun. The frontend is built with
Vite, and in production the backend serves the static files from `ui/dist`.

## Prerequisites

- [Bun](https://bun.sh) (the only required toolchain — no Node.js needed)

## Getting started

```bash
# Install dependencies for both app/ and ui/
bun run setup

# Run backend (:3001) and frontend (:5173) together with hot reload
bun run dev
```

- UI dev server: <http://localhost:5173>
- API: <http://localhost:3001>

You can also run the halves separately with `bun run dev:app` and
`bun run dev:ui`.

To test a production-like build locally:

```bash
bun run build   # builds ui/dist
bun run start   # backend serves ui/dist on :3001
```

## Before you open a PR

Run the same checks CI runs, so nothing breaks after merge:

```bash
# Type-check both packages
cd app && bunx tsc --noEmit
cd ../ui && bunx tsc --noEmit

# Build the frontend
bun run build
```

Both packages use `strict` TypeScript — please keep the build type-clean.

## Database schema changes

The files in `CANONICAL_SCHEMA_FILES` in `app/src/databaseMigrations.ts`
describe the current schema for new installations. Any change to one must add
the next versioned entry to `app/src/databaseMigrations.ts`, with explicit
`sqlite` and `postgres` implementations and updated schema fingerprints. Never
add a new one-off startup migration to `db.ts`.

Run `bun run check:database-migrations` after changing the schema. The same
check is part of `check:validate` and CI, and rejects schema changes that do not
include migration paths for both supported database engines.

## Pull request workflow

If you carry the project on, changes go through a pull request:

1. Branch off `main` (e.g. `fix/live-detection`, `feat/playlist-import`).
2. Make your change and keep commits focused.
3. Make sure type-checks and the build pass locally.
4. Open a PR against `main` with a clear description of *what* and *why*.

## Release versioning

This fork has no releases.

## Coding style

- Match the surrounding code — naming, structure, and comment density.
- Keep changes scoped; avoid unrelated refactors in the same PR.
- User-facing UI text is translated via `ui/src/i18n.tsx`. When you add new
  copy, provide a string for **every** language defined there (the `Language`
  type lists the currently supported locales) so no language falls back to a
  missing key.
- Use icons from `lucide-react` rather than emoji in the UI.

## License

By contributing, you agree that your contributions are licensed under the
project's **GNU Affero General Public License v3.0 only**
([`AGPL-3.0-only`](https://www.gnu.org/licenses/agpl-3.0.html)), the same
license as the rest of the project. See the full text in [LICENSE](LICENSE).
