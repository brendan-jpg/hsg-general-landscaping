import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { processQuickBooksWebhookEvent } from '@/lib/integrations/quickbooks';

interface QuickBooksWebhookEntity {
  name?: string;
  id?: string;
}

interface QuickBooksWebhookEventNotification {
  realmId?: string;
  dataChangeEvent?: {
    entities?: QuickBooksWebhookEntity[];
  };
}

interface QuickBooksWebhookPayload {
  eventNotifications?: QuickBooksWebhookEventNotification[];
}

interface QuickBooksWebhookWorkItem {
  realmId: string;
  entities: QuickBooksWebhookEntity[];
}

function getWebhookVerifierToken() {
  return process.env.QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN?.trim() || null;
}

function isValidWebhookSignature(rawBody: string, signatureHeader: string | null) {
  if (!signatureHeader) return false;
  const token = getWebhookVerifierToken();
  if (!token) return false;

  const expected = createHmac('sha256', token)
    .update(rawBody, 'utf8')
    .digest('base64');

  const provided = signatureHeader.trim();
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);

  if (expectedBuffer.length !== providedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, providedBuffer);
}

export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const rawBody = await request.text();
  const signatureHeader = request.headers.get('intuit-signature');
  if (!isValidWebhookSignature(rawBody, signatureHeader)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: QuickBooksWebhookPayload;
  try {
    payload = (rawBody ? JSON.parse(rawBody) : {}) as QuickBooksWebhookPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const notifications = payload.eventNotifications ?? [];
  const workItems: QuickBooksWebhookWorkItem[] = notifications
    .map((notification): QuickBooksWebhookWorkItem | null => {
      const realmId = (notification.realmId ?? '').trim();
      const entities = notification.dataChangeEvent?.entities ?? [];
      if (!realmId || entities.length === 0) return null;
      return {
        realmId,
        entities: entities.map((entity) => ({
          name: entity.name,
          id: entity.id,
        })),
      };
    })
    .filter((item): item is QuickBooksWebhookWorkItem => item !== null);

  console.info('QuickBooks webhook accepted', {
    acceptedNotifications: workItems.length,
  });

  void (async () => {
    let processedNotifications = 0;
    for (const workItem of workItems) {
      try {
        await processQuickBooksWebhookEvent(workItem);
        processedNotifications += 1;
      } catch (error) {
        console.error('QuickBooks webhook processing error', {
          realmId: workItem.realmId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    console.info('QuickBooks webhook processing complete', {
      acceptedNotifications: workItems.length,
      processedNotifications,
      durationMs: Date.now() - startedAt,
    });
  })();

  return NextResponse.json({ ok: true, acceptedNotifications: workItems.length });
}
