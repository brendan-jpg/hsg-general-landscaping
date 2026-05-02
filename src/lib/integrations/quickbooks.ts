import { createAdminClient } from '@/lib/supabase/admin';
import type { LineItem } from '@/lib/types';
import type { Json, Tables, TablesInsert, TablesUpdate } from '@/lib/types/database';

type QuickBooksConnection = Tables<'quickbooks_connections'>;
type QuickBooksTokenPatch = {
  access_token: string;
  refresh_token: string;
  access_token_expires_at: string | null;
  refresh_token_expires_at: string | null;
  token_type: string | null;
  scope: string | null;
};

interface QuickBooksTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  x_refresh_token_expires_in?: number;
  token_type?: string;
  scope?: string;
}

interface QuickBooksCompanyInfoResponse {
  CompanyInfo?: {
    CompanyName?: string;
  };
  Fault?: { Error?: Array<{ Detail?: string; Message?: string }> };
}

interface QuickBooksCustomerResponse {
  Customer?: { Id?: string };
  Fault?: { Error?: Array<{ Detail?: string; Message?: string }> };
}

interface QuickBooksCustomerEntity {
  Id?: string;
  DisplayName?: string;
  GivenName?: string;
  FamilyName?: string;
  PrimaryEmailAddr?: { Address?: string };
  PrimaryPhone?: { FreeFormNumber?: string };
  BillAddr?: {
    Line1?: string;
    City?: string;
    CountrySubDivisionCode?: string;
    PostalCode?: string;
  };
}

interface QuickBooksCustomersQueryResponse {
  QueryResponse?: {
    Customer?: QuickBooksCustomerEntity[];
  };
  Fault?: { Error?: Array<{ Detail?: string; Message?: string }> };
}

interface QuickBooksEstimateResponse {
  Estimate?: { Id?: string; SyncToken?: string };
  Fault?: { Error?: Array<{ Detail?: string; Message?: string }> };
}

interface QuickBooksInvoiceResponse {
  Invoice?: {
    Id?: string;
    SyncToken?: string;
    TotalAmt?: number;
    Balance?: number;
    PrivateNote?: string;
  };
  Fault?: { Error?: Array<{ Detail?: string; Message?: string }> };
}

interface QuickBooksLinkedTxn {
  TxnId?: string;
  TxnType?: string;
}

interface QuickBooksPaymentLine {
  Amount?: number;
  LinkedTxn?: QuickBooksLinkedTxn[];
}

interface QuickBooksPayment {
  Id?: string;
  SyncToken?: string;
  TotalAmt?: number;
  TxnDate?: string;
  PaymentRefNum?: string;
  PrivateNote?: string;
  CustomerRef?: { value?: string };
  Line?: QuickBooksPaymentLine[];
}

interface QuickBooksPaymentResponse {
  Payment?: QuickBooksPayment;
  Fault?: { Error?: Array<{ Detail?: string; Message?: string }> };
}

interface QuickBooksLinePayload {
  Amount: number;
  Description?: string;
  DetailType: 'SalesItemLineDetail';
  SalesItemLineDetail: {
    ItemRef: { value: string };
    Qty?: number;
    UnitPrice?: number;
  };
}

interface QuickBooksConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  defaultServiceItemId: string | null;
}

interface QuickBooksItem {
  Id?: string;
  Name?: string;
  Type?: string;
  Active?: boolean;
  UnitPrice?: number | string | null;
  SyncToken?: string;
  Description?: string | null;
  IncomeAccountRef?: { value?: string; name?: string };
}

export interface QuickBooksSelectableItem {
  id: string;
  name: string;
  type: string;
  unitPrice: number | null;
  description: string | null;
  active: boolean;
}

interface QuickBooksItemResponse {
  Item?: QuickBooksItem;
  Fault?: { Error?: Array<{ Detail?: string; Message?: string }> };
}

interface QuickBooksItemsQueryResponse {
  QueryResponse?: {
    Item?: QuickBooksItem[];
  };
  Fault?: { Error?: Array<{ Detail?: string; Message?: string }> };
}

interface QuickBooksAccount {
  Id?: string;
  Name?: string;
  AccountType?: string;
  Active?: boolean;
}

interface QuickBooksAccountsQueryResponse {
  QueryResponse?: {
    Account?: QuickBooksAccount[];
  };
  Fault?: { Error?: Array<{ Detail?: string; Message?: string }> };
}

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function readSettingsString(settings: unknown, key: string) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return '';
  const value = (settings as Record<string, unknown>)[key];
  return typeof value === 'string' ? value.trim() : '';
}

function getQuickBooksBaseUrl() {
  const env = (process.env.QUICKBOOKS_ENV ?? 'sandbox').trim().toLowerCase();
  return env === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com';
}

function getIntuitAuthBaseUrl() {
  const env = (process.env.QUICKBOOKS_ENV ?? 'sandbox').trim().toLowerCase();
  return env === 'production'
    ? 'https://appcenter.intuit.com/connect/oauth2'
    : 'https://appcenter.intuit.com/connect/oauth2';
}

function getTokenEndpoint() {
  return 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
}

