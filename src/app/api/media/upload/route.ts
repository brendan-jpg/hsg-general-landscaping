import path from 'node:path';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { getCurrentDashboardBusinessId } from '@/lib/authz/dashboard';
import { getMediaRoleFromMetadata } from '@/lib/media/roles';
import { chooseCanonicalVariant, processImageUpload, type MediaImageRole } from '@/lib/media/image-pipeline';
import { validateFormUploadFile } from '@/lib/forms/uploadValidation';
import type { Json, Tables, TablesInsert } from '@/lib/types/database';

type Media = Tables<'media'>;

export const runtime = 'nodejs';

const VALID_ROLES: MediaImageRole[] = ['hero', 'logo', 'icon', 'card', 'content', 'gallery', 'avatar', 'graphic', 'generic'];

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, '-');
}

function inferFileType(file: File) {
  if (file.type && file.type !== 'application/octet-stream') return file.type;
  const extension = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() : '';
  if (extension === 'heic') return 'image/heic';
  if (extension === 'heif') return 'image/heif';
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'gif') return 'image/gif';
  if (extension === 'svg') return 'image/svg+xml';
  if (extension === 'pdf') return 'application/pdf';
  return 'application/octet-stream';
}

function isProcessableRasterImage(file: File) {
  const type = inferFileType(file);
  if (!type.startsWith('image/')) return false;
  if (type === 'image/svg+xml') return false;
  if (type === 'image/gif') return false;
  return true;
}

async function getAuthenticatedUploadContext() {
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) throw new Error(authError.message);
  if (!user) throw new Error('You must be signed in to upload media.');
  const businessId = await getCurrentDashboardBusinessId();
  if (!businessId) throw new Error('No business is associated with this user.');

  return {
    userId: user.id,
    businessId,
  };
}

async function uploadBuffer(
  bucket: string,
  objectPath: string,
  buffer: Buffer,
  contentType: string,
  options?: {
    upsert?: boolean;
    cacheControl?: string;
  }
) {
  const admin = createAdminClient();
  const { error } = await admin.storage.from(bucket).upload(objectPath, buffer, {
    upsert: options?.upsert ?? false,
    contentType,
    cacheControl: options?.cacheControl ?? '31536000',
  });
  if (error) throw new Error(error.message);
}

function getPublicUrl(bucket: string, objectPath: string) {
  const admin = createAdminClient();
  return admin.storage.from(bucket).getPublicUrl(objectPath).data.publicUrl;
}

function extForContentType(contentType: string) {
  switch (contentType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/avif':
      return 'avif';
    case 'image/svg+xml':
      return 'svg';
    case 'application/pdf':
      return 'pdf';
    default:
      return '';
  }
}

function getStorageObjectPathFromPublicUrl(fileUrl: string, bucket: string) {
  try {
    const url = new URL(fileUrl);
    const marker = `/storage/v1/object/public/${bucket}/`;
    const index = url.pathname.indexOf(marker);
    if (index === -1) return null;
    return decodeURIComponent(url.pathname.slice(index + marker.length));
  } catch {
    return null;
  }
}

async function removeExistingBusinessMediaByRole(businessId: string, bucket: string, role: 'logo' | 'icon') {
  const admin = createAdminClient();
  const { data: existingMedia, error: existingError } = await admin
    .from('media')
    .select('id, file_url, folder, storage_prefix, metadata')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (existingError) throw new Error(existingError.message);

  const existingWithRole = (existingMedia ?? []).filter((row) => getMediaRoleFromMetadata(row.metadata) === role);
  if (existingWithRole.length === 0) return;

  const explicitPaths = new Set<string>();
  for (const row of existingWithRole) {
    const prefix = row.storage_prefix || row.folder || null;
    if (prefix) {
      const { data: listed, error: listError } = await admin.storage.from(bucket).list(prefix, {
        limit: 200,
        sortBy: { column: 'name', order: 'asc' },
      });
      if (listError) throw new Error(listError.message);
      for (const entry of listed ?? []) {
        if (!entry.name) continue;
        explicitPaths.add(`${prefix}/${entry.name}`);
      }
    }

    const primaryPath = getStorageObjectPathFromPublicUrl(row.file_url, bucket);
    if (primaryPath) explicitPaths.add(primaryPath);
  }

  if (explicitPaths.size > 0) {
    const { error: storageError } = await admin.storage.from(bucket).remove([...explicitPaths]);
    if (storageError) throw new Error(storageError.message);
  }

  const ids = existingWithRole.map((row) => row.id);
  const { error: deleteError } = await admin.from('media').delete().in('id', ids);
  if (deleteError) throw new Error(deleteError.message);
}

