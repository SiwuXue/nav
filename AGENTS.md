# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains the Angular app code.
- `src/components/` holds reusable UI blocks (usually `index.component.ts|html|scss`).
- `src/view/` contains page/theme-level views (`light`, `side`, `sim`, `system`, etc.).
- `src/services/`, `src/utils/`, `src/store/`, and `src/types/` hold shared logic and types.
- `data/` stores runtime JSON content (`db.json`, `settings.json`, `tag.json`) prepared by scripts.
- `scripts/` contains TypeScript preprocessing/build helpers (`start.ts`, `build.ts`, `utils.ts`).
- `public/` provides static assets copied at build time; deployment output is `dist/browser`.

## Build, Test, and Development Commands
- `pnpm install` installs dependencies (CI uses pnpm 10 + Node 22).
- `npm run start` initializes data then starts dev server on `http://localhost:7002` (no live reload).
- `npm run start:reload` same as above, with live reload enabled.
- `npm run build` runs setup and creates a production build.
- `npm run build-gh-pages` builds for static hosting (GitHub Pages); CI also copies `dist/browser/index.html` to `dist/browser/404.html`.
- `npm run lint` runs `oxlint`.
- `npm run format` runs Prettier on `*.ts`, `*.cjs`, `*.mjs`.
- `npm run formatlint` runs format + lint together.

## Coding Style & Naming Conventions
- Use 2-space indentation, UTF-8, and trim trailing whitespace (`.editorconfig`).
- Prefer single quotes and no semicolons (`.prettierrc.json`).
- Keep component directories kebab-case, for example: `src/components/web-list/`.
- Keep TypeScript identifiers in `camelCase`, types/interfaces in `PascalCase`.

## Testing Guidelines
- Angular/Karma test target exists in `angular.json`, but this repository currently lacks `tsconfig.spec.json` and checked-in `*.spec.ts` files.
- For now, treat `npm run lint` + `npm run build` as the required validation baseline.
- When adding non-trivial logic, include focused tests and place them as `*.spec.ts` near the feature code.

## Commit & Pull Request Guidelines
- Recent history mostly follows Conventional Commit prefixes (`feat:`, `fix:`, `refactor:`). Use that style consistently.
- Keep commit messages descriptive (avoid numeric-only messages like `1`, `2`, `3`).
- PRs should include:
  - clear summary and rationale,
  - linked issue (if applicable),
  - UI screenshots/GIFs for visual changes,
  - confirmation that `npm run formatlint` and `npm run build` were run.
