# Sections System Flow

## Current Setup

- `hsg-sections` is the source-of-truth repo for the reusable sections system.
- `HSG` does not install `hsg-sections` directly from GitHub or from `node_modules` edits.
- `HSG` installs a packaged snapshot of `hsg-sections` from a tarball committed in `vendor/`.
- Vercel deploys `HSG` using that committed tarball, which avoids private repo auth problems during install.

Current package wiring in `HSG`:

- `package.json` -> `@brendan-jpg/hsg-sections: file:./vendor/brendan-jpg-hsg-sections-0.2.56.tgz`

## Repo Responsibilities

### `hsg-sections`

Owns:

- section schema, labels, defaults, and editor catalog
- template definitions and slot structure
- template renderer logic
- package-owned section UI/components

Main files:

- `src/templatePages.ts`
- `src/template-renderer/renderedSection.tsx`
- `src/TemplatePageRenderer.tsx`
- `src/frontend/*`

### `HSG`

Owns:

- app routes and data fetching
- theme CSS and app-specific styling
- the tarball snapshot consumed at deploy time
- a small compatibility layer for legacy template keys

Main files:

- `src/app/(frontend)/*`
- `src/components/integrations/TemplatePageRenderer.tsx`
- `src/styles/frontend/themes/*`
- `src/lib/sections/templatePages.ts`

Theme CSS note:

- each tenant frontend theme should live in a single file in `src/styles/frontend/themes/`
- tenant theme files are authored with one top-level wrapper such as `.site[data-theme='client-general-landscaping-theme'] { ... }`
- nested selectors are preferred inside that wrapper
- `src/lib/frontend/themeCss.ts` compiles nested theme CSS to flat CSS before `/theme.css` serves it

## Source Of Truth Rules

- If the change is about section schema, section block options, template slots, or reusable section rendering, edit `hsg-sections`.
- If the change is about app routing, page data loading, or theme styling, edit `HSG`.
- Do not edit `node_modules`.
- Do not recreate a second source copy like `vendor/hsg-sections/`.
- Do not assume pushing `hsg-sections` updates `HSG` automatically.
- Do not replace the contents of an existing tarball version in place and assume deploys will notice. Bump the package version and use a new tarball filename.

## How Changes Move From `hsg-sections` To `HSG`

1. Make the reusable change in `hsg-sections`.
2. Run `npm run typecheck` in `hsg-sections`.
3. Bump the version in `hsg-sections/package.json`.
4. Commit and push `hsg-sections`.
5. Pack a tarball from `hsg-sections` into `HSG/vendor/`.
6. Update the tarball filename in `HSG/package.json`.
7. Remove the old tarball from `HSG/vendor/`.
8. Run `npm install` in `HSG`.
9. Run `npm run build` in `HSG`.
10. Commit and push `HSG`.

Nothing is live in the app until the `HSG` repo has been updated to the new tarball and deployed.
Nothing is reliably updated until the package version, tarball filename, and lockfile all move together.

## Release Commands

### In `hsg-sections`

```powershell
cmd /c npm run typecheck
git add -A
git commit -m "Describe the reusable section change"
git push origin main
cmd /c npm pack --pack-destination ..\HSG\vendor
```

This creates a tarball like:

- `vendor/brendan-jpg-hsg-sections-0.2.56.tgz`

### In `HSG`

If the tarball version changed:

1. Remove the previous tarball from `vendor/`.
2. Update the tarball path in `package.json`.

Then run:

```powershell
cmd /c npm install
cmd /c npm run build
git add -A
git commit -m "Update hsg-sections package"
git push origin main
```

## Current Compatibility Layer

`HSG` still contains a thin adapter here:

- `src/lib/sections/templatePages.ts`

Its job is narrow:

- normalize legacy template keys:
  - `area-page-v1` -> `area-content-v1`
  - `service-page-v1` -> `service-content-v1`
  - `blog-post-page-v1` -> `blog-post-content-v1`
- normalize a couple of legacy archive grid type aliases:
  - `service_archive_grid_section` -> `service_grid_section`
  - `area_archive_grid_section` -> `area_grid_section`
  - `service_area_grid_section` -> `area_grid_section`

It should not become a second schema system.

## Current Data Model Note

- Area page content now lives in the `areas` table.
- `service_areas` is legacy terminology in older docs/exports and should not be assumed to be the live app table.
- Public URLs still use `/service-areas/*`.

## Section Editing Guidance

Edit `hsg-sections` for:

- adding/removing a block from the editor dropdown
- renaming a section type label
- adding a reusable `Layout` / `variant` selector to a shared block
- changing default section data
- changing archive hero behavior
- changing archive grid rendering
- changing related section rendering

Edit `HSG` for:

- changing page query logic
- changing which context values are passed into the renderer
- adjusting theme styling
- styling shared layout variants per tenant
- updating route-level fallback behavior

If a change feels like it should affect every template/page that uses the same section type, it almost certainly belongs in `hsg-sections`.

## Shared Variant Pattern

When a section needs a few reusable markup options, keep one shared section type in `hsg-sections` and add a `Layout` / `variant` select rather than creating tenant-specific block types.

Current examples:

- `Home Hero`: `default`, `split`, `feature`
- `Service Hero`: `default`, `split`, `feature`

`HSG` should own the tenant theme CSS for those variants, while `hsg-sections` owns the reusable schema and markup branches.

## What Not To Do

- Do not edit package files in `node_modules`.
- Do not push only `hsg-sections` and expect the app to change.
- Do not keep multiple tarball versions around in `HSG/vendor/` longer than needed.
- Do not keep the same version number while changing tarball contents.
- Do not revive the old GitHub Packages flow unless you intentionally reintroduce publish infrastructure.
- Do not put reusable section logic back into scattered app overrides unless there is a clear app-only reason.