async function insertMediaRow(row: TablesInsert<'media'>) {
  const admin = createAdminClient();
  const { data, error } = await admin.from('media').insert(row).select('*').single();
  if (error) throw new Error(error.message);
  return data as Media;
}

async function syncBusinessBrandAssetUrl(
  businessId: string,
  role: 'logo' | 'icon',
  fileUrl: string | null,
) {
  const admin = createAdminClient();

  if (role === 'logo') {
    const { error } = await admin.from('businesses').update({ logo_url: fileUrl }).eq('id', businessId);
    if (error) throw new Error(error.message);
    return;
  }

  const { data: business, error: businessError } = await admin
    .from('businesses')
    .select('settings')
    .eq('id', businessId)
    .maybeSingle();
  if (businessError) throw new Error(businessError.message);

  const settings =
    business?.settings && typeof business.settings === 'object' && !Array.isArray(business.settings)
      ? { ...(business.settings as Record<string, unknown>) }
      : {};
  settings.favicon_url = fileUrl;

  const { error: updateError } = await admin.from('businesses').update({ settings: settings as Json }).eq('id', businessId);
  if (updateError) throw new Error(updateError.message);
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files = formData
      .getAll('files')
      .filter((value): value is File => value instanceof File);

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files uploaded.' }, { status: 400 });
    }

    const roleValue = formData.get('role');
    const requestedRole = typeof roleValue === 'string' ? roleValue : 'generic';
    const role: MediaImageRole = VALID_ROLES.includes(requestedRole as MediaImageRole)
      ? (requestedRole as MediaImageRole)
      : 'generic';
    const contactIdValue = formData.get('contact_id');
    const contactId = typeof contactIdValue === 'string' ? contactIdValue.trim() : '';
    if ((role === 'logo' || role === 'icon') && files.length > 1) {
      return NextResponse.json({ error: `${role === 'logo' ? 'Logo' : 'Icon'} uploads support one file at a time.` }, { status: 400 });
    }

    const { userId, businessId } = await getAuthenticatedUploadContext();
    const admin = createAdminClient();
    const bucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || 'media';
    if (role === 'logo' || role === 'icon') {
      await removeExistingBusinessMediaByRole(businessId, bucket, role);
    }
    if (contactId) {
      const { data: contact, error: contactError } = await admin
        .from('contacts')
        .select('id')
        .eq('id', contactId)
        .eq('business_id', businessId)
        .maybeSingle();
      if (contactError) throw new Error(contactError.message);
      if (!contact) {
        return NextResponse.json({ error: 'Contact not found.' }, { status: 404 });
      }
    }

    const insertedItems: Media[] = [];
    const failedFiles: string[] = [];

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const assetKey = `${Date.now()}-${index}-${crypto.randomUUID()}`;
      const baseName = sanitizeFileName(path.parse(file.name).name) || 'file';
      const assetPrefix = `${businessId}/assets/${assetKey}`;
      const isPrivateContactUpload = Boolean(contactId);

      try {
        const contentType = isPrivateContactUpload
          ? validateFormUploadFile(file).contentType
          : inferFileType(file);
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        if (!isPrivateContactUpload && isProcessableRasterImage(file)) {
          const processed = await processImageUpload({
            buffer,
            fileName: file.name,
            contentType,
            role,
          });

          const originalExt = path.extname(file.name).replace(/^\./, '') || extForContentType(contentType) || 'bin';
          const originalObjectPath = `${assetPrefix}/${baseName}-original.${originalExt}`;
          await uploadBuffer(bucket, originalObjectPath, buffer, contentType);

          for (const variant of processed.variants) {
            const variantPath = `${assetPrefix}/${variant.fileName}`;
            await uploadBuffer(bucket, variantPath, variant.buffer, variant.contentType);
          }

          const canonical = chooseCanonicalVariant(processed);
          const canonicalObjectPath = `${assetPrefix}/${canonical.fileName}`;
          const originalPublicUrl = getPublicUrl(bucket, originalObjectPath);
          const canonicalPublicUrl = getPublicUrl(bucket, canonicalObjectPath);

          const metadataPayload = {
            version: 1,
            kind: 'managed-image',
            role,
            original: {
              fileName: file.name,
              contentType,
              bytes: file.size,
              width: processed.width,
              height: processed.height,
              url: originalPublicUrl,
              objectPath: originalObjectPath,
              sourceFormat: processed.sourceFormat,
            },
            display: {
              url: canonicalPublicUrl,
              objectPath: canonicalObjectPath,
            },
            blurDataUrl: processed.blurDataUrl,
            variants: processed.variants.map((variant) => ({
              format: variant.format,
              width: variant.width,
              height: variant.height,
              bytes: variant.bytes,
              contentType: variant.contentType,
              fileName: variant.fileName,
              objectPath: `${assetPrefix}/${variant.fileName}`,
              url: getPublicUrl(bucket, `${assetPrefix}/${variant.fileName}`),
            })),
          };

          const inserted = await insertMediaRow({
            business_id: businessId,
            file_name: file.name,
            file_type: canonical.contentType,
            file_size: canonical.bytes,
            file_url: canonicalPublicUrl,
            uploaded_by: userId,
            alt_text: null,
            width: canonical.width,
            height: canonical.height,
            folder: assetPrefix,
            original_file_url: originalPublicUrl,
            blur_data_url: processed.blurDataUrl,
            storage_prefix: assetPrefix,
            variants: metadataPayload.variants,
            metadata: {
              version: metadataPayload.version,
              kind: metadataPayload.kind,
              role: metadataPayload.role,
              sourceFormat: processed.sourceFormat,
              hasAlpha: processed.hasAlpha,
              originalWidth: processed.width,
              originalHeight: processed.height,
              ...(contactId
                ? {
                    related_entity_type: 'contact',
                    related_entity_id: contactId,
                  }
                : {}),
            },
          });

          insertedItems.push(inserted);
          continue;
        }

        const originalExt = path.extname(file.name).replace(/^\./, '') || extForContentType(contentType) || 'bin';
        const objectPath = `${assetPrefix}/${baseName}.${originalExt}`;
        await uploadBuffer(bucket, objectPath, buffer, contentType);
        const rawFileReference = isPrivateContactUpload ? objectPath : getPublicUrl(bucket, objectPath);

        const metadataPayload = {
          version: 1,
          kind: isPrivateContactUpload ? 'private-contact-file' : 'raw-file',
          original: {
            fileName: file.name,
            contentType,
            bytes: file.size,
            url: rawFileReference,
            objectPath,
          },
        };

        const inserted = await insertMediaRow({
          business_id: businessId,
          file_name: file.name,
          file_type: contentType,
          file_size: file.size,
          file_url: rawFileReference,
          uploaded_by: userId,
          alt_text: null,
          width: null,
          height: null,
          folder: assetPrefix,
          original_file_url: rawFileReference,
          blur_data_url: null,
          storage_prefix: assetPrefix,
          variants: null,
          metadata: {
            version: metadataPayload.version,
            kind: metadataPayload.kind,
            role,
            ...(isPrivateContactUpload
              ? {
                  is_private: true,
                  storage_object_path: objectPath,
                }
              : {}),
            ...(contactId
              ? {
                  related_entity_type: 'contact',
                  related_entity_id: contactId,
                }
              : {}),
          },
        });
        insertedItems.push(inserted);
      } catch (uploadError) {
        console.error('Media upload failed for file', file.name, uploadError);
        failedFiles.push(file.name);
      }
    }

    if ((role === 'logo' || role === 'icon') && insertedItems[0]) {
      await syncBusinessBrandAssetUrl(businessId, role, insertedItems[0].file_url);
    }

    return NextResponse.json({
      items: insertedItems,
      failedFiles,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
