'use client';

import { useEffect } from 'react';
import { setSectionsRuntime } from '@/lib/sections-core/lib/runtime';
import { submitForm } from '@/lib/actions';
import { trackEvent } from '@/components/analytics/NativeAnalytics';

let initialized = false;
const TRACKABLE_EVENTS = new Set(['form_start', 'form_submit', 'cta_click', 'phone_click']);

export default function SectionsRuntimeClientSetup() {
  useEffect(() => {
    if (initialized) return;
    setSectionsRuntime({
      actions: {
        submitForm: async (formData) => {
          await submitForm(formData);
        },
      },
      analytics: {
        trackEvent: (event) => {
          if (!TRACKABLE_EVENTS.has(event)) return;
          trackEvent(event as 'form_start' | 'form_submit' | 'cta_click' | 'phone_click');
        },
      },
    });
    initialized = true;
  }, []);

  return null;
}

