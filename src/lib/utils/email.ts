import { Resend } from 'resend';
import { createAdminClient } from '@/lib/supabase/admin';

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  businessId?: string;
}

function readSettingsString(settings: unknown, key: string) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return '';
  const value = (settings as Record<string, unknown>)[key];
  return typeof value === 'string' ? value.trim() : '';
}

function formatFromAddress(name: string, email: string) {
  const normalizedName = name.replace(/"/g, '').trim();
  if (!normalizedName) return email;
  return `"${normalizedName}" <${email}>`;
}

async function resolveSenderConfig(options: { businessId?: string; explicitReplyTo?: string }) {
  const fallbackFrom = process.env.RESEND_FROM_EMAIL?.trim();
  const fallbackReplyTo = options.explicitReplyTo || process.env.RESEND_REPLY_TO_EMAIL?.trim() || undefined;

  if (!options.businessId) {
    if (!fallbackFrom) throw new Error('RESEND_FROM_EMAIL is not configured');
    return {
      from: fallbackFrom,
      replyTo: fallbackReplyTo,
    };
  }

  const admin = createAdminClient();
  const { data: business, error } = await admin
    .from('businesses')
    .select('name, settings')
    .eq('id', options.businessId)
    .maybeSingle();
  if (error) throw new Error(error.message);

  const fromAddress =
    readSettingsString(business?.settings, 'email_from_address') ||
    readSettingsString(business?.settings, 'resend_from_email') ||
    '';
  const fromName =
    readSettingsString(business?.settings, 'email_from_name') ||
    (business?.name ?? '').trim();
  const replyTo =
    options.explicitReplyTo ||
    readSettingsString(business?.settings, 'email_reply_to') ||
    process.env.RESEND_REPLY_TO_EMAIL?.trim() ||
    undefined;

  if (fromAddress) {
    return {
      from: formatFromAddress(fromName, fromAddress),
      replyTo,
    };
  }

  if (!fallbackFrom) {
    throw new Error(
      `Email sender is not configured for business ${options.businessId}. Set businesses.settings.email_from_address or RESEND_FROM_EMAIL.`
    );
  }

  return {
    from: fallbackFrom,
    replyTo,
  };
}

export async function sendEmail({ to, subject, html, text, replyTo, businessId }: SendEmailParams) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const resend = new Resend(apiKey);
  const sender = await resolveSenderConfig({ businessId, explicitReplyTo: replyTo });

  const { data, error } = await resend.emails.send({
    from: sender.from,
    to,
    subject,
    html,
    text,
    replyTo: sender.replyTo,
  });

  if (error) {
    console.error('Resend error:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }

  return data;
}

// Render an email template by replacing {{variable}} placeholders
export function renderTemplate(
  template: { subject: string; body_html: string; body_text: string },
  variables:
    | Record<string, string>
    | {
        common?: Record<string, string>;
        html?: Record<string, string>;
        text?: Record<string, string>;
        subject?: Record<string, string>;
      }
): { subject: string; html: string; text: string } {
  let subject = template.subject;
  let html = template.body_html;
  let text = template.body_text;

  const scopedVariables: {
    common?: Record<string, string>;
    html?: Record<string, string>;
    text?: Record<string, string>;
    subject?: Record<string, string>;
  } = (
    typeof variables === 'object' &&
    variables !== null &&
    !Array.isArray(variables) &&
    (Object.prototype.hasOwnProperty.call(variables, 'common') ||
      Object.prototype.hasOwnProperty.call(variables, 'html') ||
      Object.prototype.hasOwnProperty.call(variables, 'text') ||
      Object.prototype.hasOwnProperty.call(variables, 'subject'))
  )
    ? (variables as {
        common?: Record<string, string>;
        html?: Record<string, string>;
        text?: Record<string, string>;
        subject?: Record<string, string>;
      })
    : { common: variables as Record<string, string> };

  const applyValues = (input: string, values?: Record<string, string>) => {
    let next = input;
    for (const [key, value] of Object.entries(values ?? {})) {
      const pattern = new RegExp(`{{${key}}}`, 'g');
      next = next.replace(pattern, value);
    }
    return next;
  };

  subject = applyValues(applyValues(subject, scopedVariables.common), scopedVariables.subject ?? scopedVariables.common);
  html = applyValues(applyValues(html, scopedVariables.common), scopedVariables.html ?? scopedVariables.common);
  text = applyValues(applyValues(text, scopedVariables.common), scopedVariables.text ?? scopedVariables.common);

  return { subject, html, text };
}