async function resolveQuickBooksConfig(businessId?: string): Promise<QuickBooksConfig> {
  let settings: Record<string, unknown> | null = null;

  if (businessId) {
    const supabase = createAdminClient();
    const { data: business, error } = await supabase
      .from('businesses')
      .select('settings')
      .eq('id', businessId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    settings =
      business?.settings && typeof business.settings === 'object' && !Array.isArray(business.settings)
        ? (business.settings as Record<string, unknown>)
        : null;
  }

  const clientId = readSettingsString(settings, 'quickbooks_client_id') || getRequiredEnv('QUICKBOOKS_CLIENT_ID');
  const clientSecret =
    readSettingsString(settings, 'quickbooks_client_secret') || getRequiredEnv('QUICKBOOKS_CLIENT_SECRET');
  const redirectUri =
    readSettingsString(settings, 'quickbooks_redirect_uri') || getRequiredEnv('QUICKBOOKS_REDIRECT_URI');
  const defaultServiceItemIdFromSettings = readSettingsString(settings, 'quickbooks_default_service_item_id');
  const defaultServiceItemIdFromEnv = process.env.QUICKBOOKS_DEFAULT_SERVICE_ITEM_ID?.trim() || '';
  const defaultServiceItemId = defaultServiceItemIdFromSettings || defaultServiceItemIdFromEnv || null;

  return {
    clientId,
    clientSecret,
    redirectUri,
    defaultServiceItemId,
  };
}

function buildBasicAuthHeader(clientId: string, clientSecret: string) {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
}

function toIsoFromNow(seconds?: number) {
  if (!seconds || !Number.isFinite(seconds)) return null;
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function toQuickBooksDate(value: string | null | undefined) {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString().slice(0, 10);
}

function parseLocalLineItems(value: Json | null): LineItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map<LineItem | null>((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const row = item as Record<string, unknown>;
      const qty = Number(row.qty ?? 0);
      const unitPrice = Number(row.unit_price ?? 0);
      const total = Number(row.total ?? qty * unitPrice);
      const description = String(row.description ?? '').trim();
      if (!description) return null;
      const qboItemId =
        typeof row.qbo_item_id === 'string' && row.qbo_item_id.trim() ? row.qbo_item_id.trim() : null;
      const qboItemName =
        typeof row.qbo_item_name === 'string' && row.qbo_item_name.trim() ? row.qbo_item_name.trim() : null;
      return {
        description,
        qty: Number.isFinite(qty) ? qty : 0,
        unit_price: Number.isFinite(unitPrice) ? unitPrice : 0,
        total: Number.isFinite(total) ? total : 0,
        qbo_item_id: qboItemId,
        qbo_item_name: qboItemName,
      } satisfies LineItem;
    })
    .filter((item): item is LineItem => item !== null);
}

async function listQuickBooksActiveItems(businessId: string, realmId: string) {
  const discoveryQuery = "select Id,Name,Type,Active,UnitPrice,Description from Item where Active = true maxresults 1000";
  const { data: queryData } = await quickBooksApiRequest<QuickBooksItemsQueryResponse>(
    businessId,
    `/v3/company/${realmId}/query`,
    { query: { query: discoveryQuery } },
  );

  return (queryData.QueryResponse?.Item ?? [])
    .filter((item): item is QuickBooksItem & { Id: string; Name: string } => Boolean(item?.Id && item?.Name))
    .map((item) => ({
      id: item.Id.trim(),
      name: item.Name.trim(),
      type: (item.Type ?? '').trim(),
      unitPrice: Number.isFinite(Number(item.UnitPrice)) ? Number(item.UnitPrice) : null,
      description: typeof item.Description === 'string' && item.Description.trim() ? item.Description.trim() : null,
      active: item.Active !== false,
    }));
}

async function listQuickBooksIncomeAccounts(businessId: string, realmId: string) {
  const discoveryQuery = "select Id,Name,AccountType,Active from Account where Active = true maxresults 1000";
  const { data: queryData } = await quickBooksApiRequest<QuickBooksAccountsQueryResponse>(
    businessId,
    `/v3/company/${realmId}/query`,
    { query: { query: discoveryQuery } },
  );

  return (queryData.QueryResponse?.Account ?? [])
    .filter((account): account is QuickBooksAccount & { Id: string; Name: string } => Boolean(account?.Id && account?.Name))
    .filter((account) => {
      const accountType = (account.AccountType ?? '').trim().toLowerCase();
      return accountType === 'income' || accountType === 'other income';
    })
    .map((account) => ({
      id: account.Id.trim(),
      name: account.Name.trim(),
      accountType: (account.AccountType ?? '').trim(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function resolveQuickBooksIncomeAccountId(businessId: string, realmId: string) {
  const accounts = await listQuickBooksIncomeAccounts(businessId, realmId);
  const incomeAccountId = accounts[0]?.id?.trim() || '';
  if (!incomeAccountId) {
    throw new Error('No active QuickBooks income account found. Create an income account in QuickBooks before adding items.');
  }
  return incomeAccountId;
}

function toQuickBooksSalesLines(
  lineItems: LineItem[],
  taxAmount: number | null | undefined,
  defaultItemId: string,
) {
  const lines: QuickBooksLinePayload[] = lineItems.map((item) => ({
    Amount: Number(item.total || item.qty * item.unit_price || 0),
    Description: item.description,
    DetailType: 'SalesItemLineDetail',
    SalesItemLineDetail: {
      ItemRef: { value: (item.qbo_item_id ?? '').trim() || defaultItemId },
      Qty: item.qty,
      UnitPrice: item.unit_price,
    },
  }));

  const tax = Number(taxAmount ?? 0);
  if (Number.isFinite(tax) && tax > 0) {
    lines.push({
      Amount: tax,
      Description: 'Tax',
      DetailType: 'SalesItemLineDetail',
      SalesItemLineDetail: {
        ItemRef: { value: defaultItemId },
        Qty: 1,
        UnitPrice: tax,
      },
    });
  }

  return lines;
}

async function ensureQuickBooksServiceItemId(
  businessId: string,
  realmId: string,
  preferredItemId: string | null,
) {
  const supabase = createAdminClient();
  const preferred = (preferredItemId ?? '').trim();
  if (preferred) {
    try {
      const { data } = await quickBooksApiRequest<QuickBooksItemResponse>(
        businessId,
        `/v3/company/${realmId}/item/${preferred}`,
      );
      if (data.Item?.Id) return data.Item.Id;
    } catch {
      // If configured id is invalid, fall through to discovery.
    }
  }

  const items = await listQuickBooksActiveItems(businessId, realmId);
  const serviceItem = items.find((item) => item.id && item.type.toLowerCase() === 'service');
  const fallbackItem = items.find((item) => item.id);
  const resolvedItemId = (serviceItem?.id ?? fallbackItem?.id ?? '').trim();
  if (!resolvedItemId) {
    throw new Error(
      'No active QuickBooks item found. Create at least one active Item in QuickBooks or set quickbooks_default_service_item_id.'
    );
  }

  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('settings')
    .eq('id', businessId)
    .maybeSingle();
  if (businessError) throw new Error(businessError.message);

  const base =
    business?.settings && typeof business.settings === 'object' && !Array.isArray(business.settings)
      ? ({ ...(business.settings as Record<string, unknown>) } as Record<string, unknown>)
      : {};
  if (typeof base.quickbooks_default_service_item_id !== 'string' || !String(base.quickbooks_default_service_item_id).trim()) {
    base.quickbooks_default_service_item_id = resolvedItemId;
    const { error: updateError } = await supabase
      .from('businesses')
      .update({ settings: base as never })
      .eq('id', businessId);
    if (updateError) throw new Error(updateError.message);
  }

  return resolvedItemId;
}

export async function listQuickBooksItemsForBusiness(businessId: string): Promise<QuickBooksSelectableItem[]> {
  const connection = await ensureQuickBooksAccessToken(businessId);
  const items = await listQuickBooksActiveItems(businessId, connection.realm_id);
  return items
    .map((item) => ({
      id: item.id,
      name: item.name,
      type: item.type,
      unitPrice: item.unitPrice,
      description: item.description,
      active: item.active,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function fetchQuickBooksItemById(businessId: string, realmId: string, qboItemId: string) {
  const { data } = await quickBooksApiRequest<QuickBooksItemResponse>(
    businessId,
    `/v3/company/${realmId}/item/${encodeURIComponent(qboItemId)}`,
  );
  return data.Item ?? null;
}

type QuickBooksManageableItemType = 'Service' | 'NonInventory';

function normalizeQuickBooksItemPayload(options: {
  name: string;
  type: QuickBooksManageableItemType;
  description?: string | null;
  unitPrice?: number | null;
  incomeAccountId: string;
}) {
  return {
    Name: options.name.trim(),
    Type: options.type,
    IncomeAccountRef: { value: options.incomeAccountId },
    Description: options.description?.trim() || undefined,
    UnitPrice: options.unitPrice ?? undefined,
    Active: true,
  };
}

export async function createQuickBooksItemForBusiness(options: {
  businessId: string;
  name: string;
  type: QuickBooksManageableItemType;
  description?: string | null;
  unitPrice?: number | null;
}) {
  const connection = await ensureQuickBooksAccessToken(options.businessId);
  const incomeAccountId = await resolveQuickBooksIncomeAccountId(options.businessId, connection.realm_id);
  const payload = normalizeQuickBooksItemPayload({
    name: options.name,
    type: options.type,
    description: options.description,
    unitPrice: options.unitPrice ?? null,
    incomeAccountId,
  });

  const { data } = await quickBooksApiRequest<QuickBooksItemResponse>(
    options.businessId,
    `/v3/company/${connection.realm_id}/item`,
    { method: 'POST', body: payload },
  );

  if (!data.Item?.Id) throw new Error('QuickBooks item response missing Item.Id');
  return data.Item;
}

export async function updateQuickBooksItemForBusiness(options: {
  businessId: string;
  itemId: string;
  name: string;
  description?: string | null;
  unitPrice?: number | null;
}) {
  const connection = await ensureQuickBooksAccessToken(options.businessId);
  const existingItem = await fetchQuickBooksItemById(options.businessId, connection.realm_id, options.itemId);
  if (!existingItem?.Id) throw new Error('QuickBooks item not found');
  if (!existingItem.SyncToken) throw new Error('QuickBooks item sync token not found');

  const incomeAccountId =
    (existingItem.IncomeAccountRef?.value ?? '').trim() ||
    (await resolveQuickBooksIncomeAccountId(options.businessId, connection.realm_id));

  const payload = {
    Id: existingItem.Id,
    SyncToken: existingItem.SyncToken,
    sparse: true,
    ...normalizeQuickBooksItemPayload({
      name: options.name,
      type: ((existingItem.Type ?? 'Service').trim() || 'Service') as QuickBooksManageableItemType,
      description: options.description,
      unitPrice: options.unitPrice ?? null,
      incomeAccountId,
    }),
  };

  const { data } = await quickBooksApiRequest<QuickBooksItemResponse>(
    options.businessId,
    `/v3/company/${connection.realm_id}/item`,
    { method: 'POST', body: payload },
  );

  if (!data.Item?.Id) throw new Error('QuickBooks item response missing Item.Id');
  return data.Item;
}

export async function deactivateQuickBooksItemForBusiness(options: {
  businessId: string;
  itemId: string;
}) {
  const connection = await ensureQuickBooksAccessToken(options.businessId);
  const existingItem = await fetchQuickBooksItemById(options.businessId, connection.realm_id, options.itemId);
  if (!existingItem?.Id) throw new Error('QuickBooks item not found');
  if (!existingItem.SyncToken) throw new Error('QuickBooks item sync token not found');

  const payload = {
    Id: existingItem.Id,
    SyncToken: existingItem.SyncToken,
    sparse: true,
    Name: (existingItem.Name ?? '').trim() || undefined,
    Active: false,
  };

  const { data } = await quickBooksApiRequest<QuickBooksItemResponse>(
    options.businessId,
    `/v3/company/${connection.realm_id}/item`,
    { method: 'POST', body: payload },
  );

  if (!data.Item?.Id) throw new Error('QuickBooks item response missing Item.Id');
  return data.Item;
}

async function fetchQuickBooksEstimateById(businessId: string, realmId: string, qboEstimateId: string) {
  const { data } = await quickBooksApiRequest<QuickBooksEstimateResponse>(
    businessId,
    `/v3/company/${realmId}/estimate/${qboEstimateId}`,
  );
  return data.Estimate ?? null;
}

async function fetchQuickBooksCustomerById(businessId: string, realmId: string, qboCustomerId: string) {
  const { data } = await quickBooksApiRequest<QuickBooksCustomerResponse & { Customer?: QuickBooksCustomerEntity & { SyncToken?: string } }>(
    businessId,
    `/v3/company/${realmId}/customer/${qboCustomerId}`,
  );
  return data.Customer ?? null;
}

async function fetchQuickBooksInvoiceById(businessId: string, realmId: string, qboInvoiceId: string) {
  const { data } = await quickBooksApiRequest<QuickBooksInvoiceResponse>(
    businessId,
    `/v3/company/${realmId}/invoice/${qboInvoiceId}`,
  );
  return data.Invoice ?? null;
}

async function fetchQuickBooksPaymentById(businessId: string, realmId: string, qboPaymentId: string) {
  const { data } = await quickBooksApiRequest<QuickBooksPaymentResponse>(
    businessId,
    `/v3/company/${realmId}/payment/${qboPaymentId}`,
  );
  return data.Payment ?? null;
}

export async function recordQuickBooksSyncError(businessId: string, error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown QuickBooks sync error';
  await createAdminClient()
    .from('quickbooks_connections')
    .update({ last_sync_error: message } as any)
    .eq('business_id', businessId);
}

function toTokenPatch(payload: QuickBooksTokenResponse): QuickBooksTokenPatch {
  if (!payload.access_token || !payload.refresh_token) {
    throw new Error('QuickBooks token response missing access/refresh token');
  }

  return {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    access_token_expires_at: toIsoFromNow(payload.expires_in),
    refresh_token_expires_at: toIsoFromNow(payload.x_refresh_token_expires_in),
    token_type: payload.token_type ?? null,
    scope: payload.scope ?? null,
  };
}

export async function buildQuickBooksAuthorizeUrl(state: string, businessId?: string) {
  const { clientId, redirectUri } = await resolveQuickBooksConfig(businessId);
  const url = new URL(getIntuitAuthBaseUrl());
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'com.intuit.quickbooks.accounting');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  return url.toString();
}

export async function exchangeQuickBooksAuthorizationCode(code: string, businessId?: string) {
  const { clientId, clientSecret, redirectUri } = await resolveQuickBooksConfig(businessId);
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });

  const response = await fetch(getTokenEndpoint(), {
    method: 'POST',
    headers: {
      Authorization: buildBasicAuthHeader(clientId, clientSecret),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
    cache: 'no-store',
  });

  const payload = (await response.json()) as QuickBooksTokenResponse & { error_description?: string };
  if (!response.ok) {
    throw new Error(payload.error_description || 'QuickBooks token exchange failed');
  }

  return toTokenPatch(payload);
}

export async function refreshQuickBooksConnection(connection: QuickBooksConnection) {
  const { clientId, clientSecret } = await resolveQuickBooksConfig(connection.business_id);
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: connection.refresh_token,
  });

  const response = await fetch(getTokenEndpoint(), {
    method: 'POST',
    headers: {
      Authorization: buildBasicAuthHeader(clientId, clientSecret),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
    cache: 'no-store',
  });

  const payload = (await response.json()) as QuickBooksTokenResponse & { error_description?: string };
  if (!response.ok) {
    throw new Error(payload.error_description || 'QuickBooks token refresh failed');
  }

  const patch = toTokenPatch(payload);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('quickbooks_connections')
    .update(patch)
    .eq('business_id', connection.business_id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as QuickBooksConnection;
}

export async function getQuickBooksConnectionByBusinessId(businessId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('quickbooks_connections')
    .select('*')
    .eq('business_id', businessId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as QuickBooksConnection | null;
}

export async function ensureQuickBooksAccessToken(businessId: string) {
  const connection = await getQuickBooksConnectionByBusinessId(businessId);
  if (!connection) throw new Error('QuickBooks is not connected for this business');

  const expiresAtMs = connection.access_token_expires_at ? Date.parse(connection.access_token_expires_at) : NaN;
  const isExpired = !Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now() + 60_000;

  if (!isExpired) return connection;
  return refreshQuickBooksConnection(connection);
}

export async function quickBooksApiRequest<T>(
  businessId: string,
  path: string,
  options?: {
    method?: 'GET' | 'POST';
    query?: Record<string, string | number | boolean | null | undefined>;
    body?: unknown;
    contentType?: 'json' | 'text';
  },
) {
  const connection = await ensureQuickBooksAccessToken(businessId);
  const url = new URL(`${getQuickBooksBaseUrl()}${path.replace(/^\//, '/')}`);
  if (options?.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value === null || value === undefined) continue;
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    method: options?.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${connection.access_token}`,
      Accept: 'application/json',
      ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  });

  const text = await response.text();
  const data = (text ? JSON.parse(text) : {}) as T;

  if (!response.ok) {
    const faultMessage =
      (data as any)?.Fault?.Error?.[0]?.Detail ||
      (data as any)?.Fault?.Error?.[0]?.Message ||
      text ||
      'QuickBooks request failed';
    throw new Error(faultMessage);
  }

  return { data, connection };
}

export async function fetchQuickBooksCompanyName(businessId: string) {
  const connection = await ensureQuickBooksAccessToken(businessId);
  const { data } = await quickBooksApiRequest<QuickBooksCompanyInfoResponse>(
    businessId,
    `/v3/company/${connection.realm_id}/companyinfo/${connection.realm_id}`,
  );
  return data.CompanyInfo?.CompanyName ?? null;
}

export async function upsertQuickBooksConnection(
  businessId: string,
  realmId: string,
  tokenPatch: QuickBooksTokenPatch,
) {
  const supabase = createAdminClient();
  let companyName: string | null = null;

  const connectionPayload = {
    business_id: businessId,
    realm_id: realmId,
    ...tokenPatch,
  };

  const { data: existingByRealm, error: existingByRealmError } = await supabase
    .from('quickbooks_connections')
    .select('business_id, realm_id')
    .eq('realm_id', realmId)
    .maybeSingle();
  if (existingByRealmError) throw new Error(existingByRealmError.message);

  if (existingByRealm) {
    const { error: updateByRealmError } = await supabase
      .from('quickbooks_connections')
      .update(connectionPayload)
      .eq('realm_id', realmId);
    if (updateByRealmError) throw new Error(updateByRealmError.message);
  } else {
    const { error: upsertError } = await supabase.from('quickbooks_connections').upsert(
      connectionPayload,
      { onConflict: 'business_id' },
    );
    if (upsertError) throw new Error(upsertError.message);
  }

  try {
    companyName = await fetchQuickBooksCompanyName(businessId);
  } catch {
    companyName = null;
  }

  const { data, error } = await supabase
    .from('quickbooks_connections')
    .update({ company_name: companyName, last_sync_error: null })
    .eq('business_id', businessId)
    .select('*')
    .single();
  if (error) throw new Error(error.message);

  return data as QuickBooksConnection;
}

export async function syncQuickBooksCustomerForContact(contactId: string) {
  const supabase = createAdminClient();
  const { data: contact, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', contactId)
    .single();
  if (error) throw new Error(error.message);

  const displayName =
    [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim() ||
    contact.email ||
    contact.phone ||
    `Contact ${contact.id.slice(0, 8)}`;

  const businessId = contact.business_id;
  const connection = await ensureQuickBooksAccessToken(businessId);
  const payload: Record<string, unknown> = {
    DisplayName: displayName,
    GivenName: contact.first_name ?? undefined,
    FamilyName: contact.last_name ?? undefined,
    PrimaryEmailAddr: contact.email ? { Address: contact.email } : undefined,
    PrimaryPhone: contact.phone ? { FreeFormNumber: contact.phone } : undefined,
    BillAddr:
      contact.address_line1 || contact.city || contact.state || contact.zip
        ? {
            Line1: contact.address_line1 ?? undefined,
            City: contact.city ?? undefined,
            CountrySubDivisionCode: contact.state ?? undefined,
            PostalCode: contact.zip ?? undefined,
          }
        : undefined,
  };

  let created = true;
  if (contact.qbo_customer_id) {
    const existing = await fetchQuickBooksCustomerById(
      businessId,
      connection.realm_id,
      contact.qbo_customer_id,
    );
    if (!existing?.Id || !(existing as { SyncToken?: string }).SyncToken) {
      throw new Error('QuickBooks customer sync token not found');
    }
    payload.Id = existing.Id;
    payload.SyncToken = (existing as { SyncToken?: string }).SyncToken;
    payload.sparse = true;
    created = false;
  }

  const { data: qbo } = await quickBooksApiRequest<QuickBooksCustomerResponse>(
    businessId,
    `/v3/company/${connection.realm_id}/customer`,
    { method: 'POST', body: payload },
  );

  const qboId = qbo.Customer?.Id;
  if (!qboId) throw new Error('QuickBooks customer response missing Customer.Id');

  const { error: updateError } = await supabase
    .from('contacts')
    .update({ qbo_customer_id: qboId } as any)
    .eq('id', contact.id)
    .eq('business_id', businessId);
  if (updateError) throw new Error(updateError.message);

  await supabase
    .from('quickbooks_connections')
    .update({ last_synced_at: new Date().toISOString(), last_sync_error: null } as any)
    .eq('business_id', businessId);

  return { id: qboId, created };
}

async function upsertQuickBooksCustomerIntoContact(options: {
  businessId: string;
  customer: QuickBooksCustomerEntity & { Id?: string };
}) {
  const { businessId, customer } = options;
  const supabase = createAdminClient();
  const qboCustomerId = (customer.Id ?? '').trim();
  if (!qboCustomerId) return { created: false, linked: false };

  const displayName = (customer.DisplayName ?? '').trim();
  const fallbackName = splitDisplayName(displayName);
  const firstName = (customer.GivenName ?? '').trim() || fallbackName.firstName;
  const lastName = (customer.FamilyName ?? '').trim() || fallbackName.lastName;
  const email = (customer.PrimaryEmailAddr?.Address ?? '').trim() || null;
  const normalizedEmail = normalizeEmail(email);
  const phone = (customer.PrimaryPhone?.FreeFormNumber ?? '').trim() || null;
  const normalizedPhone = normalizePhone(phone);
  const nameKey = normalizeNameKey(firstName, lastName);
  const addressLine1 = (customer.BillAddr?.Line1 ?? '').trim() || null;
  const city = (customer.BillAddr?.City ?? '').trim() || null;
  const state = (customer.BillAddr?.CountrySubDivisionCode ?? '').trim() || null;
  const zip = (customer.BillAddr?.PostalCode ?? '').trim() || null;

  const { data: existingContacts, error: existingContactsError } = await supabase
    .from('contacts')
    .select('id, qbo_customer_id, email, phone, first_name, last_name')
    .eq('business_id', businessId);
  if (existingContactsError) throw new Error(existingContactsError.message);

  let matchedId: string | null =
    (existingContacts ?? []).find((contact) => (contact.qbo_customer_id ?? '').trim() === qboCustomerId)?.id ?? null;

  if (!matchedId && normalizedEmail) {
    matchedId =
      (existingContacts ?? []).find((contact) => normalizeEmail(contact.email) === normalizedEmail)?.id ?? null;
  }

  if (!matchedId && normalizedPhone) {
    matchedId =
      (existingContacts ?? []).find((contact) => normalizePhone(contact.phone) === normalizedPhone)?.id ?? null;
  }

  if (!matchedId && nameKey) {
    const nameMatches = (existingContacts ?? []).filter(
      (contact) => normalizeNameKey(contact.first_name, contact.last_name) === nameKey,
    );
    if (nameMatches.length === 1) {
      matchedId = nameMatches[0]?.id ?? null;
    }
  }

  const contactPatch: TablesUpdate<'contacts'> = {
    qbo_customer_id: qboCustomerId,
    ...(firstName ? { first_name: firstName } : {}),
    ...(lastName ? { last_name: lastName } : {}),
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    ...(addressLine1 ? { address_line1: addressLine1 } : {}),
    ...(city ? { city } : {}),
    ...(state ? { state } : {}),
    ...(zip ? { zip } : {}),
  };

  if (matchedId) {
    const { error: updateError } = await supabase
      .from('contacts')
      .update(contactPatch)
      .eq('id', matchedId)
      .eq('business_id', businessId);
    if (updateError) throw new Error(updateError.message);
    return { created: false, linked: true };
  }

  const insertRow: TablesInsert<'contacts'> = {
    business_id: businessId,
    qbo_customer_id: qboCustomerId,
    first_name: firstName || null,
    last_name: lastName || null,
    email,
    phone,
    address_line1: addressLine1,
    city,
    state,
    zip,
    source: 'other',
    status: 'customer',
  };

  const { error: insertError } = await supabase
    .from('contacts')
    .insert(insertRow);
  if (insertError) throw new Error(insertError.message);

  return { created: true, linked: false };
}

export async function syncQuickBooksCustomerFromQuickBooks(businessId: string, qboCustomerId: string) {
  const connection = await ensureQuickBooksAccessToken(businessId);
  const customer = await fetchQuickBooksCustomerById(businessId, connection.realm_id, qboCustomerId);
  if (!customer?.Id) {
    throw new Error('QuickBooks customer not found');
  }

  const result = await upsertQuickBooksCustomerIntoContact({
    businessId,
    customer,
  });

  await createAdminClient()
    .from('quickbooks_connections')
    .update({ last_synced_at: new Date().toISOString(), last_sync_error: null } as any)
    .eq('business_id', businessId);

  return result;
}

export async function syncQuickBooksEstimateForEstimate(estimateId: string) {
  const supabase = createAdminClient();
  const { data: estimate, error } = await supabase
    .from('estimates')
    .select('*, contacts(*)')
    .eq('id', estimateId)
    .single();
  if (error) throw new Error(error.message);
  if (!estimate) throw new Error('Estimate not found');

  const contact = (estimate as any).contacts as Tables<'contacts'> | null;
  if (!contact) throw new Error('Estimate contact not found');

  const customer = await syncQuickBooksCustomerForContact(contact.id);
  const connection = await ensureQuickBooksAccessToken((estimate as any).business_id);
  const lineItems = parseLocalLineItems((estimate as any).line_items as Json | null);
  const quickBooksConfig = await resolveQuickBooksConfig((estimate as any).business_id);
  const serviceItemId = await ensureQuickBooksServiceItemId(
    (estimate as any).business_id,
    connection.realm_id,
    quickBooksConfig.defaultServiceItemId,
  );

  const payload: Record<string, unknown> = {
    CustomerRef: { value: customer.id },
    DocNumber: (estimate as any).estimate_number || undefined,
    TxnDate: toQuickBooksDate((estimate as any).created_at) ?? toQuickBooksDate(new Date().toISOString()),
    ExpirationDate: toQuickBooksDate((estimate as any).valid_until),
    PrivateNote: (estimate as any).notes || undefined,
    Line: toQuickBooksSalesLines(
      lineItems,
      Number((estimate as any).tax ?? 0),
      serviceItemId,
    ),
  };

  if ((estimate as any).qbo_estimate_id) {
    const existing = await fetchQuickBooksEstimateById(
      (estimate as any).business_id,
      connection.realm_id,
      (estimate as any).qbo_estimate_id,
    );
    if (!existing?.SyncToken) {
      throw new Error('QuickBooks estimate sync token not found');
    }
    payload.Id = (estimate as any).qbo_estimate_id;
    payload.SyncToken = existing.SyncToken;
  }

  const { data: qbo } = await quickBooksApiRequest<QuickBooksEstimateResponse>(
    (estimate as any).business_id,
    `/v3/company/${connection.realm_id}/estimate`,
    { method: 'POST', body: payload },
  );

  const qboEstimateId = qbo.Estimate?.Id;
  if (!qboEstimateId) throw new Error('QuickBooks estimate response missing Estimate.Id');

  const { error: updateError } = await supabase
    .from('estimates')
    .update({ qbo_estimate_id: qboEstimateId } as any)
    .eq('id', estimateId)
    .eq('business_id', (estimate as any).business_id);
  if (updateError) throw new Error(updateError.message);

  await supabase
    .from('quickbooks_connections')
    .update({ last_synced_at: new Date().toISOString(), last_sync_error: null } as any)
    .eq('business_id', (estimate as any).business_id);

  return { qboEstimateId, created: !(estimate as any).qbo_estimate_id };
}

export async function syncQuickBooksInvoiceForInvoice(invoiceId: string) {
  const supabase = createAdminClient();
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('*, contacts(*)')
    .eq('id', invoiceId)
    .single();
  if (error) throw new Error(error.message);
  if (!invoice) throw new Error('Invoice not found');

  const contact = (invoice as any).contacts as Tables<'contacts'> | null;
  if (!contact) throw new Error('Invoice contact not found');

  const customer = await syncQuickBooksCustomerForContact(contact.id);
  const connection = await ensureQuickBooksAccessToken((invoice as any).business_id);
  const lineItems = parseLocalLineItems((invoice as any).line_items as Json | null);
  const quickBooksConfig = await resolveQuickBooksConfig((invoice as any).business_id);
  const serviceItemId = await ensureQuickBooksServiceItemId(
    (invoice as any).business_id,
    connection.realm_id,
    quickBooksConfig.defaultServiceItemId,
  );

  const payload: Record<string, unknown> = {
    CustomerRef: { value: customer.id },
    DocNumber: (invoice as any).invoice_number || undefined,
    TxnDate: toQuickBooksDate((invoice as any).created_at) ?? toQuickBooksDate(new Date().toISOString()),
    DueDate: toQuickBooksDate((invoice as any).due_date),
    PrivateNote: (invoice as any).notes || undefined,
    Line: toQuickBooksSalesLines(
      lineItems,
      Number((invoice as any).tax ?? 0),
      serviceItemId,
    ),
  };

  if ((invoice as any).qbo_invoice_id) {
    const existing = await fetchQuickBooksInvoiceById(
      (invoice as any).business_id,
      connection.realm_id,
      (invoice as any).qbo_invoice_id,
    );
    if (!existing?.SyncToken) {
      throw new Error('QuickBooks invoice sync token not found');
    }
    payload.Id = (invoice as any).qbo_invoice_id;
    payload.SyncToken = existing.SyncToken;
  }

  const { data: qbo } = await quickBooksApiRequest<QuickBooksInvoiceResponse>(
    (invoice as any).business_id,
    `/v3/company/${connection.realm_id}/invoice`,
    { method: 'POST', body: payload },
  );

  const qboInvoiceId = qbo.Invoice?.Id;
  if (!qboInvoiceId) throw new Error('QuickBooks invoice response missing Invoice.Id');

  const { error: updateError } = await supabase
    .from('invoices')
    .update({ qbo_invoice_id: qboInvoiceId } as any)
    .eq('id', invoiceId)
    .eq('business_id', (invoice as any).business_id);
  if (updateError) throw new Error(updateError.message);

  await supabase
    .from('quickbooks_connections')
    .update({ last_synced_at: new Date().toISOString(), last_sync_error: null } as any)
    .eq('business_id', (invoice as any).business_id);

  return { qboInvoiceId, created: !(invoice as any).qbo_invoice_id };
}

export async function refreshQuickBooksInvoiceStatusForInvoice(invoiceId: string) {
  const supabase = createAdminClient();
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('id, business_id, qbo_invoice_id, total, amount_paid, status')
    .eq('id', invoiceId)
    .single();
  if (error) throw new Error(error.message);
  if (!invoice) throw new Error('Invoice not found');
  if (!invoice.qbo_invoice_id) throw new Error('Invoice is not linked to QuickBooks');

  const connection = await ensureQuickBooksAccessToken(invoice.business_id);
  const qboInvoice = await fetchQuickBooksInvoiceById(invoice.business_id, connection.realm_id, invoice.qbo_invoice_id);
  if (!qboInvoice) throw new Error('QuickBooks invoice not found');

  const totalAmt = Number(qboInvoice.TotalAmt ?? invoice.total ?? 0);
  const balance = Number(qboInvoice.Balance ?? Math.max(totalAmt - Number(invoice.amount_paid ?? 0), 0));
  const amountPaid = Math.max(totalAmt - balance, 0);
  const nextStatus =
    amountPaid >= totalAmt && totalAmt > 0
      ? 'paid'
      : invoice.status === 'draft'
        ? 'draft'
        : 'sent';

  const updatePayload: TablesUpdate<'invoices'> = {
    amount_paid: amountPaid,
    status: nextStatus as Tables<'invoices'>['status'],
    paid_at: amountPaid >= totalAmt && totalAmt > 0 ? new Date().toISOString() : null,
  };

  const { error: updateError } = await supabase
    .from('invoices')
    .update(updatePayload)
    .eq('id', invoice.id)
    .eq('business_id', invoice.business_id);
  if (updateError) throw new Error(updateError.message);

  await supabase
    .from('quickbooks_connections')
    .update({ last_synced_at: new Date().toISOString(), last_sync_error: null } as any)
    .eq('business_id', invoice.business_id);

  return { amountPaid, total: totalAmt, status: nextStatus };
}

export async function syncAllQuickBooksInvoicesForBusiness(businessId: string) {
  const supabase = createAdminClient();
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('id')
    .eq('business_id', businessId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);

  let synced = 0;
  let failed = 0;
  let lastError: string | null = null;

  for (const invoice of invoices ?? []) {
    try {
      await syncQuickBooksInvoiceForInvoice(invoice.id);
      synced += 1;
    } catch (syncError) {
      failed += 1;
      lastError = syncError instanceof Error ? syncError.message : 'Unknown sync error';
    }
  }

  await supabase
    .from('quickbooks_connections')
    .update({
      last_synced_at: new Date().toISOString(),
      last_sync_error: lastError,
    } as any)
    .eq('business_id', businessId);

  return { synced, failed, lastError };
}

export async function syncAllQuickBooksEstimatesForBusiness(businessId: string) {
  const supabase = createAdminClient();
  const { data: estimates, error } = await supabase
    .from('estimates')
    .select('id')
    .eq('business_id', businessId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);

  let synced = 0;
  let failed = 0;
  let lastError: string | null = null;

  for (const estimate of estimates ?? []) {
    try {
      await syncQuickBooksEstimateForEstimate(estimate.id);
      synced += 1;
    } catch (syncError) {
      failed += 1;
      lastError = syncError instanceof Error ? syncError.message : 'Unknown sync error';
    }
  }

  await supabase
    .from('quickbooks_connections')
    .update({
      last_synced_at: new Date().toISOString(),
      last_sync_error: lastError,
    } as any)
    .eq('business_id', businessId);

  return { synced, failed, lastError };
}

export async function syncQuickBooksPaymentForPayment(paymentId: string) {
  const supabase = createAdminClient();
  const { data: payment, error } = await supabase
    .from('payments')
    .select('*, invoices(*)')
    .eq('id', paymentId)
    .single();
  if (error) throw new Error(error.message);
  if (!payment) throw new Error('Payment not found');

  const invoice = (payment as any).invoices as Tables<'invoices'> | null;
  if (!invoice) throw new Error('Payment invoice not found');
  if (!invoice.qbo_invoice_id) throw new Error('Invoice is not linked to QuickBooks');

  const { data: contact, error: contactError } = await supabase
    .from('contacts')
    .select('id')
    .eq('id', invoice.contact_id)
    .eq('business_id', payment.business_id)
    .maybeSingle();
  if (contactError) throw new Error(contactError.message);
  if (!contact?.id) throw new Error('Invoice contact not found');

  const customer = await syncQuickBooksCustomerForContact(contact.id);
  const connection = await ensureQuickBooksAccessToken(payment.business_id);

  const payload: Record<string, unknown> = {
    CustomerRef: { value: customer.id },
    TotalAmt: Number(payment.amount ?? 0),
    TxnDate: toQuickBooksDate(payment.paid_at) ?? toQuickBooksDate(new Date().toISOString()),
    PaymentRefNum: payment.reference ?? undefined,
    PrivateNote: payment.notes ?? undefined,
    Line: [
      {
        Amount: Number(payment.amount ?? 0),
        LinkedTxn: [
          {
            TxnId: invoice.qbo_invoice_id,
            TxnType: 'Invoice',
          },
        ],
      },
    ],
  };

  if (payment.qbo_payment_id) {
    const existing = await fetchQuickBooksPaymentById(
      payment.business_id,
      connection.realm_id,
      payment.qbo_payment_id,
    );
    if (!existing?.SyncToken) throw new Error('QuickBooks payment sync token not found');
    payload.Id = payment.qbo_payment_id;
    payload.SyncToken = existing.SyncToken;
  }

  const { data: qbo } = await quickBooksApiRequest<QuickBooksPaymentResponse>(
    payment.business_id,
    `/v3/company/${connection.realm_id}/payment`,
    { method: 'POST', body: payload },
  );

  const qboPaymentId = qbo.Payment?.Id;
  if (!qboPaymentId) throw new Error('QuickBooks payment response missing Payment.Id');

  const { error: updateError } = await supabase
    .from('payments')
    .update({ qbo_payment_id: qboPaymentId } as any)
    .eq('id', payment.id)
    .eq('business_id', payment.business_id);
  if (updateError) throw new Error(updateError.message);

  await refreshQuickBooksInvoiceStatusForInvoice(payment.invoice_id);
  await supabase
    .from('quickbooks_connections')
    .update({ last_synced_at: new Date().toISOString(), last_sync_error: null } as any)
    .eq('business_id', payment.business_id);

  return { qboPaymentId, created: !payment.qbo_payment_id };
}

export async function processQuickBooksWebhookEvent(options: {
  realmId: string;
  entities: Array<{ name?: string; id?: string }>;
}) {
  const realmId = options.realmId.trim();
  if (!realmId) return { businessId: null, processed: 0 };

  const supabase = createAdminClient();
  const { data: connection, error: connectionError } = await supabase
    .from('quickbooks_connections')
    .select('business_id')
    .eq('realm_id', realmId)
    .maybeSingle();
  if (connectionError) throw new Error(connectionError.message);
  if (!connection?.business_id) return { businessId: null, processed: 0 };

  let processed = 0;
  for (const entity of options.entities) {
    const name = (entity.name ?? '').trim().toLowerCase();
    const id = (entity.id ?? '').trim();
    if (!name || !id) continue;

    try {
      if (name === 'invoice') {
        const { data: invoice } = await supabase
          .from('invoices')
          .select('id')
          .eq('business_id', connection.business_id)
          .eq('qbo_invoice_id', id)
          .maybeSingle();
        if (invoice?.id) {
          await refreshQuickBooksInvoiceStatusForInvoice(invoice.id);
          processed += 1;
        }
        continue;
      }

      if (name === 'payment') {
        const qboPayment = await fetchQuickBooksPaymentById(connection.business_id, realmId, id);
        if (!qboPayment) continue;

        const linkedInvoiceQboId =
          qboPayment.Line?.flatMap((line) => line.LinkedTxn ?? [])
            .find((txn) => (txn.TxnType ?? '').toLowerCase() === 'invoice')
            ?.TxnId ?? '';
        if (!linkedInvoiceQboId) continue;

        const { data: invoice } = await supabase
          .from('invoices')
          .select('id')
          .eq('business_id', connection.business_id)
          .eq('qbo_invoice_id', linkedInvoiceQboId)
          .maybeSingle();
        if (!invoice?.id) continue;

        const { data: existingPayment } = await supabase
          .from('payments')
          .select('id')
          .eq('business_id', connection.business_id)
          .eq('qbo_payment_id', id)
          .maybeSingle();

        if (existingPayment?.id) {
          const { error: updatePaymentError } = await supabase
            .from('payments')
            .update({
              amount: Number(qboPayment.TotalAmt ?? 0),
              reference: qboPayment.PaymentRefNum ?? null,
              notes: qboPayment.PrivateNote ?? null,
              paid_at: qboPayment.TxnDate
                ? `${qboPayment.TxnDate}T00:00:00.000Z`
                : new Date().toISOString(),
            } as any)
            .eq('id', existingPayment.id)
            .eq('business_id', connection.business_id);
          if (updatePaymentError) throw new Error(updatePaymentError.message);
        } else {
          const { error: insertPaymentError } = await supabase.from('payments').insert({
            business_id: connection.business_id,
            invoice_id: invoice.id,
            amount: Number(qboPayment.TotalAmt ?? 0),
            method: 'other',
            reference: qboPayment.PaymentRefNum ?? null,
            notes: qboPayment.PrivateNote ?? null,
            paid_at: qboPayment.TxnDate
              ? `${qboPayment.TxnDate}T00:00:00.000Z`
              : new Date().toISOString(),
            qbo_payment_id: id,
          } as any);
          if (insertPaymentError) throw new Error(insertPaymentError.message);
        }

        await refreshQuickBooksInvoiceStatusForInvoice(invoice.id);
        processed += 1;
        continue;
      }

      if (name === 'customer') {
        await syncQuickBooksCustomerFromQuickBooks(connection.business_id, id);
        processed += 1;
      }
    } catch {
      continue;
    }
  }

  await supabase
    .from('quickbooks_connections')
    .update({ last_synced_at: new Date().toISOString() } as any)
    .eq('business_id', connection.business_id);

  return { businessId: connection.business_id, processed };
}

export async function syncAllQuickBooksCustomersForBusiness(businessId: string) {
  const supabase = createAdminClient();
  const { data: contacts, error } = await supabase
    .from('contacts')
    .select('id')
    .eq('business_id', businessId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);

  let synced = 0;
  let failed = 0;
  let lastError: string | null = null;

  for (const contact of contacts ?? []) {
    try {
      await syncQuickBooksCustomerForContact(contact.id);
      synced += 1;
    } catch (syncError) {
      failed += 1;
      lastError = syncError instanceof Error ? syncError.message : 'Unknown sync error';
    }
  }

  await supabase
    .from('quickbooks_connections')
    .update({
      last_synced_at: new Date().toISOString(),
      last_sync_error: lastError,
    } as any)
    .eq('business_id', businessId);

  return { synced, failed, lastError };
}

export async function syncAllQuickBooksPaymentsForBusiness(businessId: string) {
  const supabase = createAdminClient();
  const { data: payments, error } = await supabase
    .from('payments')
    .select('id')
    .eq('business_id', businessId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);

  let synced = 0;
  let failed = 0;
  let lastError: string | null = null;

  for (const payment of payments ?? []) {
    try {
      await syncQuickBooksPaymentForPayment(payment.id);
      synced += 1;
    } catch (syncError) {
      failed += 1;
      lastError = syncError instanceof Error ? syncError.message : 'Unknown sync error';
    }
  }

  await supabase
    .from('quickbooks_connections')
    .update({
      last_synced_at: new Date().toISOString(),
      last_sync_error: lastError,
    } as any)
    .eq('business_id', businessId);

  return { synced, failed, lastError };
}

function splitDisplayName(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return { firstName: '', lastName: '' };
  const parts = trimmed.split(/\s+/);
  return {
    firstName: parts[0] ?? '',
    lastName: parts.slice(1).join(' '),
  };
}

function normalizeEmail(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase();
}

function normalizePhone(value: string | null | undefined) {
  return (value ?? '').replace(/\D/g, '');
}

function normalizeNameKey(firstName: string | null | undefined, lastName: string | null | undefined) {
  const first = (firstName ?? '').trim().toLowerCase();
  const last = (lastName ?? '').trim().toLowerCase();
  if (!first && !last) return '';
  return `${first}|${last}`;
}

export async function importQuickBooksCustomersForBusiness(businessId: string) {
  const connection = await ensureQuickBooksAccessToken(businessId);
  const supabase = createAdminClient();

  let startPosition = 1;
  const maxResults = 1000;
  let created = 0;
  let linked = 0;
  let failed = 0;
  let lastError: string | null = null;

  while (true) {
    const query = `select * from Customer startposition ${startPosition} maxresults ${maxResults}`;
    const { data } = await quickBooksApiRequest<QuickBooksCustomersQueryResponse>(
      businessId,
      `/v3/company/${connection.realm_id}/query`,
      { query: { query } },
    );

    const customers = data.QueryResponse?.Customer ?? [];
    if (customers.length === 0) break;

    for (const customer of customers) {
      try {
        const result = await upsertQuickBooksCustomerIntoContact({
          businessId,
          customer,
        });
        if (result.linked) {
          linked += 1;
        } else if (result.created) {
          created += 1;
        }
      } catch (importError) {
        failed += 1;
        lastError = importError instanceof Error ? importError.message : 'Unknown import error';
      }
    }

    if (customers.length < maxResults) break;
    startPosition += customers.length;
  }

  await supabase
    .from('quickbooks_connections')
    .update({
      last_synced_at: new Date().toISOString(),
      last_sync_error: lastError,
    } as any)
    .eq('business_id', businessId);

  return { created, linked, failed, lastError };
}

export async function runInitialQuickBooksSyncForBusiness(businessId: string) {
  const contactsImported = await importQuickBooksCustomersForBusiness(businessId);
  const contactsSynced = await syncAllQuickBooksCustomersForBusiness(businessId);
  const estimatesSynced = await syncAllQuickBooksEstimatesForBusiness(businessId);
  const invoicesSynced = await syncAllQuickBooksInvoicesForBusiness(businessId);
  const paymentsSynced = await syncAllQuickBooksPaymentsForBusiness(businessId);

  const lastError =
    paymentsSynced.lastError ??
    invoicesSynced.lastError ??
    estimatesSynced.lastError ??
    contactsSynced.lastError ??
    contactsImported.lastError ??
    null;

  await createAdminClient()
    .from('quickbooks_connections')
    .update({
      last_synced_at: new Date().toISOString(),
      last_sync_error: lastError,
    } as any)
    .eq('business_id', businessId);

  return {
    contactsImported,
    contactsSynced,
    estimatesSynced,
    invoicesSynced,
    paymentsSynced,
    lastError,
  };
}

export async function runFullQuickBooksReconcileForBusiness(businessId: string) {
  return runInitialQuickBooksSyncForBusiness(businessId);
}
