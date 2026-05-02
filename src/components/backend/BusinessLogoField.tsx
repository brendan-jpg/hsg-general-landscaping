'use client';

import { useState } from 'react';
import MediaPickerField from '@/components/backend/MediaPickerField';

interface BusinessLogoFieldProps {
  initialValue?: string | null;
  label?: string;
  fieldName?: 'logo_url' | 'favicon_url' | 'og_image_url';
  mediaTab?: 'logo' | 'icon' | 'graphics';
  uploadRole?: 'logo' | 'icon' | 'generic';
}

export default function BusinessLogoField({
  initialValue,
  label = 'Logo',
  fieldName = 'logo_url',
  mediaTab = 'logo',
  uploadRole = 'logo',
}: BusinessLogoFieldProps) {
  const [logoUrl, setLogoUrl] = useState(initialValue ?? '');

  return (
    <div className="settings-field--half">
      <input type="hidden" name={fieldName} value={logoUrl} readOnly />
      <MediaPickerField
        label={label}
        value={logoUrl}
        onChange={setLogoUrl}
        mediaTab={mediaTab}
        allowUpload
        uploadRole={uploadRole}
        maxUploadFiles={1}
        showSelectedActions={fieldName !== 'favicon_url'}
      />
    </div>
  );
}
