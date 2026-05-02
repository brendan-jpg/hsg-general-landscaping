import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { UploadedFormFileValue } from '@/lib/forms/uploads';
import { validateFormUploadFile } from '@/lib/forms/uploadValidation';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const businessId = ((formData.get('business_id') as string) || '').trim();
    const file = formData.get('file');

    if (!businessId) {
      return NextResponse.json({ error: 'Business context is required.' }, { status: 400 });
    }

    if (!(file instanceof File) || file.size <= 0 || !file.name.trim()) {
      return NextResponse.json({ error: 'A valid file is required.' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: business, error: businessError } = await admin
      .from('businesses')
      .select('id')
      .eq('id', businessId)
      .maybeSingle();
    if (businessError) {
      return NextResponse.json({ error: businessError.message }, { status: 500 });
    }
    if (!business?.id) {
      return NextResponse.json({ error: 'Business context is invalid.' }, { status: 400 });
    }

    const bucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || 'media';
    const { contentType } = validateFormUploadFile(file);
    const normalizedName = file.name.trim().replace(/[^a-zA-Z0-9._-]/g, '-');
    const safeName = normalizedName || 'file';
    const objectPath = `${businessId}/form-uploads/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await admin.storage.from(bucket).upload(objectPath, fileBuffer, {
      upsert: false,
      contentType,
      cacheControl: '31536000',
    });
    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const payload: UploadedFormFileValue = {
      file_name: file.name,
      file_size: file.size,
      file_type: contentType,
      file_url: '',
      storage_path: objectPath,
    };

    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to upload file.';
    const isValidationError =
      message === 'A valid file is required.' ||
      message === 'Business context is invalid.' ||
      message.includes('too large') ||
      message.includes('Unsupported file type');

    return NextResponse.json(
      { error: message },
      { status: isValidationError ? 400 : 500 },
    );
  }
}
