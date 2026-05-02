# HSG

Primary app repo for the HSG platform and frontend site.

## What This Repo Owns

- Next.js app routes and app-specific page behavior
- data loading and query assembly
- theme CSS and frontend styling
- backend dashboard/UI code
- the vendored `@brendan-jpg/hsg-sections` tarball used at build/deploy time

If a change affects reusable section schema, template slots, shared section rendering, or section editor labels, make that change in `hsg-sections` first.

## Sections System

`HSG` consumes `@brendan-jpg/hsg-sections` from a tarball committed in `vendor/`.

Current package path:

- `@brendan-jpg/hsg-sections: file:./vendor/brendan-jpg-hsg-sections-0.2.56.tgz`

See [SECTIONS_RELEASE_FLOW.md](SECTIONS_RELEASE_FLOW.md) for the current update workflow.

## Getting Started

```bash
npm install
```

Run the app locally:

```bash
npm run dev
```

Run a production build check:

```bash
npm run build
```

Open [http://localhost:3000](http://localhost:3000).

## Working With `hsg-sections`

1. Make reusable section changes in `hsg-sections`.
2. Run `npm run typecheck` there.
3. Bump the package version there.
4. Pack a new tarball into `HSG/vendor/`.
5. Update `HSG/package.json` to the new tarball.
6. Run `npm install` and `npm run build` here.

Do not edit `node_modules` as a source of truth.
Do not reuse the same tarball version/filename after changing package contents. Release a new versioned tarball so `package-lock.json`, local installs, and Vercel installs all pick up a new package identity.

## Data Model Notes

- The active area content table in this app is `areas`, not `service_areas`.
- Public area routes are `/service-areas/*`, but the underlying content/query layer now reads from `areas`.
- When changing tenant content directly in Supabase, verify the current app table name in `src/lib/content/queries.ts` or `src/lib/actions/index.ts` first.

## Hero Layout Variants

Shared hero sections can now expose a `Layout` dropdown from `hsg-sections`.

Current shared variants:

- `Home Hero`: `default`, `split`, `feature`
- `Service Hero`: `default`, `split`, `feature`

Use `HSG` theme CSS to style those variants per tenant. If a new reusable markup pattern is needed, add it in `hsg-sections` first and then style it here.

## Frontend Theme Files

- Each tenant frontend theme lives in one CSS file under `src/styles/frontend/themes/`.
- Theme files are authored with a single top-level scope like `.site[data-theme='client-hsg-theme'] { ... }`.
- Nested selectors inside that wrapper are allowed and preferred for tenant theme authoring.
- `src/lib/frontend/themeCss.ts` compiles nested theme CSS into flat CSS before `/theme.css` serves it, so tenant styles stay isolated without repeating the full scope on every selector.
- Keep each tenant's frontend styling inside its own theme file rather than spreading tenant-specific CSS across multiple files.

## Related Docs

- [SECTIONS_RELEASE_FLOW.md](SECTIONS_RELEASE_FLOW.md)
- [docs/media-pipeline.md](docs/media-pipeline.md)
