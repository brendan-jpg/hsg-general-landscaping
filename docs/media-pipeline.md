# Media Pipeline (Managed Uploads)

This project now supports a server-side managed media upload pipeline for images:

- stores the original upload
- generates optimized delivery variants (`avif`, `webp`, fallback `jpeg/png`)
- stores a JSON metadata sidecar (`asset-meta.json`)
- inserts a `media` row pointing at the canonical delivery URL

## Upload Flow

- Client component: `src/components/backend/MediaLibraryManager.tsx`
- API route: `src/app/api/media/upload/route.ts`
- Processing utility: `src/lib/media/image-pipeline.ts`

`MediaLibraryManager` uploads selected files to `/api/media/upload` as `multipart/form-data`.

## Storage Layout

Each uploaded asset is stored under a managed prefix:

`{businessId}/assets/{assetKey}/`

Examples inside a prefix:

- original file (`*-original.jpg`)
- generated variants (`*-768w.webp`, `*-1600w.avif`, etc.)
- `asset-meta.json`

The `media.folder` column stores the prefix so deletion can remove all related files.

## Roles (Image Defaults)

The server processor supports image roles:

- `hero`
- `logo`
- `card`
- `content`
- `gallery`
- `avatar`
- `generic`

Roles control output widths and formats. Current upload UI sends `generic`; add role-specific uploads later if needed.

## Database Migration (Recommended)

A migration has been added to support long-term metadata persistence:

- `supabase/migrations/20260222090000_add_media_asset_metadata.sql`

After applying the migration, regenerate `src/lib/types/database.ts` before using the new columns in app code.
