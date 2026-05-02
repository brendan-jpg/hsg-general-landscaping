"use server";
import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  assertAdminDashboardAction,
  assertPlatformAdminAction,
  getCurrentDashboardBusinessId,
  getCurrentDashboardProfile,
  getConfiguredPlatformAdminEmails,
  isPlatformAdminEmail,
} from "@/lib/authz/dashboard";
import {
  createGoogleBusinessProfileLocalPost,
  deleteGoogleBusinessProfileReviewReply,
  syncGoogleBusinessProfileReviews,
  upsertGoogleBusinessProfileReviewReply,
} from "@/lib/integrations/googleBusinessProfile";
import {
  importQuickBooksCustomersForBusiness,
  createQuickBooksItemForBusiness,
  deactivateQuickBooksItemForBusiness,
  listQuickBooksItemsForBusiness,
  recordQuickBooksSyncError,
  runFullQuickBooksReconcileForBusiness,
  refreshQuickBooksInvoiceStatusForInvoice,
  syncAllQuickBooksCustomersForBusiness,
  syncAllQuickBooksInvoicesForBusiness,
  syncQuickBooksCustomerForContact,
  syncQuickBooksEstimateForEstimate,
  syncQuickBooksInvoiceForInvoice,
  updateQuickBooksItemForBusiness,
  syncQuickBooksPaymentForPayment,
} from "@/lib/integrations/quickbooks";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, renderTemplate } from "@/lib/utils/email";
import {
  PLATFORM_AUTOMATION_TRIGGER_VALUES,
  type PlatformAutomationTriggerValue,
} from "@/lib/email/automationTriggers";
import { parseImportedContentToBlocks } from "@/lib/content/blockImport";
import {
  convertBasicBlocksToTemplatePageContent,
  createTemplatePageContent,
  sanitizeTemplatePageContent,
  toTemplatePageContent,
} from "@/lib/sections/templatePages";
import { parseSharedSections, saveBusinessSharedSections } from "@/lib/sections/sharedSections";
import {
  getRecommendedPageTemplateKeyForPageKind,
  getRecommendedPageTemplateKeyForSlug,
  isAllowedAreaTemplateKey,
  isAllowedPageTemplateKey,
  isAllowedServiceTemplateKey,
} from "@/lib/sections/templateOptions";
import { getRequiredDashboardPageBySlug, isProtectedPage, type PageKind } from "@/lib/content/pageConfig";
import { compileFrontendThemeSource, getFrontendThemeEditorBaseSource, wrapThemeEditorSource } from "@/lib/frontend/themeCss";
import { buildClientThemeKey, normalizeFrontendTheme } from "@/lib/frontend/themes";
import { getFreeTrialIndustryPreset, type FreeTrialServicePreset } from "@/lib/freeTrial/presets";
import { footerBuilderConfigToJson, parseFooterBuilderConfig } from "@/lib/navigation/footerBuilder";
import { headerNavConfigToJson, parseHeaderNavConfig } from "@/lib/navigation/headerNavigation";
import { getBusiness } from "@/lib/utils/business";
import { parseBusinessLicenses } from "@/lib/utils/licenses";
import { markAllLeadNotificationsReadForBusiness } from "@/lib/notifications/queries";
import { normalizeBusinessTimezone } from "@/lib/timezones";
import {
  collectUploadedFormFiles,
  parseUploadedFormFileValue,
  uploadedFormFileValueToJson,
} from "@/lib/forms/uploads";
import { validateFormUploadFile } from "@/lib/forms/uploadValidation";
import {
  buildAreaPath,
  buildServicePath,
  getAreaDetailBaseSegment,
  getServiceDetailBaseSegment,
  normalizePublicPathSegment,
} from "@/lib/utils/publicPaths";
import type { Json, Tables, TablesInsert, TablesUpdate } from "@/lib/types/database";

function revalidateContactDetailPaths(id: string) {
  revalidatePath(`/dashboard/contacts/${id}`);
  revalidatePath(`/dashboard/leads/${id}`);
  revalidatePath(`/dashboard/prospects/${id}`);
  revalidatePath(`/dashboard/customers/${id}`);
}

function revalidateDashboardShell() {
  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/leads");
}

async function getRequestIpAddress() {
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwardedFor) return forwardedFor;
  const realIp = requestHeaders.get("x-real-ip")?.trim();
  return realIp || null;
}

async function getRequestUserAgent() {
  const requestHeaders = await headers();
  return requestHeaders.get("user-agent")?.trim() || null;
}

async function getRequestHostName() {
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim() || "";
  const host = forwardedHost || requestHeaders.get("host")?.trim() || "";
  return host.toLowerCase().replace(/:\d+$/, "");
}

function normalizeEmailForMatch(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function normalizePhoneForMatch(value: string | null | undefined) {
  return (value ?? "").replace(/\D+/g, "");
}

function normalizeLooseTextForMatch(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function readSubmissionMatchText(data: Json | null | undefined, ...keys: string[]) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return "";
  const record = data as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value !== "string") continue;
    const normalized = value.trim();
    if (normalized) return normalized;
  }
  return "";
}

function readSubmissionMatchTextBySuffix(data: Json | null | undefined, ...suffixes: string[]) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return "";
  const record = data as Record<string, unknown>;
  for (const suffix of suffixes) {
    for (const [key, value] of Object.entries(record)) {
      if (!key.endsWith(suffix)) continue;
      if (typeof value !== "string") continue;
      const normalized = value.trim();
      if (normalized) return normalized;
    }
  }
  return "";
}

function submissionMatchesContactIdentity(
  submission: Pick<Tables<"form_submissions">, "data">,
  contact: {
    email?: string | null;
    phone?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    addressLine1?: string | null;
    city?: string | null;
  }
) {
  const submissionEmail = normalizeEmailForMatch(
    readSubmissionMatchText(submission.data, "email", "email_address"),
  );
  const submissionPhone = normalizePhoneForMatch(
    readSubmissionMatchText(submission.data, "phone", "phone_number", "phoneNumber", "mobile"),
  );
  const submissionFirstName = normalizeLooseTextForMatch(
    readSubmissionMatchText(submission.data, "first_name", "firstname", "firstName", "given_name"),
  );
  const submissionLastName = normalizeLooseTextForMatch(
    readSubmissionMatchText(submission.data, "last_name", "lastname", "lastName", "family_name", "surname"),
  );
  const submissionFullName = normalizeLooseTextForMatch(
    readSubmissionMatchText(submission.data, "name", "full_name", "fullName"),
  );
  const submissionAddressLine1 = normalizeLooseTextForMatch(
    readSubmissionMatchText(submission.data, "address_line1", "address", "street_address", "service_address", "property_address") ||
      readSubmissionMatchTextBySuffix(submission.data, "__address_line1"),
  );
  const submissionCity = normalizeLooseTextForMatch(
    readSubmissionMatchText(submission.data, "city") || readSubmissionMatchTextBySuffix(submission.data, "__city"),
  );

  const contactEmail = normalizeEmailForMatch(contact.email);
  const contactPhone = normalizePhoneForMatch(contact.phone);
  const contactFirstName = normalizeLooseTextForMatch(contact.firstName);
  const contactLastName = normalizeLooseTextForMatch(contact.lastName);
  const contactFullName = normalizeLooseTextForMatch([contact.firstName, contact.lastName].filter(Boolean).join(" "));
  const contactAddressLine1 = normalizeLooseTextForMatch(contact.addressLine1);
  const contactCity = normalizeLooseTextForMatch(contact.city);

  if (contactEmail && submissionEmail && contactEmail === submissionEmail) return true;
  if (contactPhone && submissionPhone && contactPhone === submissionPhone) return true;

  const hasNameMatch =
    (contactFirstName && submissionFirstName && contactFirstName === submissionFirstName &&
      contactLastName && submissionLastName && contactLastName === submissionLastName) ||
    (contactFullName && submissionFullName && contactFullName === submissionFullName);

  if (hasNameMatch && contactAddressLine1 && submissionAddressLine1 && contactAddressLine1 === submissionAddressLine1) {
    return true;
  }

  if (hasNameMatch && contactCity && submissionCity && contactCity === submissionCity) {
    return true;
  }

  return false;
}

async function verifyRecaptchaToken(options: {
  token: string;
  expectedAction: string;
}) {
  const projectId =
    process.env.RECAPTCHA_ENTERPRISE_PROJECT_ID?.trim() ||
    process.env.GOOGLE_CLOUD_PROJECT_ID?.trim() ||
    "";
  const apiKey = process.env.RECAPTCHA_ENTERPRISE_API_KEY?.trim() || "";
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim() || "";
  if (!projectId || !apiKey || !siteKey) return;

  const token = options.token.trim();
  if (!token) {
    throw new Error("Spam verification failed. Please try again.");
  }

  const remoteIp = await getRequestIpAddress();
  const requestHost = await getRequestHostName();

  const response = await fetch(`https://recaptchaenterprise.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/assessments?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      event: {
        token,
        siteKey,
        userAgent: (await getRequestUserAgent()) || undefined,
        userIpAddress: remoteIp || undefined,
        expectedAction: options.expectedAction,
      },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const responseBody = await response.text().catch(() => "");
    console.error("reCAPTCHA Enterprise request failed", {
      status: response.status,
      statusText: response.statusText,
      requestHost,
      expectedAction: options.expectedAction,
      body: responseBody.slice(0, 500),
    });
    throw new Error("Spam verification failed. Please try again.");
  }

  const result = (await response.json()) as {
    tokenProperties?: {
      valid?: boolean;
      invalidReason?: string;
      action?: string;
      hostname?: string;
    };
    riskAnalysis?: {
      score?: number;
      reasons?: string[];
    };
  };

  if (!result.tokenProperties?.valid) {
    console.error("reCAPTCHA Enterprise rejected token", {
      requestHost,
      expectedAction: options.expectedAction,
      invalidReason: result.tokenProperties?.invalidReason ?? null,
      hostname: result.tokenProperties?.hostname ?? null,
      action: result.tokenProperties?.action ?? null,
    });
    throw new Error("Spam verification failed. Please try again.");
  }

  if ((result.tokenProperties?.action ?? "").trim() !== options.expectedAction) {
    console.error("reCAPTCHA Enterprise action mismatch", {
      requestHost,
      expectedAction: options.expectedAction,
      receivedAction: result.tokenProperties?.action ?? null,
      hostname: result.tokenProperties?.hostname ?? null,
    });
    throw new Error("Spam verification failed. Please try again.");
  }

  const verifiedHost = (result.tokenProperties?.hostname ?? "").trim().toLowerCase();
  if (verifiedHost && requestHost && verifiedHost !== requestHost) {
    console.error("reCAPTCHA Enterprise hostname mismatch", {
      requestHost,
      verifiedHost,
      expectedAction: options.expectedAction,
    });
    throw new Error("Spam verification failed. Please try again.");
  }

  const score = typeof result.riskAnalysis?.score === "number" ? result.riskAnalysis.score : 0;
  if (score < 0.5) {
    console.error("reCAPTCHA Enterprise low score", {
      requestHost,
      verifiedHost: verifiedHost || null,
      expectedAction: options.expectedAction,
      score,
      reasons: result.riskAnalysis?.reasons ?? [],
    });
    throw new Error("Your submission looked suspicious. Please try again.");
  }
}

function normalizeDomain(value: string | null | undefined) {
  return (value ?? "").trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

function formatSubmittedAt(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

async function getBusinessSiteBaseUrl(businessId: string) {
  const admin = createAdminClient();

  const { data: domainRow, error: domainError } = await admin
    .from("business_domains")
    .select("domain, canonical_domain")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .eq("is_primary", true)
    .maybeSingle();
  if (domainError) throw new Error(domainError.message);

  const mappedDomain = normalizeDomain(domainRow?.canonical_domain || domainRow?.domain);
  if (mappedDomain) return `https://${mappedDomain}`;

  const { data: business, error: businessError } = await admin
    .from("businesses")
    .select("domain")
    .eq("id", businessId)
    .maybeSingle();
  if (businessError) throw new Error(businessError.message);

  const businessDomain = normalizeDomain(business?.domain);
  if (businessDomain) return `https://${businessDomain}`;

  return "";
}

async function getEstimateApprovalBaseUrl(businessId: string) {
  const tenantSiteUrl = await getBusinessSiteBaseUrl(businessId);
  if (tenantSiteUrl) return tenantSiteUrl;

  const siteUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    process.env.VERCEL_URL?.trim() ||
    "";
  if (siteUrl) {
    return siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`;
  }

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host")?.trim() || requestHeaders.get("host")?.trim() || "";
  const proto = requestHeaders.get("x-forwarded-proto")?.trim() || "https";
  return host ? `${proto}://${host}` : "";
}

interface FormAutoResponseSettings {
  enabled: boolean;
  contact: boolean;
  quote_request: boolean;
  booking: boolean;
  newsletter: boolean;
}

function getDefaultFormAutoResponseSettings(): FormAutoResponseSettings {
  return {
    enabled: false,
    contact: true,
    quote_request: true,
    booking: true,
    newsletter: false,
  };
}

function parseFormAutoResponseSettings(settings: Json | null | undefined): FormAutoResponseSettings {
  const defaults = getDefaultFormAutoResponseSettings();
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return defaults;

  const root = settings as Record<string, unknown>;
  const raw = root.form_auto_responses;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return defaults;
  const parsed = raw as Record<string, unknown>;

  const readBoolean = (key: keyof FormAutoResponseSettings, fallback: boolean) =>
    typeof parsed[key] === "boolean" ? (parsed[key] as boolean) : fallback;

  return {
    enabled: readBoolean("enabled", defaults.enabled),
    contact: readBoolean("contact", defaults.contact),
    quote_request: readBoolean("quote_request", defaults.quote_request),
    booking: readBoolean("booking", defaults.booking),
    newsletter: readBoolean("newsletter", defaults.newsletter),
  };
}

function mergeFormAutoResponseSettingsIntoBusinessSettings(
  existingSettings: Json | null | undefined,
  next: FormAutoResponseSettings
): Json {
  const base =
    existingSettings && typeof existingSettings === "object" && !Array.isArray(existingSettings)
      ? ({ ...(existingSettings as Record<string, Json | undefined>) } as Record<string, Json | undefined>)
      : ({} as Record<string, Json | undefined>);

  base.form_auto_responses = {
    enabled: next.enabled,
    contact: next.contact,
    quote_request: next.quote_request,
    booking: next.booking,
    newsletter: next.newsletter,
  } as Json;

  return base as Json;
}

async function sendFormAutoResponseEmail(options: {
  businessId: string;
  formType: Tables<"form_submissions">["form_type"];
  submissionId?: string | null;
  data: Record<string, Json | undefined>;
}) {
  const { businessId, formType, submissionId, data } = options;
  const admin = createAdminClient();

  const email = String(data.email ?? "").trim();
  if (!email) return;

  const firstName = String(data.first_name ?? "").trim();
  const lastName = String(data.last_name ?? "").trim();
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const customerName = fullName || String(data.name ?? "").trim() || "there";
  const context = await getBusinessNotificationContext(admin, businessId);

  await sendAutomationRuleEmails({
    supabase: admin,
    businessId,
    triggerEvent: "inquiry_response",
    fallbackRecipients: [{ email, contactId: null }],
    relatedType: "form_submission_auto_response",
    relatedId: submissionId ?? null,
    templateVariables: {
      contact_name: customerName,
      contact_first_name: firstName || customerName,
      contact_last_name: lastName || "",
      contact_email: email,
      business_name: context.businessName,
      form_type: formType,
    },
  });
}

async function reconcileFormSubmissionsForContact(options: {
  admin: ReturnType<typeof createAdminClient>;
  businessId: string;
  contactId: string;
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  addressLine1?: string | null;
  city?: string | null;
}) {
  const { admin, businessId, contactId, email, phone, firstName, lastName, addressLine1, city } = options;
  const normalizedEmail = normalizeEmailForMatch(email);
  const normalizedPhone = normalizePhoneForMatch(phone);
  const normalizedFirstName = normalizeLooseTextForMatch(firstName);
  const normalizedLastName = normalizeLooseTextForMatch(lastName);
  const normalizedAddressLine1 = normalizeLooseTextForMatch(addressLine1);
  const normalizedCity = normalizeLooseTextForMatch(city);
  if (
    !normalizedEmail &&
    !normalizedPhone &&
    !(normalizedFirstName && normalizedLastName) &&
    !normalizedAddressLine1
  ) return;

  const { data: submissions, error: submissionsError } = await admin
    .from("form_submissions")
    .select("id, data, contact_id")
    .eq("business_id", businessId)
    .is("contact_id", null)
    .order("created_at", { ascending: false })
    .limit(250);
  if (submissionsError) throw new Error(submissionsError.message);

  const idsToRelink = ((submissions ?? []) as Array<Pick<Tables<"form_submissions">, "id" | "data" | "contact_id">>)
    .filter((submission) => {
      if (submission.contact_id) return false;
      return submissionMatchesContactIdentity(submission, {
        email: normalizedEmail,
        phone: normalizedPhone,
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
        addressLine1: normalizedAddressLine1,
        city: normalizedCity,
      });
    })
    .map((submission) => submission.id);

  if (idsToRelink.length === 0) return;

  const { error: updateError } = await admin
    .from("form_submissions")
    .update({ contact_id: contactId } satisfies TablesUpdate<"form_submissions">)
    .eq("business_id", businessId)
    .is("contact_id", null)
    .in("id", idsToRelink);
  if (updateError) throw new Error(updateError.message);
}

// ---- Form submission (public, no auth required) ----

export async function submitForm(formData: FormData) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const submittedBusinessId = ((formData.get("business_id") as string) || "").trim();
  const resolvedBusiness = await getBusiness();
  const businessId = resolvedBusiness?.id ?? submittedBusinessId;
  if (!businessId) throw new Error("Business context is required");
  const formId = ((formData.get("form_id") as string) || "").trim() || null;
  const formType =
    ((formData.get("form_type") as string) || "contact") as Tables<"form_submissions">["form_type"];
  const recaptchaToken = ((formData.get("recaptcha_token") as string) || "").trim();
  const recaptchaAction = ((formData.get("recaptcha_action") as string) || "").trim() || "frontend_form_submit";

  if (
    process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim() &&
    (process.env.RECAPTCHA_ENTERPRISE_PROJECT_ID?.trim() || process.env.GOOGLE_CLOUD_PROJECT_ID?.trim()) &&
    process.env.RECAPTCHA_ENTERPRISE_API_KEY?.trim()
  ) {
    await verifyRecaptchaToken({
      token: recaptchaToken,
      expectedAction: recaptchaAction,
    });
  }

  const dataRecord: Record<string, Json | undefined> = {};
  const uploadedFileQueue: Array<{ key: string; file: File; index: number }> = [];
  const nextValueIndexByKey = new Map<string, number>();
  const reservedKeys = new Set(["business_id", "form_type", "form_id", "recaptcha_token", "recaptcha_action"]);

  for (const [key, value] of formData.entries()) {
    if (reservedKeys.has(key)) continue;

    if (value instanceof File) {
      if (value.size <= 0 || !value.name.trim()) continue;
      const nextIndex = nextValueIndexByKey.get(key) ?? 0;
      nextValueIndexByKey.set(key, nextIndex + 1);
      uploadedFileQueue.push({ key, file: value, index: nextIndex });
      continue;
    }

    const nextValue = value.toString();
    const uploadedFileValue = parseUploadedFormFileValue(nextValue);
    if (uploadedFileValue) {
      const existingValue = dataRecord[key];
      const jsonValue = uploadedFormFileValueToJson(uploadedFileValue);
      if (existingValue === undefined) {
        dataRecord[key] = jsonValue;
      } else if (Array.isArray(existingValue)) {
        dataRecord[key] = [...existingValue, jsonValue];
      } else {
        dataRecord[key] = [existingValue, jsonValue];
      }
      continue;
    }

    const existingValue = dataRecord[key];
    if (existingValue === undefined) {
      dataRecord[key] = nextValue;
      continue;
    }
    if (Array.isArray(existingValue)) {
      dataRecord[key] = [...existingValue, nextValue];
      continue;
    }
    dataRecord[key] = [existingValue, nextValue];
  }

  const payload: TablesInsert<"form_submissions"> = {
    business_id: businessId,
    form_type: formType,
    data: dataRecord as Json,
    page_url: (formData.get("page_url") as string) || null,
    utm_source: (formData.get("utm_source") as string) || null,
    utm_medium: (formData.get("utm_medium") as string) || null,
    utm_campaign: (formData.get("utm_campaign") as string) || null,
  };

  const { data: insertedSubmission, error } = await admin
    .from("form_submissions")
    .insert(payload)
    .select("id, created_at")
    .single();
  if (error) throw new Error(error.message);

  if (uploadedFileQueue.length > 0) {
    const bucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "media";

    for (const queued of uploadedFileQueue) {
      const { contentType } = validateFormUploadFile(queued.file);
      const normalizedName = queued.file.name.trim().replace(/[^a-zA-Z0-9._-]/g, "-");
      const safeName = normalizedName || `file-${queued.index + 1}`;
      const objectPath = `${businessId}/form-submissions/${insertedSubmission.id}/${Date.now()}-${queued.index}-${crypto.randomUUID()}-${safeName}`;
      const fileBuffer = Buffer.from(await queued.file.arrayBuffer());

      const { error: uploadError } = await admin.storage.from(bucket).upload(objectPath, fileBuffer, {
        upsert: false,
        contentType,
        cacheControl: "31536000",
      });
      if (uploadError) throw new Error(uploadError.message);

      const fileValue: Json = {
        file_name: queued.file.name,
        file_size: queued.file.size,
        file_type: contentType,
        file_url: "",
        storage_path: objectPath,
      };

      const existingValue = dataRecord[queued.key];
      if (existingValue === undefined) {
        dataRecord[queued.key] = fileValue;
      } else if (Array.isArray(existingValue)) {
        dataRecord[queued.key] = [...existingValue, fileValue];
      } else {
        dataRecord[queued.key] = [existingValue, fileValue];
      }
    }

    const { error: updateSubmissionError } = await admin
      .from("form_submissions")
      .update({ data: dataRecord as Json } satisfies TablesUpdate<"form_submissions">)
      .eq("id", insertedSubmission.id)
      .eq("business_id", businessId);
    if (updateSubmissionError) throw new Error(updateSubmissionError.message);
  }

  const readText = (...keys: string[]) => {
    for (const key of keys) {
      const value = dataRecord[key];
      if (typeof value !== "string") continue;
      const normalized = value.trim();
      if (normalized) return normalized;
    }
    return "";
  };

  const readTextBySuffix = (...suffixes: string[]) => {
    for (const suffix of suffixes) {
      for (const [key, value] of Object.entries(dataRecord)) {
        if (!key.endsWith(suffix)) continue;
        if (typeof value !== "string") continue;
        const normalized = value.trim();
        if (normalized) return normalized;
      }
    }
    return "";
  };

  let firstName = readText("first_name", "firstname", "firstName", "given_name");
  let lastName = readText("last_name", "lastname", "lastName", "family_name", "surname");
  const fullName = readText("name", "full_name", "fullName");
  const email = readText("email", "email_address").toLowerCase();
  const phone = readText("phone", "phone_number", "phoneNumber", "mobile");
  const addressLine1 =
    readText("address_line1") ||
    readTextBySuffix("__address_line1") ||
    readText("address", "street_address", "service_address", "property_address");
  const city = readText("city") || readTextBySuffix("__city");
  const state = readText("state") || readTextBySuffix("__state");
  const zip = readText("zip", "postal_code") || readTextBySuffix("__zip");
  const address = [addressLine1, city, [state, zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const message = readText("message", "details", "notes", "comment");
  const leadName = [firstName, lastName].filter(Boolean).join(" ").trim() || fullName || email || phone || "Lead";
  const submittedAt = formatSubmittedAt(insertedSubmission.created_at);

  if (!firstName && !lastName && fullName) {
    const parts = fullName.split(/\s+/).filter(Boolean);
    if (parts.length > 0) {
      firstName = parts[0] ?? "";
      lastName = parts.slice(1).join(" ");
    }
  }

  if (!firstName && !lastName && email) {
    firstName = email.split("@")[0] ?? "";
  }

  const hasContactIdentity = Boolean(email || phone || firstName || lastName || fullName);
  if (hasContactIdentity) {
    try {
      type ContactLookupRow = Pick<
        Tables<"contacts">,
        "id" | "first_name" | "last_name" | "email" | "phone" | "notes"
      >;
      let existingContact: ContactLookupRow | null = null;

      if (email) {
        const { data: emailMatches, error: emailError } = await admin
          .from("contacts")
          .select("id, first_name, last_name, email, phone, notes")
          .eq("business_id", businessId)
          .eq("email", email)
          .limit(1);
        if (emailError) throw new Error(emailError.message);
        const matches = (emailMatches ?? []) as ContactLookupRow[];
        existingContact = matches[0] ?? null;
      }

      if (!existingContact && phone) {
        const { data: phoneMatches, error: phoneError } = await admin
          .from("contacts")
          .select("id, first_name, last_name, email, phone, notes")
          .eq("business_id", businessId)
          .eq("phone", phone)
          .limit(1);
        if (phoneError) throw new Error(phoneError.message);
        const matches = (phoneMatches ?? []) as ContactLookupRow[];
        existingContact = matches[0] ?? null;
      }

      let contactId = existingContact?.id ?? null;
      if (!existingContact) {
        const insertContact: TablesInsert<"contacts"> = {
          business_id: businessId,
          first_name: firstName || "Website",
          last_name: lastName || null,
          email: email || null,
          phone: phone || null,
          address_line1: addressLine1 || null,
          city: city || null,
          state: state || null,
          zip: zip || null,
          notes: message || null,
          source: "website_form",
          source_submission_id: insertedSubmission.id,
          status: "lead",
        };
        const { data: createdContact, error: insertContactError } = await admin
          .from("contacts")
          .insert(insertContact)
          .select("id")
          .single();
        if (insertContactError) throw new Error(insertContactError.message);
        contactId = createdContact.id;
      }

      if (contactId) {
        const { error: linkContactError } = await admin
          .from("form_submissions")
          .update({ contact_id: contactId } satisfies TablesUpdate<"form_submissions">)
          .eq("id", insertedSubmission.id)
          .eq("business_id", businessId);
        if (linkContactError) throw new Error(linkContactError.message);

        await admin
          .from("contacts")
          .update({ source_submission_id: insertedSubmission.id } satisfies TablesUpdate<"contacts">)
          .eq("id", contactId)
          .eq("business_id", businessId)
          .is("source_submission_id", null);

        await reconcileFormSubmissionsForContact({
          admin,
          businessId,
          contactId,
          email,
          phone,
          firstName,
          lastName,
          addressLine1,
          city,
        });
      }
    } catch (contactProcessingError) {
      console.error("Unable to attach website form submission to a contact:", contactProcessingError);
    }
  }

  try {
    const context = await getBusinessNotificationContext(admin, businessId);
    const leadFiles = buildLeadFilesEmailContent(dataRecord);
    await sendAutomationRuleEmails({
      supabase: admin,
      businessId,
      triggerEvent: "lead_notification",
      fallbackRecipients: [],
      relatedType: "internal_notification",
      relatedId: insertedSubmission.id,
      templateVariables: {
        common: {
          contact_name: leadName,
          contact_first_name: firstName || leadName,
          contact_last_name: lastName || "",
          contact_address: address || "-",
          contact_email: email || "-",
          contact_phone: phone || "-",
          contact_message: message || "-",
          contact_files: leadFiles.textValue,
          business_name: context.businessName,
          form_type: formType,
          submitted_at: submittedAt,
        },
        html: {
          contact_files: leadFiles.htmlValue,
        },
      },
      fallbackSubject: `New lead: ${leadName}`,
      fallbackHtml: toNotificationHtml([
        `A new website form submission was received for ${leadName}.`,
        email ? `Email: ${email}` : "Email: -",
        phone ? `Phone: ${phone}` : "Phone: -",
        address ? `Address: ${address}` : "Address: -",
        message ? `Message: ${message}` : "Message: -",
        `Submitted: ${submittedAt}`,
      ]),
      fallbackText: [
        `A new website form submission was received for ${leadName}.`,
        email ? `Email: ${email}` : "Email: -",
        phone ? `Phone: ${phone}` : "Phone: -",
        address ? `Address: ${address}` : "Address: -",
        message ? `Message: ${message}` : "Message: -",
        `Submitted: ${submittedAt}`,
      ].join("\n\n"),
      appendHtml: leadFiles.htmlBlock,
      appendText: leadFiles.textBlock ? `\n\n${leadFiles.textBlock}` : "",
      activityAction: "notification.new_lead",
      activityEntityType: "form_submission",
      activityEntityId: insertedSubmission.id,
      activitySubject: `New lead: ${leadName}`,
    });
  } catch (notificationError) {
    console.error("Failed to process form submission notifications:", notificationError);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/contacts");

  try {
    await sendFormAutoResponseEmail({
      businessId,
      formType,
      submissionId: insertedSubmission.id,
      data: dataRecord,
    });
  } catch (autoResponseError) {
    console.error("Unable to send form auto-response email:", autoResponseError);
  }

  return { success: true };
}

// ---- Blog CRUD ----

export async function saveBlogPost(formData: FormData) {
  await assertAdminDashboardAction();
  const supabase = await createClient();

  const id = (formData.get("id") as string) || null;
  const businessId =
    (formData.get("business_id") as string) || (await resolveCurrentBusinessId()) || "";

  if (!businessId) throw new Error("Business context is required");
  const sharedSections = parseSharedSectionsFromFormData(formData);

  const linkedRaw = (formData.get("linked_service_ids") as string) || "[]";
  let linkedServiceIds: string[] = [];
  try {
    const parsed = JSON.parse(linkedRaw) as unknown;
    linkedServiceIds = Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    linkedServiceIds = [];
  }

  let content: Json = [];
  const contentRaw = (formData.get("content") as string) || "[]";
  try {
    const parsed = JSON.parse(contentRaw) as unknown;
    content =
      (convertBasicBlocksToTemplatePageContent(
        parsed,
        "blog-post-content-v1",
        ((formData.get("title") as string) || "").trim() || "Article",
      ) ??
        sanitizeTemplatePageContent(parsed)) as unknown as Json;
  } catch {
    content = sanitizeTemplatePageContent({
      kind: "template-page",
      version: 1,
      templateKey: "blog-post-content-v1",
      sections: [],
    }) as unknown as Json;
  }

  const post: TablesInsert<"blog_posts"> = {
    title: ((formData.get("title") as string) || "").trim(),
    slug:
      ((formData.get("slug") as string) || "").trim() ||
      slugify((formData.get("title") as string) || ""),
    excerpt: ((formData.get("excerpt") as string) || "").trim() || null,
    content,
    featured_image_url:
      ((formData.get("featured_image_url") as string) || "").trim() || null,
    meta_title: ((formData.get("meta_title") as string) || "").trim() || null,
    meta_description:
      ((formData.get("meta_description") as string) || "").trim() || null,
    status: (formData.get("status") as any) || "draft",
    business_id: businessId,
    read_time_minutes: parseNullableNumber(formData.get("read_time_minutes")),
    published_at:
      (formData.get("status") as string) === "published"
        ? new Date().toISOString()
        : null,
  };

  if (!post.title) throw new Error("Title is required");
  if (!post.slug) throw new Error("Slug is required");
  await ensureUniqueSlug({
    table: "blog_posts",
    businessId,
    slug: post.slug,
    id,
    label: "Blog post",
  });

  if (id) {
    const { data, error } = await supabase
      .from("blog_posts")
      .update(post)
      .eq("id", id)
      .eq("business_id", businessId)
      .select("id, slug")
      .single();
    if (error) throw new Error(error.message);

    const blogPostId = data.id;

    const { error: deleteLinksError } = await supabase
      .from("blog_post_services")
      .delete()
      .eq("blog_post_id", blogPostId);
    if (deleteLinksError) throw new Error(deleteLinksError.message);

    if (linkedServiceIds.length > 0) {
      const linkRows: TablesInsert<"blog_post_services">[] = linkedServiceIds.map((serviceId) => ({
        blog_post_id: blogPostId,
        service_id: serviceId,
      }));
      const { error: insertLinksError } = await supabase.from("blog_post_services").insert(linkRows);
      if (insertLinksError) throw new Error(insertLinksError.message);
    }

    if (sharedSections) {
      await saveBusinessSharedSections(businessId, sharedSections);
    }

    revalidatePath("/dashboard/blog");
    revalidatePath(`/dashboard/blog/${id}`);
    revalidatePath("/blog");
    revalidatePath(`/blog/${data.slug}`);
    return { success: true, id: data.id };
  } else {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const insertPayload: TablesInsert<"blog_posts"> = {
      ...post,
      author_id: user?.id ?? null,
    };

    const { data, error } = await supabase
      .from("blog_posts")
      .insert(insertPayload)
      .select("id, slug")
      .single();
    if (error) throw new Error(error.message);

    if (linkedServiceIds.length > 0) {
      const linkRows: TablesInsert<"blog_post_services">[] = linkedServiceIds.map((serviceId) => ({
        blog_post_id: data.id,
        service_id: serviceId,
      }));
      const { error: insertLinksError } = await supabase.from("blog_post_services").insert(linkRows);
      if (insertLinksError) throw new Error(insertLinksError.message);
    }

    if (sharedSections) {
      await saveBusinessSharedSections(businessId, sharedSections);
    }

    revalidatePath("/dashboard/blog");
    revalidatePath(`/dashboard/blog/${data.id}`);
    revalidatePath("/blog");
    revalidatePath(`/blog/${data.slug}`);
    return { success: true, id: data.id };
  }
}

export async function deleteBlogPost(id: string) {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const { data: existing, error: fetchError } = await supabase
    .from("blog_posts")
    .select("slug")
    .eq("id", id)
    .eq("business_id", businessId)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  const { error: deleteLinksError } = await supabase
    .from("blog_post_services")
    .delete()
    .eq("blog_post_id", id);
  if (deleteLinksError) throw new Error(deleteLinksError.message);

  const { error } = await supabase
    .from("blog_posts")
    .delete()
    .eq("id", id)
    .eq("business_id", businessId);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/blog");
  revalidatePath("/blog");
  revalidatePath(`/blog/${existing.slug}`);
  return { success: true };
}

export async function deleteBlogPostsBulk(ids: string[]) {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const uniqueIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
  if (uniqueIds.length === 0) return { success: true, deletedCount: 0 };

  const { data: existing, error: fetchError } = await supabase
    .from("blog_posts")
    .select("id, slug")
    .eq("business_id", businessId)
    .in("id", uniqueIds);
  if (fetchError) throw new Error(fetchError.message);

  const existingIds = (existing ?? []).map((post) => post.id);
  if (existingIds.length === 0) return { success: true, deletedCount: 0 };

  const { error: deleteLinksError } = await supabase
    .from("blog_post_services")
    .delete()
    .in("blog_post_id", existingIds);
  if (deleteLinksError) throw new Error(deleteLinksError.message);

  const { error: deleteError } = await supabase
    .from("blog_posts")
    .delete()
    .eq("business_id", businessId)
    .in("id", existingIds);
  if (deleteError) throw new Error(deleteError.message);

  revalidatePath("/dashboard/blog");
  revalidatePath("/blog");
  for (const post of existing ?? []) {
    revalidatePath(`/blog/${post.slug}`);
  }

  return { success: true, deletedCount: existingIds.length };
}

// ---- Custom Content CRUD ----

async function saveCurrentBusinessContentDefaults(
  updates: Record<string, Json | undefined>,
) {
  const admin = createAdminClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const { data: existingBusiness, error: existingBusinessError } = await admin
    .from("businesses")
    .select("settings")
    .eq("id", businessId)
    .maybeSingle();
  if (existingBusinessError) throw new Error(existingBusinessError.message);

  const existingSettings =
    existingBusiness?.settings && typeof existingBusiness.settings === "object" && !Array.isArray(existingBusiness.settings)
      ? (existingBusiness.settings as Record<string, Json | undefined>)
      : {};

  const nextSettings: Record<string, Json | undefined> = {
    ...existingSettings,
    ...updates,
  };

  const { error } = await admin
    .from("businesses")
    .update({ settings: nextSettings as Json } satisfies TablesUpdate<"businesses">)
    .eq("id", businessId);
  if (error) throw new Error(error.message);
}

export async function saveServiceContentDefaultsAction(formData: FormData) {
  await assertAdminDashboardAction();

  const normalizedServiceBase = normalizePublicPathSegment((formData.get("service_detail_base_path") as string) || "");
  await saveCurrentBusinessContentDefaults({
    service_default_icon: ((((formData.get("service_default_icon") as string) || "").trim()) || null) as unknown as Json,
    service_default_title_template: ((((formData.get("service_default_title_template") as string) || "").trim()) || null) as unknown as Json,
    service_default_meta_description_template:
      ((((formData.get("service_default_meta_description_template") as string) || "").trim()) || null) as unknown as Json,
    service_default_h1_template: ((((formData.get("service_default_h1_template") as string) || "").trim()) || null) as unknown as Json,
    service_default_url_template: ((((formData.get("service_default_url_template") as string) || "").trim()) || null) as unknown as Json,
    service_detail_base_path: (normalizedServiceBase || null) as unknown as Json,
    service_card_show_excerpts: formData.has("service_card_show_excerpts") as unknown as Json,
  });

  await applyServiceDefaultsAction();
  revalidatePath("/dashboard/settings");
}

export async function saveAreaContentDefaultsAction(formData: FormData) {
  await assertAdminDashboardAction();

  const normalizedAreaBase = normalizePublicPathSegment((formData.get("area_detail_base_path") as string) || "");
  await saveCurrentBusinessContentDefaults({
    area_default_icon: ((((formData.get("area_default_icon") as string) || "").trim()) || null) as unknown as Json,
    area_default_title_template: ((((formData.get("area_default_title_template") as string) || "").trim()) || null) as unknown as Json,
    area_default_meta_description_template:
      ((((formData.get("area_default_meta_description_template") as string) || "").trim()) || null) as unknown as Json,
    area_default_h1_template: ((((formData.get("area_default_h1_template") as string) || "").trim()) || null) as unknown as Json,
    area_default_url_template: ((((formData.get("area_default_url_template") as string) || "").trim()) || null) as unknown as Json,
    area_detail_base_path: (normalizedAreaBase || null) as unknown as Json,
    area_card_show_excerpts: formData.has("area_card_show_excerpts") as unknown as Json,
  });

  await applyAreaDefaultsAction();
  revalidatePath("/dashboard/settings");
}

// ---- Team CRUD ----

export async function saveTeamMember(formData: FormData) {
  await assertAdminDashboardAction();
  const supabase = await createClient();

  const id = (formData.get("id") as string) || null;
  const businessId =
    (formData.get("business_id") as string) || (await resolveCurrentBusinessId()) || "";

  if (!businessId) throw new Error("Business context is required");

  const firstName = ((formData.get("first_name") as string) || "").trim() || null;
  const lastName = ((formData.get("last_name") as string) || "").trim() || null;
  const combinedTeamName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const hasSortOrderField = formData.has("sort_order");
  let sortOrder = parseNullableNumber(formData.get("sort_order"));

  if (!hasSortOrderField && id) {
    const { data: existingMember, error: existingMemberError } = await supabase
      .from("team_members")
      .select("sort_order")
      .eq("id", id)
      .eq("business_id", businessId)
      .maybeSingle();
    if (existingMemberError) throw new Error(existingMemberError.message);
    sortOrder = existingMember?.sort_order ?? 0;
  }

  if (!hasSortOrderField && !id) {
    const { data: existingMembers, error: existingMembersError } = await supabase
      .from("team_members")
      .select("sort_order")
      .eq("business_id", businessId)
      .order("sort_order", { ascending: false })
      .limit(1);
    if (existingMembersError) throw new Error(existingMembersError.message);
    sortOrder = ((existingMembers ?? [])[0]?.sort_order ?? 0) + 1;
  }

  const teamMember: TablesInsert<"team_members"> = {
    business_id: businessId,
    first_name: firstName,
    last_name: lastName,
    title: ((formData.get("title") as string) || "").trim() || null,
    bio: ((formData.get("bio") as string) || "").trim() || null,
    photo_url: ((formData.get("photo_url") as string) || "").trim() || null,
    sort_order: sortOrder ?? 0,
    website_published: ((formData.get("website_published") as string) || "on") !== "off",
  };

  if (!combinedTeamName) throw new Error("First or last name is required");

  const loginEmail = ((formData.get("login_email") as string) || "").trim() || null;
  const appRoleRaw = ((formData.get("app_role") as string) || "employee").trim();
  const employmentStatus =
    ((formData.get("employment_status") as string) || "full_time").trim() || "full_time";
  const loginStatus = ((formData.get("login_status") as string) || "not_created").trim() || "not_created";
  const payType = ((formData.get("pay_type") as string) || "hourly").trim() || "hourly";
  const hourlyRate = parseNullableNumber(formData.get("hourly_rate"));
  const salaryAmount = parseNullableNumber(formData.get("salary_amount"));
  const startDate = ((formData.get("start_date") as string) || "").trim() || null;
  const endDate = ((formData.get("end_date") as string) || "").trim() || null;
  const phone = ((formData.get("phone") as string) || "").trim() || null;
  const internalNotes = ((formData.get("internal_notes") as string) || "").trim() || null;
  const appRole = appRoleRaw === "admin" ? "admin" : "employee";

  async function upsertEmployment(teamMemberId: string) {
    const { data: existingEmployment, error: existingEmploymentError } = await supabase
      .from("team_member_employment")
      .select("profile_id, invited_at")
      .eq("team_member_id", teamMemberId)
      .eq("business_id", businessId)
      .maybeSingle();
    if (existingEmploymentError) throw new Error(existingEmploymentError.message);

    const payload: TablesInsert<"team_member_employment"> = {
      business_id: businessId,
      team_member_id: teamMemberId,
      login_email: loginEmail,
      profile_id: existingEmployment?.profile_id ?? null,
      app_role: appRole,
      employment_status: employmentStatus,
      login_status: loginStatus,
      pay_type: payType,
      hourly_rate: payType === "salary" ? null : hourlyRate,
      salary_amount: payType === "salary" ? salaryAmount : null,
      start_date: startDate,
      end_date: endDate,
      phone,
      internal_notes: internalNotes,
      invited_at: existingEmployment?.invited_at ?? null,
    };

    const hasAnyEmploymentData =
      !!loginEmail ||
      !!existingEmployment?.profile_id ||
      !!internalNotes ||
      hourlyRate !== null ||
      salaryAmount !== null ||
      !!startDate ||
      !!endDate ||
      !!phone ||
      employmentStatus !== "full_time" ||
      loginStatus !== "not_created" ||
      payType !== "hourly" ||
      appRole !== "employee";

    if (!hasAnyEmploymentData) {
      await supabase
        .from("team_member_employment")
        .delete()
        .eq("team_member_id", teamMemberId)
        .eq("business_id", businessId);
      return null;
    }

    const { data: savedEmployment, error: employmentError } = await supabase
      .from("team_member_employment")
      .upsert(payload, { onConflict: "team_member_id" })
      .select("*")
      .single();
    if (employmentError) throw new Error(employmentError.message);
    return savedEmployment;
  }

  async function syncLinkedProfileRole(employment: Tables<"team_member_employment"> | null) {
    if (!employment?.profile_id) return;

    const adminSupabase = createAdminClient();
    const { error: profileSyncError } = await adminSupabase
      .from("profiles")
      .update({
        business_id: businessId,
        first_name: teamMember.first_name ?? null,
        last_name: teamMember.last_name ?? null,
        role: employment.app_role,
        is_active: employment.login_status !== "disabled",
      })
      .eq("id", employment.profile_id);

    if (profileSyncError) throw new Error(profileSyncError.message);
  }

  if (id) {
    const { data, error } = await supabase
      .from("team_members")
      .update(teamMember)
      .eq("id", id)
      .eq("business_id", businessId)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const savedEmployment = await upsertEmployment(id);
    await syncLinkedProfileRole(savedEmployment);
    if (loginEmail && loginStatus !== "disabled") {
      await createTeamMemberLoginAction(id);
    }

    revalidatePath("/dashboard/team");
    revalidatePath(`/dashboard/team/${id}`);
    revalidatePath("/team");
    return { success: true, id: data.id };
  }

  const { data, error } = await supabase
    .from("team_members")
    .insert(teamMember)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const savedEmployment = await upsertEmployment(data.id);
  await syncLinkedProfileRole(savedEmployment);
  if (loginEmail && loginStatus !== "disabled") {
    await createTeamMemberLoginAction(data.id);
  }

  revalidatePath("/dashboard/team");
  revalidatePath(`/dashboard/team/${data.id}`);
  revalidatePath("/team");
  return { success: true, id: data.id };
}

export async function createTeamMemberLoginAction(teamMemberId: string) {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const { data: member, error: memberError } = await supabase
    .from("team_members")
    .select("id, first_name, last_name")
    .eq("id", teamMemberId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (memberError) throw new Error(memberError.message);
  if (!member) throw new Error("Team member not found");

  const { data: employment, error: employmentError } = await supabase
    .from("team_member_employment")
    .select("*")
    .eq("team_member_id", teamMemberId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (employmentError) throw new Error(employmentError.message);
  if (!employment?.login_email) throw new Error("Add a login email before creating login access");
  if (employment.login_status === "disabled") {
    throw new Error("Login is disabled for this team member");
  }
  if (employment.profile_id && (employment.login_status === "active" || employment.login_status === "invited")) {
    return { success: true, userId: employment.profile_id };
  }

  const memberFirstName =
    (member as { first_name?: string | null }).first_name?.trim() || null;
  const memberLastName =
    (member as { last_name?: string | null }).last_name?.trim() || null;
  const adminSupabase = createAdminClient();
  const existingAuthUsers = await listAuthUsersByEmail(adminSupabase);
  const existingAuthUser = existingAuthUsers.get(employment.login_email.trim().toLowerCase()) ?? null;
  const inviteResult = await sendManagedInviteEmail({
    admin: adminSupabase,
    businessId,
    email: employment.login_email,
    firstName: memberFirstName,
    lastName: memberLastName,
    existingUserId: existingAuthUser?.id ?? null,
  });
  const invitedUserId = inviteResult.userId;

  const { error: profileError } = await adminSupabase
    .from("profiles")
    .upsert(
      {
        id: invitedUserId,
        business_id: businessId,
        first_name: memberFirstName,
        last_name: memberLastName,
        role: employment.app_role,
        is_active: employment.login_status !== "disabled",
      },
      { onConflict: "id" }
    );
  if (profileError) throw new Error(profileError.message);

  const { error: updateEmploymentError } = await supabase
    .from("team_member_employment")
    .upsert(
      {
        ...employment,
        business_id: businessId,
        team_member_id: teamMemberId,
        profile_id: invitedUserId,
        login_status: "invited",
        invited_at: new Date().toISOString(),
      },
      { onConflict: "team_member_id" }
    );
  if (updateEmploymentError) throw new Error(updateEmploymentError.message);

  revalidatePath("/dashboard/team");
  revalidatePath(`/dashboard/team/${teamMemberId}`);
  return { success: true, userId: invitedUserId };
}

export async function deleteTeamMember(id: string) {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const { error } = await supabase
    .from("team_members")
    .delete()
    .eq("id", id)
    .eq("business_id", businessId);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/team");
  revalidatePath("/team");
  return { success: true };
}

export async function deleteTeamMembersBulk(ids: string[]) {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const validIds = Array.from(
    new Set(ids.map((id) => id.trim()).filter(Boolean))
  );
  if (validIds.length === 0) return { success: true, deleted: 0 };

  const { error } = await supabase
    .from("team_members")
    .delete()
    .eq("business_id", businessId)
    .in("id", validIds);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/team");
  revalidatePath("/team");
  return { success: true, deleted: validIds.length };
}

export async function reorderTeamMembersAction(
  updates: Array<{ id: string; sort_order: number }>,
) {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");
  const ensuredBusinessId = businessId;

  const normalizedUpdates = Array.from(
    new Map(
      updates
        .filter((update) => typeof update?.id === "string" && update.id.trim())
        .map((update) => [
          update.id.trim(),
          {
            id: update.id.trim(),
            sort_order: Number.isFinite(update.sort_order) ? Math.max(0, Math.trunc(update.sort_order)) : 0,
          },
        ]),
    ).values(),
  );

  if (normalizedUpdates.length === 0) return { success: true };

  for (const update of normalizedUpdates) {
    const { error } = await supabase
      .from("team_members")
      .update({ sort_order: update.sort_order })
      .eq("id", update.id)
      .eq("business_id", businessId);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/dashboard/team");
  revalidatePath("/team");
  return { success: true };
}

// ---- Schedule CRUD ----

export async function saveScheduleItem(formData: FormData) {
  const supabase = await createClient();

  const id = (formData.get("id") as string) || null;
  const businessId =
    (formData.get("business_id") as string) || (await resolveCurrentBusinessId()) || "";
  if (!businessId) throw new Error("Business context is required");

  const startsAt = ((formData.get("starts_at") as string) || "").trim();
  const endsAt = ((formData.get("ends_at") as string) || "").trim() || null;

  const item: TablesInsert<"schedule_items"> = {
    business_id: businessId,
    title: ((formData.get("title") as string) || "").trim(),
    description: ((formData.get("description") as string) || "").trim() || null,
    starts_at: startsAt,
    ends_at: endsAt,
    location: ((formData.get("location") as string) || "").trim() || null,
    assigned_to: null,
    assigned_team_member_id: ((formData.get("assigned_team_member_id") as string) || "").trim() || null,
    related_job_id: ((formData.get("related_job_id") as string) || "").trim() || null,
  };

  if (!item.title) throw new Error("Title is required");
  if (!item.starts_at) throw new Error("Start date/time is required");
  if (item.ends_at && new Date(item.ends_at).getTime() < new Date(item.starts_at).getTime()) {
    throw new Error("End date/time must be after start date/time");
  }
  if (item.assigned_team_member_id) {
    const { data: teamMember, error: teamMemberError } = await supabase
      .from("team_members")
      .select("id")
      .eq("id", item.assigned_team_member_id)
      .eq("business_id", businessId)
      .maybeSingle();
    if (teamMemberError) throw new Error(teamMemberError.message);
    if (!teamMember) throw new Error("Assigned team member is invalid");
  }
  if (item.related_job_id) {
    const { data: relatedJob, error: relatedJobError } = await supabase
      .from("jobs")
      .select("id")
      .eq("id", item.related_job_id)
      .eq("business_id", businessId)
      .maybeSingle();
    if (relatedJobError) throw new Error(relatedJobError.message);
    if (!relatedJob) throw new Error("Related job is invalid");
  }

  if (id) {
    const { error } = await supabase
      .from("schedule_items")
      .update(item)
      .eq("id", id)
      .eq("business_id", businessId);
    if (error) throw new Error(error.message);
    revalidatePath(`/dashboard/schedule/${id}`);
  } else {
    const { data, error } = await supabase
      .from("schedule_items")
      .insert(item)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath(`/dashboard/schedule/${data.id}`);
  }

  revalidatePath("/dashboard/schedule");
  revalidatePath("/dashboard/jobs");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteScheduleItem(id: string) {
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const { error } = await supabase
    .from("schedule_items")
    .delete()
    .eq("id", id)
    .eq("business_id", businessId);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/schedule");
  revalidatePath(`/dashboard/schedule/${id}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function rescheduleScheduleEntryAction(input: {
  sourceType: "job" | "custom";
  id: string;
  startsAt: string;
  endsAt?: string | null;
}) {
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const startsAt = input.startsAt?.trim();
  const endsAt = input.endsAt?.trim() || null;
  if (!startsAt) throw new Error("Start date/time is required");
  if (endsAt && new Date(endsAt).getTime() < new Date(startsAt).getTime()) {
    throw new Error("End date/time must be after start date/time");
  }

  if (input.sourceType === "job") {
    const { error } = await supabase
      .from("jobs")
      .update({
        scheduled_start: startsAt,
        scheduled_end: endsAt,
      } as TablesUpdate<"jobs">)
      .eq("id", input.id)
      .eq("business_id", businessId);
    if (error) throw new Error(error.message);

    revalidatePath("/dashboard/jobs");
    revalidatePath(`/dashboard/jobs/${input.id}`);
  } else {
    const { error } = await supabase
      .from("schedule_items")
      .update({
        starts_at: startsAt,
        ends_at: endsAt,
      })
      .eq("id", input.id)
      .eq("business_id", businessId);
    if (error) throw new Error(error.message);

    revalidatePath(`/dashboard/schedule/${input.id}`);
  }

  revalidatePath("/dashboard/schedule");
  revalidatePath("/dashboard");
  return { success: true };
}

// ---- Testimonial CRUD ----

export async function saveTestimonial(formData: FormData) {
  await assertAdminDashboardAction();
  const supabase = await createClient();

  const id = (formData.get("id") as string) || null;
  const businessId =
    (formData.get("business_id") as string) || (await resolveCurrentBusinessId()) || "";

  if (!businessId) throw new Error("Business context is required");

  const reviewDateRaw = ((formData.get("review_date") as string) || "").trim();
  const testimonial: TablesInsert<"testimonials"> = {
    business_id: businessId,
    customer_name: ((formData.get("customer_name") as string) || "").trim(),
    area_id: ((formData.get("area_id") as string) || "").trim() || null,
    content: ((formData.get("content") as string) || "").trim(),
    rating: parseNullableNumber(formData.get("rating")),
    source: ((formData.get("source") as string) || "manual") as TablesInsert<"testimonials">["source"],
    source_url: ((formData.get("source_url") as string) || "").trim() || null,
    avatar_url: ((formData.get("avatar_url") as string) || "").trim() || null,
    service_id: ((formData.get("service_id") as string) || "").trim() || null,
    is_featured: (formData.get("is_featured") as string) === "on",
    is_active: (formData.get("is_active") as string) !== "off",
    review_date: reviewDateRaw || null,
  };

  if (!testimonial.customer_name) throw new Error("Customer name is required");
  if (!testimonial.content) throw new Error("Review content is required");

  if (id) {
    const { data: existing, error: existingError } = await supabase
      .from("testimonials")
      .select("*")
      .eq("id", id)
      .eq("business_id", businessId)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (!existing) throw new Error("Testimonial not found");

    if (existing.source === "google") {
      const lockedGoogleFields: TablesUpdate<"testimonials"> = {
        area_id: testimonial.area_id,
        service_id: testimonial.service_id,
        is_featured: testimonial.is_featured,
        is_active: testimonial.is_active,
      };

      const { data, error } = await supabase
        .from("testimonials")
        .update(lockedGoogleFields)
        .eq("id", id)
        .eq("business_id", businessId)
        .select("id")
        .single();
      if (error) throw new Error(error.message);

      revalidatePath("/dashboard/testimonials");
      revalidatePath(`/dashboard/testimonials/${id}`);
      revalidatePath("/");
      return { success: true, id: data.id };
    }

    const { data, error } = await supabase
      .from("testimonials")
      .update(testimonial)
      .eq("id", id)
      .eq("business_id", businessId)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    revalidatePath("/dashboard/testimonials");
    revalidatePath(`/dashboard/testimonials/${id}`);
    revalidatePath("/");
    return { success: true, id: data.id };
  }

  const { data, error } = await supabase
    .from("testimonials")
    .insert(testimonial)
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/testimonials");
  revalidatePath(`/dashboard/testimonials/${data.id}`);
  revalidatePath("/");
  return { success: true, id: data.id };
}

export async function deleteTestimonial(id: string) {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const { error } = await supabase
    .from("testimonials")
    .delete()
    .eq("id", id)
    .eq("business_id", businessId);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/testimonials");
  revalidatePath(`/dashboard/testimonials/${id}`);
  revalidatePath("/");
  return { success: true };
}

export async function deleteTestimonialsBulk(ids: string[]) {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const uniqueIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
  if (uniqueIds.length === 0) return { success: true, deletedCount: 0 };

  const { error } = await supabase
    .from("testimonials")
    .delete()
    .eq("business_id", businessId)
    .in("id", uniqueIds);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/testimonials");
  revalidatePath("/");
  for (const id of uniqueIds) {
    revalidatePath(`/dashboard/testimonials/${id}`);
  }
  return { success: true, deletedCount: uniqueIds.length };
}

export async function syncGoogleBusinessProfileReviewsAction() {
  await assertAdminDashboardAction();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  try {
    const result = await syncGoogleBusinessProfileReviews({ businessId });
    revalidatePath("/dashboard/testimonials");
    revalidatePath("/");

    const params = new URLSearchParams({
      google_sync: "success",
      fetched: String(result.fetched ?? 0),
      inserted: String(result.inserted ?? 0),
      updated: String(result.updated ?? 0),
      deactivated: String(result.deactivated ?? 0),
    });
    redirect(`/dashboard/testimonials?${params.toString()}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google review sync failed";
    const params = new URLSearchParams({
      google_sync: "error",
      message,
    });
    redirect(`/dashboard/testimonials?${params.toString()}`);
  }
}

export async function upsertGoogleBusinessProfileReviewReplyAction(formData: FormData) {
  await assertAdminDashboardAction();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const reviewReference = ((formData.get("review_reference") as string) || "").trim();
  const replyComment = ((formData.get("reply_comment") as string) || "").trim();
  const redirectTo = ((formData.get("redirect_to") as string) || "").trim() || "/dashboard/testimonials";

  try {
    const result = await upsertGoogleBusinessProfileReviewReply({
      businessId,
      review: reviewReference,
      comment: replyComment,
    });
    revalidatePath("/dashboard/testimonials");

    const params = new URLSearchParams({
      google_reply: "success",
      google_reply_message: "Review reply saved.",
      google_reply_review: result.reviewName,
    });
    redirect(`${redirectTo}?${params.toString()}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google review reply failed";
    const params = new URLSearchParams({
      google_reply: "error",
      google_reply_message: message,
    });
    redirect(`${redirectTo}?${params.toString()}`);
  }
}

function normalizeHost(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "")
    .replace(/:\d+$/, "");
}

function buildPasswordResetEmailContent(options: {
  businessName: string;
  resetUrl: string;
}) {
  const { businessName, resetUrl } = options;
  return {
    subject: `Reset your password for ${businessName}`,
    html: `<div style="font-family:Arial,sans-serif;color:#111827;line-height:1.6;">
      <p style="margin:0 0 16px;">A password reset was requested for your ${businessName} account.</p>
      <p style="margin:0 0 20px;">Use the button below to choose a new password:</p>
      <p style="margin:0 0 20px;">
        <a href="${resetUrl}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;">Reset Password</a>
      </p>
      <p style="margin:0 0 12px;">If the button doesn&apos;t work, use this link:</p>
      <p style="margin:0 0 16px;word-break:break-word;"><a href="${resetUrl}">${resetUrl}</a></p>
      <p style="margin:0;color:#6b7280;font-size:14px;">If you didn&apos;t request this, you can ignore this email.</p>
    </div>`,
    text:
      `A password reset was requested for your ${businessName} account.\n\n` +
      `Reset your password here:\n${resetUrl}\n\n` +
      `If you didn't request this, you can ignore this email.`,
  };
}

function buildUserInviteEmailContent(options: {
  businessName: string;
  inviteUrl: string;
  recipientName?: string | null;
}) {
  const { businessName, inviteUrl, recipientName } = options;
  const greeting = recipientName?.trim() ? `Hi ${recipientName.trim()},` : "Hi,";

  return {
    subject: `You have been invited to ${businessName}`,
    html: `<div style="font-family:Arial,sans-serif;color:#111827;line-height:1.6;">
      <p style="margin:0 0 16px;">${greeting}</p>
      <p style="margin:0 0 16px;">You have been invited to access ${businessName}.</p>
      <p style="margin:0 0 20px;">Use the button below to accept your invite and finish setting up your login:</p>
      <p style="margin:0 0 20px;">
        <a href="${inviteUrl}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;">Accept Invite</a>
      </p>
      <p style="margin:0 0 12px;">If the button doesn&apos;t work, use this link:</p>
      <p style="margin:0 0 16px;word-break:break-word;"><a href="${inviteUrl}">${inviteUrl}</a></p>
      <p style="margin:0;color:#6b7280;font-size:14px;">If you weren&apos;t expecting this invite, you can ignore this email.</p>
    </div>`,
    text:
      `${greeting}\n\n` +
      `You have been invited to access ${businessName}.\n\n` +
      `Accept your invite here:\n${inviteUrl}\n\n` +
      `If you weren't expecting this invite, you can ignore this email.`,
  };
}

function buildExistingUserAccessEmailContent(options: {
  businessName: string;
  loginUrl: string;
  recipientName?: string | null;
}) {
  const { businessName, loginUrl, recipientName } = options;
  const greeting = recipientName?.trim() ? `Hi ${recipientName.trim()},` : "Hi,";

  return {
    subject: `Your access to ${businessName} is ready`,
    html: `<div style="font-family:Arial,sans-serif;color:#111827;line-height:1.6;">
      <p style="margin:0 0 16px;">${greeting}</p>
      <p style="margin:0 0 16px;">Your account now has access to ${businessName}.</p>
      <p style="margin:0 0 20px;">You can sign in here:</p>
      <p style="margin:0 0 20px;">
        <a href="${loginUrl}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;">Go To Login</a>
      </p>
      <p style="margin:0 0 12px;">If the button doesn&apos;t work, use this link:</p>
      <p style="margin:0 0 16px;word-break:break-word;"><a href="${loginUrl}">${loginUrl}</a></p>
      <p style="margin:0;color:#6b7280;font-size:14px;">If you weren&apos;t expecting this, you can ignore this email.</p>
    </div>`,
    text:
      `${greeting}\n\n` +
      `Your account now has access to ${businessName}.\n\n` +
      `Sign in here:\n${loginUrl}\n\n` +
      `If you weren't expecting this, you can ignore this email.`,
  };
}

async function getBusinessInviteContext(businessId: string) {
  const admin = createAdminClient();
  const [{ data: business, error: businessError }, siteBaseUrl] = await Promise.all([
    admin
      .from("businesses")
      .select("name")
      .eq("id", businessId)
      .maybeSingle(),
    getBusinessSiteBaseUrl(businessId),
  ]);

  if (businessError) throw new Error(businessError.message);

  return {
    businessName: business?.name?.trim() || "Home Service Growth",
    loginUrl: siteBaseUrl ? `${siteBaseUrl}/login` : "",
  };
}

function getPlatformAuthBaseUrl() {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    "";

  if (siteUrl) {
    return siteUrl.startsWith("http") ? siteUrl.replace(/\/+$/, "") : `https://${siteUrl.replace(/\/+$/, "")}`;
  }

  return "https://hsgrowth.com";
}

async function sendManagedInviteEmail(options: {
  admin: ReturnType<typeof createAdminClient>;
  businessId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  existingUserId?: string | null;
}) {
  const { admin, businessId, email, firstName, lastName, existingUserId = null } = options;
  const { businessName, loginUrl } = await getBusinessInviteContext(businessId);
  const recipientName = [firstName?.trim(), lastName?.trim()].filter(Boolean).join(" ") || null;

  if (existingUserId) {
    if (!loginUrl) {
      return { userId: existingUserId, emailSent: false };
    }

    const rendered = buildExistingUserAccessEmailContent({
      businessName,
      loginUrl,
      recipientName,
    });

    await sendEmail({
      to: email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      businessId,
    });

    return { userId: existingUserId, emailSent: true };
  }

  const inviteRedirectTo = (() => {
    const platformAuthBaseUrl = getPlatformAuthBaseUrl();
    if (!platformAuthBaseUrl) return undefined;
    const redirectUrl = new URL("/reset-password", platformAuthBaseUrl);
    redirectUrl.searchParams.set("invite", "1");
    if (loginUrl) redirectUrl.searchParams.set("next", loginUrl);
    return redirectUrl.toString();
  })();

  const linkResult = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    ...(inviteRedirectTo ? { options: { redirectTo: inviteRedirectTo } } : {}),
  });
  if (linkResult.error) throw new Error(linkResult.error.message);

  const invitedUserId = linkResult.data.user?.id ?? null;
  const inviteTokenHash = linkResult.data.properties?.hashed_token?.trim() || "";
  if (!invitedUserId) throw new Error("Invite created but user record was not returned");
  if (!inviteTokenHash) throw new Error("Invite created but token hash was not returned");

  const inviteUrl = (() => {
    const platformAuthBaseUrl = getPlatformAuthBaseUrl();
    const url = new URL("/reset-password", platformAuthBaseUrl);
    url.searchParams.set("invite", "1");
    url.searchParams.set("token_hash", inviteTokenHash);
    if (loginUrl) url.searchParams.set("next", loginUrl);
    return url.toString();
  })();

  const rendered = buildUserInviteEmailContent({
    businessName,
    inviteUrl,
    recipientName,
  });

  await sendEmail({
    to: email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    businessId,
  });

  return { userId: invitedUserId, emailSent: true };
}

export async function requestPasswordResetEmailAction(emailInput: string) {
  const email = (emailInput ?? "").trim().toLowerCase();
  if (!email) {
    return { success: true };
  }

  const admin = createAdminClient();
  const business = await getBusiness();
  const authUsers = await listAuthUsersByEmail(admin);
  const authUser = authUsers.get(email) ?? null;

  if (!authUser) {
    return { success: true };
  }

  const isPlatformEmail = isPlatformAdminEmail(email);
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("business_id, is_active")
    .eq("id", authUser.id)
    .maybeSingle();
  if (profileError) throw new Error(profileError.message);

  if (profile?.is_active === false) {
    return { success: true };
  }

  if (business?.id) {
    if (profile?.business_id !== business.id) {
      return { success: true };
    }
  } else if (!isPlatformEmail) {
    return { success: true };
  }

  const platformAuthBaseUrl = getPlatformAuthBaseUrl();
  const loginUrl = platformAuthBaseUrl
    ? (business?.id
        ? (await getBusinessInviteContext(business.id)).loginUrl
        : `${platformAuthBaseUrl}/login`)
    : "";
  const redirectTo = (() => {
    if (!platformAuthBaseUrl) return undefined;

    const redirectUrl = new URL("/reset-password", platformAuthBaseUrl);
    if (loginUrl) {
      redirectUrl.searchParams.set("next", loginUrl);
    }

    return redirectUrl.toString();
  })();

  const linkResult = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    ...(redirectTo ? { options: { redirectTo } } : {}),
  });
  if (linkResult.error) {
    if (/user/i.test(linkResult.error.message)) {
      return { success: true };
    }
    throw new Error(linkResult.error.message);
  }

  const resetTokenHash = linkResult.data.properties?.hashed_token?.trim() || "";
  if (!resetTokenHash) {
    return { success: true };
  }

  const resetUrl = (() => {
    const url = new URL("/reset-password", platformAuthBaseUrl);
    url.searchParams.set("token_hash", resetTokenHash);
    if (loginUrl) {
      url.searchParams.set("next", loginUrl);
    }
    return url.toString();
  })();

  const businessName = business?.name?.trim() || "Home Service Growth";
  const rendered = buildPasswordResetEmailContent({
    businessName,
    resetUrl,
  });

  const resendData = await sendEmail({
    to: email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    businessId: business?.id ?? undefined,
  });

  if (business?.id) {
    await admin.from("email_log").insert({
      business_id: business.id,
      contact_id: null,
      template_id: null,
      to_email: email,
      subject: rendered.subject,
      resend_id: resendData?.id || null,
      status: "sent",
      related_type: "internal_notification",
      related_id: authUser.id,
      sent_at: new Date().toISOString(),
    });
  }

  return { success: true };
}

export async function deleteGoogleBusinessProfileReviewReplyAction(formData: FormData) {
  await assertAdminDashboardAction();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const reviewReference = ((formData.get("review_reference") as string) || "").trim();
  const redirectTo = ((formData.get("redirect_to") as string) || "").trim() || "/dashboard/testimonials";

  try {
    const result = await deleteGoogleBusinessProfileReviewReply({
      businessId,
      review: reviewReference,
    });
    revalidatePath("/dashboard/testimonials");

    const params = new URLSearchParams({
      google_reply: "success",
      google_reply_message: "Review reply deleted.",
      google_reply_review: result.reviewName,
    });
    redirect(`${redirectTo}?${params.toString()}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google review reply delete failed";
    const params = new URLSearchParams({
      google_reply: "error",
      google_reply_message: message,
    });
    redirect(`${redirectTo}?${params.toString()}`);
  }
}

export async function createGoogleBusinessProfilePostAction(formData: FormData) {
  await assertAdminDashboardAction();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const summary = ((formData.get("summary") as string) || "").trim();
  const topicTypeRaw = ((formData.get("topic_type") as string) || "STANDARD").trim().toUpperCase();
  const callToActionActionTypeRaw = ((formData.get("cta_action_type") as string) || "").trim().toUpperCase();
  const callToActionUrl = ((formData.get("cta_url") as string) || "").trim();

  const topicType: "STANDARD" | "EVENT" | "OFFER" | "ALERT" =
    topicTypeRaw === "EVENT" || topicTypeRaw === "OFFER" || topicTypeRaw === "ALERT"
      ? topicTypeRaw
      : "STANDARD";
  const callToActionActionType:
    | "BOOK"
    | "ORDER"
    | "SHOP"
    | "LEARN_MORE"
    | "SIGN_UP"
    | "CALL"
    | undefined =
    callToActionActionTypeRaw === "BOOK" ||
    callToActionActionTypeRaw === "ORDER" ||
    callToActionActionTypeRaw === "SHOP" ||
    callToActionActionTypeRaw === "LEARN_MORE" ||
    callToActionActionTypeRaw === "SIGN_UP" ||
    callToActionActionTypeRaw === "CALL"
      ? callToActionActionTypeRaw
      : undefined;

  try {
    const result = await createGoogleBusinessProfileLocalPost({
      businessId,
      summary,
      topicType,
      callToActionActionType,
      callToActionUrl,
    });
    revalidatePath("/dashboard/testimonials");
    revalidatePath("/dashboard/content");

    const params = new URLSearchParams({
      google_post: "success",
      google_post_message: "Google post created.",
      google_post_name: result.name ?? "",
      tab: "google-posts",
    });
    redirect(`/dashboard/content?${params.toString()}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google post creation failed";
    const params = new URLSearchParams({
      google_post: "error",
      google_post_message: message,
      tab: "google-posts",
    });
    redirect(`/dashboard/content?${params.toString()}`);
  }
}

export async function createDefaultFormAutoResponseTemplatesAction() {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");
  let inserted = 0;
  let updated = 0;

  const templates: Array<{
    name: string;
    subject: string;
    body_html: string;
    body_text: string;
  }> = [
    {
      name: "Auto Response - Default",
      subject: "Thanks for reaching out to {{business_name}}",
      body_html:
        "<p>Hi {{contact_first_name}},</p><p>Thanks for contacting {{business_name}}. We received your request and will follow up shortly.</p>",
      body_text:
        "Hi {{contact_first_name}},\n\nThanks for contacting {{business_name}}. We received your request and will follow up shortly.",
    },
    {
      name: "Review Request - Default",
      subject: "How did we do on your recent project with {{business_name}}?",
      body_html:
        "<p>Hi {{contact_first_name}},</p><p>Thanks for choosing {{business_name}}.</p><p>If you have a moment, please leave a quick review:</p><p><a href=\"{{review_link}}\">{{review_link}}</a></p>",
      body_text:
        "Hi {{contact_first_name}},\n\nThanks for choosing {{business_name}}.\n\nIf you have a moment, please leave a quick review:\n{{review_link}}",
    },
  ];

  for (const template of templates) {
    const { data: existing, error: existingError } = await supabase
      .from("email_templates")
      .select("id")
      .eq("business_id", businessId)
      .eq("name", template.name)
      .limit(1)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);

    if (existing) {
      const { error: updateError } = await supabase
        .from("email_templates")
        .update({
          is_active: true,
          subject: template.subject,
          body_html: template.body_html,
          body_text: template.body_text,
        })
        .eq("id", existing.id)
        .eq("business_id", businessId);
      if (updateError) throw new Error(updateError.message);
      updated += 1;
      continue;
    }

    const { error: insertError } = await supabase.from("email_templates").insert({
      business_id: businessId,
      name: template.name,
      is_active: true,
      subject: template.subject,
      body_html: template.body_html,
      body_text: template.body_text,
    });
    if (insertError) throw new Error(insertError.message);
    inserted += 1;
  }

  revalidatePath("/dashboard/automations");
  return { inserted, updated };
}

export async function saveEmailTemplateAction(formData: FormData) {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");
  const ensuredBusinessId = businessId;

  const id = ((formData.get("id") as string) || "").trim() || null;
  const name = ((formData.get("name") as string) || "").trim();
  const subject = ((formData.get("subject") as string) || "").trim();
  const bodyHtml = ((formData.get("body_html") as string) || "").trim();
  const bodyText = ((formData.get("body_text") as string) || "").trim();
  const hasIsActive = formData.has("is_active");

  if (!name) throw new Error("Template name is required");
  if (!subject) throw new Error("Subject is required");
  if (!bodyHtml && !bodyText) throw new Error("At least HTML or text body is required");

  const normalizeTemplateName = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();

  async function resolveUniqueEmailTemplateName(requestedName: string) {
    const { data: existingTemplates, error: existingTemplatesError } = await supabase
      .from("email_templates")
      .select("id, name")
      .eq("business_id", ensuredBusinessId);
    if (existingTemplatesError) throw new Error(existingTemplatesError.message);

    const existingNames = new Set(
      (existingTemplates ?? [])
        .filter((template) => template.id !== id)
        .map((template) => normalizeTemplateName(template.name ?? ""))
        .filter(Boolean),
    );

    const baseName = requestedName.trim().replace(/\s+/g, " ");
    let candidate = baseName;
    let suffix = 2;

    while (existingNames.has(normalizeTemplateName(candidate))) {
      candidate = `${baseName} ${suffix}`;
      suffix += 1;
    }

    return candidate;
  }

  const existingTemplate = id
      ? await (async () => {
        const { data, error } = await supabase
          .from("email_templates")
          .select("is_active")
          .eq("id", id)
          .eq("business_id", businessId)
          .maybeSingle();
        if (error) throw new Error(error.message);
        return data;
      })()
    : null;
  const resolvedIsActive = hasIsActive ? (formData.get("is_active") as string) === "on" : (existingTemplate?.is_active ?? true);
  const resolvedName = await resolveUniqueEmailTemplateName(name);

  const payload: TablesInsert<"email_templates"> = {
    business_id: businessId,
    name: resolvedName,
    subject,
    body_html: bodyHtml || bodyText,
    body_text: bodyText || bodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    is_active: resolvedIsActive,
  };

  if (id) {
    const { error } = await supabase
      .from("email_templates")
      .update(payload)
      .eq("id", id)
      .eq("business_id", businessId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("email_templates").insert(payload);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/dashboard/automations");
  revalidatePath("/dashboard/automations/templates");
}

export async function deleteEmailTemplateAction(id: string) {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const { error } = await supabase
    .from("email_templates")
    .delete()
    .eq("id", id)
    .eq("business_id", businessId);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/automations");
  revalidatePath("/dashboard/automations/templates");
}

export async function deleteEmailTemplatesBulk(ids: string[]) {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const uniqueIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
  if (uniqueIds.length === 0) return { success: true, deletedCount: 0 };

  const { data: existing, error: fetchError } = await supabase
    .from("email_templates")
    .select("id")
    .eq("business_id", businessId)
    .in("id", uniqueIds);
  if (fetchError) throw new Error(fetchError.message);

  const existingIds = (existing ?? []).map((row) => row.id);
  if (existingIds.length === 0) return { success: true, deletedCount: 0 };

  const { error: deleteError } = await supabase
    .from("email_templates")
    .delete()
    .eq("business_id", businessId)
    .in("id", existingIds);
  if (deleteError) throw new Error(deleteError.message);

  revalidatePath("/dashboard/automations");
  revalidatePath("/dashboard/automations/templates");
  return { success: true, deletedCount: existingIds.length };
}
export async function saveEmailTemplateStatusAction(formData: FormData) {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const id = ((formData.get("id") as string) || "").trim();
  if (!id) throw new Error("Template is required");
  const isActive = formData.get("is_active") === "on";

  const { error } = await supabase
    .from("email_templates")
    .update({ is_active: isActive } satisfies TablesUpdate<"email_templates">)
    .eq("business_id", businessId)
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/automations");
  revalidatePath("/dashboard/automations/templates");
}

export async function updateFormAutoResponseSettingsAction(formData: FormData) {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const next: FormAutoResponseSettings = {
    enabled: (formData.get("enabled") as string) === "on",
    contact: (formData.get("contact") as string) === "on",
    quote_request: (formData.get("quote_request") as string) === "on",
    booking: (formData.get("booking") as string) === "on",
    newsletter: (formData.get("newsletter") as string) === "on",
  };

  const { data: existingBusiness, error: existingError } = await supabase
    .from("businesses")
    .select("settings")
    .eq("id", businessId)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);

  const mergedSettings = mergeFormAutoResponseSettingsIntoBusinessSettings(
    existingBusiness?.settings,
    next
  );

  const { error } = await supabase
    .from("businesses")
    .update({ settings: mergedSettings })
    .eq("id", businessId);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/automations");
}

function revalidateCommonSitePaths() {
  revalidatePath("/");
  revalidatePath("/about");
  revalidatePath("/contact");
  revalidatePath("/blog");
  revalidatePath("/services");
  revalidatePath("/service-areas");
}

async function getBusinessSettingsJson(
  supabase: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>,
  businessId: string,
) {
  const { data, error } = await supabase
    .from("businesses")
    .select("settings")
    .eq("id", businessId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.settings ?? null) as Json | null;
}

async function revalidateConfiguredServiceDetailPath(
  supabase: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>,
  businessId: string,
  slug: string | null | undefined,
) {
  const normalizedSlug = (slug ?? "").trim();
  if (!normalizedSlug) return;
  const settings = await getBusinessSettingsJson(supabase, businessId);
  revalidatePath(buildServicePath(normalizedSlug, settings));
}

async function revalidateConfiguredAreaDetailPath(
  supabase: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>,
  businessId: string,
  slug: string | null | undefined,
) {
  const normalizedSlug = (slug ?? "").trim();
  if (!normalizedSlug) return;
  const settings = await getBusinessSettingsJson(supabase, businessId);
  revalidatePath(buildAreaPath(normalizedSlug, settings));
}

export async function disconnectQuickBooksConnectionAction() {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const { error } = await supabase
    .from("quickbooks_connections")
    .delete()
    .eq("business_id", businessId);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/settings");
  return { success: true };
}

export async function syncQuickBooksContactsAction() {
  await assertAdminDashboardAction();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const result = await syncAllQuickBooksCustomersForBusiness(businessId);
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/contacts");
  return { success: true, ...result };
}

export async function importQuickBooksContactsAction() {
  await assertAdminDashboardAction();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const result = await importQuickBooksCustomersForBusiness(businessId);
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/contacts");
  return { success: true, ...result };
}

export async function syncQuickBooksEstimateAction(estimateId: string) {
  await assertAdminDashboardAction();
  const result = await syncQuickBooksEstimateForEstimate(estimateId);
  revalidatePath("/dashboard/estimates");
  revalidatePath(`/dashboard/estimates/${estimateId}`);
  revalidatePath("/dashboard/settings");
  return { success: true, ...result };
}

export async function syncQuickBooksInvoiceAction(invoiceId: string) {
  await assertAdminDashboardAction();
  const result = await syncQuickBooksInvoiceForInvoice(invoiceId);
  revalidatePath("/dashboard/invoices");
  revalidatePath(`/dashboard/invoices/${invoiceId}`);
  revalidatePath("/dashboard/settings");
  return { success: true, ...result };
}

export async function syncAllQuickBooksInvoicesAction() {
  await assertAdminDashboardAction();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const result = await syncAllQuickBooksInvoicesForBusiness(businessId);
  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/settings");
  redirect(
    `/dashboard/invoices?quickbooks=${result.failed > 0 ? "partial" : "synced"}&synced=${result.synced}&failed=${result.failed}`
  );
}

export async function runFullQuickBooksReconcileAction() {
  await assertAdminDashboardAction();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const result = await runFullQuickBooksReconcileForBusiness(businessId);
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/contacts");
  revalidatePath("/dashboard/estimates");
  revalidatePath("/dashboard/invoices");
  return { success: true, ...result };
}

export async function refreshQuickBooksInvoiceStatusAction(invoiceId: string) {
  await assertAdminDashboardAction();
  const result = await refreshQuickBooksInvoiceStatusForInvoice(invoiceId);
  revalidatePath("/dashboard/invoices");
  revalidatePath(`/dashboard/invoices/${invoiceId}`);
  revalidatePath("/dashboard/settings");
  return { success: true, ...result };
}

export async function updateEstimateStatusAction(estimateId: string, nextStatus: Tables<"estimates">["status"]) {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const updatePayload: TablesUpdate<"estimates"> = {
    status: nextStatus,
  };

  if (nextStatus === "approved") {
    updatePayload.approved_at = new Date().toISOString();
  }

  const { data: estimate, error } = await supabase
    .from("estimates")
    .update(updatePayload)
    .eq("id", estimateId)
    .eq("business_id", businessId)
    .select("contact_id")
    .single();
  if (error) throw new Error(error.message);

  if (nextStatus === "approved" && estimate?.contact_id) {
    const { error: contactError } = await supabase
      .from("contacts")
      .update({ status: "customer" } as any)
      .eq("id", estimate.contact_id)
      .eq("business_id", businessId);
    if (contactError) throw new Error(contactError.message);
    revalidatePath("/dashboard/contacts");
    revalidateContactDetailPaths(estimate.contact_id);
  }

  revalidatePath("/dashboard/estimates");
  revalidatePath(`/dashboard/estimates/${estimateId}`);
  return { success: true };
}

export async function saveBusinessSettingsAction(formData: FormData) {
  await assertAdminDashboardAction();
  const supabase = createAdminClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const name = ((formData.get("name") as string) || "").trim();
  if (!name) throw new Error("Business name is required");
  const teamTitleTypesRaw = ((formData.get("team_title_types") as string) || "").trim();
  const teamTitleTypes = teamTitleTypesRaw
    ? Array.from(
        new Set(
          teamTitleTypesRaw
            .split(/\r?\n|,/)
            .map((value) => value.trim())
            .filter(Boolean)
        )
      )
    : [];
  const contactFormId = ((formData.get("contact_form_id") as string) || "").trim();
  const { data: existingBusiness, error: existingBusinessError } = await supabase
    .from("businesses")
    .select("settings")
    .eq("id", businessId)
    .maybeSingle();
  if (existingBusinessError) throw new Error(existingBusinessError.message);
  const existingSettings =
    existingBusiness?.settings && typeof existingBusiness.settings === "object" && !Array.isArray(existingBusiness.settings)
      ? (existingBusiness.settings as Record<string, Json | undefined>)
      : {};
  const nextSettings: Record<string, Json | undefined> = {
    ...existingSettings,
    team_title_types: teamTitleTypes as unknown as Json,
  };

  const setNullableStringSetting = (key: string, options?: { preserveIfBlank?: boolean }) => {
    if (!formData.has(key)) return;
    const value = ((formData.get(key) as string) || "").trim();
    if (!value && options?.preserveIfBlank) return;
    nextSettings[key] = (value || null) as unknown as Json;
  };
  const setNullableNumberSetting = (key: string) => {
    if (!formData.has(key)) return;
    const parsed = parseNullableNumber(formData.get(key));
    nextSettings[key] = (parsed ?? null) as unknown as Json;
  };

  if (formData.has("contact_form_id")) {
    nextSettings.contact_form_id = (contactFormId || null) as unknown as Json;
  }
  if (formData.has("license_numbers_config")) {
    const rawLicenses = ((formData.get("license_numbers_config") as string) || "").trim();
    let parsedLicenses: unknown = [];
    if (rawLicenses) {
      try {
        parsedLicenses = JSON.parse(rawLicenses);
      } catch {
        throw new Error("Invalid license numbers config JSON");
      }
    }
    nextSettings.license_numbers = parseBusinessLicenses(parsedLicenses) as unknown as Json;
  }

  setNullableStringSetting("service_default_title_template");
  setNullableStringSetting("service_default_meta_description_template");
  setNullableStringSetting("service_default_h1_template");
  setNullableStringSetting("service_default_url_template");
  setNullableStringSetting("service_default_icon");
  if (formData.has("service_card_show_excerpts_present")) {
    nextSettings.service_card_show_excerpts = formData.has("service_card_show_excerpts") as unknown as Json;
  }
  if (formData.has("service_detail_base_path")) {
    const normalizedServiceBase = normalizePublicPathSegment((formData.get("service_detail_base_path") as string) || "");
    nextSettings.service_detail_base_path = (normalizedServiceBase || null) as unknown as Json;
  }
  setNullableStringSetting("area_default_title_template");
  setNullableStringSetting("area_default_meta_description_template");
  setNullableStringSetting("area_default_h1_template");
  setNullableStringSetting("area_default_url_template");
  setNullableStringSetting("area_default_icon");
  if (formData.has("area_card_show_excerpts_present")) {
    nextSettings.area_card_show_excerpts = formData.has("area_card_show_excerpts") as unknown as Json;
  }
  if (formData.has("area_detail_base_path")) {
    const normalizedAreaBase = normalizePublicPathSegment((formData.get("area_detail_base_path") as string) || "");
    nextSettings.area_detail_base_path = (normalizedAreaBase || null) as unknown as Json;
  }
  setNullableStringSetting("favicon_url");
  setNullableStringSetting("google_business_profile_account_id");
  setNullableStringSetting("google_business_profile_location_id");
  setNullableStringSetting("google_business_profile_refresh_token", { preserveIfBlank: true });
  setNullableStringSetting("quickbooks_client_id");
  setNullableStringSetting("quickbooks_client_secret");
  setNullableStringSetting("quickbooks_redirect_uri");
  setNullableStringSetting("quickbooks_default_service_item_id");
  setNullableNumberSetting("default_tax_rate");
  setNullableStringSetting("email_from_name");
  setNullableStringSetting("email_from_address");
  setNullableStringSetting("email_reply_to");
  setNullableStringSetting("owner_first_name");
  setNullableStringSetting("owner_last_name");
  setNullableStringSetting("owner_phone");
  setNullableStringSetting("owner_email");
  setNullableStringSetting("primary_cta_label");
  setNullableStringSetting("secondary_cta_label");
  setNullableStringSetting("secondary_cta_link");
  delete (nextSettings as Record<string, unknown>).frontend_theme;
  delete (nextSettings as Record<string, unknown>).frontend_theme_css;
  delete (nextSettings as Record<string, unknown>).frontend_theme_css_theme;

  const rawState = ((formData.get("state") as string) || "").trim().toUpperCase();
  const allowedStateCodes = [
    "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
    "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
    "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
  ] as const;
  type BusinessStateCode = (typeof allowedStateCodes)[number];
  const normalizedState: BusinessStateCode | null = allowedStateCodes.includes(rawState as BusinessStateCode)
    ? (rawState as BusinessStateCode)
    : null;

  const payload: TablesUpdate<"businesses"> = {
    name,
    phone: ((formData.get("phone") as string) || "").trim() || null,
    email: ((formData.get("email") as string) || "").trim() || null,
    domain: ((formData.get("domain") as string) || "").trim() || null,
    logo_url: ((formData.get("logo_url") as string) || "").trim() || null,
    address_line1: ((formData.get("address_line1") as string) || "").trim() || null,
    address_line2: ((formData.get("address_line2") as string) || "").trim() || null,
    city: ((formData.get("city") as string) || "").trim() || null,
    state: normalizedState,
    zip: ((formData.get("zip") as string) || "").trim() || null,
    timezone: normalizeBusinessTimezone((formData.get("timezone") as string) || ""),
    settings: nextSettings as Json,
  };

  const { error } = await supabase
    .from("businesses")
    .update(payload)
    .eq("id", businessId);
  if (error) throw new Error(error.message);

  await syncConfiguredEntityBasePathRedirects({
    supabase,
    businessId,
    table: "services",
    previousSettings: existingSettings as Json,
    nextSettings: nextSettings as Json,
  });
  await syncConfiguredEntityBasePathRedirects({
    supabase,
    businessId,
    table: "areas",
    previousSettings: existingSettings as Json,
    nextSettings: nextSettings as Json,
  });

  revalidatePath("/dashboard/settings");
  revalidateCommonSitePaths();
}

export async function saveHeaderNavigationSettingsAction(formData: FormData) {
  await assertAdminDashboardAction();
  const supabase = createAdminClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const rawConfig = ((formData.get("header_navigation_config") as string) || "").trim();
  let parsedInput: unknown = {};
  if (rawConfig) {
    try {
      parsedInput = JSON.parse(rawConfig);
    } catch {
      throw new Error("Invalid header navigation config JSON");
    }
  }

  const nextConfig = parseHeaderNavConfig(parsedInput);

  const { data: existingBusiness, error: existingBusinessError } = await supabase
    .from("businesses")
    .select("settings")
    .eq("id", businessId)
    .maybeSingle();
  if (existingBusinessError) throw new Error(existingBusinessError.message);

  const existingSettings =
    existingBusiness?.settings && typeof existingBusiness.settings === "object" && !Array.isArray(existingBusiness.settings)
      ? (existingBusiness.settings as Record<string, Json | undefined>)
      : {};

  const nextSettings: Json = {
    ...existingSettings,
    header_navigation: headerNavConfigToJson(nextConfig),
  } as Json;

  const { error } = await supabase
    .from("businesses")
    .update({ settings: nextSettings } satisfies TablesUpdate<"businesses">)
    .eq("id", businessId);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/settings");
  revalidateCommonSitePaths();
}

export async function saveFooterBuilderSettingsAction(formData: FormData) {
  await assertAdminDashboardAction();
  const supabase = createAdminClient();
  const submittedBusinessId = ((formData.get("business_id") as string) || "").trim();
  const businessId = submittedBusinessId || (await resolveCurrentBusinessId());
  if (!businessId) throw new Error("Business context is required");

  const rawConfig = ((formData.get("footer_builder_config") as string) || "").trim();
  let parsedInput: unknown = {};
  if (rawConfig) {
    try {
      parsedInput = JSON.parse(rawConfig);
    } catch {
      throw new Error("Invalid footer builder config JSON");
    }
  }

  const nextConfig = parseFooterBuilderConfig(parsedInput);

  const { data: existingBusiness, error: existingBusinessError } = await supabase
    .from("businesses")
    .select("settings")
    .eq("id", businessId)
    .maybeSingle();
  if (existingBusinessError) throw new Error(existingBusinessError.message);

  const existingSettings =
    existingBusiness?.settings && typeof existingBusiness.settings === "object" && !Array.isArray(existingBusiness.settings)
      ? (existingBusiness.settings as Record<string, Json | undefined>)
      : {};

  const nextSettings: Json = {
    ...existingSettings,
    footer_builder: footerBuilderConfigToJson(nextConfig),
  } as Json;

  const { error } = await supabase
    .from("businesses")
    .update({ settings: nextSettings } satisfies TablesUpdate<"businesses">)
    .eq("id", businessId);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/settings");
  revalidateCommonSitePaths();
  redirect("/dashboard/settings?tab=footer");
}

export async function saveContactPageFormSelectionAction(formId: string | null) {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const { data: existingBusiness, error: existingBusinessError } = await supabase
    .from("businesses")
    .select("settings")
    .eq("id", businessId)
    .maybeSingle();
  if (existingBusinessError) throw new Error(existingBusinessError.message);

  const existingSettings =
    existingBusiness?.settings && typeof existingBusiness.settings === "object" && !Array.isArray(existingBusiness.settings)
      ? (existingBusiness.settings as Record<string, Json | undefined>)
      : {};

  const nextSettings: Json = {
    ...existingSettings,
    contact_form_id: ((formId ?? "").trim() || null) as unknown as Json,
  } as Json;

  const { error } = await supabase
    .from("businesses")
    .update({ settings: nextSettings } satisfies TablesUpdate<"businesses">)
    .eq("id", businessId);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/forms");
  revalidatePath("/dashboard/settings");
  revalidatePath("/contact");
  revalidateCommonSitePaths();
  return { success: true };
}

export async function saveSeoSettingsAction(formData: FormData) {
  await assertAdminDashboardAction();
  const supabase = createAdminClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const excludesRaw = ((formData.get("sitemap_excludes") as string) || "").trim();
  const sitemapExcludes = excludesRaw
    ? excludesRaw
        .split(/\r?\n|,/)
        .map((entry) => entry.trim())
        .filter(Boolean)
    : null;

  const payload: TablesInsert<"seo_settings"> = {
    business_id: businessId,
    default_meta_title_suffix: null,
    google_analytics_id: ((formData.get("google_analytics_id") as string) || "").trim() || null,
    google_tag_manager_id:
      ((formData.get("google_tag_manager_id") as string) || "").trim() || null,
    google_business_profile_url:
      ((formData.get("google_business_profile_url") as string) || "").trim() || null,
    og_image_url: ((formData.get("og_image_url") as string) || "").trim() || null,
    sitemap_excludes: sitemapExcludes,
  };

  const { error } = await supabase
    .from("seo_settings")
    .upsert(payload, { onConflict: "business_id" });
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/settings");
  revalidateCommonSitePaths();
}

export async function saveAutomationSettingsAction(formData: FormData) {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const { data: existingBusiness, error: existingBusinessError } = await supabase
    .from("businesses")
    .select("settings")
    .eq("id", businessId)
    .maybeSingle();
  if (existingBusinessError) throw new Error(existingBusinessError.message);

  const existingSettings =
    existingBusiness?.settings && typeof existingBusiness.settings === "object" && !Array.isArray(existingBusiness.settings)
      ? (existingBusiness.settings as Record<string, Json | undefined>)
      : {};

  const nextSettings: Record<string, Json | undefined> = {
    ...existingSettings,
  };

  for (const key of ["email_from_name", "email_from_address", "email_reply_to"] as const) {
    if (!formData.has(key)) continue;
    const value = ((formData.get(key) as string) || "").trim();
    nextSettings[key] = (value || null) as unknown as Json;
  }

  for (const key of [
    "notification_new_lead_email",
    "notification_new_prospect_email",
    "notification_new_customer_email",
    "notification_estimate_approved_email",
    "notification_invoice_paid_email",
  ] as const) {
    if (!formData.has(`${key}__present`) && !formData.has(key)) continue;
    nextSettings[key] = (formData.get(key) === "on") as unknown as Json;
  }

  const { error: businessUpdateError } = await supabase
    .from("businesses")
    .update({ settings: nextSettings } satisfies TablesUpdate<"businesses">)
    .eq("id", businessId);
  if (businessUpdateError) throw new Error(businessUpdateError.message);

  const { data: existingSeo, error: existingSeoError } = await supabase
    .from("seo_settings")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();
  if (existingSeoError) throw new Error(existingSeoError.message);

  const payload: TablesInsert<"seo_settings"> = {
    business_id: businessId,
    default_meta_title_suffix: existingSeo?.default_meta_title_suffix ?? null,
    google_analytics_id: existingSeo?.google_analytics_id ?? null,
    google_tag_manager_id: existingSeo?.google_tag_manager_id ?? null,
    google_business_profile_url: formData.has("google_business_profile_url")
      ? (((formData.get("google_business_profile_url") as string) || "").trim() || null)
      : (existingSeo?.google_business_profile_url ?? null),
    og_image_url: existingSeo?.og_image_url ?? null,
    sitemap_excludes: existingSeo?.sitemap_excludes ?? null,
  };

  const { error: seoError } = await supabase
    .from("seo_settings")
    .upsert(payload, { onConflict: "business_id" });
  if (seoError) throw new Error(seoError.message);

  revalidatePath("/dashboard/automations");
  revalidatePath("/dashboard/settings");
  revalidateCommonSitePaths();
}

export async function saveAutomationRuleAction(formData: FormData) {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const id = ((formData.get("id") as string) || "").trim();
  const name = ((formData.get("name") as string) || "").trim();
  const templateId = ((formData.get("template_id") as string) || "").trim();
  const triggerEvent = ((formData.get("trigger_event") as string) || "").trim();
  const delayMinutesRaw = ((formData.get("delay_minutes") as string) || "0").trim();
  const delayMinutes = Number(delayMinutesRaw);
  const isActive = formData.get("is_active") === "on";
  const normalizedRecipientTargets = await validateAutomationRecipientTargets(
    formData.has("recipient_targets")
      ? (() => {
          const rawRecipientTargets = ((formData.get("recipient_targets") as string) || "").trim();
          try {
            const parsed = JSON.parse(rawRecipientTargets) as unknown;
            return Array.isArray(parsed)
              ? parsed
                  .filter((value): value is string => typeof value === "string")
                  .map((value) => value.trim())
                  .filter(Boolean)
              : [];
          } catch {
            throw new Error("Recipient targets are invalid");
          }
        })()
      : getDefaultAutomationRecipientTargets(triggerEvent as PlatformAutomationTriggerValue),
  );

  if (!name) throw new Error("Automation name is required");
  if (!templateId) throw new Error("Template is required");

  if (!PLATFORM_AUTOMATION_TRIGGER_VALUES.includes(triggerEvent as (typeof PLATFORM_AUTOMATION_TRIGGER_VALUES)[number])) {
    throw new Error("Invalid automation trigger");
  }

  if (!Number.isFinite(delayMinutes) || delayMinutes < 0) {
    throw new Error("Delay minutes must be zero or greater");
  }

  if (id) {
    const { error } = await supabase
      .from("automation_rules")
      .update({
        name,
        template_id: templateId,
        trigger_event: triggerEvent as TablesUpdate<"automation_rules">["trigger_event"],
        delay_minutes: Math.round(delayMinutes),
        is_active: isActive,
        recipient_targets: normalizedRecipientTargets as unknown as Json,
      } satisfies TablesUpdate<"automation_rules">)
      .eq("id", id)
      .eq("business_id", businessId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("automation_rules")
      .insert({
        business_id: businessId,
        name,
        template_id: templateId,
        trigger_event: triggerEvent as TablesInsert<"automation_rules">["trigger_event"],
        delay_minutes: Math.round(delayMinutes),
        is_active: isActive,
        recipient_targets: normalizedRecipientTargets as unknown as Json,
        conditions: null,
      } satisfies TablesInsert<"automation_rules">);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/dashboard/automations");
}

export async function createQuickBooksItemAction(formData: FormData) {
  await assertAdminDashboardAction();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const name = ((formData.get("name") as string) || "").trim();
  const type = ((formData.get("type") as string) || "").trim();
  const description = ((formData.get("description") as string) || "").trim() || null;
  const rawUnitPrice = ((formData.get("unit_price") as string) || "").trim();
  const unitPrice = rawUnitPrice === "" ? null : Number(rawUnitPrice);

  if (!name) throw new Error("Item name is required");
  if (type !== "Service" && type !== "NonInventory") {
    throw new Error("Item type is invalid");
  }
  if (unitPrice !== null && !Number.isFinite(unitPrice)) {
    throw new Error("Unit price must be a valid number");
  }

  await createQuickBooksItemForBusiness({
    businessId,
    name,
    type,
    description,
    unitPrice,
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/estimates");
  revalidatePath("/dashboard/invoices");
}

export async function updateQuickBooksItemAction(formData: FormData) {
  await assertAdminDashboardAction();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const itemId = ((formData.get("item_id") as string) || "").trim();
  const name = ((formData.get("name") as string) || "").trim();
  const description = ((formData.get("description") as string) || "").trim() || null;
  const rawUnitPrice = ((formData.get("unit_price") as string) || "").trim();
  const unitPrice = rawUnitPrice === "" ? null : Number(rawUnitPrice);

  if (!itemId) throw new Error("Item is required");
  if (!name) throw new Error("Item name is required");
  if (unitPrice !== null && !Number.isFinite(unitPrice)) {
    throw new Error("Unit price must be a valid number");
  }

  await updateQuickBooksItemForBusiness({
    businessId,
    itemId,
    name,
    description,
    unitPrice,
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/estimates");
  revalidatePath("/dashboard/invoices");
}

export async function deactivateQuickBooksItemAction(itemId: string) {
  await assertAdminDashboardAction();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");
  if (!itemId.trim()) throw new Error("Item is required");

  await deactivateQuickBooksItemForBusiness({
    businessId,
    itemId: itemId.trim(),
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/estimates");
  revalidatePath("/dashboard/invoices");
}

export async function deleteAutomationRuleAction(id: string) {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const { error } = await supabase
    .from("automation_rules")
    .delete()
    .eq("id", id)
    .eq("business_id", businessId);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/automations");
}

export async function addAutomationRuleRowAction() {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const [{ data: templates, error: templatesError }, { count, error: countError }] = await Promise.all([
    supabase
      .from("email_templates")
      .select("id, name")
      .eq("business_id", businessId)
      .order("name", { ascending: true })
      .limit(1),
    supabase
      .from("automation_rules")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId),
  ]);
  if (templatesError) throw new Error(templatesError.message);
  if (countError) throw new Error(countError.message);

  const template = templates?.[0];
  if (!template?.id) {
    throw new Error("Create an email template before adding a trigger.");
  }

  const nextIndex = (count ?? 0) + 1;
  const defaultTriggerEvent = PLATFORM_AUTOMATION_TRIGGER_VALUES[0];
  const { error } = await supabase
    .from("automation_rules")
    .insert({
      business_id: businessId,
      name: `Flow ${nextIndex}`,
      template_id: template.id,
      trigger_event: defaultTriggerEvent,
      delay_minutes: 0,
      is_active: true,
      recipient_targets: getDefaultAutomationRecipientTargets(defaultTriggerEvent) as unknown as Json,
      conditions: null,
    } satisfies TablesInsert<"automation_rules">);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/automations");
}

export async function saveAutomationRuleFieldAction(formData: FormData) {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const id = ((formData.get("id") as string) || "").trim();
  if (!id) throw new Error("Automation flow is required");

  const update: TablesUpdate<"automation_rules"> = {};

  if (formData.has("trigger_event")) {
    const triggerEvent = ((formData.get("trigger_event") as string) || "").trim();
    if (!PLATFORM_AUTOMATION_TRIGGER_VALUES.includes(triggerEvent as (typeof PLATFORM_AUTOMATION_TRIGGER_VALUES)[number])) {
      throw new Error("Invalid automation trigger");
    }
    update.trigger_event = triggerEvent as TablesUpdate<"automation_rules">["trigger_event"];

    const { data: existingRule, error: existingRuleError } = await supabase
      .from("automation_rules")
      .select("recipient_targets")
      .eq("business_id", businessId)
      .eq("id", id)
      .maybeSingle();
    if (existingRuleError) throw new Error(existingRuleError.message);

    const existingRecipientTargets = parseAutomationRuleRecipientTargets(existingRule?.recipient_targets);
    const hasOnlyDefaultRecipients =
      existingRecipientTargets.length > 0 &&
      existingRecipientTargets.every((value) => value === "contact");

    if (existingRecipientTargets.length === 0 || hasOnlyDefaultRecipients) {
      update.recipient_targets = getDefaultAutomationRecipientTargets(
        triggerEvent as PlatformAutomationTriggerValue,
      ) as unknown as Json;
    }
  }

  if (formData.has("template_id")) {
    const templateId = ((formData.get("template_id") as string) || "").trim();
    if (!templateId) throw new Error("Template is required");

    const { data: template, error: templateError } = await supabase
      .from("email_templates")
      .select("id")
      .eq("business_id", businessId)
      .eq("id", templateId)
      .maybeSingle();
    if (templateError) throw new Error(templateError.message);
    if (!template?.id) throw new Error("Selected template is invalid");
    update.template_id = templateId;
  }

  if (formData.has("is_active_present")) {
    update.is_active = formData.get("is_active") === "on";
  }

  if (formData.has("recipient_targets")) {
    const rawRecipientTargets = ((formData.get("recipient_targets") as string) || "").trim();
    let recipientTargets: string[] = [];
    try {
      const parsed = JSON.parse(rawRecipientTargets) as unknown;
      recipientTargets = Array.isArray(parsed)
        ? parsed
            .filter((value): value is string => typeof value === "string")
            .map((value) => value.trim())
            .filter(Boolean)
        : [];
    } catch {
      throw new Error("Recipient targets are invalid");
    }

    update.recipient_targets = (
      await validateAutomationRecipientTargets(recipientTargets)
    ) as unknown as Json;
  }

  if (formData.has("name")) {
    const name = ((formData.get("name") as string) || "").trim();
    if (!name) throw new Error("Automation name is required");
    update.name = name;
  }

  if (Object.keys(update).length === 0) return;

  const { error } = await supabase
    .from("automation_rules")
    .update(update)
    .eq("business_id", businessId)
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/automations");
}

export async function deleteAutomationRulesBulk(ids: string[]) {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const uniqueIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
  if (uniqueIds.length === 0) return { success: true, deletedCount: 0 };

  const { error } = await supabase
    .from("automation_rules")
    .delete()
    .eq("business_id", businessId)
    .in("id", uniqueIds);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/automations");
  return { success: true, deletedCount: uniqueIds.length };
}

export async function saveNavigationMenuAction(formData: FormData) {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const location = ((formData.get("location") as string) || "header").trim();
  if (!["header", "footer", "sidebar"].includes(location)) {
    throw new Error("Invalid menu location");
  }

  const rawItems = ((formData.get("items_json") as string) || "").trim();
  let parsedItems: Json = [];
  if (rawItems) {
    try {
      const parsed = JSON.parse(rawItems) as unknown;
      if (!Array.isArray(parsed)) throw new Error("Navigation items must be an array");
      parsedItems = parsed as Json;
    } catch {
      throw new Error("Navigation JSON is invalid");
    }
  }

  const payload: TablesInsert<"navigation_menus"> = {
    business_id: businessId,
    location: location as TablesInsert<"navigation_menus">["location"],
    items: parsedItems,
  };

  const { error } = await supabase
    .from("navigation_menus")
    .upsert(payload, { onConflict: "business_id,location" });
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/settings");
  revalidateCommonSitePaths();
}

export async function saveRedirectAction(formData: FormData) {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const id = ((formData.get("id") as string) || "").trim() || null;
  const fromPath = normalizeRedirectPathInput((formData.get("from_path") as string) || "");
  const toPath = normalizeRedirectPathInput((formData.get("to_path") as string) || "");
  const typeRaw = ((formData.get("type") as string) || "301").trim();
  const isActive = (formData.get("is_active") as string) === "on";

  if (!fromPath || !toPath) throw new Error("Redirect from/to paths are required");
  if (!["301", "302"].includes(typeRaw)) throw new Error("Invalid redirect type");

  const payload: TablesInsert<"redirects"> = {
    business_id: businessId,
    from_path: fromPath,
    to_path: toPath,
    type: typeRaw as TablesInsert<"redirects">["type"],
    is_active: isActive,
  };

  if (id) {
    const { error } = await supabase
      .from("redirects")
      .update(payload)
      .eq("id", id)
      .eq("business_id", businessId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("redirects").insert(payload);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/dashboard/settings");
}

export async function deleteRedirectAction(id: string) {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const { error } = await supabase
    .from("redirects")
    .delete()
    .eq("id", id)
    .eq("business_id", businessId);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/settings");
}

function normalizeDomainInput(value: string | null | undefined) {
  const raw = (value ?? "").trim().toLowerCase();
  if (!raw) return "";
  return raw
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "")
    .replace(/:\d+$/, "");
}

function getVercelCanonicalDomain(value: string | null | undefined) {
  const normalized = normalizeDomainInput(value);
  if (!normalized) return "";
  return normalized.startsWith("www.") ? normalized : `www.${normalized}`;
}

function getVercelDomainCandidates(value: string | null | undefined) {
  const canonicalDomain = getVercelCanonicalDomain(value);
  if (!canonicalDomain) return [];

  const apexDomain = canonicalDomain.replace(/^www\./, "");
  return Array.from(new Set([apexDomain, canonicalDomain]));
}

function normalizeRedirectPathInput(value: string | null | undefined) {
  const raw = (value ?? "").trim();
  if (!raw) return "";

  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      const pathname = parsed.pathname || "/";
      const search = parsed.search || "";
      const normalizedPathname =
        pathname === "/" ? "/" : `/${pathname.replace(/^\/+/, "").replace(/\/+$/, "")}`;
      return `${normalizedPathname}${search}`;
    } catch {
      return "";
    }
  }

  const [pathnamePart, queryPart = ""] = raw.split("?", 2);
  const trimmedPath = pathnamePart.trim();
  const normalizedPathname =
    !trimmedPath || trimmedPath === "/"
      ? "/"
      : `/${trimmedPath.replace(/^\/+/, "").replace(/\/+$/, "")}`;

  return queryPart ? `${normalizedPathname}?${queryPart}` : normalizedPathname;
}

function normalizeSlugInput(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function logPlatformAudit(options: {
  supabase: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>;
  businessId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Json | null;
}) {
  const { supabase, businessId, userId, action, entityType, entityId, metadata } = options;
  await supabase.from("activity_log").insert({
    business_id: businessId,
    user_id: userId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata: metadata ?? null,
  });
}

async function resolvePlatformTargetBusinessId(
  supabase: ReturnType<typeof createAdminClient>,
  formData?: FormData
) {
  const requestedBusinessId = ((formData?.get("business_id") as string) || "").trim();
  if (!requestedBusinessId) {
    return await resolveCurrentBusinessId();
  }

  const { data: business, error } = await supabase
    .from("businesses")
    .select("id")
    .eq("id", requestedBusinessId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!business?.id) throw new Error("Selected business was not found");
  return business.id;
}

async function resolveManagedUserBusinessContext(formData?: FormData) {
  const profile = await getCurrentDashboardProfile();
  if (!profile || profile.role !== "admin") {
    throw new Error("Admin access required");
  }

  const adminSupabase = createAdminClient();
  const requestedBusinessId = ((formData?.get("business_id") as string) || "").trim();
  const isPlatformAdmin = isPlatformAdminEmail(profile.user.email);
  const businessId = requestedBusinessId && isPlatformAdmin
    ? await resolvePlatformTargetBusinessId(adminSupabase, formData)
    : profile.business_id;

  if (!businessId) throw new Error("Business context is required");
  return { profile, businessId, isPlatformAdmin, adminSupabase };
}

async function listAuthUsersByEmail(adminSupabase: ReturnType<typeof createAdminClient>) {
  const perPage = 200;
  const users = new Map<string, { id: string; email: string }>();

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await adminSupabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);

    const rows = data?.users ?? [];
    for (const user of rows) {
      const email = user.email?.trim().toLowerCase();
      if (email) {
        users.set(email, { id: user.id, email });
      }
    }

    if (rows.length < perPage) break;
  }

  return users;
}

async function grantPlatformAdminAccessToBusiness(
  adminSupabase: ReturnType<typeof createAdminClient>,
  businessId: string,
) {
  const platformAdminEmails = getConfiguredPlatformAdminEmails();
  if (platformAdminEmails.length === 0) return;

  const authUsers = await listAuthUsersByEmail(adminSupabase);
  const accessRows = platformAdminEmails
    .map((email) => authUsers.get(email))
    .filter((user): user is { id: string; email: string } => Boolean(user))
    .map((user) => ({
      user_id: user.id,
      business_id: businessId,
      role: "admin" as const,
      is_active: true,
    }));

  if (accessRows.length === 0) return;

  const { error } = await adminSupabase
    .from("user_business_access")
    .upsert(accessRows, { onConflict: "user_id,business_id" });
  if (error) throw new Error(error.message);
}

export async function inviteBusinessUserAction(formData: FormData) {
  const { profile, businessId, adminSupabase } = await resolveManagedUserBusinessContext(formData);

  const email = ((formData.get("email") as string) || "").trim().toLowerCase();
  const firstName = ((formData.get("first_name") as string) || "").trim() || null;
  const lastName = ((formData.get("last_name") as string) || "").trim() || null;
  const phone = ((formData.get("phone") as string) || "").trim() || null;
  const role = ((formData.get("role") as string) || "employee").trim() === "admin" ? "admin" : "employee";

  if (!email) throw new Error("Email is required");

  const existingAuthUsers = await listAuthUsersByEmail(adminSupabase);
  const existingAuthUser = existingAuthUsers.get(email) ?? null;

  const inviteResult = await sendManagedInviteEmail({
    admin: adminSupabase,
    businessId,
    email,
    firstName,
    lastName,
    existingUserId: existingAuthUser?.id ?? null,
  });
  const invitedUserId = inviteResult.userId;

  if (!invitedUserId) throw new Error("Unable to create or invite the user");

  const { data: existingProfile, error: existingProfileError } = await adminSupabase
    .from("profiles")
    .select("id, business_id")
    .eq("id", invitedUserId)
    .maybeSingle();
  if (existingProfileError) throw new Error(existingProfileError.message);

  const { error: profileError } = await adminSupabase
    .from("profiles")
    .upsert(
      {
        id: invitedUserId,
        business_id: existingProfile?.business_id ?? businessId,
        first_name: firstName,
        last_name: lastName,
        phone,
        role,
        is_active: true,
      },
      { onConflict: "id" }
    );
  if (profileError) throw new Error(profileError.message);

  const { error: accessError } = await adminSupabase
    .from("user_business_access")
    .upsert(
      {
        user_id: invitedUserId,
        business_id: businessId,
        role,
        is_active: true,
      },
      { onConflict: "user_id,business_id" },
    );
  if (accessError) throw new Error(accessError.message);

  await logPlatformAudit({
    supabase: adminSupabase,
    businessId,
    userId: profile.id,
    action: "business_user_invited",
    entityType: "profile",
    entityId: invitedUserId,
    metadata: {
      email,
      first_name: firstName,
      last_name: lastName,
      phone,
      role,
    } as Json,
  });

  revalidatePath("/dashboard/platform");
  revalidatePath("/dashboard/settings");
}

export async function updateBusinessUserAccessAction(formData: FormData) {
  const { profile, businessId, adminSupabase } = await resolveManagedUserBusinessContext(formData);
  const userId = ((formData.get("user_id") as string) || "").trim();
  if (!userId) throw new Error("User is required");

  const role = ((formData.get("role") as string) || "employee").trim() === "admin" ? "admin" : "employee";
  const phone = ((formData.get("phone") as string) || "").trim() || null;

  if (userId === profile.id && role !== "admin") {
    throw new Error("You can't remove your own admin access");
  }

  const { data: existingAccess, error: existingAccessError } = await adminSupabase
    .from("user_business_access")
    .select("user_id, business_id")
    .eq("user_id", userId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (existingAccessError) throw new Error(existingAccessError.message);
  if (!existingAccess) throw new Error("User not found");

  const { error: accessError } = await adminSupabase
    .from("user_business_access")
    .update({
      role,
      is_active: true,
    })
    .eq("user_id", userId)
    .eq("business_id", businessId);
  if (accessError) throw new Error(accessError.message);

  const { error } = await adminSupabase
    .from("profiles")
    .update({
      role,
      phone,
    })
    .eq("id", userId);
  if (error) throw new Error(error.message);

  await logPlatformAudit({
    supabase: adminSupabase,
    businessId,
    userId: profile.id,
    action: "business_user_updated",
    entityType: "profile",
    entityId: userId,
    metadata: {
      role,
      phone,
    } as Json,
  });

  revalidatePath("/dashboard/platform");
  revalidatePath("/dashboard/settings");
}

export async function deleteBusinessUserAccessAction(userId: string, businessIdOverride?: string) {
  const { profile, businessId, isPlatformAdmin, adminSupabase } = await resolveManagedUserBusinessContext();
  const normalizedUserId = userId.trim();
  const requestedBusinessId = businessIdOverride?.trim() || "";
  if (requestedBusinessId && !isPlatformAdmin && requestedBusinessId !== businessId) {
    throw new Error("You can't delete users from another business");
  }
  const normalizedBusinessId = requestedBusinessId || businessId;

  if (!normalizedUserId) throw new Error("User is required");
  if (!normalizedBusinessId) throw new Error("Business context is required");
  if (normalizedUserId === profile.id) throw new Error("You can't delete your own access");

  const { data: existingAccess, error: existingAccessError } = await adminSupabase
    .from("user_business_access")
    .select("user_id, business_id")
    .eq("user_id", normalizedUserId)
    .eq("business_id", normalizedBusinessId)
    .maybeSingle();
  if (existingAccessError) throw new Error(existingAccessError.message);
  if (!existingAccess) throw new Error("User not found");

  const { data: authUserResult, error: authUserError } = await adminSupabase.auth.admin.getUserById(normalizedUserId);
  if (authUserError) throw new Error(authUserError.message);
  const authEmail = authUserResult.user?.email?.trim().toLowerCase() || "";
  if (authEmail && isPlatformAdminEmail(authEmail)) {
    throw new Error("Platform admin access can't be deleted from this screen");
  }

  const { error: accessDeleteError } = await adminSupabase
    .from("user_business_access")
    .delete()
    .eq("user_id", normalizedUserId)
    .eq("business_id", normalizedBusinessId);
  if (accessDeleteError) throw new Error(accessDeleteError.message);

  await logPlatformAudit({
    supabase: adminSupabase,
    businessId: normalizedBusinessId,
    userId: profile.id,
    action: "business_user_deleted",
    entityType: "profile",
    entityId: normalizedUserId,
    metadata: {
      email: authEmail || null,
    } as Json,
  });

  revalidatePath("/dashboard/platform");
  revalidatePath("/dashboard/settings");
}

export async function savePlatformTenantThemeAction(formData: FormData) {
  const platformProfile = await assertPlatformAdminAction();
  const supabase = createAdminClient();
  const businessId = await resolvePlatformTargetBusinessId(supabase, formData);
  if (!businessId) throw new Error("Business context is required");

  const rawTheme = ((formData.get("theme_key") as string) || "").trim();
  const nextTheme = normalizeFrontendTheme(rawTheme);
  if (!nextTheme) throw new Error("Invalid theme key");

  const { data: existingBusiness, error: existingBusinessError } = await supabase
    .from("businesses")
    .select("theme_key")
    .eq("id", businessId)
    .maybeSingle();
  if (existingBusinessError) throw new Error(existingBusinessError.message);

  const { error } = await supabase
    .from("businesses")
    .update({ theme_key: nextTheme } satisfies TablesUpdate<"businesses">)
    .eq("id", businessId);
  if (error) throw new Error(error.message);

  await logPlatformAudit({
    supabase,
    businessId,
    userId: platformProfile.id,
    action: "platform_theme_updated",
    entityType: "business",
    entityId: businessId,
    metadata: {
      previous_theme_key: existingBusiness?.theme_key ?? null,
      theme_key: nextTheme,
    } as Json,
  });

  revalidatePath("/dashboard/platform");
  revalidatePath("/dashboard/settings");
  revalidateTag("business-theme-source", "max");
  revalidateCommonSitePaths();
}

export async function savePlatformThemeFileAction(
  _previousState: { error: string | null; success: string | null },
  formData: FormData,
) {
  try {
    const platformProfile = await assertPlatformAdminAction();
    const supabase = createAdminClient();
    const businessId = await resolvePlatformTargetBusinessId(supabase, formData);
    if (!businessId) throw new Error("Business context is required");
    const rawTheme = ((formData.get("theme") as string) || "").trim();
    const css = typeof formData.get("css") === "string" ? (formData.get("css") as string) : "";
    const frontendTheme = normalizeFrontendTheme(rawTheme);

    if (!frontendTheme) throw new Error("Invalid theme key");
    const wrappedCss = wrapThemeEditorSource(frontendTheme, css);
    compileFrontendThemeSource(wrappedCss);
    const { error: updateError } = await supabase
      .from("businesses")
      .update({ theme_css: css } satisfies TablesUpdate<"businesses">)
      .eq("id", businessId);
    if (updateError) throw new Error(updateError.message);

    await logPlatformAudit({
      supabase,
      businessId,
      userId: platformProfile.id,
      action: "platform_theme_file_updated",
      entityType: "business",
      entityId: businessId,
      metadata: {
        theme_key: frontendTheme,
        theme_css_length: wrappedCss.length,
      } as Json,
    });

    revalidatePath("/dashboard/platform");
    revalidatePath("/dashboard/settings");
    revalidatePath("/theme.css");
    revalidateTag("business-theme-source", "max");
    revalidateCommonSitePaths();

    return { error: null, success: "Theme CSS saved." };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to save theme CSS.",
      success: null,
    };
  }
}

export async function saveBusinessDomainAction(formData: FormData) {
  const platformProfile = await assertPlatformAdminAction();
  const supabase = createAdminClient();
  const businessId = await resolvePlatformTargetBusinessId(supabase, formData);
  if (!businessId) throw new Error("Business context is required");

  const id = ((formData.get("id") as string) || "").trim();
  const domain = normalizeDomainInput(formData.get("domain") as string);
  const isPrimary = (formData.get("is_primary") as string) === "on";
  const isActive = (formData.get("is_active") as string) === "on";
  const submittedCanonicalDomain = normalizeDomainInput(formData.get("canonical_domain") as string) || null;
  const canonicalDomain =
    isPrimary ? submittedCanonicalDomain || getVercelCanonicalDomain(domain) : submittedCanonicalDomain;

  if (!domain) throw new Error("Domain is required");

  if (isPrimary) {
    const { error: clearPrimaryError } = await supabase
      .from("business_domains")
      .update({ is_primary: false })
      .eq("business_id", businessId);
    if (clearPrimaryError) throw new Error(clearPrimaryError.message);
  }

  const payload = {
    business_id: businessId,
    domain,
    canonical_domain: canonicalDomain,
    is_primary: isPrimary,
    is_active: isActive,
  };

  if (id) {
    const { error } = await supabase
      .from("business_domains")
      .update(payload)
      .eq("id", id)
      .eq("business_id", businessId);
    if (error) throw new Error(error.message);
    await logPlatformAudit({
      supabase,
      businessId,
      userId: platformProfile.id,
      action: "platform_domain_updated",
      entityType: "business_domain",
      entityId: id,
      metadata: {
        domain,
        canonical_domain: canonicalDomain,
        is_primary: isPrimary,
        is_active: isActive,
      } as Json,
    });
  } else {
    const { data: created, error } = await supabase
      .from("business_domains")
      .insert(payload)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (created?.id) {
      await logPlatformAudit({
        supabase,
        businessId,
        userId: platformProfile.id,
        action: "platform_domain_created",
        entityType: "business_domain",
        entityId: created.id,
        metadata: {
          domain,
          canonical_domain: canonicalDomain,
          is_primary: isPrimary,
          is_active: isActive,
        } as Json,
      });
    }
  }

  if (isPrimary) {
    const effectiveBusinessDomain = canonicalDomain || domain;
    const { error: businessUpdateError } = await supabase
      .from("businesses")
      .update({ domain: effectiveBusinessDomain })
      .eq("id", businessId);
    if (businessUpdateError) throw new Error(businessUpdateError.message);
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/platform");
}

export async function deleteBusinessDomainAction(id: string, businessIdOverride?: string) {
  const platformProfile = await assertPlatformAdminAction();
  const supabase = createAdminClient();
  const businessId =
    businessIdOverride?.trim() ||
    (await resolvePlatformTargetBusinessId(supabase));
  if (!businessId) throw new Error("Business context is required");

  const { error } = await supabase
    .from("business_domains")
    .delete()
    .eq("id", id)
    .eq("business_id", businessId);
  if (error) throw new Error(error.message);
  await logPlatformAudit({
    supabase,
    businessId,
    userId: platformProfile.id,
    action: "platform_domain_deleted",
    entityType: "business_domain",
    entityId: id,
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/platform");
}

export async function seedBusinessDomainsFromBusinessAction(formData?: FormData) {
  const platformProfile = await assertPlatformAdminAction();
  const supabase = createAdminClient();
  const businessId = await resolvePlatformTargetBusinessId(supabase, formData);
  if (!businessId) throw new Error("Business context is required");

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("domain")
    .eq("id", businessId)
    .maybeSingle();
  if (businessError) throw new Error(businessError.message);

  const baseDomain = normalizeDomainInput(business?.domain ?? "");
  if (!baseDomain) throw new Error("Business domain is not configured");

  const canonicalDomain = getVercelCanonicalDomain(baseDomain);
  const candidates = getVercelDomainCandidates(baseDomain);
  let insertedCount = 0;
  let updatedCount = 0;

  const { data: existingRows, error: existingError } = await supabase
    .from("business_domains")
    .select("id, domain")
    .eq("business_id", businessId);
  if (existingError) throw new Error(existingError.message);

  const existingMap = new Map<string, string>((existingRows ?? []).map((row) => [normalizeDomainInput(row.domain), row.id]));
  for (const domain of candidates) {
    const existingId = existingMap.get(domain);
    if (existingId) {
      const { error: updateError } = await supabase
        .from("business_domains")
        .update({
          canonical_domain: canonicalDomain,
          is_primary: domain === canonicalDomain,
          is_active: true,
        })
        .eq("id", existingId)
        .eq("business_id", businessId);
      if (updateError) throw new Error(updateError.message);
      updatedCount += 1;
      continue;
    }

    const { error: insertError } = await supabase.from("business_domains").insert({
      business_id: businessId,
      domain,
      canonical_domain: canonicalDomain,
      is_primary: domain === canonicalDomain,
      is_active: true,
    });
    if (insertError) throw new Error(insertError.message);
    insertedCount += 1;
  }

  const { error: clearOtherPrimaryError } = await supabase
    .from("business_domains")
    .update({ is_primary: false })
    .eq("business_id", businessId)
    .neq("domain", canonicalDomain);
  if (clearOtherPrimaryError) throw new Error(clearOtherPrimaryError.message);

  const { error: businessUpdateError } = await supabase
    .from("businesses")
    .update({ domain: canonicalDomain })
    .eq("id", businessId);
  if (businessUpdateError) throw new Error(businessUpdateError.message);

  await logPlatformAudit({
    supabase,
    businessId,
    userId: platformProfile.id,
    action: "platform_domains_seeded",
    entityType: "business",
    entityId: businessId,
    metadata: {
      primary_domain: canonicalDomain,
      inserted: insertedCount,
      updated: updatedCount,
    } as Json,
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/platform");
}

export async function runTenantOnboardingAction(formData?: FormData) {
  const platformProfile = await assertPlatformAdminAction();
  const supabase = createAdminClient();
  const businessId = await resolvePlatformTargetBusinessId(supabase, formData);
  if (!businessId) throw new Error("Business context is required");

  await seedBusinessDomainsFromBusinessAction(formData);

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("name, email, settings")
    .eq("id", businessId)
    .maybeSingle();
  if (businessError) throw new Error(businessError.message);

  const existingSettings =
    business?.settings && typeof business.settings === "object" && !Array.isArray(business.settings)
      ? (business.settings as Record<string, Json | undefined>)
      : {};

  const nextSettings: Record<string, Json | undefined> = { ...existingSettings };
  const hasEmailSender = typeof existingSettings.email_from_address === "string" && existingSettings.email_from_address.trim();
  if (!hasEmailSender && business?.email) {
    nextSettings.email_from_address = business.email as unknown as Json;
  }
  const hasSenderName = typeof existingSettings.email_from_name === "string" && existingSettings.email_from_name.trim();
  if (!hasSenderName && business?.name) {
    nextSettings.email_from_name = business.name as unknown as Json;
  }
  const hasReplyTo = typeof existingSettings.email_reply_to === "string" && existingSettings.email_reply_to.trim();
  if (!hasReplyTo && business?.email) {
    nextSettings.email_reply_to = business.email as unknown as Json;
  }

  if (JSON.stringify(existingSettings) !== JSON.stringify(nextSettings)) {
    const { error: updateBusinessError } = await supabase
      .from("businesses")
      .update({ settings: nextSettings as Json })
      .eq("id", businessId);
    if (updateBusinessError) throw new Error(updateBusinessError.message);
  }

  await createDefaultFormAutoResponseTemplatesAction();
  await logPlatformAudit({
    supabase,
    businessId,
    userId: platformProfile.id,
    action: "platform_tenant_onboarding_run",
    entityType: "business",
    entityId: businessId,
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/automations");
  revalidatePath("/dashboard/platform");
}

export async function createTenantAction(formData: FormData) {
  const platformProfile = await assertPlatformAdminAction();
  const supabase = createAdminClient();
  const name = ((formData.get("name") as string) || "").trim();
  const inputDomain = normalizeDomainInput((formData.get("primary_domain") as string) || "");
  const primaryDomain = getVercelCanonicalDomain(inputDomain);
  const slugInput = ((formData.get("slug") as string) || "").trim();
  const slugBase = normalizeSlugInput(slugInput || primaryDomain || name);
  const timezone = normalizeBusinessTimezone((formData.get("timezone") as string) || "");
  const phone = ((formData.get("phone") as string) || "").trim() || null;
  const email = ((formData.get("email") as string) || "").trim() || null;
  const addressLine1 = ((formData.get("address_line1") as string) || "").trim() || null;
  const city = ((formData.get("city") as string) || "").trim() || null;
  const zip = ((formData.get("zip") as string) || "").trim() || null;
  const uploadedLogo = formData.get("logo");
  const rawState = ((formData.get("state") as string) || "").trim().toUpperCase();
  const allowedStateCodes = [
    "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
    "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
    "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
  ] as const;
  type BusinessStateCode = (typeof allowedStateCodes)[number];
  const normalizedState: BusinessStateCode | null = allowedStateCodes.includes(rawState as BusinessStateCode)
    ? (rawState as BusinessStateCode)
    : null;

  if (!name) throw new Error("Tenant name is required");
  if (!slugBase) throw new Error("Tenant slug is required");

  let slug = slugBase;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = attempt === 0 ? slugBase : `${slugBase}-${attempt + 1}`;
    const { data: existingSlug, error: existingSlugError } = await supabase
      .from("businesses")
      .select("id")
      .eq("slug", candidate)
      .limit(1)
      .maybeSingle();
    if (existingSlugError) throw new Error(existingSlugError.message);
    if (!existingSlug) {
      slug = candidate;
      break;
    }
  }

  if (!slug) throw new Error("Unable to generate a unique tenant slug");
  const themeKey = buildClientThemeKey(slug);
  if (!themeKey) throw new Error("Unable to generate a theme key for this tenant");

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .insert({
      name,
      slug,
      timezone,
      domain: primaryDomain || null,
      phone,
      email,
      address_line1: addressLine1,
      city,
      state: normalizedState,
      zip,
      theme_key: themeKey,
      theme_css: null,
      settings: {} as Json,
    })
    .select("id, settings")
    .single();
  if (businessError) throw new Error(businessError.message);

  if (uploadedLogo instanceof File && uploadedLogo.size > 0 && uploadedLogo.name.trim()) {
    const bucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "media";
    const contentType = uploadedLogo.type || "application/octet-stream";
    const normalizedName = uploadedLogo.name.trim().replace(/[^a-zA-Z0-9._-]/g, "-");
    const safeName = normalizedName || "logo";
    const objectPath = `${business.id}/branding/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
    const fileBuffer = Buffer.from(await uploadedLogo.arrayBuffer());

    const { error: uploadError } = await supabase.storage.from(bucket).upload(objectPath, fileBuffer, {
      upsert: false,
      contentType,
      cacheControl: "31536000",
    });
    if (uploadError) throw new Error(uploadError.message);

    const fileUrl = supabase.storage.from(bucket).getPublicUrl(objectPath).data.publicUrl;
    const nextSettings =
      business.settings && typeof business.settings === "object" && !Array.isArray(business.settings)
        ? { ...(business.settings as Record<string, Json | undefined>) }
        : {};
    if (typeof nextSettings.favicon_url !== "string" || !nextSettings.favicon_url.trim()) {
      nextSettings.favicon_url = fileUrl as unknown as Json;
    }

    const { error: logoUpdateError } = await supabase
      .from("businesses")
      .update({
        logo_url: fileUrl,
        settings: nextSettings as Json,
      })
      .eq("id", business.id);
    if (logoUpdateError) throw new Error(logoUpdateError.message);
  }

  if (primaryDomain) {
    const domainCandidates = getVercelDomainCandidates(primaryDomain);

    for (const domain of domainCandidates) {
      const { error: domainError } = await supabase.from("business_domains").insert({
        business_id: business.id,
        domain,
        canonical_domain: primaryDomain,
        is_primary: domain === primaryDomain,
        is_active: true,
      });
      if (domainError) throw new Error(domainError.message);
    }
  }

  await grantPlatformAdminAccessToBusiness(supabase, business.id);

  await logPlatformAudit({
    supabase,
    businessId: business.id,
    userId: platformProfile.id,
    action: "platform_tenant_created",
    entityType: "business",
    entityId: business.id,
    metadata: {
      name,
      slug,
      primary_domain: primaryDomain || null,
      timezone,
      phone,
      email,
      address_line1: addressLine1,
      city,
      state: normalizedState,
      zip,
      has_logo_upload: uploadedLogo instanceof File && uploadedLogo.size > 0,
    } as Json,
  });

  revalidatePath("/dashboard/platform");
  redirect(`/dashboard/platform?client=${business.id}`);
}

type TrialProvisioningState = {
  error: string | null;
  success: string | null;
  businessName?: string;
  previewUrl?: string;
  dashboardUrl?: string;
  slug?: string;
  inviteEmailSent?: boolean;
};

const FREE_TRIAL_ROOT_DOMAIN = "hsgrowth.com";
const FREE_TRIAL_NEARBY_AREA_COUNT = 10;
const FREE_TRIAL_AREA_RADIUS_MILES = 35;
const FREE_TRIAL_AI_TIMEOUT_MS = 180000;
const FREE_TRIAL_AI_MODEL = process.env.OPENAI_FREE_TRIAL_MODEL?.trim() || "gpt-5-mini";
const FREE_TRIAL_BODY_WORD_TARGET = 700;
const ALLOWED_STATE_CODES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
] as const;
type BusinessStateCode = (typeof ALLOWED_STATE_CODES)[number];
type FreeTrialZipLocation = Tables<"zip_locations">;

function isAllowedStateCode(value: string | null | undefined): value is BusinessStateCode {
  return ALLOWED_STATE_CODES.includes((value ?? "").toUpperCase() as BusinessStateCode);
}

function normalizeFreeTrialZipCode(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\D+/g, "");
  return digits.length === 5 ? digits : "";
}

function normalizeFreeTrialIndustry(value: string | null | undefined) {
  return getFreeTrialIndustryPreset(normalizeSlugInput(value)).key;
}

function generateFreeTrialSlugSuffix(length = 4) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let output = "";
  for (let index = 0; index < length; index += 1) {
    output += alphabet[Math.floor(Math.random() * alphabet.length)] ?? "x";
  }
  return output;
}

function splitFreeTrialName(value: string | null | undefined) {
  const parts = (value ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: null, lastName: null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

function parseFreeTrialServices(formData: FormData, industry: string) {
  const preset = getFreeTrialIndustryPreset(industry);
  const selectedTitles = formData
    .getAll("services")
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);

  const selectedSet = new Set(selectedTitles);
  return preset.services.filter((service) => selectedSet.has(service.title));
}

function buildTrialPageContent(templateKey: string, values: Record<string, unknown> = {}): Json {
  const content = createTemplatePageContent(templateKey);
  return {
    ...content,
    sections: content.sections.map((section) => {
      if (section.type !== "flexible_hero_section") return section;
      return {
        ...section,
        data: {
          ...(section.data && typeof section.data === "object" && !Array.isArray(section.data)
            ? section.data
            : {}),
          ...values,
        },
      };
    }),
  } as unknown as Json;
}

async function withFreeTrialTimeout<T>(step: string, promise: PromiseLike<T>, timeoutMs = 10000): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => {
          reject(new Error(`Timed out during ${step}.`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function throwIfSupabaseError(step: string, error: { message?: string } | null | undefined) {
  if (error) throw new Error(`${step}: ${error.message || 'Supabase request failed'}`);
}

async function getFreeTrialZipLocation(
  supabase: ReturnType<typeof createAdminClient>,
  zip: string,
) {
  const { data, error } = await (supabase as any)
    .from("zip_locations")
    .select("zip, city, state_id, state_name, lat, lng, population, county_name, timezone, imprecise, military")
    .eq("zip", zip)
    .maybeSingle();

  throwIfSupabaseError("looking up zip code", error);
  return (data ?? null) as FreeTrialZipLocation | null;
}

function calculateHaversineMiles(latA: number, lngA: number, latB: number, lngB: number) {
  const earthRadiusMiles = 3958.8;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const deltaLat = toRadians(latB - latA);
  const deltaLng = toRadians(lngB - lngA);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(latA)) * Math.cos(toRadians(latB)) * Math.sin(deltaLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMiles * c;
}

async function getNearbyFreeTrialAreaNames(
  supabase: ReturnType<typeof createAdminClient>,
  anchorLocation: FreeTrialZipLocation,
  stateCode: string,
  maxNearbyAreaCount = FREE_TRIAL_NEARBY_AREA_COUNT,
  radiusMiles = FREE_TRIAL_AREA_RADIUS_MILES,
) {
  const primaryAreaName = anchorLocation.city;
  const latDelta = radiusMiles / 69;
  const lngDelta = radiusMiles / Math.max(69 * Math.cos((anchorLocation.lat * Math.PI) / 180), 15);
  const { data, error } = await (supabase as any)
    .from("zip_locations")
    .select("zip, city, state_id, state_name, lat, lng, population, county_name, timezone, imprecise, military")
    .gte("lat", anchorLocation.lat - latDelta)
    .lte("lat", anchorLocation.lat + latDelta)
    .gte("lng", anchorLocation.lng - lngDelta)
    .lte("lng", anchorLocation.lng + lngDelta)
    .limit(500);

  throwIfSupabaseError("finding nearby zip codes", error);

  const bestByCity = new Map<string, { name: string; distanceMiles: number; population: number }>();
  for (const row of ((data ?? []) as FreeTrialZipLocation[])) {
    if (!row.city || !row.state_id) continue;
    if (row.imprecise || row.military) continue;
    if (row.state_id !== stateCode) continue;
    const distanceMiles = calculateHaversineMiles(anchorLocation.lat, anchorLocation.lng, row.lat, row.lng);
    if (distanceMiles > radiusMiles) continue;

    const areaName = row.city;
    if (areaName === primaryAreaName) continue;

    const key = row.city.toLowerCase();
    const population = Math.max(0, row.population ?? 0);
    const existing = bestByCity.get(key);
    if (!existing) {
      bestByCity.set(key, { name: areaName, distanceMiles, population });
      continue;
    }

    if (
      distanceMiles < existing.distanceMiles ||
      (Math.abs(distanceMiles - existing.distanceMiles) < 0.25 && population > existing.population)
    ) {
      bestByCity.set(key, { name: areaName, distanceMiles, population });
    }
  }

  const nearbyAreaNames = Array.from(bestByCity.values())
    .sort((left, right) => {
      if (left.distanceMiles !== right.distanceMiles) return left.distanceMiles - right.distanceMiles;
      if (left.population !== right.population) return right.population - left.population;
      return left.name.localeCompare(right.name);
    })
    .slice(0, Math.max(0, maxNearbyAreaCount))
    .map((entry) => entry.name);

  return [primaryAreaName, ...nearbyAreaNames];
}

async function createFreeTrialPageRows(
  supabase: ReturnType<typeof createAdminClient>,
  businessId: string,
  businessName: string,
) {
  const pages: TablesInsert<"pages">[] = [
    {
      business_id: businessId,
      title: "Home",
      slug: "home",
      show_in_nav: true,
      sort_order: 0,
      content: buildTrialPageContent("home-page-v1", {
        heading: "{{primary_service}} in {{primary_area}}, {{state_code}}",
        lede: "Reliable local service with clear communication, easy scheduling, and professional follow-through.",
      }),
      meta_title: `${businessName} | Home`,
      meta_description: null,
    },
    {
      business_id: businessId,
      title: "About",
      slug: "about",
      show_in_nav: true,
      sort_order: 1,
      content: buildTrialPageContent("about-page-v1", {
        heading: `About ${businessName}`,
        lede: "A local team focused on dependable service and a smooth customer experience.",
      }),
      meta_title: `About | ${businessName}`,
      meta_description: null,
    },
    {
      business_id: businessId,
      title: "Contact",
      slug: "contact",
      show_in_nav: true,
      sort_order: 2,
      content: buildTrialPageContent("contact-page-v1", {
        heading: "Request a Quote",
        lede: "Tell us what you need and we will follow up with the next steps.",
      }),
      meta_title: `Contact | ${businessName}`,
      meta_description: null,
    },
  ];

  const { error } = await supabase.from("pages").insert(pages);
  if (error) throw new Error(error.message);
}

function buildFreeTrialTemplateTokens(input: {
  businessName: string;
  city: string;
  stateCode: string;
  primaryService: string;
  service?: string;
  area?: string;
}) {
  const { businessName, city, stateCode, primaryService, service = "", area = "" } = input;
  return {
    business: businessName,
    city,
    state: stateCode,
    state_code: stateCode,
    primary_area: city,
    primary_service: primaryService,
    service,
    area,
    location: area || city,
    url: "",
    site_url: "",
  };
}

function countWords(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function buildLongFormBlocksFromMarkdown(markdown: string) {
  return parseImportedContentToBlocks(markdown).filter((block) =>
    block.type === "heading" || block.type === "paragraph" || block.type === "list" || block.type === "quote",
  );
}

function extractOpenAIResponseText(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "";
  const record = payload as Record<string, unknown>;

  if (typeof record.output_text === "string" && record.output_text.trim()) {
    return record.output_text.trim();
  }

  const output = Array.isArray(record.output) ? record.output : [];
  const textParts: string[] = [];

  for (const item of output) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const itemRecord = item as Record<string, unknown>;
    const content = Array.isArray(itemRecord.content) ? itemRecord.content : [];

    for (const contentItem of content) {
      if (!contentItem || typeof contentItem !== "object" || Array.isArray(contentItem)) continue;
      const contentRecord = contentItem as Record<string, unknown>;
      const directText =
        typeof contentRecord.text === "string"
          ? contentRecord.text
          : typeof contentRecord.output_text === "string"
            ? contentRecord.output_text
            : "";
      if (directText.trim()) {
        textParts.push(directText.trim());
      }
    }
  }

  return textParts.join("\n\n").trim();
}

function setLongFormBodyBlocks(content: ReturnType<typeof createTemplatePageContent>, markdown: string) {
  const blocks = buildLongFormBlocksFromMarkdown(markdown);
  if (blocks.length === 0) {
    throw new Error("Generated body content did not include any supported content blocks.");
  }

  return sanitizeTemplatePageContent({
    ...content,
    sections: content.sections.map((section) => {
      if (section.slotId !== "content" || section.type !== "long_form_body_section") return section;
      return {
        ...section,
        data: {
          blocks,
        },
      };
    }),
  });
}

async function mapWithConcurrencyLimit<TItem, TResult>(
  items: TItem[],
  limit: number,
  worker: (item: TItem, index: number) => Promise<TResult>,
) {
  if (items.length === 0) return [] as TResult[];

  const results = new Array<TResult>(items.length);
  let cursor = 0;

  async function runWorker() {
    while (true) {
      const currentIndex = cursor;
      cursor += 1;
      if (currentIndex >= items.length) return;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  return results;
}

async function generateFreeTrialBodyContent(params: {
  pageType: "service" | "area";
  businessName: string;
  city: string;
  stateCode: string;
  primaryService: string;
  serviceName?: string;
  areaName?: string;
  sourceSummary?: string;
}) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured for free trial content generation.");
  }

  const {
    pageType,
    businessName,
    city,
    stateCode,
    primaryService,
    serviceName = "",
    areaName = "",
    sourceSummary = "",
  } = params;

  const prompt =
    pageType === "service"
      ? [
          `Write about ${FREE_TRIAL_BODY_WORD_TARGET} words of website body content for a service page.`,
          `Business: ${businessName}`,
          `Primary market: ${city}, ${stateCode}`,
          `Service: ${serviceName}`,
          sourceSummary ? `Starter notes: ${sourceSummary}` : "",
          "Requirements:",
          "- Return markdown only.",
          "- Do not include an H1 title.",
          "- Use 4 to 6 H2 or H3 subheadings.",
          "- Write clear local-service copy for homeowners or property owners.",
          "- Explain what the service is, common problems, what customers can expect, and why the process is helpful.",
          "- Keep claims grounded. Do not invent awards, years in business, certifications, pricing, neighborhoods, or testimonials.",
          "- End with a short call-to-action paragraph.",
        ].filter(Boolean).join("\n")
      : [
          `Write about ${FREE_TRIAL_BODY_WORD_TARGET} words of website body content for an area page.`,
          `Business: ${businessName}`,
          `Primary market: ${city}, ${stateCode}`,
          `Area page target: ${areaName}`,
          `Primary service: ${primaryService}`,
          "Requirements:",
          "- Return markdown only.",
          "- Do not include an H1 title.",
          "- Use 4 to 6 H2 or H3 subheadings.",
          "- Focus on offering this service in the target area and nearby properties.",
          "- Mention practical local-service concerns like scheduling, communication, project planning, and follow-through.",
          "- Keep claims grounded. Do not invent awards, years in business, certifications, pricing, neighborhoods, landmarks, or testimonials.",
          "- End with a short call-to-action paragraph.",
        ].join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: FREE_TRIAL_AI_MODEL,
      reasoning: { effort: "low" },
      instructions:
        "You write clean local-service website copy. Follow the requested format exactly and keep the tone professional, natural, and conversion-focused without sounding spammy.",
      input: prompt,
      max_output_tokens: 2200,
      text: {
        format: {
          type: "text",
        },
      },
    }),
  });

  const payload = (await response.json()) as {
    error?: { message?: string };
    output_text?: string;
    output?: unknown[];
  };

  if (!response.ok) {
    throw new Error(payload.error?.message || `OpenAI request failed with status ${response.status}.`);
  }

  const outputText = extractOpenAIResponseText(payload);
  if (!outputText) {
    throw new Error("OpenAI returned empty body content.");
  }

  if (countWords(outputText) < 500) {
    throw new Error("OpenAI returned body content that was too short for the trial page.");
  }

  return outputText;
}

async function createFreeTrialServiceRows(
  supabase: ReturnType<typeof createAdminClient>,
  businessId: string,
  businessName: string,
  city: string,
  stateCode: string,
  services: FreeTrialServicePreset[],
  featuredImageUrlsBySlug: Map<string, string>,
) {
  const primaryService = services[0]?.title?.trim() || "";
  const rows = await mapWithConcurrencyLimit(services, 3, async (service, index) => {
    const tokens = buildFreeTrialTemplateTokens({
      businessName,
      city,
      stateCode,
      primaryService,
      service: service.title,
    });
    const serviceH1 = interpolateTemplateString(DEFAULT_SERVICE_H1_TEMPLATE, tokens).trim() || service.title;
    const serviceMetaTitle =
      interpolateTemplateString(DEFAULT_SERVICE_META_TITLE_TEMPLATE, tokens).trim() || `${service.title} | ${businessName}`;
    const serviceMetaDescription =
      interpolateTemplateString(DEFAULT_SERVICE_META_DESCRIPTION_TEMPLATE, tokens).trim() || null;
    const serviceSlug =
      normalizeSlugInput(interpolateTemplateString(DEFAULT_SERVICE_URL_TEMPLATE, tokens)) || service.slug;
    const generatedBodyMarkdown = await generateFreeTrialBodyContent({
      pageType: "service",
      businessName,
      city,
      stateCode,
      primaryService,
      serviceName: service.title,
      sourceSummary: [service.lede, service.body].filter(Boolean).join(" "),
    });
    const content = createTemplatePageContent("service-content-v1");
    const nextContent = setLongFormBodyBlocks({
      ...content,
      sections: content.sections.map((section) => {
        if (section.type === "flexible_hero_section") {
          return {
            ...section,
            data: {
              ...(section.data && typeof section.data === "object" && !Array.isArray(section.data) ? section.data : {}),
              heading: serviceH1,
              lede: service.lede,
            },
          };
        }

        return section;
      }),
    }, generatedBodyMarkdown);

    return {
      business_id: businessId,
      title: service.title,
      slug: serviceSlug,
      excerpt: `${businessName} provides professional ${service.title.toLowerCase()} with responsive communication and dependable project support.`,
      featured_image_url: featuredImageUrlsBySlug.get(service.slug) ?? null,
      content: nextContent as unknown as Json,
      sort_order: index,
      parent_service_id: null,
      is_active: true,
      is_primary: index === 0,
      before_after_groups: [] as Json,
      service_projects: [] as Json,
      meta_title: serviceMetaTitle,
      meta_description: serviceMetaDescription,
    } satisfies TablesInsert<"services">;
  });

  const { data, error } = await supabase.from("services").insert(rows).select("id");
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function uploadFreeTrialAsset(options: {
  supabase: ReturnType<typeof createAdminClient>;
  businessId: string;
  folder: string;
  file: File;
}) {
  const { supabase, businessId, folder, file } = options;
  if (!(file instanceof File) || file.size <= 0 || !file.name.trim()) return null;
  if (!file.type.startsWith("image/")) {
    throw new Error(`"${file.name}" must be an image.`);
  }

  const bucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "media";
  const normalizedName = file.name.trim().replace(/[^a-zA-Z0-9._-]/g, "-");
  const safeName = normalizedName || "upload";
  const objectPath = `${businessId}/${folder}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage.from(bucket).upload(objectPath, fileBuffer, {
    upsert: false,
    contentType: file.type || "application/octet-stream",
    cacheControl: "31536000",
  });
  if (uploadError) throw new Error(uploadError.message);

  return {
    fileUrl: supabase.storage.from(bucket).getPublicUrl(objectPath).data.publicUrl,
    objectPath,
  };
}

async function insertFreeTrialMediaRow(options: {
  supabase: ReturnType<typeof createAdminClient>;
  businessId: string;
  file: File;
  fileUrl: string;
  objectPath: string;
  role: "logo" | "card";
  relatedEntityType?: "service";
  relatedEntityId?: string;
}) {
  const { supabase, businessId, file, fileUrl, objectPath, role, relatedEntityType, relatedEntityId } = options;
  const pathSegments = objectPath.split("/");
  pathSegments.pop();
  const storagePrefix = pathSegments.join("/");
  const metadata: Record<string, Json | undefined> = {
    version: 1,
    kind: "raw-file",
    role,
    storage_object_path: objectPath,
  };

  if (relatedEntityType && relatedEntityId) {
    metadata.related_entity_type = relatedEntityType;
    metadata.related_entity_id = relatedEntityId;
  }

  const { error } = await supabase.from("media").insert({
    business_id: businessId,
    file_name: file.name,
    file_type: file.type || "application/octet-stream",
    file_size: file.size,
    file_url: fileUrl,
    uploaded_by: null,
    alt_text: null,
    width: null,
    height: null,
    folder: storagePrefix,
    original_file_url: fileUrl,
    blur_data_url: null,
    storage_prefix: storagePrefix,
    variants: null,
    metadata: metadata as Json,
  } satisfies TablesInsert<"media">);
  if (error) throw new Error(error.message);
}

async function createFreeTrialAreaRows(
  supabase: ReturnType<typeof createAdminClient>,
  businessId: string,
  businessName: string,
  city: string,
  stateCode: string,
  primaryService: string,
  areaNames: string[],
) {
  const uniqueAreaNames = Array.from(new Set(areaNames.filter(Boolean)));
  const rows = await mapWithConcurrencyLimit(uniqueAreaNames, 3, async (areaName) => {
    const tokens = buildFreeTrialTemplateTokens({
      businessName,
      city,
      stateCode,
      primaryService,
      area: areaName,
    });
    const areaH1 =
      interpolateTemplateString(DEFAULT_AREA_H1_TEMPLATE, tokens).trim() || `${businessName} in ${areaName}`;
    const areaMetaTitle =
      interpolateTemplateString(DEFAULT_AREA_META_TITLE_TEMPLATE, tokens).trim() || `${areaName} Services | ${businessName}`;
    const areaMetaDescription =
      interpolateTemplateString(DEFAULT_AREA_META_DESCRIPTION_TEMPLATE, tokens).trim() || null;
    const areaSlug =
      normalizeSlugInput(interpolateTemplateString(DEFAULT_AREA_URL_TEMPLATE, tokens)) || normalizeSlugInput(areaName);
    const generatedBodyMarkdown = await generateFreeTrialBodyContent({
      pageType: "area",
      businessName,
      city,
      stateCode,
      primaryService,
      areaName,
    });
    const content = setLongFormBodyBlocks(
      createTemplatePageContent("area-content-v1"),
      generatedBodyMarkdown,
    );

    return {
      business_id: businessId,
      name: areaName,
      slug: areaSlug,
      content: sanitizeTemplatePageContent({
        ...content,
        sections: content.sections.map((section) => {
          if (section.type !== "flexible_hero_section") return section;
          return {
            ...section,
            data: {
              ...(section.data && typeof section.data === "object" && !Array.isArray(section.data) ? section.data : {}),
              heading: areaH1,
              lede: `Local service from ${businessName} for homeowners in ${areaName} and nearby communities.`,
            },
          };
        }),
      }) as unknown as Json,
      is_active: true,
      meta_title: areaMetaTitle,
      meta_description: areaMetaDescription,
    } satisfies TablesInsert<"areas">;
  });

  const { data, error } = await supabase.from("areas").insert(rows).select("id");
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function linkFreeTrialAreasToServices(
  supabase: ReturnType<typeof createAdminClient>,
  areaRows: Array<{ id: string }>,
  serviceRows: Array<{ id: string }>,
) {
  const rows = areaRows.flatMap((area) =>
    serviceRows.map((service) => ({
      area_id: area.id,
      service_id: service.id,
      is_active: true,
      custom_content: null,
    })),
  );
  if (rows.length === 0) return;

  const { error } = await (supabase as any).from("area_services").insert(rows);
  if (error) throw new Error(error.message);
}

export async function createFreeTrialTenantAction(
  _previousState: TrialProvisioningState,
  formData: FormData,
): Promise<TrialProvisioningState> {
  try {
    const startedAt = Date.now();
    const logStep = (step: string) => {
      console.log(`[free-trial] ${step} (${Date.now() - startedAt}ms)`);
    };
    const supabase = createAdminClient();
    logStep("started");
    const businessName = ((formData.get("business_name") as string) || "").trim();
    const ownerFirstNameInput = ((formData.get("owner_first_name") as string) || "").trim();
    const ownerLastNameInput = ((formData.get("owner_last_name") as string) || "").trim();
    const ownerName = ((formData.get("owner_name") as string) || "").trim();
    const ownerEmail = ((formData.get("email") as string) || "").trim().toLowerCase();
    const password = ((formData.get("password") as string) || "");
    const confirmPassword = ((formData.get("confirm_password") as string) || "");
    const phone = ((formData.get("phone") as string) || "").trim() || null;
    const selectedState = ((formData.get("state") as string) || "").trim().toUpperCase();
    const zip = normalizeFreeTrialZipCode((formData.get("zip") as string) || "");
    const industry = normalizeFreeTrialIndustry((formData.get("industry") as string) || "");
    const requestedServices = parseFreeTrialServices(formData, industry);
    const slugBase = normalizeSlugInput((formData.get("slug") as string) || businessName);

    if (!businessName) throw new Error("Business name is required.");
    if (!ownerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
      throw new Error("A valid email is required.");
    }
    if (!phone) {
      throw new Error("Business phone is required.");
    }
    if (!isAllowedStateCode(selectedState)) {
      throw new Error("Select a valid state.");
    }
    if (!zip) {
      throw new Error("A valid 5-digit ZIP code is required.");
    }
    if (requestedServices.length === 0) {
      throw new Error("At least one service is required.");
    }
    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }
    if (password !== confirmPassword) {
      throw new Error("Passwords do not match.");
    }
    if (!ownerFirstNameInput) {
      throw new Error("First name is required.");
    }
    if (!ownerLastNameInput) {
      throw new Error("Last name is required.");
    }
    if (!slugBase) throw new Error("Unable to create a site slug from that business name.");

    const zipLocation = await withFreeTrialTimeout("looking up primary zip", getFreeTrialZipLocation(supabase, zip));
    if (!zipLocation) {
      throw new Error("That ZIP code was not found in the service area dataset.");
    }
    if (zipLocation.imprecise) {
      throw new Error("Please use a standard 5-digit ZIP code for the primary market.");
    }
    if (zipLocation.military) {
      throw new Error("Please use a standard residential or business ZIP code for the primary market.");
    }
    if (!isAllowedStateCode(zipLocation.state_id)) {
      throw new Error("That ZIP code is outside the supported US states for this starter flow.");
    }
    if (zipLocation.state_id !== selectedState) {
      throw new Error(`That ZIP code is in ${zipLocation.state_id}. Please select the matching state.`);
    }

    const city = zipLocation.city;
    const normalizedState = selectedState;
    const timezone = normalizeBusinessTimezone(zipLocation.timezone || "America/New_York");
    const areaNames = await withFreeTrialTimeout(
      "finding nearby service areas",
      getNearbyFreeTrialAreaNames(supabase, zipLocation, normalizedState),
    );
    logStep("zip resolved");

    let slug = "";
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const candidate = `${slugBase}-${generateFreeTrialSlugSuffix()}`;
      const candidateDomain = `${candidate}.${FREE_TRIAL_ROOT_DOMAIN}`;
      const [{ data: existingSlug, error: existingSlugError }, { data: existingDomain, error: existingDomainError }] =
        await withFreeTrialTimeout("checking slug availability", Promise.all([
          supabase.from("businesses").select("id").eq("slug", candidate).limit(1).maybeSingle(),
          supabase.from("business_domains").select("id").eq("domain", candidateDomain).limit(1).maybeSingle(),
        ]));
      throwIfSupabaseError("checking business slug", existingSlugError);
      throwIfSupabaseError("checking business domain", existingDomainError);
      if (!existingSlug && !existingDomain) {
        slug = candidate;
        break;
      }
    }
    if (!slug) throw new Error("Unable to generate a unique trial site URL.");

    const trialDomain = `${slug}.${FREE_TRIAL_ROOT_DOMAIN}`;
    const themeKey = buildClientThemeKey(slug);
    if (!themeKey) throw new Error("Unable to create a theme key for this trial.");
    const starterThemeCss = await getFrontendThemeEditorBaseSource();
    const uploadedLogo = formData.get("logo_file");
    const logoFile = uploadedLogo instanceof File && uploadedLogo.size > 0 ? uploadedLogo : null;

    const { data: business, error: businessError } = await withFreeTrialTimeout("creating business", supabase
      .from("businesses")
      .insert({
        name: businessName,
        slug,
        timezone,
        domain: trialDomain,
        phone,
        email: ownerEmail,
        city,
        state: normalizedState,
        logo_url: null,
        zip,
        theme_key: themeKey,
        theme_css: starterThemeCss,
        settings: {
          trial: true,
          trial_source: "marketing_free_trial",
          trial_started_at: new Date().toISOString(),
          onboarding_industry: industry,
          service_default_title_template: DEFAULT_SERVICE_META_TITLE_TEMPLATE,
          service_default_meta_description_template: DEFAULT_SERVICE_META_DESCRIPTION_TEMPLATE,
          service_default_h1_template: DEFAULT_SERVICE_H1_TEMPLATE,
          service_default_url_template: DEFAULT_SERVICE_URL_TEMPLATE,
          area_default_title_template: DEFAULT_AREA_META_TITLE_TEMPLATE,
          area_default_meta_description_template: DEFAULT_AREA_META_DESCRIPTION_TEMPLATE,
          area_default_h1_template: DEFAULT_AREA_H1_TEMPLATE,
          area_default_url_template: DEFAULT_AREA_URL_TEMPLATE,
          primary_zip: zipLocation.zip,
          primary_city: zipLocation.city,
          primary_state: normalizedState,
          primary_county: zipLocation.county_name,
          primary_market_timezone: zipLocation.timezone,
          primary_market_population: zipLocation.population,
          primary_market_coordinates: {
            lat: zipLocation.lat,
            lng: zipLocation.lng,
          },
          generated_area_names: areaNames,
        } as Json,
      })
      .select("id")
      .single());
    throwIfSupabaseError("creating business", businessError);
    if (!business?.id) throw new Error("creating business: no business id returned");
    logStep("business created");

    const { error: domainError } = await withFreeTrialTimeout("creating trial domain", supabase.from("business_domains").insert({
      business_id: business.id,
      domain: trialDomain,
      canonical_domain: trialDomain,
      is_primary: true,
      is_active: true,
    }));
    throwIfSupabaseError("creating trial domain", domainError);
    logStep("domain created");

    const uploadedLogoAsset =
      logoFile
        ? await withFreeTrialTimeout(
            "uploading business logo",
            uploadFreeTrialAsset({
              supabase,
              businessId: business.id,
              folder: "branding",
              file: logoFile,
            }),
          )
        : null;
    if (uploadedLogoAsset?.fileUrl && logoFile) {
      const { error: logoUpdateError } = await supabase
        .from("businesses")
        .update({ logo_url: uploadedLogoAsset.fileUrl } satisfies TablesUpdate<"businesses">)
        .eq("id", business.id);
      if (logoUpdateError) throw new Error(logoUpdateError.message);
      await insertFreeTrialMediaRow({
        supabase,
        businessId: business.id,
        file: logoFile,
        fileUrl: uploadedLogoAsset.fileUrl,
        objectPath: uploadedLogoAsset.objectPath,
        role: "logo",
      });
      logStep("logo uploaded");
    } else {
      logStep("logo skipped");
    }

    await withFreeTrialTimeout("creating trial pages", createFreeTrialPageRows(supabase, business.id, businessName));
    logStep("pages created");
    const featuredImageUrlsBySlug = new Map<string, string>(
      requestedServices
        .map((service) => [service.slug, service.featuredImageUrl?.trim() ?? ''] as const)
        .filter((entry): entry is readonly [string, string] => Boolean(entry[1])),
    );
    for (const service of requestedServices) {
      const uploadedServiceImage = formData.get(`service_image__${service.slug}`);
      if (!(uploadedServiceImage instanceof File) || uploadedServiceImage.size <= 0) continue;
      const uploadedServiceAsset = await withFreeTrialTimeout(
        `uploading ${service.title.toLowerCase()} image`,
        uploadFreeTrialAsset({
          supabase,
          businessId: business.id,
          folder: "services",
          file: uploadedServiceImage,
        }),
      );
      if (uploadedServiceAsset?.fileUrl) {
        featuredImageUrlsBySlug.set(service.slug, uploadedServiceAsset.fileUrl);
        await insertFreeTrialMediaRow({
          supabase,
          businessId: business.id,
          file: uploadedServiceImage,
          fileUrl: uploadedServiceAsset.fileUrl,
          objectPath: uploadedServiceAsset.objectPath,
          role: "card",
        });
      }
    }
    logStep("service images handled");
    const serviceRows = await withFreeTrialTimeout(
      "creating trial services",
      createFreeTrialServiceRows(
        supabase,
        business.id,
        businessName,
        city,
        normalizedState,
        requestedServices,
        featuredImageUrlsBySlug,
      ),
      FREE_TRIAL_AI_TIMEOUT_MS,
    );
    logStep("services created");
    const areaRows = await withFreeTrialTimeout(
      "creating trial areas",
      createFreeTrialAreaRows(
        supabase,
        business.id,
        businessName,
        city,
        normalizedState,
        requestedServices[0]?.title ?? "",
        areaNames,
      ),
      FREE_TRIAL_AI_TIMEOUT_MS,
    );
    logStep("areas created");
    if (process.env.FREE_TRIAL_LINK_AREAS_TO_SERVICES === "1") {
      await linkFreeTrialAreasToServices(supabase, areaRows, serviceRows);
      logStep("area-service links created");
    } else {
      logStep("area-service links skipped");
    }

    if (process.env.FREE_TRIAL_GRANT_PLATFORM_ADMINS === "1") {
      await grantPlatformAdminAccessToBusiness(supabase, business.id);
      logStep("platform access granted");
    } else {
      logStep("platform access skipped");
    }

    let invitedUserId: string | null = null;
    let inviteEmailSent = false;
    const existingAuthUsers = await listAuthUsersByEmail(supabase);
    logStep("auth users listed");
    const existingAuthUser = existingAuthUsers.get(ownerEmail) ?? null;
    if (existingAuthUser) {
      throw new Error("An account with this email already exists. Please sign in instead.");
    }

    const splitOwnerName = splitFreeTrialName(ownerName);
    const firstName = ownerFirstNameInput || splitOwnerName.firstName;
    const lastName = ownerLastNameInput || splitOwnerName.lastName;
    const { data: createdAuthUser, error: createdAuthUserError } = await supabase.auth.admin.createUser({
      email: ownerEmail,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        business_name: businessName,
        source: "free_trial",
      },
    });
    if (createdAuthUserError) throw new Error(createdAuthUserError.message);

    invitedUserId = createdAuthUser.user?.id ?? null;
    if (!invitedUserId) throw new Error("Owner account was created but no user id was returned.");
    logStep("owner auth account created");

    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        id: invitedUserId,
        business_id: business.id,
        first_name: firstName,
        last_name: lastName,
        phone,
        role: "admin",
        is_active: true,
      },
      { onConflict: "id" },
    );
    if (profileError) throw new Error(profileError.message);

    const { error: accessError } = await supabase.from("user_business_access").upsert(
      {
        user_id: invitedUserId,
        business_id: business.id,
        role: "admin",
        is_active: true,
      },
      { onConflict: "user_id,business_id" },
    );
    if (accessError) throw new Error(accessError.message);
    logStep("owner dashboard access created");

    supabase.from("activity_log").insert({
      business_id: business.id,
      user_id: invitedUserId,
      action: "free_trial_created",
      entity_type: "business",
      entity_id: business.id,
        metadata: {
          domain: trialDomain,
          industry,
          services: requestedServices.map((service) => service.title),
        } as Json,
    }).then(({ error }) => {
      if (error) console.error("[free-trial] activity log failed", error.message);
    });
    logStep("activity log queued");

    revalidateTag("public-business-brand-assets", "max");
    revalidateTag("public-business-by-id", "max");
    revalidateTag("public-business-by-slug", "max");
    revalidateTag("public-business-by-domain", "max");
    revalidateTag("public-default-business", "max");
    revalidatePath("/theme.css");
    logStep("public caches revalidated");

    const previewUrl = `https://${trialDomain}`;
    logStep("completed");
    return {
      error: null,
      success: "Your trial site is ready.",
      businessName,
      previewUrl,
      dashboardUrl: `${previewUrl}/login`,
      slug,
      inviteEmailSent,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to create the trial site.",
      success: null,
    };
  }
}


type BulkImportTargetTable = "blog_posts" | "pages" | "services" | "areas" | "testimonials";
type ImportedXmlRecord = {
  title: string;
  mainContent: string;
  slug: string;
  excerpt: string;
  metaTitle: string;
  metaDescription: string;
  status: "draft" | "published";
  sortOrder: number | null;
  parentServiceSlug: string;
  customerName?: string;
  rating?: number | null;
  source?: TablesInsert<"testimonials">["source"] | null;
  sourceUrl?: string;
  avatarUrl?: string;
  reviewDate?: string;
  isFeatured?: boolean | null;
  isActive?: boolean | null;
  serviceSlug?: string;
  areaSlug?: string;
};

export async function bulkImportContentAction(formData: FormData) {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const admin = createAdminClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const table = ((formData.get("table") as string) || "").trim() as BulkImportTargetTable;
  const recordId = ((formData.get("record_id") as string) || "").trim();
  const mode = (((formData.get("mode") as string) || "replace").trim() || "replace") as
    | "create"
    | "replace";
  const xmlFile = formData.get("xml_file");

  if (!["blog_posts", "pages", "services", "areas", "testimonials"].includes(table)) {
    throw new Error("Unsupported content type");
  }
  if (mode === "replace" && !recordId) throw new Error("Select a destination record");
  if (!(xmlFile instanceof File)) throw new Error("Upload an XML file to import");

  const importedRecords = await parseImportedXmlFile(xmlFile, table);

  if (mode === "replace") {
    if (importedRecords.length !== 1) {
      throw new Error("Replace mode requires an XML file with exactly one record.");
    }
    if (table === "testimonials") {
      const [record] = importedRecords;
      const { data: existing, error: fetchError } = await supabase
        .from("testimonials")
        .select("id")
        .eq("id", recordId)
        .eq("business_id", businessId)
        .maybeSingle();
      if (fetchError) throw new Error(fetchError.message);
      if (!existing) throw new Error("Selected record was not found");

      const updatePayload = await buildImportedTestimonialPayload({
        supabase,
        businessId,
        record,
      });

      const { error: updateError } = await supabase
        .from("testimonials")
        .update(updatePayload)
        .eq("id", recordId)
        .eq("business_id", businessId);
      if (updateError) throw new Error(updateError.message);

      await revalidateImportedTablePaths(table, recordId, null, businessId);

      return {
        success: true,
        importedBlocks: 0,
        mode,
        table,
        recordId,
      };
    }

    const [{ title, mainContent }] = importedRecords;
    const importedBlocks = parseImportedContentToBlocks(mainContent);
    if (importedBlocks.length === 0) {
      throw new Error("No content detected. Paste headings, paragraphs, lists, or quotes.");
    }

    const { data: existing, error: fetchError } = await supabase
      .from(table)
      .select("id, slug, content")
      .eq("id", recordId)
      .eq("business_id", businessId)
      .maybeSingle();
    if (fetchError) throw new Error(fetchError.message);
    if (!existing) throw new Error("Selected record was not found");

    const templateImportConfig = getTemplateImportConfigForTable(table, existing);
    const nextContent = templateImportConfig
      ? buildTemplateContentFromImportedBlocks({
          existingContent: existing.content,
          importedBlocks,
          mode: "replace",
          templateKey: templateImportConfig.templateKey,
          fallbackHeading: title || templateImportConfig.fallbackHeading,
        })
      : (importedBlocks as unknown as Json);

    const updatePayload =
      table === "areas"
        ? ({ name: title, content: nextContent } as TablesUpdate<"areas">)
        : ({ title, content: nextContent } as TablesUpdate<"blog_posts"> & TablesUpdate<"pages"> & TablesUpdate<"services">);

    const { error: updateError } = await supabase
      .from(table)
      .update(updatePayload as never)
      .eq("id", recordId)
      .eq("business_id", businessId);
    if (updateError) throw new Error(updateError.message);

    await revalidateImportedTablePaths(table, recordId, existing.slug ?? null, businessId);

    return {
      success: true,
      importedBlocks: importedBlocks.length,
      mode,
      table,
      recordId,
    };
  }

  const usedSlugs = new Set<string>();
  let templateImportConfig: ReturnType<typeof getTemplateImportConfigForTable> = null;

  if (table !== "testimonials") {
    const { data: slugRows, error: slugError } = await supabase
      .from(table)
      .select("slug")
      .eq("business_id", businessId);
    if (slugError) throw new Error(slugError.message);
    for (const row of slugRows ?? []) {
      const slug = typeof row.slug === "string" ? row.slug.trim() : "";
      if (slug) usedSlugs.add(slug);
    }
    templateImportConfig = getTemplateImportConfigForTable(table, null);
  }
  const createdIds: string[] = [];
  let importedBlockCount = 0;
  const createdServicesBySlug = new Map<string, string>();

  for (const record of importedRecords) {
    if (table === "testimonials") {
      const payload = await buildImportedTestimonialPayload({
        supabase,
        businessId,
        record,
      });
      const { data, error } = await supabase.from("testimonials").insert(payload).select("id").single();
      if (error) throw new Error(error.message);
      createdIds.push(data.id);
      await revalidateImportedTablePaths(table, data.id, null, businessId);
      continue;
    }

    const importedBlocks = parseImportedContentToBlocks(record.mainContent);
    if (importedBlocks.length === 0) {
      throw new Error(`No content detected for "${record.title}". Paste headings, paragraphs, lists, or quotes.`);
    }

    importedBlockCount += importedBlocks.length;
    const requestedSlug = slugify(record.slug || record.title);
    const slug = findUniqueSlug(requestedSlug || record.title, usedSlugs);
    const nextContent = templateImportConfig
      ? buildTemplateContentFromImportedBlocks({
          existingContent: null,
          importedBlocks,
          mode: "replace",
          templateKey: templateImportConfig.templateKey,
          fallbackHeading: record.title || templateImportConfig.fallbackHeading,
        })
      : (importedBlocks as unknown as Json);

    if (table === "blog_posts") {
      const payload: TablesInsert<"blog_posts"> = {
        business_id: businessId,
        title: record.title,
        slug,
        excerpt: record.excerpt || null,
        content: nextContent,
        meta_title: record.metaTitle || null,
        meta_description: record.metaDescription || null,
        read_time_minutes: null,
        status: "draft",
      };
      const { data, error } = await supabase.from("blog_posts").insert(payload).select("id, slug").single();
      if (error) throw new Error(error.message);
      createdIds.push(data.id);
      await revalidateImportedTablePaths(table, data.id, data.slug, businessId);
      continue;
    }

    if (table === "pages") {
      const payload: TablesInsert<"pages"> = {
        business_id: businessId,
        title: record.title,
        slug,
        content: nextContent,
        show_in_nav: false,
        is_active: true,
        sort_order: record.sortOrder ?? 0,
        meta_title: record.metaTitle || null,
        meta_description: record.metaDescription || null,
      };
      const { data, error } = await supabase.from("pages").insert(payload).select("id, slug").single();
      if (error) throw new Error(error.message);
      createdIds.push(data.id);
      await revalidateImportedTablePaths(table, data.id, data.slug, businessId);
      continue;
    }

    if (table === "services") {
      const payload: TablesInsert<"services"> = {
        business_id: businessId,
        title: record.title,
        slug,
        excerpt: record.excerpt || null,
        content: nextContent,
        is_active: true,
        is_primary: false,
        sort_order: record.sortOrder ?? 0,
        meta_title: record.metaTitle || null,
        meta_description: record.metaDescription || null,
        parent_service_id: null,
      };
      const { data, error } = await supabase.from("services").insert(payload).select("id, slug").single();
      if (error) throw new Error(error.message);
      createdIds.push(data.id);
      createdServicesBySlug.set(data.slug, data.id);
      await revalidateImportedTablePaths(table, data.id, data.slug, businessId);
      continue;
    }

    const payload: TablesInsert<"areas"> = {
      business_id: businessId,
      name: record.title,
      slug,
      content: nextContent,
      is_active: true,
      meta_title: record.metaTitle || null,
      meta_description: record.metaDescription || null,
    };
    const { data, error } = await supabase.from("areas").insert(payload).select("id, slug").single();
    if (error) throw new Error(error.message);
    createdIds.push(data.id);
    await revalidateImportedTablePaths(table, data.id, data.slug, businessId);
  }

  if (table === "services") {
    const recordsWithParents = importedRecords
      .map((record) => ({
        ...record,
        resolvedSlug: slugify(record.slug || record.title),
        resolvedParentSlug: slugify(record.parentServiceSlug),
      }))
      .filter((record) => record.resolvedParentSlug);

    if (recordsWithParents.length > 0) {
      const parentSlugSet = new Set(recordsWithParents.map((record) => record.resolvedParentSlug));
      const existingParentIdsBySlug = new Map<string, string>();
      const missingParentSlugs = Array.from(parentSlugSet).filter((slug) => !createdServicesBySlug.has(slug));

      if (missingParentSlugs.length > 0) {
        const { data: parentRows, error: parentError } = await supabase
          .from("services")
          .select("id, slug")
          .eq("business_id", businessId)
          .in("slug", missingParentSlugs);
        if (parentError) throw new Error(parentError.message);
        for (const row of parentRows ?? []) {
          if (row.slug) existingParentIdsBySlug.set(row.slug, row.id);
        }
      }

      for (const record of recordsWithParents) {
        const childId = createdServicesBySlug.get(record.resolvedSlug);
        if (!childId) {
          throw new Error(`Imported service "${record.title}" could not be found after creation.`);
        }

        const parentId =
          createdServicesBySlug.get(record.resolvedParentSlug) ??
          existingParentIdsBySlug.get(record.resolvedParentSlug) ??
          null;
        if (!parentId) {
          throw new Error(`Parent service slug "${record.parentServiceSlug}" was not found for "${record.title}".`);
        }
        if (parentId === childId) {
          throw new Error(`Service "${record.title}" cannot be its own parent.`);
        }

        const { error: updateParentError } = await supabase
          .from("services")
          .update({ parent_service_id: parentId })
          .eq("id", childId)
          .eq("business_id", businessId);
        if (updateParentError) throw new Error(updateParentError.message);
      }
    }
  }

  return {
    success: true,
    importedBlocks: importedBlockCount,
    importedRecords: createdIds.length,
    mode,
    table,
    recordId: createdIds[0] ?? "",
  };
}

async function revalidateImportedTablePaths(
  table: BulkImportTargetTable,
  recordId: string,
  slug: string | null,
  businessId: string,
) {
  if (table === "blog_posts") {
    revalidatePath("/dashboard/blog");
    revalidatePath(`/dashboard/blog/${recordId}`);
    revalidatePath("/blog");
    if (slug) revalidatePath(`/blog/${slug}`);
  }
  if (table === "pages") {
    revalidatePath("/dashboard/pages");
    revalidatePath(`/dashboard/pages/${recordId}`);
    if (slug) revalidatePath(`/${slug}`);
  }
  if (table === "services") {
    revalidatePath("/dashboard/services");
    revalidatePath(`/dashboard/services/${recordId}`);
    revalidatePath("/services");
    revalidatePath("/service-areas");
    await revalidateConfiguredServiceDetailPath(createAdminClient(), businessId, slug);
  }
  if (table === "areas") {
    revalidatePath("/dashboard/areas");
    revalidatePath(`/dashboard/areas/${recordId}`);
    revalidatePath("/service-areas");
    await revalidateConfiguredAreaDetailPath(createAdminClient(), businessId, slug);
  }
  if (table === "testimonials") {
    revalidatePath("/dashboard/testimonials");
    revalidatePath(`/dashboard/testimonials/${recordId}`);
    revalidatePath("/");
  }
}

function getTemplateImportConfigForTable(
  table: BulkImportTargetTable,
  existing?: { slug?: string | null; content?: unknown } | null,
) {
  if (table === "pages") {
    const existingTemplate = toTemplatePageContent(existing?.content);
    return {
      templateKey:
        existingTemplate?.templateKey ??
        getRecommendedPageTemplateKeyForSlug(existing?.slug ?? null),
      fallbackHeading: "Overview",
    } as const;
  }
  if (table === "blog_posts") {
    return { templateKey: "blog-post-content-v1", fallbackHeading: "Article" } as const;
  }
  if (table === "services") {
    return { templateKey: "service-content-v1", fallbackHeading: "Service Overview" } as const;
  }
  if (table === "areas") {
    return { templateKey: "area-content-v1", fallbackHeading: "Area Overview" } as const;
  }
  if (table === "testimonials") {
    return null;
  }
  return null;
}

function joinBodyText(a: string, b: string) {
  const left = a.trim();
  const right = b.trim();
  if (!left) return right;
  if (!right) return left;
  return `${left}\n\n${right}`;
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractXmlField(xml: string, tagNames: string[]) {
  for (const tagName of tagNames) {
    const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
    const match = xml.match(pattern);
    if (match?.[1]) {
      const value = decodeXmlEntities(match[1]).trim();
      if (value) return value;
    }
  }
  return "";
}

function parseImportedStatus(value: string | null | undefined): "draft" | "published" {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized === "publish" || normalized === "published" ? "published" : "draft";
}

async function parseImportedXmlFile(file: File, table: BulkImportTargetTable): Promise<ImportedXmlRecord[]> {
  const fileName = file.name?.trim() || "import.xml";
  if (!fileName.toLowerCase().endsWith(".xml")) {
    throw new Error("Upload an XML file");
  }

  const xml = (await file.text()).trim();
  if (!xml) throw new Error("The uploaded XML file is empty");

  if (table === "testimonials") {
    return parseImportedTestimonialsXml(xml);
  }

  let detectedTestimonialRecords: ImportedXmlRecord[] = [];
  try {
    detectedTestimonialRecords = parseImportedTestimonialsXml(xml);
  } catch {
    detectedTestimonialRecords = [];
  }

  const titleTags = ["title", "name", "headline"];
  const contentTags = ["main_content", "main-content", "content:encoded", "content", "body", "description"];
  const slugTags = ["slug", "post_name", "url_slug"];
  const excerptTags = ["excerpt", "summary", "teaser"];
  const metaTitleTags = ["meta_title", "meta-title", "seo_title", "seo-title"];
  const metaDescriptionTags = ["meta_description", "meta-description", "seo_description", "seo-description"];
  const statusTags = ["status", "post_status", "wp:status"];
  const sortOrderTags = ["sort_order", "sort-order"];
  const parentServiceSlugTags = ["parent_service_slug", "parent-service-slug"];
  const candidateRecordTags = ["item", "record", "entry", "post", "page", "service", "area"];
  const records: ImportedXmlRecord[] = [];

  for (const tagName of candidateRecordTags) {
    const pattern = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "gi");
    for (const match of xml.matchAll(pattern)) {
      const block = match[1]?.trim();
      if (!block) continue;
      const title = extractXmlField(block, titleTags);
      const mainContent = extractXmlField(block, contentTags);
      if (title && mainContent) {
        records.push({
          title,
          mainContent,
          slug: extractXmlField(block, slugTags),
          excerpt: extractXmlField(block, excerptTags),
          metaTitle: extractXmlField(block, metaTitleTags),
          metaDescription: extractXmlField(block, metaDescriptionTags),
          status: parseImportedStatus(extractXmlField(block, statusTags)),
          sortOrder: parseXmlNumberField(block, sortOrderTags),
          parentServiceSlug: extractXmlField(block, parentServiceSlugTags),
        });
      }
    }
  }

  if (records.length > 0) {
    return records;
  }

  const title = extractXmlField(xml, titleTags);
  const mainContent = extractXmlField(xml, contentTags);

  if (!title && !mainContent && detectedTestimonialRecords.length > 0) {
    throw new Error('This XML was recognized as testimonial data. Select "Testimonials" as the content type and try again.');
  }
  if (!title) throw new Error("Could not find a title field in the XML file");
  if (!mainContent) throw new Error("Could not find a main content field in the XML file");

  return [
    {
      title,
      mainContent,
      slug: extractXmlField(xml, slugTags),
      excerpt: extractXmlField(xml, excerptTags),
      metaTitle: extractXmlField(xml, metaTitleTags),
      metaDescription: extractXmlField(xml, metaDescriptionTags),
      status: parseImportedStatus(extractXmlField(xml, statusTags)),
      sortOrder: parseXmlNumberField(xml, sortOrderTags),
      parentServiceSlug: extractXmlField(xml, parentServiceSlugTags),
    },
  ];
}

function parseXmlNumberField(xml: string, tagNames: string[]) {
  const raw = extractXmlField(xml, tagNames);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : null;
}

function parseImportedTestimonialsXml(xml: string) {
  const customerNameTags = ["customer_name", "customer-name", "name", "author", "title"];
  const contentTags = ["content", "review", "testimonial", "body", "description", "main_content", "main-content"];
  const ratingTags = ["rating", "stars", "star_rating", "star-rating", "score"];
  const sourceTags = ["source", "platform"];
  const sourceUrlTags = ["source_url", "source-url", "review_url", "review-url", "url"];
  const avatarUrlTags = ["avatar_url", "avatar-url", "photo_url", "photo-url", "image_url", "image-url"];
  const reviewDateTags = ["review_date", "review-date", "date", "published_at", "published-at"];
  const isFeaturedTags = ["is_featured", "is-featured", "featured"];
  const isActiveTags = ["is_active", "is-active", "active"];
  const serviceSlugTags = ["service_slug", "service-slug"];
  const areaSlugTags = ["area_slug", "area-slug"];
  const candidateRecordTags = ["item", "record", "entry", "review", "testimonial"];
  const records: ImportedXmlRecord[] = [];

  for (const tagName of candidateRecordTags) {
    const pattern = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "gi");
    for (const match of xml.matchAll(pattern)) {
      const block = match[1]?.trim();
      if (!block) continue;
      const customerName = extractXmlField(block, customerNameTags);
      const content = extractXmlField(block, contentTags);
      if (!customerName || !content) continue;
      records.push(buildImportedTestimonialRecord(block, customerName, content, ratingTags, sourceTags, sourceUrlTags, avatarUrlTags, reviewDateTags, isFeaturedTags, isActiveTags, serviceSlugTags, areaSlugTags));
    }
  }

  if (records.length > 0) {
    return records;
  }

  const customerName = extractXmlField(xml, customerNameTags);
  const content = extractXmlField(xml, contentTags);
  if (!customerName) throw new Error("Could not find a customer name field in the XML file");
  if (!content) throw new Error("Could not find a review content field in the XML file");

  return [
    buildImportedTestimonialRecord(
      xml,
      customerName,
      content,
      ratingTags,
      sourceTags,
      sourceUrlTags,
      avatarUrlTags,
      reviewDateTags,
      isFeaturedTags,
      isActiveTags,
      serviceSlugTags,
      areaSlugTags,
    ),
  ];
}

function buildImportedTestimonialRecord(
  xml: string,
  customerName: string,
  content: string,
  ratingTags: string[],
  sourceTags: string[],
  sourceUrlTags: string[],
  avatarUrlTags: string[],
  reviewDateTags: string[],
  isFeaturedTags: string[],
  isActiveTags: string[],
  serviceSlugTags: string[],
  areaSlugTags: string[],
): ImportedXmlRecord {
  return {
    title: customerName,
    mainContent: content,
    slug: "",
    excerpt: "",
    metaTitle: "",
    metaDescription: "",
    status: "published",
    sortOrder: null,
    parentServiceSlug: "",
    customerName,
    rating: parseXmlRatingField(xml, ratingTags),
    source: parseXmlTestimonialSource(xml, sourceTags),
    sourceUrl: extractXmlField(xml, sourceUrlTags),
    avatarUrl: extractXmlField(xml, avatarUrlTags),
    reviewDate: extractXmlField(xml, reviewDateTags),
    isFeatured: parseXmlBooleanField(xml, isFeaturedTags),
    isActive: parseXmlBooleanField(xml, isActiveTags),
    serviceSlug: extractXmlField(xml, serviceSlugTags),
    areaSlug: extractXmlField(xml, areaSlugTags),
  };
}

function parseXmlRatingField(xml: string, tagNames: string[]) {
  const raw = extractXmlField(xml, tagNames);
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(5, Math.max(1, Math.round(parsed)));
}

function parseXmlBooleanField(xml: string, tagNames: string[]) {
  const raw = extractXmlField(xml, tagNames);
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return null;
}

function parseXmlTestimonialSource(
  xml: string,
  tagNames: string[],
): TablesInsert<"testimonials">["source"] | null {
  const raw = extractXmlField(xml, tagNames);
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "google") return "google";
  if (normalized === "yelp") return "yelp";
  if (normalized === "facebook") return "facebook";
  if (normalized === "manual") return "manual";
  return null;
}

async function buildImportedTestimonialPayload(options: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  businessId: string;
  record: ImportedXmlRecord;
}) {
  const { supabase, businessId, record } = options;
  const serviceId = await resolveImportedLinkedRecordId({
    supabase,
    businessId,
    table: "services",
    slug: record.serviceSlug ?? "",
    label: `service for review by "${record.customerName ?? record.title}"`,
  });
  const areaId = await resolveImportedLinkedRecordId({
    supabase,
    businessId,
    table: "areas",
    slug: record.areaSlug ?? "",
    label: `area for review by "${record.customerName ?? record.title}"`,
  });

  return {
    business_id: businessId,
    customer_name: record.customerName?.trim() || record.title.trim(),
    content: record.mainContent.trim(),
    rating: record.rating ?? null,
    source: record.source ?? "manual",
    source_url: record.sourceUrl?.trim() || null,
    avatar_url: record.avatarUrl?.trim() || null,
    review_date: normalizeImportedDate(record.reviewDate ?? ""),
    is_featured: record.isFeatured ?? false,
    is_active: record.isActive ?? true,
    service_id: serviceId,
    area_id: areaId,
  } satisfies TablesInsert<"testimonials">;
}

async function resolveImportedLinkedRecordId(options: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  businessId: string;
  table: "services" | "areas";
  slug: string;
  label: string;
}) {
  const normalizedSlug = slugify(options.slug);
  if (!normalizedSlug) return null;
  const { data, error } = await options.supabase
    .from(options.table)
    .select("id")
    .eq("business_id", options.businessId)
    .eq("slug", normalizedSlug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    throw new Error(`Could not find ${options.label} with slug "${normalizedSlug}".`);
  }
  return data.id;
}

function normalizeImportedDate(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid review date "${value}".`);
  }
  return normalized;
}

function sanitizeInlineBlocksValue(value: unknown) {
  if (!Array.isArray(value)) return [] as Array<{ type: string; data: Record<string, unknown> }>;
  return value.filter(
    (item): item is { type: string; data: Record<string, unknown> } =>
      !!item &&
      typeof item === "object" &&
      !Array.isArray(item) &&
      typeof (item as { type?: unknown }).type === "string" &&
      !!(item as { data?: unknown }).data &&
      typeof (item as { data?: unknown }).data === "object" &&
      !Array.isArray((item as { data?: unknown }).data),
  );
}

function buildTemplateContentFromImportedBlocks(options: {
  existingContent: unknown;
  importedBlocks: Array<{ type: string; data: Record<string, unknown> }>;
  mode: "append" | "replace";
  templateKey: string;
  fallbackHeading: string;
}): Json {
  const importedTemplate = sanitizeTemplatePageContent(
    convertBasicBlocksToTemplatePageContent(
      options.importedBlocks,
      options.templateKey,
      options.fallbackHeading,
    ) ?? createTemplatePageContent(options.templateKey),
  );

  if (options.mode === "replace") {
    return importedTemplate as unknown as Json;
  }

  const existingTemplate =
    toTemplatePageContent(options.existingContent) ??
    convertBasicBlocksToTemplatePageContent(
      options.existingContent,
      options.templateKey,
      options.fallbackHeading,
    ) ??
    createTemplatePageContent(options.templateKey);

  const merged = sanitizeTemplatePageContent({
    ...existingTemplate,
    sections: existingTemplate.sections.map((section) => {
      if (section.slotId !== "content") return section;
      const importedSection = importedTemplate.sections.find((candidate) => candidate.slotId === "content");
      if (!importedSection) return section;

      const currentData =
        section.data && typeof section.data === "object" && !Array.isArray(section.data)
          ? ({ ...(section.data as Record<string, unknown>) } as Record<string, unknown>)
          : {};
      const importedData =
        importedSection.data && typeof importedSection.data === "object" && !Array.isArray(importedSection.data)
          ? (importedSection.data as Record<string, unknown>)
          : {};

      if (section.type === "rich_text_section") {
        const currentHeading = typeof currentData.heading === "string" ? currentData.heading : "";
        const importedHeading = typeof importedData.heading === "string" ? importedData.heading : "";
        const currentLede = typeof currentData.lede === "string" ? currentData.lede : "";
        const importedLede = typeof importedData.lede === "string" ? importedData.lede : "";
        return {
          ...section,
          data: {
            ...currentData,
            heading: currentHeading || importedHeading,
            lede: joinBodyText(currentLede, importedLede),
          },
        };
      }

      if (section.type === "long_form_body_section") {
        const currentBlocks = sanitizeInlineBlocksValue(currentData.blocks);
        const importedBlocks = sanitizeInlineBlocksValue(importedData.blocks);
        if (currentBlocks.length > 0 || importedBlocks.length > 0) {
          return {
            ...section,
            data: {
              ...currentData,
              blocks: [...currentBlocks, ...importedBlocks],
            },
          };
        }
        return {
          ...section,
          data: currentData,
        };
      }

      return section;
    }),
  });

  return merged as unknown as Json;
}

// ---- Service CRUD ----

function parseNullableNumber(value: FormDataEntryValue | null) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

interface EditableServiceProject {
  title: string;
  summary: string;
  photo_urls: string[];
  area_ids: string[];
}

interface EditableBeforeAfterGroup {
  before_urls: string[];
  after_urls: string[];
  area_ids: string[];
}

function parseJsonStringArray(raw: string): string[] {
  if (!raw.trim()) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function parseServiceProjects(raw: string): EditableServiceProject[] {
  if (!raw.trim()) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          return {
            title: "",
            summary: "",
            photo_urls: [],
            area_ids: [],
          };
        }

        const row = item as Record<string, unknown>;
        const title = typeof row.title === "string" ? row.title.trim() : "";
        const summary = typeof row.summary === "string" ? row.summary.trim() : "";
        const photoUrls = Array.isArray(row.photo_urls)
          ? row.photo_urls
              .filter((value): value is string => typeof value === "string")
              .map((value) => value.trim())
              .filter(Boolean)
          : [];
        const AreaIds = Array.isArray(row.area_ids)
          ? row.area_ids
              .filter((value): value is string => typeof value === "string")
              .map((value) => value.trim())
              .filter(Boolean)
          : [];

        return {
          title,
          summary,
          photo_urls: photoUrls,
          area_ids: Array.from(new Set(AreaIds)),
        };
      })
      .filter((item) => item.title || item.summary || item.photo_urls.length > 0);
  } catch {
    return [];
  }
}

function parseBeforeAfterGroups(raw: string): EditableBeforeAfterGroup[] {
  if (!raw.trim()) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          return { before_urls: [], after_urls: [], area_ids: [] };
        }
        const row = item as Record<string, unknown>;
        const beforeUrls = Array.isArray(row.before_urls)
          ? row.before_urls
              .filter((value): value is string => typeof value === "string")
              .map((value) => value.trim())
              .filter(Boolean)
          : [];
        const afterUrls = Array.isArray(row.after_urls)
          ? row.after_urls
              .filter((value): value is string => typeof value === "string")
              .map((value) => value.trim())
              .filter(Boolean)
          : [];
        const areaIds = Array.isArray(row.area_ids)
          ? row.area_ids
              .filter((value): value is string => typeof value === "string")
              .map((value) => value.trim())
              .filter(Boolean)
          : [];
        return {
          before_urls: beforeUrls,
          after_urls: afterUrls,
          area_ids: Array.from(new Set(areaIds)),
        };
      })
      .filter((group) => group.before_urls.length > 0 || group.after_urls.length > 0);
  } catch {
    return [];
  }
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toAreaPath(slug: string, settings?: Json | null) {
  return buildAreaPath(slug, settings ?? null);
}

function toServicePath(slug: string, settings?: Json | null) {
  return buildServicePath(slug, settings ?? null);
}

function findUniqueSlug(baseSlug: string, used: Set<string>) {
  const normalized = slugify(baseSlug);
  const seed = normalized || "item";
  let candidate = seed;
  let index = 2;
  while (used.has(candidate)) {
    candidate = `${seed}-${index}`;
    index += 1;
  }
  used.add(candidate);
  return candidate;
}

function interpolateTemplateString(
  template: string,
  tokens: Record<string, string | number | null | undefined>,
) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const value = tokens[key];
    return value === null || value === undefined ? "" : String(value);
  });
}

const DEFAULT_SERVICE_META_TITLE_TEMPLATE = "{{service}} Services | {{business}}";
const DEFAULT_SERVICE_META_DESCRIPTION_TEMPLATE =
  "Professional {{service}} services from {{business}} in {{primary_area}}, {{state_code}}. Contact us today for expert help.";
const DEFAULT_SERVICE_H1_TEMPLATE = "Pro {{service}} Services";
const DEFAULT_SERVICE_URL_TEMPLATE = "{{service}}";

const DEFAULT_AREA_META_TITLE_TEMPLATE = "{{primary_service}} in {{area}}, {{state_code}} | {{business}}";
const DEFAULT_AREA_META_DESCRIPTION_TEMPLATE =
  "Need {{primary_service}} in {{area}}, {{state_code}}? {{business}} provides trusted local service and fast scheduling.";
const DEFAULT_AREA_H1_TEMPLATE = "{{primary_service}} in {{area}}, {{state_code}}";
const DEFAULT_AREA_URL_TEMPLATE = "{{primary_service}}-{{area}}-{{state_code}}";

function applyHeadingToPrimaryTemplateSection(
  content: unknown,
  allowedTemplateKeys: string[],
  headingTemplate: string,
  tokens: Record<string, string | number | null | undefined>,
) {
  const templateContent = toTemplatePageContent(content);
  if (!templateContent) return content as Json;
  if (!allowedTemplateKeys.includes(templateContent.templateKey)) {
    return content as Json;
  }

  const nextHeading = interpolateTemplateString(headingTemplate, tokens).trim();
  if (!nextHeading) return content as Json;

  const targetIndex = templateContent.sections.findIndex((section) => {
    if (section.hidden) return false;
    if (section.slotId === "hero") return true;
    return [
      "flexible_hero_section",
      "hero_standard",
      "content_page_header",
      "service_hero_section",
      "about_hero_section",
      "contact_hero_section",
      "service_archive_hero_section",
      "service_area_archive_hero_section",
      "blog_archive_hero_section",
    ].includes(section.type);
  });

  if (targetIndex < 0) return content as Json;

  return sanitizeTemplatePageContent({
    ...templateContent,
    sections: templateContent.sections.map((section, index) => {
      if (index !== targetIndex) return section;
      const nextData =
        section.data && typeof section.data === "object" && !Array.isArray(section.data)
          ? { ...(section.data as Record<string, unknown>) }
          : {};
      return {
        ...section,
        data: {
          ...nextData,
          heading: nextHeading,
        },
      };
    }),
  }) as unknown as Json;
}

function readSettingsString(
  settings: Json | null | undefined,
  key: string,
) {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return "";
  const value = (settings as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() : "";
}

async function syncConfiguredEntityBasePathRedirects(options: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  businessId: string;
  table: "services" | "areas";
  previousSettings: Json | null | undefined;
  nextSettings: Json | null | undefined;
}) {
  const { supabase, businessId, table, previousSettings, nextSettings } = options;
  const previousBaseSegment =
    table === "services"
      ? getServiceDetailBaseSegment(previousSettings)
      : getAreaDetailBaseSegment(previousSettings);
  const nextBaseSegment =
    table === "services"
      ? getServiceDetailBaseSegment(nextSettings)
      : getAreaDetailBaseSegment(nextSettings);

  if (previousBaseSegment === nextBaseSegment) return 0;

  const { data: rows, error } = await supabase
    .from(table)
    .select("slug")
    .eq("business_id", businessId);
  if (error) throw new Error(error.message);

  const slugs = (rows ?? [])
    .map((row) => (row.slug ?? "").trim())
    .filter(Boolean);
  if (slugs.length === 0) return 0;

  const fromPaths = slugs.map((slug) =>
    table === "services" ? toServicePath(slug, previousSettings) : toAreaPath(slug, previousSettings),
  );
  const { data: existingRedirects, error: existingRedirectsError } = await supabase
    .from("redirects")
    .select("from_path, to_path")
    .eq("business_id", businessId)
    .in("from_path", fromPaths);
  if (existingRedirectsError) throw new Error(existingRedirectsError.message);

  const existingFromPaths = new Set((existingRedirects ?? []).map((row) => row.from_path));
  const redirectRows: TablesInsert<"redirects">[] = slugs
    .map((slug) => ({
      business_id: businessId,
      from_path: table === "services" ? toServicePath(slug, previousSettings) : toAreaPath(slug, previousSettings),
      to_path: table === "services" ? toServicePath(slug, nextSettings) : toAreaPath(slug, nextSettings),
      type: "301" as TablesInsert<"redirects">["type"],
      is_active: true,
    }))
    .filter((row) => !existingFromPaths.has(row.from_path));

  if (redirectRows.length > 0) {
    const { error: redirectsInsertError } = await supabase
      .from("redirects")
      .insert(redirectRows);
    if (redirectsInsertError) throw new Error(redirectsInsertError.message);
  }

  for (const slug of slugs) {
    if (table === "services") {
      revalidatePath(toServicePath(slug, previousSettings));
      revalidatePath(toServicePath(slug, nextSettings));
    } else {
      revalidatePath(toAreaPath(slug, previousSettings));
      revalidatePath(toAreaPath(slug, nextSettings));
    }
  }

  revalidatePath(`/${previousBaseSegment}`);
  revalidatePath(`/${nextBaseSegment}`);
  return redirectRows.length;
}

function formatDefaultLocation(city: string, state: string, stateCode: string) {
  const normalizedState = stateCode || state;
  if (city && normalizedState) return `${city}, ${normalizedState}`;
  return city || normalizedState;
}

async function loadBusinessTemplateContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
) {
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("name, city, state, domain, settings")
    .eq("id", businessId)
    .maybeSingle();
  if (businessError) throw new Error(businessError.message);

  const stateRaw = (business?.state ?? "").trim();
  const stateCode = /^[a-z]{2}$/i.test(stateRaw) ? stateRaw.toUpperCase() : "";
  const city = (business?.city ?? "").trim();
  const state = stateRaw;
  const normalizedDomain = (business?.domain ?? "").trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");

  const { data: primaryService, error: primaryServiceError } = await supabase
    .from("services")
    .select("title")
    .eq("business_id", businessId)
    .eq("is_primary", true)
    .limit(1)
    .maybeSingle();
  if (primaryServiceError) throw new Error(primaryServiceError.message);

  return {
    settings: (business?.settings ?? null) as Json | null,
    tokens: {
      business: business?.name ?? "",
      city,
      state,
      state_code: stateCode,
      primary_area: city,
      primary_service: primaryService?.title ?? "",
      site_url: normalizedDomain ? `https://${normalizedDomain}` : "",
      domain: normalizedDomain,
      url: "",
      location: formatDefaultLocation(city, state, stateCode),
    },
  };
}

export async function applyAreaDefaultsAction() {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const { data: areas, error: areasError } = await supabase
    .from("areas")
    .select("id, name, slug, meta_title, meta_description, icon, content")
    .eq("business_id", businessId)
    .order("created_at", { ascending: true });
  if (areasError) throw new Error(areasError.message);

  const businessContext = await loadBusinessTemplateContext(supabase, businessId);
  const areaDefaultTitleTemplate = readSettingsString(
    businessContext.settings,
    "area_default_title_template",
  ) || DEFAULT_AREA_META_TITLE_TEMPLATE;
  const areaDefaultMetaDescriptionTemplate = readSettingsString(
    businessContext.settings,
    "area_default_meta_description_template",
  ) || DEFAULT_AREA_META_DESCRIPTION_TEMPLATE;
  const areaDefaultH1Template = readSettingsString(
    businessContext.settings,
    "area_default_h1_template",
  ) || DEFAULT_AREA_H1_TEMPLATE;
  const areaDefaultUrlTemplate = readSettingsString(
    businessContext.settings,
    "area_default_url_template",
  ) || DEFAULT_AREA_URL_TEMPLATE;
  const areaDefaultIcon = readSettingsString(
    businessContext.settings,
    "area_default_icon",
  );

  if (!areas || areas.length === 0) {
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/areas");
    revalidatePath(`/${getAreaDetailBaseSegment(businessContext.settings)}`);
    revalidateCommonSitePaths();
    return {
      success: true,
      updatedCount: 0,
      metaTitleCount: 0,
      metaDescriptionCount: 0,
      h1Count: 0,
      iconCount: 0,
      slugCount: 0,
      redirectCount: 0,
    };
  }

  const usedSlugs = new Set(
    areas
      .map((area) => (area.slug ?? "").trim())
      .filter(Boolean),
  );

  const updates: Array<{
    id: string;
    update: TablesUpdate<"areas">;
    oldSlug: string | null;
    nextSlug: string | null;
  }> = [];
  let metaTitleCount = 0;
  let metaDescriptionCount = 0;
  let h1Count = 0;
  let iconCount = 0;
  let slugCount = 0;

  for (const area of areas) {
    const areaName = (area.name ?? "").trim();
    if (!areaName) continue;

    const currentSlug = (area.slug ?? "").trim();
    const currentMetaTitle = (area.meta_title ?? "").trim();
    const currentMetaDescription = (area.meta_description ?? "").trim();
    const currentIcon = (area.icon ?? "").trim();
    const currentContent = toTemplatePageContent(area.content);
    const tokens = {
      ...businessContext.tokens,
      area: areaName,
      location: areaName,
      url: "",
    };

    const update: TablesUpdate<"areas"> = {};
    let shouldUpdate = false;
    let nextSlug: string | null = null;

    if (areaDefaultTitleTemplate) {
      const nextMetaTitle = interpolateTemplateString(areaDefaultTitleTemplate, tokens).trim();
      if (currentMetaTitle !== nextMetaTitle) {
        update.meta_title = nextMetaTitle || null;
        shouldUpdate = true;
        metaTitleCount += 1;
      }
    }

    if (areaDefaultMetaDescriptionTemplate) {
      const nextMetaDescription = interpolateTemplateString(areaDefaultMetaDescriptionTemplate, tokens).trim();
      if (currentMetaDescription !== nextMetaDescription) {
        update.meta_description = nextMetaDescription || null;
        shouldUpdate = true;
        metaDescriptionCount += 1;
      }
    }

    if (areaDefaultIcon && !currentIcon) {
      update.icon = areaDefaultIcon;
      shouldUpdate = true;
      iconCount += 1;
    }

    if (areaDefaultH1Template && currentContent?.templateKey === "area-content-v1") {
      const nextContent = applyHeadingToPrimaryTemplateSection(
        currentContent,
        ["area-content-v1"],
        areaDefaultH1Template,
        tokens,
      );
      if (JSON.stringify(nextContent) !== JSON.stringify(currentContent)) {
        update.content = nextContent;
        shouldUpdate = true;
        h1Count += 1;
      }
    }

    if (areaDefaultUrlTemplate) {
      const desiredBaseSlug = slugify(interpolateTemplateString(areaDefaultUrlTemplate, tokens)) || slugify(areaName);
      if (desiredBaseSlug) {
        if (currentSlug) usedSlugs.delete(currentSlug);
        nextSlug = findUniqueSlug(desiredBaseSlug, usedSlugs);
        if (currentSlug !== nextSlug) {
          update.slug = nextSlug;
          shouldUpdate = true;
          slugCount += 1;
        }
      }
    }

    if (shouldUpdate) {
      updates.push({
        id: area.id,
        update,
        oldSlug: currentSlug || null,
        nextSlug,
      });
    }
  }

  for (const update of updates) {
    const { error } = await supabase
      .from("areas")
      .update(update.update)
      .eq("id", update.id)
      .eq("business_id", businessId);
    if (error) throw new Error(error.message);
  }

  const slugUpdates = updates.filter(
    (update): update is typeof update & { oldSlug: string; nextSlug: string } =>
      Boolean(update.oldSlug && update.nextSlug && update.oldSlug !== update.nextSlug),
  );

  let redirectCount = 0;
  if (slugUpdates.length > 0) {
    const fromPaths = slugUpdates.map((update) => toAreaPath(update.oldSlug, businessContext.settings));
    const { data: existingRedirects, error: existingRedirectsError } = await supabase
      .from("redirects")
      .select("from_path, to_path")
      .eq("business_id", businessId)
      .in("from_path", fromPaths);
    if (existingRedirectsError) throw new Error(existingRedirectsError.message);

    const existingMap = new Map(
      (existingRedirects ?? []).map((row) => [row.from_path, row.to_path]),
    );
    const redirectRows: TablesInsert<"redirects">[] = slugUpdates
      .map((update) => ({
        business_id: businessId,
        from_path: toAreaPath(update.oldSlug, businessContext.settings),
        to_path: toAreaPath(update.nextSlug, businessContext.settings),
        type: "301" as TablesInsert<"redirects">["type"],
        is_active: true,
      }))
      .filter((row) => !existingMap.has(row.from_path));

    if (redirectRows.length > 0) {
      const { error: redirectsInsertError } = await supabase
        .from("redirects")
        .insert(redirectRows);
      if (redirectsInsertError) throw new Error(redirectsInsertError.message);
      redirectCount = redirectRows.length;
    }

    for (const update of slugUpdates) {
      revalidatePath(toAreaPath(update.oldSlug, businessContext.settings));
      revalidatePath(toAreaPath(update.nextSlug, businessContext.settings));
    }
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/areas");
  revalidatePath(`/${getAreaDetailBaseSegment(businessContext.settings)}`);
  revalidateCommonSitePaths();
  return {
    success: true,
    updatedCount: updates.length,
    metaTitleCount,
    metaDescriptionCount,
    h1Count,
    iconCount,
    slugCount,
    redirectCount,
  };
}

export async function applyServiceDefaultsAction() {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const { data: services, error: servicesError } = await supabase
    .from("services")
    .select("id, title, slug, meta_title, meta_description, icon, content")
    .eq("business_id", businessId)
    .order("created_at", { ascending: true });
  if (servicesError) throw new Error(servicesError.message);

  const businessContext = await loadBusinessTemplateContext(supabase, businessId);
  const serviceDefaultTitleTemplate = readSettingsString(
    businessContext.settings,
    "service_default_title_template",
  ) || DEFAULT_SERVICE_META_TITLE_TEMPLATE;
  const serviceDefaultMetaDescriptionTemplate = readSettingsString(
    businessContext.settings,
    "service_default_meta_description_template",
  ) || DEFAULT_SERVICE_META_DESCRIPTION_TEMPLATE;
  const serviceDefaultH1Template = readSettingsString(
    businessContext.settings,
    "service_default_h1_template",
  ) || DEFAULT_SERVICE_H1_TEMPLATE;
  const serviceDefaultUrlTemplate = readSettingsString(
    businessContext.settings,
    "service_default_url_template",
  ) || DEFAULT_SERVICE_URL_TEMPLATE;
  const serviceDefaultIcon = readSettingsString(
    businessContext.settings,
    "service_default_icon",
  );

  if (!services || services.length === 0) {
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/services");
    revalidatePath(`/${getServiceDetailBaseSegment(businessContext.settings)}`);
    revalidateCommonSitePaths();
    return {
      success: true,
      updatedCount: 0,
      metaTitleCount: 0,
      metaDescriptionCount: 0,
      h1Count: 0,
      iconCount: 0,
      slugCount: 0,
      redirectCount: 0,
    };
  }

  const usedSlugs = new Set(
    services
      .map((service) => (service.slug ?? "").trim())
      .filter(Boolean),
  );

  const updates: Array<{
    id: string;
    update: TablesUpdate<"services">;
    oldSlug: string | null;
    nextSlug: string | null;
  }> = [];
  let metaTitleCount = 0;
  let metaDescriptionCount = 0;
  let h1Count = 0;
  let iconCount = 0;
  let slugCount = 0;

  for (const service of services) {
    const serviceTitle = (service.title ?? "").trim();
    if (!serviceTitle) continue;

    const currentSlug = (service.slug ?? "").trim();
    const currentMetaTitle = (service.meta_title ?? "").trim();
    const currentMetaDescription = (service.meta_description ?? "").trim();
    const currentIcon = (service.icon ?? "").trim();
    const currentContent = toTemplatePageContent(service.content);
    const tokens = {
      ...businessContext.tokens,
      service: serviceTitle,
      url: "",
    };

    const update: TablesUpdate<"services"> = {};
    let shouldUpdate = false;
    let nextSlug: string | null = null;

    if (serviceDefaultTitleTemplate) {
      const nextMetaTitle = interpolateTemplateString(serviceDefaultTitleTemplate, tokens).trim();
      if (currentMetaTitle !== nextMetaTitle) {
        update.meta_title = nextMetaTitle || null;
        shouldUpdate = true;
        metaTitleCount += 1;
      }
    }

    if (serviceDefaultMetaDescriptionTemplate) {
      const nextMetaDescription = interpolateTemplateString(serviceDefaultMetaDescriptionTemplate, tokens).trim();
      if (currentMetaDescription !== nextMetaDescription) {
        update.meta_description = nextMetaDescription || null;
        shouldUpdate = true;
        metaDescriptionCount += 1;
      }
    }

    if (serviceDefaultIcon && !currentIcon) {
      update.icon = serviceDefaultIcon;
      shouldUpdate = true;
      iconCount += 1;
    }

    if (serviceDefaultH1Template && currentContent?.templateKey === "service-content-v1") {
      const nextContent = applyHeadingToPrimaryTemplateSection(
        currentContent,
        ["service-content-v1"],
        serviceDefaultH1Template,
        tokens,
      );

      if (JSON.stringify(nextContent) !== JSON.stringify(currentContent)) {
        update.content = nextContent;
        shouldUpdate = true;
        h1Count += 1;
      }
    }

    if (serviceDefaultUrlTemplate) {
      const desiredBaseSlug =
        slugify(interpolateTemplateString(serviceDefaultUrlTemplate, tokens)) || slugify(serviceTitle);
      if (desiredBaseSlug) {
        if (currentSlug) usedSlugs.delete(currentSlug);
        nextSlug = findUniqueSlug(desiredBaseSlug, usedSlugs);
        if (currentSlug !== nextSlug) {
          update.slug = nextSlug;
          shouldUpdate = true;
          slugCount += 1;
        }
      }
    }

    if (shouldUpdate) {
      updates.push({
        id: service.id,
        update,
        oldSlug: currentSlug || null,
        nextSlug,
      });
    }
  }

  for (const update of updates) {
    const { error } = await supabase
      .from("services")
      .update(update.update)
      .eq("id", update.id)
      .eq("business_id", businessId);
    if (error) throw new Error(error.message);
  }

  const slugUpdates = updates.filter(
    (update): update is typeof update & { oldSlug: string; nextSlug: string } =>
      Boolean(update.oldSlug && update.nextSlug && update.oldSlug !== update.nextSlug),
  );

  let redirectCount = 0;
  if (slugUpdates.length > 0) {
    const fromPaths = slugUpdates.map((update) => toServicePath(update.oldSlug, businessContext.settings));
    const { data: existingRedirects, error: existingRedirectsError } = await supabase
      .from("redirects")
      .select("from_path, to_path")
      .eq("business_id", businessId)
      .in("from_path", fromPaths);
    if (existingRedirectsError) throw new Error(existingRedirectsError.message);

    const existingMap = new Map(
      (existingRedirects ?? []).map((row) => [row.from_path, row.to_path]),
    );
    const redirectRows: TablesInsert<"redirects">[] = slugUpdates
      .map((update) => ({
        business_id: businessId,
        from_path: toServicePath(update.oldSlug, businessContext.settings),
        to_path: toServicePath(update.nextSlug, businessContext.settings),
        type: "301" as TablesInsert<"redirects">["type"],
        is_active: true,
      }))
      .filter((row) => !existingMap.has(row.from_path));

    if (redirectRows.length > 0) {
      const { error: redirectsInsertError } = await supabase
        .from("redirects")
        .insert(redirectRows);
      if (redirectsInsertError) throw new Error(redirectsInsertError.message);
      redirectCount = redirectRows.length;
    }

    for (const update of slugUpdates) {
      revalidatePath(toServicePath(update.oldSlug, businessContext.settings));
      revalidatePath(toServicePath(update.nextSlug, businessContext.settings));
    }
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/services");
  revalidatePath(`/${getServiceDetailBaseSegment(businessContext.settings)}`);
  revalidateCommonSitePaths();
  return {
    success: true,
    updatedCount: updates.length,
    metaTitleCount,
    metaDescriptionCount,
    h1Count,
    iconCount,
    slugCount,
    redirectCount,
  };
}

export async function regenerateAreaSlugsAction() {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const { data: areas, error: areasError } = await supabase
    .from("areas")
    .select("id, name, slug")
    .eq("business_id", businessId)
    .order("created_at", { ascending: true });
  if (areasError) throw new Error(areasError.message);

  if (!areas || areas.length === 0) {
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/areas");
    revalidatePath(`/${getAreaDetailBaseSegment(await getBusinessSettingsJson(supabase, businessId))}`);
    return { success: true, updatedCount: 0, redirectCount: 0 };
  }

  const businessContext = await loadBusinessTemplateContext(supabase, businessId);
  const AreaDefaultUrlTemplate = readSettingsString(
    businessContext.settings,
    "area_default_url_template",
  ) || DEFAULT_AREA_URL_TEMPLATE;

  const usedSlugs = new Set(
    areas
      .map((area) => (area.slug ?? "").trim())
      .filter(Boolean),
  );

  const updates: Array<{ id: string; oldSlug: string; nextSlug: string }> = [];
  for (const area of areas) {
    const areaName = (area.name ?? "").trim();
    if (!areaName) continue;

    const tokens = {
      ...businessContext.tokens,
      area: areaName,
      location: areaName,
    };
    const rendered = interpolateTemplateString(AreaDefaultUrlTemplate, tokens);
    const desiredBaseSlug = slugify(rendered) || slugify(areaName);
    if (!desiredBaseSlug) continue;

    const currentSlug = (area.slug ?? "").trim();
    if (currentSlug) usedSlugs.delete(currentSlug);
    const nextSlug = findUniqueSlug(desiredBaseSlug, usedSlugs);
    if (currentSlug && currentSlug !== nextSlug) {
      updates.push({ id: area.id, oldSlug: currentSlug, nextSlug });
    }
  }

  let redirectCount = 0;
  if (updates.length > 0) {
    for (const update of updates) {
      const { error } = await supabase
        .from("areas")
        .update({ slug: update.nextSlug } satisfies TablesUpdate<"areas">)
        .eq("id", update.id)
        .eq("business_id", businessId);
      if (error) throw new Error(error.message);
    }

    const fromPaths = updates.map((row) => toAreaPath(row.oldSlug, businessContext.settings));
    const { data: existingRedirects, error: existingRedirectsError } = await supabase
      .from("redirects")
      .select("from_path, to_path")
      .eq("business_id", businessId)
      .in("from_path", fromPaths);
    if (existingRedirectsError) throw new Error(existingRedirectsError.message);

    const existingMap = new Map(
      (existingRedirects ?? []).map((row) => [row.from_path, row.to_path]),
    );
    const redirectRows: TablesInsert<"redirects">[] = updates
      .map((row) => ({
        business_id: businessId,
        from_path: toAreaPath(row.oldSlug, businessContext.settings),
        to_path: toAreaPath(row.nextSlug, businessContext.settings),
        type: "301" as TablesInsert<"redirects">["type"],
        is_active: true,
      }))
      .filter((row) => !existingMap.has(row.from_path));

    if (redirectRows.length > 0) {
      const { error: redirectsInsertError } = await supabase
        .from("redirects")
        .insert(redirectRows);
      if (redirectsInsertError) throw new Error(redirectsInsertError.message);
      redirectCount = redirectRows.length;
    }
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/areas");
  revalidatePath(`/${getAreaDetailBaseSegment(businessContext.settings)}`);
  revalidateCommonSitePaths();
  return { success: true, updatedCount: updates.length, redirectCount };
}

export async function regenerateServiceSlugsAction() {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const { data: services, error: servicesError } = await supabase
    .from("services")
    .select("id, title, slug")
    .eq("business_id", businessId)
    .order("created_at", { ascending: true });
  if (servicesError) throw new Error(servicesError.message);

  if (!services || services.length === 0) {
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/services");
    revalidatePath(`/${getServiceDetailBaseSegment(await getBusinessSettingsJson(supabase, businessId))}`);
    return { success: true, updatedCount: 0, redirectCount: 0 };
  }

  const businessContext = await loadBusinessTemplateContext(supabase, businessId);
  const serviceDefaultUrlTemplate = readSettingsString(
    businessContext.settings,
    "service_default_url_template",
  ) || DEFAULT_SERVICE_URL_TEMPLATE;

  const usedSlugs = new Set(
    services
      .map((service) => (service.slug ?? "").trim())
      .filter(Boolean),
  );

  const updates: Array<{ id: string; oldSlug: string; nextSlug: string }> = [];
  for (const service of services) {
    const serviceTitle = (service.title ?? "").trim();
    if (!serviceTitle) continue;

    const tokens = {
      ...businessContext.tokens,
      service: serviceTitle,
      url: "",
    };
    const rendered = interpolateTemplateString(serviceDefaultUrlTemplate, tokens);
    const desiredBaseSlug = slugify(rendered) || slugify(serviceTitle);
    if (!desiredBaseSlug) continue;

    const currentSlug = (service.slug ?? "").trim();
    if (currentSlug) usedSlugs.delete(currentSlug);
    const nextSlug = findUniqueSlug(desiredBaseSlug, usedSlugs);
    if (currentSlug && currentSlug !== nextSlug) {
      updates.push({ id: service.id, oldSlug: currentSlug, nextSlug });
    }
  }

  let redirectCount = 0;
  if (updates.length > 0) {
    for (const update of updates) {
      const { error } = await supabase
        .from("services")
        .update({ slug: update.nextSlug } satisfies TablesUpdate<"services">)
        .eq("id", update.id)
        .eq("business_id", businessId);
      if (error) throw new Error(error.message);
    }

    const fromPaths = updates.map((row) => toServicePath(row.oldSlug, businessContext.settings));
    const { data: existingRedirects, error: existingRedirectsError } = await supabase
      .from("redirects")
      .select("from_path, to_path")
      .eq("business_id", businessId)
      .in("from_path", fromPaths);
    if (existingRedirectsError) throw new Error(existingRedirectsError.message);

    const existingMap = new Map(
      (existingRedirects ?? []).map((row) => [row.from_path, row.to_path]),
    );
    const redirectRows: TablesInsert<"redirects">[] = updates
      .map((row) => ({
        business_id: businessId,
        from_path: toServicePath(row.oldSlug, businessContext.settings),
        to_path: toServicePath(row.nextSlug, businessContext.settings),
        type: "301" as TablesInsert<"redirects">["type"],
        is_active: true,
      }))
      .filter((row) => !existingMap.has(row.from_path));

    if (redirectRows.length > 0) {
      const { error: redirectsInsertError } = await supabase
        .from("redirects")
        .insert(redirectRows);
      if (redirectsInsertError) throw new Error(redirectsInsertError.message);
      redirectCount = redirectRows.length;
    }
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/services");
  revalidatePath(`/${getServiceDetailBaseSegment(businessContext.settings)}`);
  revalidateCommonSitePaths();
  return { success: true, updatedCount: updates.length, redirectCount };
}

interface EditableLineItem {
  description: string;
  qty: number;
  unit_price: number;
  total: number;
  qbo_item_id?: string | null;
  qbo_item_name?: string | null;
}

function parseLineItems(raw: string): EditableLineItem[] {
  if (!raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        const row = item as Partial<EditableLineItem>;
        const qty = Number(row.qty ?? 0);
        const unit = Number(row.unit_price ?? 0);
        return {
          description: String(row.description ?? "").trim(),
          qty: Number.isFinite(qty) ? qty : 0,
          unit_price: Number.isFinite(unit) ? unit : 0,
          total: Number.isFinite(qty * unit) ? qty * unit : 0,
          qbo_item_id:
            typeof row.qbo_item_id === "string" && row.qbo_item_id.trim() ? row.qbo_item_id.trim() : null,
          qbo_item_name:
            typeof row.qbo_item_name === "string" && row.qbo_item_name.trim() ? row.qbo_item_name.trim() : null,
        };
      })
      .filter((item) => item.description.length > 0);
  } catch {
    return [];
  }
}

async function resolveCurrentBusinessId() {
  return await getCurrentDashboardBusinessId();
}

function parseSharedSectionsFromFormData(formData: FormData) {
  const rawValue = ((formData.get("shared_sections") as string) || "").trim();
  if (!rawValue) return null;

  try {
    return parseSharedSections(JSON.parse(rawValue) as unknown);
  } catch {
    return null;
  }
}

async function ensureUniqueSlug(options: {
  table: "blog_posts" | "pages" | "services" | "areas" | "projects";
  businessId: string;
  slug: string;
  id?: string | null;
  label: string;
}) {
  const supabase = await createClient();

  let query = supabase
    .from(options.table)
    .select("id")
    .eq("business_id", options.businessId)
    .eq("slug", options.slug)
    .limit(1);

  if (options.id) {
    query = query.neq("id", options.id);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (data) throw new Error(`${options.label} slug "${options.slug}" is already in use.`);
}

export async function saveService(formData: FormData) {
  const profile = await assertAdminDashboardAction();
  const supabase = createAdminClient();

  const id = (formData.get("id") as string) || null;
  const businessId =
    profile.business_id ||
    (formData.get("business_id") as string) ||
    (await resolveCurrentBusinessId()) ||
    "";

  if (!businessId) throw new Error("Business context is required");
  const sharedSections = parseSharedSectionsFromFormData(formData);

  const title = ((formData.get("title") as string) || "").trim();
  const explicitSlug = ((formData.get("slug") as string) || "").trim();

  if (!title) throw new Error("Title is required");

  const businessContext = await loadBusinessTemplateContext(supabase, businessId);
  const serviceDefaultTitleTemplate = readSettingsString(
    businessContext.settings,
    "service_default_title_template",
  ) || DEFAULT_SERVICE_META_TITLE_TEMPLATE;
  const serviceDefaultMetaDescriptionTemplate = readSettingsString(
    businessContext.settings,
    "service_default_meta_description_template",
  ) || DEFAULT_SERVICE_META_DESCRIPTION_TEMPLATE;
  const serviceDefaultH1Template = readSettingsString(
    businessContext.settings,
    "service_default_h1_template",
  ) || DEFAULT_SERVICE_H1_TEMPLATE;
  const serviceDefaultUrlTemplate = readSettingsString(
    businessContext.settings,
    "service_default_url_template",
  ) || DEFAULT_SERVICE_URL_TEMPLATE;
  const serviceTokens = {
    ...businessContext.tokens,
    service: title,
  };
  const autoSlugFromTitle = slugify(title);
  const slugCanUseTemplate = !explicitSlug || explicitSlug === autoSlugFromTitle;
  const renderedSlugFromTemplate =
    slugCanUseTemplate && serviceDefaultUrlTemplate
      ? slugify(interpolateTemplateString(serviceDefaultUrlTemplate, serviceTokens))
      : "";
  const slug = renderedSlugFromTemplate || explicitSlug || autoSlugFromTitle;

  if (!slug) throw new Error("Slug is required");
  let existingServiceForUpdate: Pick<
    Tables<"services">,
    "id" | "slug" | "is_primary" | "sort_order" | "parent_service_id"
  > | null = null;
  if (id) {
    const { data: existingService, error: existingServiceError } = await supabase
      .from("services")
      .select("id, slug, is_primary, sort_order, parent_service_id")
      .eq("id", id)
      .eq("business_id", businessId)
      .maybeSingle();
    if (existingServiceError) throw new Error(existingServiceError.message);
    existingServiceForUpdate =
      (existingService as Pick<
        Tables<"services">,
        "id" | "slug" | "is_primary" | "sort_order" | "parent_service_id"
      > | null) ?? null;
    if (!existingServiceForUpdate) throw new Error("Service not found");
  }
  const hasParentServiceField = formData.has("parent_service_id");
  const parentServiceId = hasParentServiceField
    ? (((formData.get("parent_service_id") as string) || "").trim() || null)
    : (existingServiceForUpdate?.parent_service_id ?? null);
  const hasPrimaryField = formData.has("is_primary");
  const isPrimary = hasPrimaryField
    ? (formData.get("is_primary") as string) === "on"
    : (existingServiceForUpdate?.is_primary ?? false);
  const hasSortOrderField = formData.has("sort_order");
  const sortOrder = hasSortOrderField
    ? (parseNullableNumber(formData.get("sort_order")) ?? 0)
    : (existingServiceForUpdate?.sort_order ?? 0);
  if (id && parentServiceId === id) {
    throw new Error("A service cannot be its own parent");
  }

  if (parentServiceId) {
    const { data: parent, error: parentError } = await supabase
      .from("services")
      .select("id")
      .eq("id", parentServiceId)
      .eq("business_id", businessId)
      .maybeSingle();
    if (parentError) throw new Error(parentError.message);
    if (!parent) throw new Error("Selected parent service was not found");
  }

  await ensureUniqueSlug({
    table: "services",
    businessId,
    slug,
    id,
    label: "Service",
  });

  let content: Json = [];
  const contentRaw = (formData.get("content") as string) || "[]";
  try {
    const parsed = JSON.parse(contentRaw) as unknown;
    content =
      (convertBasicBlocksToTemplatePageContent(
        parsed,
        "service-content-v1",
        `${title.trim() || "Service"} Services`,
      ) ??
        sanitizeTemplatePageContent(parsed)) as unknown as Json;
  } catch {
    content = sanitizeTemplatePageContent(
      convertBasicBlocksToTemplatePageContent([], "service-content-v1") ?? {
        kind: "template-page",
        version: 1,
        templateKey: "service-content-v1",
        sections: [],
      },
    ) as unknown as Json;
  }
  if (serviceDefaultH1Template) {
    content = applyHeadingToPrimaryTemplateSection(
      content,
      ["service-content-v1"],
      serviceDefaultH1Template,
      serviceTokens,
    );
  }
  const parsedBeforeAfterGroups = parseBeforeAfterGroups(
    (formData.get("before_after_groups") as string) || "[]",
  );
  const beforeAfterGroups = parsedBeforeAfterGroups;
  const serviceProjects = parseServiceProjects(
    (formData.get("service_projects") as string) || "[]",
  );
  const serviceGalleryUrls = parseJsonStringArray(
    (formData.get("service_gallery_urls") as string) || "[]",
  );

  const service: TablesInsert<"services"> = {
    before_after_groups: beforeAfterGroups as unknown as Json,
    business_id: businessId,
    title,
    slug,
    excerpt: ((formData.get("excerpt") as string) || "").trim() || null,
    content,
    icon: ((formData.get("icon") as string) || "").trim() || null,
    is_primary: isPrimary,
    featured_image_url:
      ((formData.get("featured_image_url") as string) || "").trim() || null,
    sort_order: sortOrder,
    meta_title:
      ((formData.get("meta_title") as string) || "").trim() ||
      (serviceDefaultTitleTemplate
        ? interpolateTemplateString(serviceDefaultTitleTemplate, serviceTokens).trim()
        : "") ||
      null,
    meta_description:
      ((formData.get("meta_description") as string) || "").trim() ||
      (serviceDefaultMetaDescriptionTemplate
        ? interpolateTemplateString(serviceDefaultMetaDescriptionTemplate, serviceTokens).trim()
        : "") ||
      null,
    parent_service_id: parentServiceId,
    service_gallery_urls: serviceGalleryUrls,
    service_projects: serviceProjects as unknown as Json,
  };

  if (id) {
    if (isPrimary) {
      const { error: clearPrimaryError } = await supabase
        .from("services")
        .update({ is_primary: false })
        .eq("business_id", businessId)
        .neq("id", id)
        .eq("is_primary", true);
      if (clearPrimaryError) throw new Error(clearPrimaryError.message);
    }

    const { error } = await supabase
      .from("services")
      .update(service)
      .eq("id", id)
      .eq("business_id", businessId);

    if (error) throw new Error(error.message);
    if (sharedSections) {
      await saveBusinessSharedSections(businessId, sharedSections);
    }

    revalidatePath("/dashboard/services");
    revalidatePath(`/dashboard/services/${id}`);
    revalidatePath("/dashboard/media");
    revalidatePath("/services");
    await revalidateConfiguredServiceDetailPath(supabase, businessId, slug);
    return { success: true, id };
  }

  if (isPrimary) {
    const { error: clearPrimaryError } = await supabase
      .from("services")
      .update({ is_primary: false })
      .eq("business_id", businessId)
      .eq("is_primary", true);
    if (clearPrimaryError) throw new Error(clearPrimaryError.message);
  }

  const { data, error } = await supabase
    .from("services")
    .insert(service)
    .select("id, slug")
    .single();

  if (error) throw new Error(error.message);
  if (sharedSections) {
    await saveBusinessSharedSections(businessId, sharedSections);
  }

  revalidatePath("/dashboard/services");
  revalidatePath(`/dashboard/services/${data.id}`);
  revalidatePath("/dashboard/media");
  revalidatePath("/services");
  await revalidateConfiguredServiceDetailPath(supabase, businessId, data.slug);
  return { success: true, id: data.id };
}

export async function deleteService(id: string) {
  const profile = await assertAdminDashboardAction();
  const supabase = createAdminClient();
  const businessId = profile.business_id || (await resolveCurrentBusinessId());
  if (!businessId) throw new Error("Business context is required");

  const { data: existing, error: fetchError } = await supabase
    .from("services")
    .select("slug")
    .eq("id", id)
    .eq("business_id", businessId)
    .single();

  if (fetchError) throw new Error(fetchError.message);

  const { error } = await supabase
    .from("services")
    .delete()
    .eq("id", id)
    .eq("business_id", businessId);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/services");
  revalidatePath("/dashboard/media");
  revalidatePath("/services");
  await revalidateConfiguredServiceDetailPath(supabase, businessId, existing.slug);
  return { success: true };
}

export async function deleteServicesBulk(ids: string[]) {
  const profile = await assertAdminDashboardAction();
  const supabase = createAdminClient();
  const businessId = profile.business_id || (await resolveCurrentBusinessId());
  if (!businessId) throw new Error("Business context is required");

  const validIds = Array.from(
    new Set(ids.map((id) => id.trim()).filter(Boolean))
  );
  if (validIds.length === 0) return { success: true, deleted: 0 };

  const { data: existingRows, error: fetchError } = await supabase
    .from("services")
    .select("id, slug")
    .eq("business_id", businessId)
    .in("id", validIds);
  if (fetchError) throw new Error(fetchError.message);

  const deletableIds = (existingRows ?? []).map((row) => row.id);
  if (deletableIds.length === 0) return { success: true, deleted: 0 };

  const { error } = await supabase
    .from("services")
    .delete()
    .eq("business_id", businessId)
    .in("id", deletableIds);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/services");
  revalidatePath("/services");
  for (const row of existingRows ?? []) {
    await revalidateConfiguredServiceDetailPath(supabase, businessId, row.slug);
  }

  return { success: true, deleted: deletableIds.length };
}

export async function reorderServicesAction(
  updates: Array<{ id: string; parent_service_id: string | null; sort_order: number }>,
) {
  const profile = await assertAdminDashboardAction();
  const supabase = createAdminClient();
  const businessId = profile.business_id || (await resolveCurrentBusinessId());
  if (!businessId) throw new Error("Business context is required");

  const normalizedUpdates = Array.from(
    new Map(
      updates
        .map((update) => ({
          id: update.id.trim(),
          parent_service_id: update.parent_service_id?.trim() || null,
          sort_order: Number.isFinite(update.sort_order) ? Math.max(0, Math.trunc(update.sort_order)) : 0,
        }))
        .filter((update) => update.id)
        .map((update) => [update.id, update] as const),
    ).values(),
  );

  if (normalizedUpdates.length === 0) {
    return { success: true, updated: 0 };
  }

  const updatedIdSet = new Set(normalizedUpdates.map((update) => update.id));
  for (const update of normalizedUpdates) {
    if (update.parent_service_id === update.id) {
      throw new Error("A service cannot be its own parent");
    }
    if (update.parent_service_id && !updatedIdSet.has(update.parent_service_id)) {
      throw new Error("Parent service must be included in the reorder payload");
    }
  }

  const { data: existingRows, error: fetchError } = await supabase
    .from("services")
    .select("id, slug, is_primary")
    .eq("business_id", businessId)
    .in("id", normalizedUpdates.map((update) => update.id));
  if (fetchError) throw new Error(fetchError.message);

  if ((existingRows ?? []).length !== normalizedUpdates.length) {
    throw new Error("Some services could not be found for reordering");
  }

  const parentById = new Map(
    normalizedUpdates.map((update) => [update.id, update.parent_service_id] as const),
  );

  for (const update of normalizedUpdates) {
    let currentParentId = update.parent_service_id;
    const visited = new Set<string>([update.id]);
    while (currentParentId) {
      if (visited.has(currentParentId)) {
        throw new Error("Service hierarchy cannot contain cycles");
      }
      visited.add(currentParentId);
      currentParentId = parentById.get(currentParentId) ?? null;
    }
  }

  const existingById = new Map(
    (existingRows ?? []).map((row) => [row.id, row] as const),
  );
  const primaryUpdate = normalizedUpdates.find((update) => existingById.get(update.id)?.is_primary);
  if (primaryUpdate) {
    primaryUpdate.parent_service_id = null;
  }

  const topLevelUpdates = normalizedUpdates
    .filter((update) => !update.parent_service_id)
    .sort((a, b) => {
      const aIsPrimary = existingById.get(a.id)?.is_primary ? 1 : 0;
      const bIsPrimary = existingById.get(b.id)?.is_primary ? 1 : 0;
      if (aIsPrimary !== bIsPrimary) return bIsPrimary - aIsPrimary;
      return a.sort_order - b.sort_order;
    })
    .map((update, index) => ({
      ...update,
      sort_order: index + 1,
    }));
  const topLevelOrderById = new Map(topLevelUpdates.map((update) => [update.id, update.sort_order] as const));

  const childOrderByParentId = new Map<string, Array<typeof normalizedUpdates[number]>>();
  for (const update of normalizedUpdates) {
    if (!update.parent_service_id) continue;
    const siblings = childOrderByParentId.get(update.parent_service_id) ?? [];
    siblings.push(update);
    childOrderByParentId.set(update.parent_service_id, siblings);
  }

  const normalizedById = new Map<string, typeof normalizedUpdates[number]>();
  for (const update of normalizedUpdates) {
    if (!update.parent_service_id) {
      normalizedById.set(update.id, {
        ...update,
        sort_order: topLevelOrderById.get(update.id) ?? update.sort_order,
      });
      continue;
    }

    const siblings = (childOrderByParentId.get(update.parent_service_id) ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((sibling, index) => ({
        ...sibling,
        sort_order: index + 1,
      }));
    for (const sibling of siblings) {
      normalizedById.set(sibling.id, sibling);
    }
  }

  for (const update of normalizedUpdates) {
    const normalizedUpdate = normalizedById.get(update.id) ?? update;
    const { error } = await supabase
      .from("services")
      .update({
        parent_service_id: normalizedUpdate.parent_service_id,
        sort_order: normalizedUpdate.sort_order,
      })
      .eq("id", update.id)
      .eq("business_id", businessId);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/dashboard/services");
  revalidatePath("/services");
  for (const row of existingRows ?? []) {
    await revalidateConfiguredServiceDetailPath(supabase, businessId, row.slug);
  }

  return { success: true, updated: normalizedUpdates.length };
}

export async function setPrimaryServiceAction(serviceId: string | null, isPrimary: boolean) {
  const profile = await assertAdminDashboardAction();
  const supabase = createAdminClient();
  const businessId = profile.business_id || (await resolveCurrentBusinessId());
  if (!businessId) throw new Error("Business context is required");

  const normalizedServiceId = serviceId?.trim() || null;

  if (!normalizedServiceId || !isPrimary) {
    const { error } = await supabase
      .from("services")
      .update({ is_primary: false })
      .eq("business_id", businessId)
      .eq("is_primary", true);
    if (error) throw new Error(error.message);

    revalidatePath("/dashboard/services");
    revalidatePath("/services");
    return { success: true };
  }

  const { data: existingService, error: fetchError } = await supabase
    .from("services")
    .select("id, slug")
    .eq("id", normalizedServiceId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (fetchError) throw new Error(fetchError.message);
  if (!existingService) throw new Error("Service not found");

  const { error: clearPrimaryError } = await supabase
    .from("services")
    .update({ is_primary: false })
    .eq("business_id", businessId)
    .neq("id", normalizedServiceId)
    .eq("is_primary", true);
  if (clearPrimaryError) throw new Error(clearPrimaryError.message);

  const { error: updateError } = await supabase
    .from("services")
    .update({ is_primary: true, parent_service_id: null })
    .eq("id", normalizedServiceId)
    .eq("business_id", businessId);
  if (updateError) throw new Error(updateError.message);

  revalidatePath("/dashboard/services");
  revalidatePath("/services");
  await revalidateConfiguredServiceDetailPath(supabase, businessId, existingService.slug);
  return { success: true };
}

export async function resetAllServiceTemplates() {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const templateContent = createTemplatePageContent("service-content-v1") as unknown as Json;
  const { data: rows, error: fetchError } = await supabase
    .from("services")
    .select("id, slug")
    .eq("business_id", businessId);
  if (fetchError) throw new Error(fetchError.message);

  if (!rows || rows.length === 0) {
    return { success: true, updatedCount: 0 };
  }

  const ids = rows.map((row) => row.id);
  const { error: updateError } = await supabase
    .from("services")
    .update({ content: templateContent } as TablesUpdate<"services">)
    .eq("business_id", businessId)
    .in("id", ids);
  if (updateError) throw new Error(updateError.message);

  revalidatePath("/dashboard/services");
  revalidatePath("/services");
  for (const row of rows) {
    revalidatePath(`/dashboard/services/${row.id}`);
    await revalidateConfiguredServiceDetailPath(supabase, businessId, row.slug);
  }

  return { success: true, updatedCount: ids.length };
}

export async function updateServiceTemplateKeyAction(serviceId: string, templateKey: string) {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const normalizedServiceId = serviceId.trim();
  const normalizedTemplateKey = templateKey.trim();
  if (!normalizedServiceId) throw new Error("Service id is required");
  if (!isAllowedServiceTemplateKey(normalizedTemplateKey)) throw new Error("Invalid service template");

  const { data: existingService, error: fetchError } = await supabase
    .from("services")
    .select("id, slug")
    .eq("id", normalizedServiceId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (fetchError) throw new Error(fetchError.message);
  if (!existingService) throw new Error("Service not found");

  const content = sanitizeTemplatePageContent(
    createTemplatePageContent(normalizedTemplateKey),
  ) as unknown as Json;

  const { error: updateError } = await supabase
    .from("services")
    .update({ content })
    .eq("id", normalizedServiceId)
    .eq("business_id", businessId);
  if (updateError) throw new Error(updateError.message);

  revalidatePath("/dashboard/services");
  revalidatePath(`/dashboard/services/${normalizedServiceId}`);
  revalidatePath("/services");
  await revalidateConfiguredServiceDetailPath(supabase, businessId, existingService.slug);
  return { success: true };
}

// ---- Page CRUD ----

function getPageRevalidationPaths(page: { slug?: string | null; page_kind?: string | null }) {
  const paths = new Set<string>();
  const slug = typeof page.slug === "string" ? page.slug.trim() : "";
  const pageKind = typeof page.page_kind === "string" ? page.page_kind.trim() : "";

  if (slug) paths.add(`/${slug}`);

  switch (pageKind) {
    case "home":
      paths.add("/");
      break;
    case "about":
      paths.add("/about");
      break;
    case "contact":
      paths.add("/contact");
      break;
    case "services_archive":
      paths.add("/services");
      break;
    case "areas_archive":
      paths.add("/service-areas");
      break;
    case "blog_archive":
      paths.add("/blog");
      break;
    default:
      break;
  }

  return Array.from(paths);
}

export async function savePage(formData: FormData) {
  const profile = await assertAdminDashboardAction();
  const supabase = createAdminClient();
  const id = (formData.get("id") as string) || null;
  const businessId =
    profile.business_id ||
    (formData.get("business_id") as string) ||
    (await resolveCurrentBusinessId()) ||
    "";

  if (!businessId) throw new Error("Business context is required");
  const sharedSections = parseSharedSectionsFromFormData(formData);

  const pageTitle = ((formData.get("title") as string) || "").trim();
  const pageSlug =
    ((formData.get("slug") as string) || "").trim() ||
    slugify((formData.get("title") as string) || "");
  let existingPageForUpdate: Pick<Tables<"pages">, "slug" | "show_in_nav" | "sort_order" | "page_kind"> | null = null;
  if (id) {
    const { data: existingPage, error: existingPageError } = await supabase
      .from("pages")
      .select("slug, show_in_nav, sort_order, page_kind")
      .eq("id", id)
      .eq("business_id", businessId)
      .maybeSingle();
    if (existingPageError) throw new Error(existingPageError.message);
    if (!existingPage) throw new Error("Page not found");
    existingPageForUpdate = existingPage as Pick<Tables<"pages">, "slug" | "show_in_nav" | "sort_order" | "page_kind">;
  }
  const inferredPageKind =
    existingPageForUpdate?.page_kind ??
    getRequiredDashboardPageBySlug(pageSlug)?.pageKind ??
    null;
  const isProtectedSystemPage = isProtectedPage({
    slug: existingPageForUpdate?.slug ?? pageSlug,
    page_kind: inferredPageKind,
  });
  const recommendedTemplateKey =
    getRecommendedPageTemplateKeyForPageKind((inferredPageKind as PageKind | null | undefined) ?? null) ??
    getRecommendedPageTemplateKeyForSlug(pageSlug);

  let content: Json = [];
  const contentRaw = (formData.get("content") as string) || "[]";
  try {
    const parsed = JSON.parse(contentRaw) as unknown;
    content =
      (convertBasicBlocksToTemplatePageContent(
        parsed,
        recommendedTemplateKey,
        pageTitle || "Overview",
      ) ??
        sanitizeTemplatePageContent(parsed)) as unknown as Json;
  } catch {
    content = sanitizeTemplatePageContent({
      kind: "template-page",
      version: 1,
      templateKey: recommendedTemplateKey,
      sections: [],
    }) as unknown as Json;
  }

  const page: TablesInsert<"pages"> = {
    business_id: businessId,
    title: pageTitle,
    slug: pageSlug,
    page_kind: inferredPageKind,
    content,
    show_in_nav: isProtectedSystemPage
      ? (existingPageForUpdate?.show_in_nav ?? true)
      : (formData.get("show_in_nav") as string) === "on",
    sort_order: isProtectedSystemPage
      ? (existingPageForUpdate?.sort_order ?? 0)
      : parseNullableNumber(formData.get("sort_order")) ?? 0,
    meta_title: ((formData.get("meta_title") as string) || "").trim() || null,
    meta_description:
      ((formData.get("meta_description") as string) || "").trim() || null,
    og_image_url: ((formData.get("og_image_url") as string) || "").trim() || null,
  };

  if (!page.title) throw new Error("Title is required");
  if (!page.slug) throw new Error("Slug is required");
  await ensureUniqueSlug({
    table: "pages",
    businessId,
    slug: page.slug,
    id,
    label: "Page",
  });

  if (id) {
    const { data, error } = await supabase
      .from("pages")
      .update(page)
      .eq("id", id)
      .eq("business_id", businessId)
      .select("id, slug")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Page not found or is outside the current business context.");
    if (sharedSections) {
      await saveBusinessSharedSections(businessId, sharedSections);
    }

    revalidatePath("/dashboard/pages");
    revalidatePath(`/dashboard/pages/${id}`);
    for (const path of getPageRevalidationPaths(existingPageForUpdate ?? {})) {
      revalidatePath(path);
    }
    for (const path of getPageRevalidationPaths({ slug: data.slug, page_kind: inferredPageKind })) {
      revalidatePath(path);
    }
    return { success: true, id: data.id };
  }

  const { data, error } = await supabase
    .from("pages")
    .insert(page)
    .select("id, slug")
    .single();
  if (error) throw new Error(error.message);
  if (sharedSections) {
    await saveBusinessSharedSections(businessId, sharedSections);
  }

  revalidatePath("/dashboard/pages");
  revalidatePath(`/dashboard/pages/${data.id}`);
  for (const path of getPageRevalidationPaths({ slug: data.slug, page_kind: inferredPageKind })) {
    revalidatePath(path);
  }
  return { success: true, id: data.id };
}

export async function updatePageTemplateKeyAction(pageId: string, templateKey: string) {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const normalizedPageId = pageId.trim();
  const normalizedTemplateKey = templateKey.trim();
  if (!normalizedPageId) throw new Error("Page id is required");
  if (!isAllowedPageTemplateKey(normalizedTemplateKey)) throw new Error("Invalid page template");

  const { data: existingPage, error: fetchError } = await supabase
    .from("pages")
    .select("id, slug, page_kind")
    .eq("id", normalizedPageId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (fetchError) throw new Error(fetchError.message);
  if (!existingPage) throw new Error("Page not found");

  const content = sanitizeTemplatePageContent(
    createTemplatePageContent(normalizedTemplateKey),
  ) as unknown as Json;

  const { error: updateError } = await supabase
    .from("pages")
    .update({ content })
    .eq("id", normalizedPageId)
    .eq("business_id", businessId);
  if (updateError) throw new Error(updateError.message);

  revalidatePath("/dashboard/pages");
  revalidatePath(`/dashboard/pages/${normalizedPageId}`);
  for (const path of getPageRevalidationPaths(existingPage)) {
    revalidatePath(path);
  }
  return { success: true };
}

export async function deletePage(id: string) {
  const profile = await assertAdminDashboardAction();
  const supabase = createAdminClient();
  const businessId = profile.business_id || (await resolveCurrentBusinessId());
  if (!businessId) throw new Error("Business context is required");

  const { data: existing, error: fetchError } = await supabase
    .from("pages")
    .select("slug, page_kind")
    .eq("id", id)
    .eq("business_id", businessId)
    .single();
  if (fetchError) throw new Error(fetchError.message);
  if (isProtectedPage(existing)) throw new Error("This page cannot be deleted.");

  const { error } = await supabase
    .from("pages")
    .delete()
    .eq("id", id)
    .eq("business_id", businessId);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/pages");
  revalidatePath(`/${existing.slug}`);
  return { success: true };
}

export async function deletePagesBulk(ids: string[]) {
  const profile = await assertAdminDashboardAction();
  const supabase = createAdminClient();
  const businessId = profile.business_id || (await resolveCurrentBusinessId());
  if (!businessId) throw new Error("Business context is required");

  const uniqueIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
  if (uniqueIds.length === 0) return { success: true, deletedCount: 0 };

  const { data: existing, error: fetchError } = await supabase
    .from("pages")
    .select("id, slug, page_kind")
    .eq("business_id", businessId)
    .in("id", uniqueIds);
  if (fetchError) throw new Error(fetchError.message);

  const existingPages = (existing ?? []).filter((page) => !isProtectedPage(page));
  const existingIds = existingPages.map((page) => page.id);
  if (existingIds.length === 0) return { success: true, deletedCount: 0 };

  const { error: deleteError } = await supabase
    .from("pages")
    .delete()
    .eq("business_id", businessId)
    .in("id", existingIds);
  if (deleteError) throw new Error(deleteError.message);

  revalidatePath("/dashboard/pages");
  for (const page of existingPages) {
    revalidatePath(`/${page.slug}`);
  }

  return { success: true, deletedCount: existingIds.length };
}

export async function saveFormDefinitionAction(formData: FormData) {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const id = ((formData.get("id") as string) || "").trim() || null;
  const name = ((formData.get("name") as string) || "").trim();
  if (!name) throw new Error("Form name is required");

  const explicitSlug = ((formData.get("slug") as string) || "").trim();
  const slug = explicitSlug || slugify(name);
  if (!slug) throw new Error("Form slug is required");

  const fieldsRaw = ((formData.get("fields") as string) || "").trim() || "[]";
  let fieldsJson: Json;
  try {
    const parsed = JSON.parse(fieldsRaw) as unknown;
    if (!Array.isArray(parsed)) throw new Error("Form fields must be an array");
    fieldsJson = parsed as Json;
  } catch (error) {
    if (error instanceof Error && error.message === "Form fields must be an array") throw error;
    throw new Error("Form fields JSON is invalid");
  }

  const payload: TablesInsert<"forms"> = {
    business_id: businessId,
    name,
    slug,
    description: ((formData.get("description") as string) || "").trim() || null,
    auto_response_template_id: ((formData.get("auto_response_template_id") as string) || "").trim() || null,
    thank_you_message: ((formData.get("thank_you_message") as string) || "").trim() || null,
    fields: fieldsJson,
  };

  if (id) {
    const { data, error } = await supabase
      .from("forms")
      .update(payload as TablesUpdate<"forms">)
      .eq("id", id)
      .eq("business_id", businessId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    revalidatePath("/dashboard/forms");
    return { success: true, form: data as Tables<"forms"> };
  }

  const { data, error } = await supabase
    .from("forms")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/forms");
  return { success: true, form: data as Tables<"forms"> };
}

export async function deleteFormDefinitionAction(id: string) {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const { error } = await supabase
    .from("forms")
    .delete()
    .eq("id", id)
    .eq("business_id", businessId);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/forms");
  return { success: true };
}

export async function deleteFormsBulk(ids: string[]) {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const uniqueIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
  if (uniqueIds.length === 0) return { success: true, deletedCount: 0 };

  const { data: existing, error: fetchError } = await supabase
    .from("forms")
    .select("id")
    .eq("business_id", businessId)
    .in("id", uniqueIds);
  if (fetchError) throw new Error(fetchError.message);

  const existingIds = (existing ?? []).map((row) => row.id);
  if (existingIds.length === 0) return { success: true, deletedCount: 0 };

  const { error: deleteError } = await supabase
    .from("forms")
    .delete()
    .eq("business_id", businessId)
    .in("id", existingIds);
  if (deleteError) throw new Error(deleteError.message);

  revalidatePath("/dashboard/forms");
  return { success: true, deletedCount: existingIds.length };
}

// ---- FAQ CRUD ----

export async function saveFaq(formData: FormData) {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const id = (formData.get("id") as string) || null;
  const businessId =
    (formData.get("business_id") as string) || (await resolveCurrentBusinessId()) || "";
  if (!businessId) throw new Error("Business context is required");

  const linkedRaw = (formData.get("linked_service_ids") as string) || "[]";
  let linkedServiceIds: string[] = [];
  try {
    const parsed = JSON.parse(linkedRaw) as unknown;
    linkedServiceIds = Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    linkedServiceIds = [];
  }

  const faq: TablesInsert<"faqs"> = {
    business_id: businessId,
    question: ((formData.get("question") as string) || "").trim(),
    answer: ((formData.get("answer") as string) || "").trim(),
    is_global: (formData.get("is_global") as string) === "on",
    schema_markup: true,
    page_type: ((formData.get("page_type") as string) || "").trim() || null,
    page_id: ((formData.get("page_id") as string) || "").trim() || null,
  };

  if (!faq.question) throw new Error("Question is required");
  if (!faq.answer) throw new Error("Answer is required");

  let faqId = id;
  if (id) {
    const { data, error } = await supabase
      .from("faqs")
      .update(faq)
      .eq("id", id)
      .eq("business_id", businessId)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    faqId = data.id;
  } else {
    const { data, error } = await supabase
      .from("faqs")
      .insert(faq)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    faqId = data.id;
  }

  if (!faqId) throw new Error("Unable to save FAQ");

  const { error: deleteLinksError } = await supabase
    .from("faq_services")
    .delete()
    .eq("faq_id", faqId);
  if (deleteLinksError) throw new Error(deleteLinksError.message);

  if (linkedServiceIds.length > 0) {
    const linkRows: TablesInsert<"faq_services">[] = linkedServiceIds.map((serviceId) => ({
      faq_id: faqId as string,
      service_id: serviceId,
    }));
    const { error: insertLinksError } = await supabase
      .from("faq_services")
      .insert(linkRows);
    if (insertLinksError) throw new Error(insertLinksError.message);
  }

  revalidatePath("/dashboard/faqs");
  revalidatePath(`/dashboard/faqs/${faqId}`);
  revalidatePath("/");
  revalidatePath("/services");
  revalidatePath("/service-areas");
  return { success: true, id: faqId };
}

export async function deleteFaq(id: string) {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const { error: deleteLinksError } = await supabase
    .from("faq_services")
    .delete()
    .eq("faq_id", id);
  if (deleteLinksError) throw new Error(deleteLinksError.message);

  const { error } = await supabase
    .from("faqs")
    .delete()
    .eq("id", id)
    .eq("business_id", businessId);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/faqs");
  revalidatePath("/");
  revalidatePath("/services");
  revalidatePath("/service-areas");
  return { success: true };
}

export async function deleteFaqsBulk(ids: string[]) {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const uniqueIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
  if (uniqueIds.length === 0) return { success: true, deletedCount: 0 };

  const { data: existingFaqs, error: fetchError } = await supabase
    .from("faqs")
    .select("id")
    .eq("business_id", businessId)
    .in("id", uniqueIds);
  if (fetchError) throw new Error(fetchError.message);

  const existingIds = (existingFaqs ?? []).map((faq) => faq.id);
  if (existingIds.length === 0) return { success: true, deletedCount: 0 };

  const { error: deleteLinksError } = await supabase
    .from("faq_services")
    .delete()
    .in("faq_id", existingIds);
  if (deleteLinksError) throw new Error(deleteLinksError.message);

  const { error } = await supabase
    .from("faqs")
    .delete()
    .eq("business_id", businessId)
    .in("id", existingIds);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/faqs");
  revalidatePath("/");
  revalidatePath("/services");
  revalidatePath("/service-areas");
  for (const id of existingIds) {
    revalidatePath(`/dashboard/faqs/${id}`);
  }
  return { success: true, deletedCount: existingIds.length };
}

// ---- Area CRUD ----

export async function saveArea(formData: FormData) {
  const profile = await assertAdminDashboardAction();
  const supabase = createAdminClient();
  const id = (formData.get("id") as string) || null;
  const businessId =
    profile.business_id ||
    (formData.get("business_id") as string) ||
    (await resolveCurrentBusinessId()) ||
    "";
  if (!businessId) throw new Error("Business context is required");
  const sharedSections = parseSharedSectionsFromFormData(formData);

  const areaName = ((formData.get("name") as string) || "").trim();
  if (!areaName) throw new Error("Name is required");

  console.log("[saveArea] start", {
    id,
    profileBusinessId: profile.business_id,
    formBusinessId: (formData.get("business_id") as string) || "",
    resolvedBusinessId: businessId,
    areaName,
  });

  const explicitSlug = ((formData.get("slug") as string) || "").trim();
  const businessContext = await loadBusinessTemplateContext(supabase, businessId);
  const AreaDefaultTitleTemplate = readSettingsString(
    businessContext.settings,
    "area_default_title_template",
  ) || DEFAULT_AREA_META_TITLE_TEMPLATE;
  const areaDefaultMetaDescriptionTemplate = readSettingsString(
    businessContext.settings,
    "area_default_meta_description_template",
  ) || DEFAULT_AREA_META_DESCRIPTION_TEMPLATE;
  const areaDefaultH1Template = readSettingsString(
    businessContext.settings,
    "area_default_h1_template",
  ) || DEFAULT_AREA_H1_TEMPLATE;
  const AreaDefaultUrlTemplate = readSettingsString(
    businessContext.settings,
    "area_default_url_template",
  ) || DEFAULT_AREA_URL_TEMPLATE;
  const areaTokens = {
    ...businessContext.tokens,
    area: areaName,
    location: areaName,
  };
  const autoSlugFromName = slugify(areaName);
  const slugCanUseTemplate = !explicitSlug || explicitSlug === autoSlugFromName;
  const renderedSlugFromTemplate =
    slugCanUseTemplate && AreaDefaultUrlTemplate
      ? slugify(interpolateTemplateString(AreaDefaultUrlTemplate, areaTokens))
      : "";
  const resolvedSlug = renderedSlugFromTemplate || explicitSlug || autoSlugFromName;
  console.log("[saveArea] slug", {
    explicitSlug,
    autoSlugFromName,
    renderedSlugFromTemplate,
    resolvedSlug,
    slugCanUseTemplate,
  });

  let content: Json = [];
  const contentRaw = (formData.get("content") as string) || "[]";
  try {
    const parsed = JSON.parse(contentRaw) as unknown;
    content =
      (convertBasicBlocksToTemplatePageContent(
        parsed,
        "area-content-v1",
        `Services in ${areaName || "Area"}`,
      ) ??
        sanitizeTemplatePageContent(parsed)) as unknown as Json;
  } catch {
    content = sanitizeTemplatePageContent({
      kind: "template-page",
      version: 1,
      templateKey: "area-content-v1",
      sections: [],
    }) as unknown as Json;
  }
  if (areaDefaultH1Template) {
    content = applyHeadingToPrimaryTemplateSection(
      content,
      ["area-content-v1"],
      areaDefaultH1Template,
      areaTokens,
    );
  }

  const area: TablesInsert<"areas"> = {
    business_id: businessId,
    name: areaName,
    slug: resolvedSlug,
    icon: ((formData.get("icon") as string) || "").trim() || null,
    content,
    featured_image_url:
      ((formData.get("featured_image_url") as string) || "").trim() || null,
    meta_title:
      ((formData.get("meta_title") as string) || "").trim() ||
      (AreaDefaultTitleTemplate
        ? interpolateTemplateString(AreaDefaultTitleTemplate, areaTokens).trim()
        : "") ||
      null,
    meta_description:
      ((formData.get("meta_description") as string) || "").trim() ||
      (areaDefaultMetaDescriptionTemplate
        ? interpolateTemplateString(areaDefaultMetaDescriptionTemplate, areaTokens).trim()
        : "") ||
      null,
  };

  if (!area.slug) throw new Error("Slug is required");
  await ensureUniqueSlug({
    table: "areas",
    businessId,
    slug: area.slug,
    id,
    label: "Area",
  });

  let areaId = id;
  let savedSlug = resolvedSlug;
  if (id) {
    const { data, error } = await supabase
      .from("areas")
      .update(area)
      .eq("id", id)
      .eq("business_id", businessId)
      .select("id, slug")
      .maybeSingle();
    if (error) {
      console.error("[saveArea] update failed", {
        id,
        businessId,
        slug: area.slug,
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      throw new Error(error.message);
    }
    if (!data) {
      throw new Error("Area not found or is outside the current business context.");
    }
    console.log("[saveArea] update succeeded", { id: data.id, slug: data.slug, businessId });
    areaId = data.id;
    savedSlug = data.slug;
  } else {
    const { data, error } = await supabase
      .from("areas")
      .insert(area)
      .select("id, slug")
      .single();
    if (error) {
      console.error("[saveArea] insert failed", {
        businessId,
        slug: area.slug,
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      throw new Error(error.message);
    }
    console.log("[saveArea] insert succeeded", { id: data.id, slug: data.slug, businessId });
    areaId = data.id;
    savedSlug = data.slug;
  }

  if (!areaId) throw new Error("Unable to save Area");
  if (sharedSections) {
    await saveBusinessSharedSections(businessId, sharedSections);
  }

  console.log("[saveArea] revalidate", { areaId, savedSlug });

  revalidatePath("/dashboard/areas");
  revalidatePath(`/dashboard/areas/${areaId}`);
  revalidatePath("/service-areas");
  await revalidateConfiguredAreaDetailPath(supabase, businessId, savedSlug);
  return { success: true, id: areaId };
}

export async function deleteArea(id: string) {
  const profile = await assertAdminDashboardAction();
  const supabase = createAdminClient();
  const businessId = profile.business_id || (await resolveCurrentBusinessId());
  if (!businessId) throw new Error("Business context is required");

  const { error } = await supabase
    .from("areas")
    .delete()
    .eq("id", id)
    .eq("business_id", businessId);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/areas");
  revalidatePath("/service-areas");
  return { success: true };
}

export async function deleteAreasBulk(ids: string[]) {
  const profile = await assertAdminDashboardAction();
  const supabase = createAdminClient();
  const businessId = profile.business_id || (await resolveCurrentBusinessId());
  if (!businessId) throw new Error("Business context is required");

  const uniqueIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
  if (uniqueIds.length === 0) return { success: true, deletedCount: 0 };

  const { data: existingAreas, error: fetchError } = await supabase
    .from("areas")
    .select("id")
    .eq("business_id", businessId)
    .in("id", uniqueIds);
  if (fetchError) throw new Error(fetchError.message);

  const existingIds = (existingAreas ?? []).map((area) => area.id);
  if (existingIds.length === 0) return { success: true, deletedCount: 0 };

  const { error } = await supabase
    .from("areas")
    .delete()
    .eq("business_id", businessId)
    .in("id", existingIds);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/areas");
  revalidatePath("/service-areas");
  for (const id of existingIds) {
    revalidatePath(`/dashboard/areas/${id}`);
  }
  return { success: true, deletedCount: existingIds.length };
}

export async function resetAllAreaTemplates() {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const templateContent = createTemplatePageContent("area-content-v1") as unknown as Json;
  const { data: rows, error: fetchError } = await supabase
    .from("areas")
    .select("id, slug")
    .eq("business_id", businessId);
  if (fetchError) throw new Error(fetchError.message);

  if (!rows || rows.length === 0) {
    return { success: true, updatedCount: 0 };
  }

  const ids = rows.map((row) => row.id);
  const { error: updateError } = await supabase
    .from("areas")
    .update({ content: templateContent } as TablesUpdate<"areas">)
    .eq("business_id", businessId)
    .in("id", ids);
  if (updateError) throw new Error(updateError.message);

  revalidatePath("/dashboard/areas");
  revalidatePath("/service-areas");
  for (const row of rows) {
    revalidatePath(`/dashboard/areas/${row.id}`);
    await revalidateConfiguredAreaDetailPath(supabase, businessId, row.slug);
  }

  return { success: true, updatedCount: ids.length };
}

export async function updateAreaTemplateKeyAction(areaId: string, templateKey: string) {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const normalizedAreaId = areaId.trim();
  const normalizedTemplateKey = templateKey.trim();
  if (!normalizedAreaId) throw new Error("Area id is required");
  if (!isAllowedAreaTemplateKey(normalizedTemplateKey)) throw new Error("Invalid area template");

  const { data: existingArea, error: fetchError } = await supabase
    .from("areas")
    .select("id, slug")
    .eq("id", normalizedAreaId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (fetchError) throw new Error(fetchError.message);
  if (!existingArea) throw new Error("Area not found");

  const content = sanitizeTemplatePageContent(
    createTemplatePageContent(normalizedTemplateKey),
  ) as unknown as Json;

  const { error: updateError } = await supabase
    .from("areas")
    .update({ content })
    .eq("id", normalizedAreaId)
    .eq("business_id", businessId);
  if (updateError) throw new Error(updateError.message);

  revalidatePath("/dashboard/areas");
  revalidatePath(`/dashboard/areas/${normalizedAreaId}`);
  revalidatePath("/service-areas");
  await revalidateConfiguredAreaDetailPath(supabase, businessId, existingArea.slug);
  return { success: true };
}

// ---- Job CRUD ----

export async function saveJob(formData: FormData) {
  const supabase = await createClient();

  const id = (formData.get("id") as string) || null;
  const businessId =
    (formData.get("business_id") as string) || (await resolveCurrentBusinessId()) || "";
  if (!businessId) throw new Error("Business context is required");

  const rawJobTeamAssignments = ((formData.get("job_team_assignments") as string) || "").trim();
  let parsedJobTeamAssignments: Array<{ team_member_id: string; hours_worked: number | null }> = [];
  if (rawJobTeamAssignments) {
    try {
      const parsed = JSON.parse(rawJobTeamAssignments) as unknown;
      if (!Array.isArray(parsed)) throw new Error("Job team assignments must be an array");

      const seen = new Set<string>();
      parsedJobTeamAssignments = parsed
        .map((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return null;
          const row = item as Record<string, unknown>;
          const teamMemberId = String(row.team_member_id ?? "").trim();
          if (!teamMemberId || seen.has(teamMemberId)) return null;
          seen.add(teamMemberId);

          const rawHours = row.hours_worked;
          let hoursWorked: number | null = null;
          if (rawHours !== null && rawHours !== undefined && String(rawHours).trim() !== "") {
            const numeric = Number(rawHours);
            if (!Number.isFinite(numeric) || numeric < 0) {
              throw new Error("Hours worked must be a non-negative number");
            }
            hoursWorked = Math.round(numeric * 100) / 100;
          }

          return { team_member_id: teamMemberId, hours_worked: hoursWorked };
        })
        .filter((row): row is { team_member_id: string; hours_worked: number | null } => Boolean(row));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid job team assignments";
      throw new Error(message);
    }
  }

  if (!parsedJobTeamAssignments.length) {
    const fallbackAssignedTeamMemberId = ((formData.get("assigned_team_member_id") as string) || "").trim();
    if (fallbackAssignedTeamMemberId) {
      parsedJobTeamAssignments = [{ team_member_id: fallbackAssignedTeamMemberId, hours_worked: null }];
    }
  }

  const primaryAssignedTeamMemberId = parsedJobTeamAssignments[0]?.team_member_id ?? null;

  const job: TablesInsert<"jobs"> = {
    title: ((formData.get("title") as string) || "").trim(),
    description: ((formData.get("description") as string) || "").trim() || null,
    status: (formData.get("status") as any) || "scheduled",
    contact_id: ((formData.get("contact_id") as string) || "").trim(),
    service_id: ((formData.get("service_id") as string) || "").trim() || null,
    assigned_to: null,
    assigned_team_member_id: primaryAssignedTeamMemberId,
    scheduled_start: ((formData.get("scheduled_start") as string) || "").trim() || null,
    scheduled_end: ((formData.get("scheduled_end") as string) || "").trim() || null,
    address_line1: ((formData.get("address_line1") as string) || "").trim() || null,
    address_line2: ((formData.get("address_line2") as string) || "").trim() || null,
    city: ((formData.get("city") as string) || "").trim() || null,
    state: ((formData.get("state") as string) || "").trim() || null,
    zip: ((formData.get("zip") as string) || "").trim() || null,
    priority: (formData.get("priority") as any) || "normal",
    internal_notes: ((formData.get("internal_notes") as string) || "").trim() || null,
    business_id: businessId,
  };

  if (!job.title) throw new Error("Title is required");
  if (!job.contact_id) throw new Error("Contact is required");
  if (parsedJobTeamAssignments.length) {
    const teamMemberIds = parsedJobTeamAssignments.map((row) => row.team_member_id);
    const { data: teamMembers, error: teamMembersError } = await supabase
      .from("team_members")
      .select("id")
      .in("id", teamMemberIds)
      .eq("business_id", businessId);
    if (teamMembersError) throw new Error(teamMembersError.message);

    const validIds = new Set((teamMembers ?? []).map((row) => row.id));
    const invalidSelection = teamMemberIds.find((id) => !validIds.has(id));
    if (invalidSelection) throw new Error("One or more assigned team members are invalid");
  }

  let previousStatus: Tables<"jobs">["status"] | null = null;
  let savedJobId = id;
  if (id) {
    const { data: existing, error: existingError } = await supabase
      .from("jobs")
      .select("status")
      .eq("id", id)
      .eq("business_id", businessId)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    previousStatus = existing?.status ?? null;
  }

  if (id) {
    const { error } = await supabase
      .from("jobs")
      .update(job)
      .eq("id", id)
      .eq("business_id", businessId);
    if (error) throw new Error(error.message);
    revalidatePath(`/dashboard/jobs/${id}`);
  } else {
    const { data, error } = await supabase
      .from("jobs")
      .insert(job)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    savedJobId = data.id;
    revalidatePath(`/dashboard/jobs/${data.id}`);
  }

  if (savedJobId) {
    const { error: clearAssignmentsError } = await supabase
      .from("job_team_members")
      .delete()
      .eq("business_id", businessId)
      .eq("job_id", savedJobId);
    if (clearAssignmentsError) throw new Error(clearAssignmentsError.message);

    const teamAssignmentsToSave = parsedJobTeamAssignments.map((row) => ({
      business_id: businessId,
      job_id: savedJobId!,
      team_member_id: row.team_member_id,
      hours_worked: row.hours_worked,
      updated_at: new Date().toISOString(),
    }));

    if (teamAssignmentsToSave.length) {
      const { error: insertAssignmentsError } = await supabase
        .from("job_team_members")
        .insert(teamAssignmentsToSave);
      if (insertAssignmentsError) throw new Error(insertAssignmentsError.message);
    }
  }

  if (savedJobId && job.status === "completed" && previousStatus !== "completed") {
    try {
      await sendJobReviewRequestEmail({
        supabase,
        businessId,
        jobId: savedJobId,
        contactId: job.contact_id,
        jobTitle: job.title,
      });
    } catch (reviewRequestError) {
      console.error("Unable to send review request email:", reviewRequestError);
    }
  }

  revalidatePath("/dashboard/jobs");
  return { success: true };
}

async function sendJobReviewRequestEmail(options: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  businessId: string;
  jobId: string;
  contactId: string;
  jobTitle: string;
}) {
  const { supabase, businessId, jobId, contactId, jobTitle } = options;

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("id, email, first_name, last_name")
    .eq("id", contactId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (contactError) throw new Error(contactError.message);
  if (!contact?.email) return;

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("name, settings")
    .eq("id", businessId)
    .maybeSingle();
  if (businessError) throw new Error(businessError.message);

  const { data: seoSettings, error: seoSettingsError } = await supabase
    .from("seo_settings")
    .select("google_business_profile_url")
    .eq("business_id", businessId)
    .maybeSingle();
  if (seoSettingsError) throw new Error(seoSettingsError.message);

  const reviewUrl =
    seoSettings?.google_business_profile_url?.trim() ||
    process.env.GOOGLE_REVIEW_REQUEST_URL?.trim() ||
    "";
  if (!reviewUrl) return;

  const { data: existingReviewEmail, error: existingEmailError } = await supabase
    .from("email_log")
    .select("id")
    .eq("business_id", businessId)
    .eq("related_type", "job_review_request")
    .eq("related_id", jobId)
    .eq("to_email", contact.email)
    .limit(1)
    .maybeSingle();
  if (existingEmailError) throw new Error(existingEmailError.message);
  if (existingReviewEmail) return;

  const customerName =
    [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim() || "there";
  const businessName = business?.name ?? "our team";

  const fallbackSubject = `How did we do on your ${jobTitle} project?`;
  const fallbackText = `Hi ${customerName}, thanks for choosing ${businessName}. If you have a moment, please leave us a quick Google review: ${reviewUrl}`;
  const fallbackHtml = `<p>Hi ${customerName},</p><p>Thanks for choosing ${businessName}.</p><p>If you have a moment, please leave us a quick Google review:</p><p><a href="${reviewUrl}">${reviewUrl}</a></p>`;

  await sendAutomationRuleEmails({
    supabase,
    businessId,
    triggerEvent: "review_request",
    fallbackRecipients: [{ email: contact.email, contactId: contact.id }],
    relatedType: "job_review_request",
    relatedId: jobId,
    templateVariables: {
      contact_name: customerName,
      contact_first_name: contact.first_name || customerName,
      contact_last_name: contact.last_name || "",
      contact_email: contact.email,
      business_name: businessName,
      review_link: reviewUrl,
      job_title: jobTitle,
    },
    fallbackSubject,
    fallbackHtml,
    fallbackText,
  });
}

export async function deleteJob(id: string) {
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const { error } = await supabase
    .from("jobs")
    .delete()
    .eq("id", id)
    .eq("business_id", businessId);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/jobs");
  revalidatePath(`/dashboard/jobs/${id}`);
  return { success: true };
}

// ---- Contact CRUD ----

export async function saveContact(formData: FormData) {
  const supabase = await createClient();

  const id = (formData.get("id") as string) || null;
  const businessId =
    (formData.get("business_id") as string) || (await resolveCurrentBusinessId()) || "";
  if (!businessId) throw new Error("Business context is required");
  const {
    data: { user: actorUser },
  } = await supabase.auth.getUser();
  const actorUserId = actorUser?.id ?? null;

  const quality = ((formData.get("quality") as string) || "").trim().toLowerCase() || "new";
  const allowedQualities = new Set([
    "new",
    "attempted",
    "contacted",
    "unqualified",
    "lost",
    "spam",
    "qualified",
    "nurture",
    "hot",
  ]);
  if (!allowedQualities.has(quality)) {
    throw new Error("Invalid contact stage");
  }

  const contact: TablesInsert<"contacts"> = {
    first_name: ((formData.get("first_name") as string) || "").trim() || null,
    last_name: ((formData.get("last_name") as string) || "").trim() || null,
    email: ((formData.get("email") as string) || "").trim() || null,
    phone: ((formData.get("phone") as string) || "").trim() || null,
    quality,
    address_line1: ((formData.get("address_line1") as string) || "").trim() || null,
    address_line2: ((formData.get("address_line2") as string) || "").trim() || null,
    city: ((formData.get("city") as string) || "").trim() || null,
    state: ((formData.get("state") as string) || "").trim() || null,
    zip: ((formData.get("zip") as string) || "").trim() || null,
    source: (formData.get("source") as any) || "manual",
    status: (formData.get("status") as any) || "lead",
    notes: ((formData.get("notes") as string) || "").trim() || null,
    business_id: businessId,
    tags: null,
  };
  const rawActivityEntries = ((formData.get("contact_activity_entries") as string) || "").trim();
  let activityEntries: Array<{ type: "called" | "texted" | "emailed" | "noted"; note: string; pinned: boolean; occurredAt: string | null }> = [];
  if (rawActivityEntries) {
    try {
      const parsed = JSON.parse(rawActivityEntries);
      if (Array.isArray(parsed)) {
        activityEntries = parsed
          .map((entry) => {
            if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
            const row = entry as Record<string, unknown>;
            const type = typeof row.type === "string" ? row.type.trim().toLowerCase() : "";
            const note = typeof row.note === "string" ? row.note.trim() : "";
            const pinned = row.pinned === true;
            const occurredAt = typeof row.occurredAt === "string" ? row.occurredAt.trim() || null : null;
            if (!note) return null;
            if (!["called", "texted", "emailed", "noted"].includes(type)) return null;
            return { type: type as "called" | "texted" | "emailed" | "noted", note, pinned, occurredAt };
          })
          .filter((entry): entry is { type: "called" | "texted" | "emailed" | "noted"; note: string; pinned: boolean; occurredAt: string | null } => !!entry);
      }
    } catch {
      throw new Error("Invalid contact activity JSON");
    }
  }

  if (!contact.first_name && !contact.last_name) {
    throw new Error("At least a first or last name is required");
  }

  const existingContact = id
    ? await (async () => {
        const { data, error } = await supabase
          .from("contacts")
          .select("id, status, qbo_customer_id")
          .eq("id", id)
          .eq("business_id", businessId)
          .maybeSingle();
        if (error) throw new Error(error.message);
        return data;
      })()
    : null;

  let savedContactId = id;

  if (id) {
    const { error } = await supabase
      .from("contacts")
      .update(contact)
      .eq("id", id)
      .eq("business_id", businessId);
    if (error) throw new Error(error.message);
    revalidateContactDetailPaths(id);

    if (savedContactId && existingContact?.qbo_customer_id) {
      try {
        await syncQuickBooksCustomerForContact(savedContactId);
      } catch (quickBooksError) {
        await recordQuickBooksSyncError(businessId, quickBooksError);
        console.error("Failed to sync updated contact to QuickBooks", quickBooksError);
      }
    }
  } else {
    const { data, error } = await supabase
      .from("contacts")
      .insert(contact)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    savedContactId = data.id;
    revalidateContactDetailPaths(data.id);
  }

  if (savedContactId && activityEntries.length > 0) {
    for (const entry of activityEntries) {
      await logActivity(
        businessId,
        `contact_${entry.type}`,
        "contact",
        savedContactId,
        {
          note: entry.note,
          type: entry.type,
          pinned: entry.pinned,
          occurred_at: entry.occurredAt,
        } as Json,
        { userId: actorUserId },
      );
    }
  }

  if (savedContactId) {
    try {
      await reconcileFormSubmissionsForContact({
        admin: createAdminClient(),
        businessId,
        contactId: savedContactId,
        email: contact.email,
        phone: contact.phone,
        firstName: contact.first_name,
        lastName: contact.last_name,
        addressLine1: contact.address_line1,
        city: contact.city,
      });
    } catch (reconcileError) {
      console.error("Unable to reconcile website form submissions for contact:", reconcileError);
    }
  }

  const contactName =
    [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim() ||
    contact.email ||
    "Contact";

  try {
    if (!id && savedContactId && contact.status === "lead") {
      const context = await getBusinessNotificationContext(supabase, businessId);
      const submittedAt = formatSubmittedAt(new Date().toISOString());
      await sendAutomationRuleEmails({
        supabase,
        businessId,
        triggerEvent: "lead_notification",
        fallbackRecipients: [],
        relatedType: "internal_notification",
        relatedId: savedContactId,
        templateVariables: {
          common: {
            contact_name: contactName,
            contact_first_name: contact.first_name || contactName,
            contact_last_name: contact.last_name || "",
            contact_address: contact.address_line1 || "-",
            contact_email: contact.email || "-",
            contact_phone: contact.phone || "-",
            contact_message: typeof contact.notes === "string" && contact.notes.trim() ? contact.notes.trim() : "-",
            contact_files: "No files",
            business_name: context.businessName,
            form_type: contact.source ?? "-",
            submitted_at: submittedAt,
          },
        },
        fallbackSubject: `New lead: ${contactName}`,
        fallbackHtml: toNotificationHtml([
          `A new lead was created for ${contactName}.`,
          contact.email ? `Email: ${contact.email}` : "Email: -",
          contact.phone ? `Phone: ${contact.phone}` : "Phone: -",
          contact.address_line1 ? `Address: ${contact.address_line1}` : "Address: -",
          `Submitted: ${submittedAt}`,
        ]),
        fallbackText: [
          `A new lead was created for ${contactName}.`,
          contact.email ? `Email: ${contact.email}` : "Email: -",
          contact.phone ? `Phone: ${contact.phone}` : "Phone: -",
          contact.address_line1 ? `Address: ${contact.address_line1}` : "Address: -",
          `Submitted: ${submittedAt}`,
        ].join("\n\n"),
        activityAction: "notification.new_lead",
        activityEntityType: "contact",
        activityEntityId: savedContactId,
        activitySubject: `New lead: ${contactName}`,
        actorUserId,
      });
    }

    if (savedContactId && contact.status === "prospect" && existingContact?.status !== "prospect") {
      await sendAdminNotification({
        supabase,
        businessId,
        settingKey: "notification_new_prospect_email",
        entityType: "contact",
        entityId: savedContactId,
        activityAction: "notification.new_prospect",
        subject: `New prospect: ${contactName}`,
        actorUserId,
        textLines: [
          `${contactName} is now marked as a prospect.`,
          contact.email ? `Email: ${contact.email}` : "Email: -",
          contact.phone ? `Phone: ${contact.phone}` : "Phone: -",
        ],
      });
    }

    if (savedContactId && contact.status === "customer" && existingContact?.status !== "customer") {
      await sendAdminNotification({
        supabase,
        businessId,
        settingKey: "notification_new_customer_email",
        entityType: "contact",
        entityId: savedContactId,
        activityAction: "notification.new_customer",
        subject: `New customer: ${contactName}`,
        actorUserId,
        textLines: [
          `${contactName} is now marked as a customer.`,
          contact.email ? `Email: ${contact.email}` : "Email: -",
          contact.phone ? `Phone: ${contact.phone}` : "Phone: -",
        ],
      });
    }
  } catch (notificationError) {
    console.error("Failed to process contact notifications:", notificationError);
  }

  revalidatePath("/dashboard/contacts");
  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard/prospects");
  revalidatePath("/dashboard/customers");
  return { success: true };
}

export async function markAllLeadNotificationsReadAction() {
  const businessId = await getCurrentDashboardBusinessId();
  if (!businessId) {
    throw new Error("Business context is required");
  }

  await markAllLeadNotificationsReadForBusiness();
  revalidateDashboardShell();
}

export async function saveContactActivityEntries(formData: FormData) {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const {
    data: { user: actorUser },
  } = await supabase.auth.getUser();
  const actorUserId = actorUser?.id ?? null;

  const contactId = ((formData.get("contact_id") as string) || "").trim();
  const businessId =
    ((formData.get("business_id") as string) || "").trim() || (await resolveCurrentBusinessId()) || "";
  const rawActivityEntries = ((formData.get("contact_activity_entries") as string) || "").trim();

  if (!businessId) throw new Error("Business context is required");
  if (!contactId) throw new Error("Contact is required");
  if (!rawActivityEntries) throw new Error("No activity entries to save");

  const { data: existingContact, error: contactError } = await supabase
    .from("contacts")
    .select("id")
    .eq("id", contactId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (contactError) throw new Error(contactError.message);
  if (!existingContact) throw new Error("Contact not found");

  let activityEntries: Array<{ type: "called" | "texted" | "emailed" | "noted"; note: string; pinned: boolean; occurredAt: string | null }> = [];
  try {
    const parsed = JSON.parse(rawActivityEntries);
    if (Array.isArray(parsed)) {
      activityEntries = parsed
        .map((entry) => {
          if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
          const row = entry as Record<string, unknown>;
          const type = typeof row.type === "string" ? row.type.trim().toLowerCase() : "";
          const note = typeof row.note === "string" ? row.note.trim() : "";
          const pinned = row.pinned === true;
          const occurredAt = typeof row.occurredAt === "string" ? row.occurredAt.trim() || null : null;
          if (!note) return null;
          if (!["called", "texted", "emailed", "noted"].includes(type)) return null;
          return { type: type as "called" | "texted" | "emailed" | "noted", note, pinned, occurredAt };
        })
        .filter((entry): entry is { type: "called" | "texted" | "emailed" | "noted"; note: string; pinned: boolean; occurredAt: string | null } => !!entry);
    }
  } catch {
    throw new Error("Invalid contact activity JSON");
  }

  if (activityEntries.length === 0) {
    throw new Error("Add at least one activity note before saving");
  }

  for (const entry of activityEntries) {
    await logActivity(
      businessId,
      `contact_${entry.type}`,
      "contact",
      contactId,
      {
        note: entry.note,
        type: entry.type,
        pinned: entry.pinned,
        occurred_at: entry.occurredAt,
      } as Json,
      { userId: actorUserId },
    );
  }

  revalidateContactDetailPaths(contactId);
  revalidatePath("/dashboard/contacts");
  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard/prospects");
  revalidatePath("/dashboard/customers");

  return { success: true };
}

export async function toggleContactActivityPinned(activityId: string, pinned: boolean) {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const businessId = (await resolveCurrentBusinessId()) || "";
  if (!businessId) throw new Error("Business context is required");

  const { data: existingActivity, error: existingActivityError } = await supabase
    .from("activity_log")
    .select("id, entity_id, metadata")
    .eq("id", activityId)
    .eq("business_id", businessId)
    .eq("entity_type", "contact")
    .maybeSingle();

  if (existingActivityError) throw new Error(existingActivityError.message);
  if (!existingActivity) throw new Error("Activity entry not found");

  const currentMetadata =
    existingActivity.metadata && typeof existingActivity.metadata === "object" && !Array.isArray(existingActivity.metadata)
      ? (existingActivity.metadata as Record<string, Json>)
      : {};

  const { error } = await supabase
    .from("activity_log")
    .update({
      metadata: {
        ...currentMetadata,
        pinned,
      } as Json,
    })
    .eq("id", activityId)
    .eq("business_id", businessId);

  if (error) throw new Error(error.message);

  if (existingActivity.entity_id) {
    revalidateContactDetailPaths(existingActivity.entity_id);
  }

  return { success: true };
}

export async function deleteContactsBulk(ids: string[]) {
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const normalizedIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
  if (normalizedIds.length === 0) return { success: true, deleted: 0 };

  const { data: existingContacts, error: fetchError } = await supabase
    .from("contacts")
    .select("id")
    .eq("business_id", businessId)
    .in("id", normalizedIds);
  if (fetchError) throw new Error(fetchError.message);

  const existingIds = (existingContacts ?? []).map((contact) => contact.id);
  if (existingIds.length === 0) return { success: true, deleted: 0 };

  const [estimateLinks, invoiceLinks, jobLinks] = await Promise.all([
    supabase.from("estimates").select("contact_id").eq("business_id", businessId).in("contact_id", existingIds),
    supabase.from("invoices").select("contact_id").eq("business_id", businessId).in("contact_id", existingIds),
    supabase.from("jobs").select("contact_id").eq("business_id", businessId).in("contact_id", existingIds),
  ]);

  if (estimateLinks.error) throw new Error(estimateLinks.error.message);
  if (invoiceLinks.error) throw new Error(invoiceLinks.error.message);
  if (jobLinks.error) throw new Error(jobLinks.error.message);

  const protectedIds = new Set<string>([
    ...(estimateLinks.data ?? []).map((row) => row.contact_id).filter(Boolean),
    ...(invoiceLinks.data ?? []).map((row) => row.contact_id).filter(Boolean),
    ...(jobLinks.data ?? []).map((row) => row.contact_id).filter(Boolean),
  ]);
  const idsToDelete = existingIds.filter((id) => !protectedIds.has(id));
  const idsToArchive = existingIds.filter((id) => protectedIds.has(id));

  if (idsToDelete.length > 0) {
    const { error } = await supabase
      .from("contacts")
      .delete()
      .eq("business_id", businessId)
      .in("id", idsToDelete);
    if (error) throw new Error(error.message);
  }

  if (idsToArchive.length > 0) {
    const { error: archiveError } = await supabase
      .from("contacts")
      .update({ status: "inactive" } as TablesUpdate<"contacts">)
      .eq("business_id", businessId)
      .in("id", idsToArchive);
    if (archiveError) throw new Error(archiveError.message);
  }

  revalidatePath("/dashboard/contacts");
  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard/prospects");
  revalidatePath("/dashboard/customers");
  for (const id of existingIds) {
    revalidateContactDetailPaths(id);
  }

  return { success: true, deleted: idsToDelete.length, archived: idsToArchive.length };
}

export async function saveEstimate(formData: FormData) {
  const supabase = await createClient();
  const id = (formData.get("id") as string) || null;
  const businessId =
    (formData.get("business_id") as string) || (await resolveCurrentBusinessId()) || "";
  if (!businessId) throw new Error("Business context is required");

  const lineItems = parseLineItems((formData.get("line_items") as string) || "[]");
  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const taxRate = parseNullableNumber(formData.get("tax_rate")) ?? 0;
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;
  const currentEstimate =
    id
      ? await (async () => {
        const { data, error } = await supabase
            .from("estimates")
            .select("estimate_version, approval_token, status, qbo_estimate_id")
            .eq("id", id)
            .eq("business_id", businessId)
            .maybeSingle();
          if (error) throw new Error(error.message);
          return data;
        })()
      : null;

  const estimate: TablesInsert<"estimates"> = {
    business_id: businessId,
    contact_id: ((formData.get("contact_id") as string) || "").trim(),
    estimate_number:
      ((formData.get("estimate_number") as string) || "").trim() || `EST-${Date.now()}`,
    status: (formData.get("status") as any) || "draft",
    valid_until: ((formData.get("valid_until") as string) || "").trim() || null,
    notes: ((formData.get("notes") as string) || "").trim() || null,
    line_items: lineItems as unknown as Json,
    subtotal,
    tax_rate: taxRate,
    tax,
    total,
    job_id: ((formData.get("job_id") as string) || "").trim() || null,
    estimate_version: currentEstimate?.estimate_version ? currentEstimate.estimate_version + 1 : 1,
    approval_token: currentEstimate?.approval_token ?? crypto.randomUUID(),
  };

  if (!estimate.contact_id) throw new Error("Contact is required");

  async function promoteContactToCustomerIfApproved() {
    if (estimate.status !== "approved") return;

    const { error: contactUpdateError } = await supabase
      .from("contacts")
      .update({ status: "customer" } as any)
      .eq("id", estimate.contact_id)
      .eq("business_id", businessId);

    if (contactUpdateError) throw new Error(contactUpdateError.message);

    revalidatePath("/dashboard/contacts");
    revalidateContactDetailPaths(estimate.contact_id);
  }

  if (id) {
    const { error } = await supabase
      .from("estimates")
      .update(estimate)
      .eq("id", id)
      .eq("business_id", businessId);
    if (error) throw new Error(error.message);
    await promoteContactToCustomerIfApproved();
    revalidatePath(`/dashboard/estimates/${id}`);
    revalidatePath("/dashboard/estimates");
    if (estimate.status === "approved" && currentEstimate?.status !== "approved") {
      try {
        const amount = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(total);
        await sendAdminNotification({
          supabase,
          businessId,
          settingKey: "notification_estimate_approved_email",
          entityType: "estimate",
          entityId: id,
          activityAction: "notification.estimate_approved",
          subject: `Estimate approved: ${estimate.estimate_number}`,
          textLines: [`Estimate ${estimate.estimate_number} was approved.`, `Total: ${amount}`],
        });
      } catch (notificationError) {
        console.error("Failed to process estimate notifications:", notificationError);
      }
    }
    if (currentEstimate?.qbo_estimate_id) {
      try {
        await syncQuickBooksEstimateForEstimate(id);
      } catch (quickBooksError) {
        await recordQuickBooksSyncError(businessId, quickBooksError);
        console.error("Unable to sync updated estimate to QuickBooks:", quickBooksError);
      }
    }
    return { success: true, id };
  } else {
    const { data, error } = await supabase
      .from("estimates")
      .insert(estimate)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await promoteContactToCustomerIfApproved();
    revalidatePath(`/dashboard/estimates/${data.id}`);
    revalidatePath("/dashboard/estimates");
    if (estimate.status === "approved") {
      try {
        const amount = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(total);
        await sendAdminNotification({
          supabase,
          businessId,
          settingKey: "notification_estimate_approved_email",
          entityType: "estimate",
          entityId: data.id,
          activityAction: "notification.estimate_approved",
          subject: `Estimate approved: ${estimate.estimate_number}`,
          textLines: [`Estimate ${estimate.estimate_number} was approved.`, `Total: ${amount}`],
        });
      } catch (notificationError) {
        console.error("Failed to process estimate notifications:", notificationError);
      }
    }
    return { success: true, id: data.id };
  }
}

export async function deleteEstimate(id: string) {
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const { error } = await supabase
    .from("estimates")
    .delete()
    .eq("id", id)
    .eq("business_id", businessId);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/estimates");
  revalidatePath(`/dashboard/estimates/${id}`);
  return { success: true };
}

export async function createInvoiceFromEstimateAction(estimateId: string) {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const { data: existingDraft, error: existingDraftError } = await supabase
    .from("invoices")
    .select("id")
    .eq("business_id", businessId)
    .eq("estimate_id", estimateId)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingDraftError) throw new Error(existingDraftError.message);
  if (existingDraft) {
    revalidatePath("/dashboard/invoices");
    revalidatePath(`/dashboard/invoices/${existingDraft.id}`);
    return { success: true, id: existingDraft.id, reused: true };
  }

  const { data: estimate, error: estimateError } = await supabase
    .from("estimates")
    .select("*")
    .eq("id", estimateId)
    .eq("business_id", businessId)
    .single();
  if (estimateError) throw new Error(estimateError.message);
  if (!estimate) throw new Error("Estimate not found");

  const invoice: TablesInsert<"invoices"> = {
    business_id: businessId,
    contact_id: estimate.contact_id,
    invoice_number: `INV-${Date.now()}`,
    status: "draft",
    due_date: estimate.valid_until ?? null,
    notes: estimate.notes ?? null,
    line_items: estimate.line_items,
    subtotal: estimate.subtotal ?? 0,
    tax_rate: estimate.tax_rate ?? 0,
    tax: estimate.tax ?? 0,
    total: estimate.total ?? 0,
    amount_paid: 0,
    estimate_id: estimate.id,
    job_id: estimate.job_id ?? null,
  };

  const { data: created, error: insertError } = await supabase
    .from("invoices")
    .insert(invoice)
    .select("id")
    .single();
  if (insertError) throw new Error(insertError.message);

  revalidatePath("/dashboard/estimates");
  revalidatePath(`/dashboard/estimates/${estimateId}`);
  revalidatePath("/dashboard/invoices");
  revalidatePath(`/dashboard/invoices/${created.id}`);

  return { success: true, id: created.id, reused: false };
}

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function deriveInvoiceStatus(options: {
  existingStatus: Tables<"invoices">["status"] | null;
  sentAt: string | null;
  dueDate: string | null;
  amountPaid: number;
  total: number;
}) {
  const { existingStatus, sentAt, dueDate, amountPaid, total } = options;
  const normalizedPaid = Number.isFinite(amountPaid) ? amountPaid : 0;
  const normalizedTotal = Number.isFinite(total) ? total : 0;
  const isPaid = normalizedTotal <= 0 || normalizedPaid >= normalizedTotal;

  if (existingStatus === "void") return "void" as const;
  if (isPaid) return "paid" as const;

  const usesSentLifecycle =
    Boolean(sentAt) || existingStatus === "sent" || existingStatus === "viewed" || existingStatus === "overdue";
  if (!usesSentLifecycle) return "draft" as const;

  const isOverdue = dueDate ? dueDate < getTodayIsoDate() : false;
  if (isOverdue) return "overdue" as const;
  if (existingStatus === "viewed") return "viewed" as const;
  return "sent" as const;
}

export async function saveInvoice(formData: FormData) {
  const supabase = await createClient();
  const id = (formData.get("id") as string) || null;
  const businessId =
    (formData.get("business_id") as string) || (await resolveCurrentBusinessId()) || "";
  if (!businessId) throw new Error("Business context is required");

  const lineItems = parseLineItems((formData.get("line_items") as string) || "[]");
  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const taxRate = parseNullableNumber(formData.get("tax_rate")) ?? 0;
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;
  const amountPaid = parseNullableNumber(formData.get("amount_paid")) ?? 0;

  const existingInvoice = id
    ? await (async () => {
        const { data, error } = await supabase
          .from("invoices")
          .select("status, sent_at, paid_at, qbo_invoice_id")
          .eq("id", id)
          .eq("business_id", businessId)
          .maybeSingle();
        if (error) throw new Error(error.message);
        return data;
      })()
    : null;

  const derivedStatus = deriveInvoiceStatus({
    existingStatus: existingInvoice?.status ?? null,
    sentAt: existingInvoice?.sent_at ?? null,
    dueDate: ((formData.get("due_date") as string) || "").trim() || null,
    amountPaid,
    total,
  });
  const paidAt =
    derivedStatus === "paid" ? existingInvoice?.paid_at ?? new Date().toISOString() : null;

  const invoice: TablesInsert<"invoices"> = {
    business_id: businessId,
    contact_id: ((formData.get("contact_id") as string) || "").trim(),
    invoice_number:
      ((formData.get("invoice_number") as string) || "").trim() || `INV-${Date.now()}`,
    status: derivedStatus,
    due_date: ((formData.get("due_date") as string) || "").trim() || null,
    notes: ((formData.get("notes") as string) || "").trim() || null,
    line_items: lineItems as unknown as Json,
    subtotal,
    tax_rate: taxRate,
    tax,
    total,
    amount_paid: amountPaid,
    paid_at: paidAt,
    estimate_id: ((formData.get("estimate_id") as string) || "").trim() || null,
    job_id: ((formData.get("job_id") as string) || "").trim() || null,
  };

  if (!invoice.contact_id) throw new Error("Contact is required");

  if (id) {
    const { error } = await supabase
      .from("invoices")
      .update(invoice)
      .eq("id", id)
      .eq("business_id", businessId);
    if (error) throw new Error(error.message);
    revalidatePath(`/dashboard/invoices/${id}`);
    if (invoice.status === "paid" && existingInvoice?.status !== "paid") {
      try {
        await sendAdminNotification({
          supabase,
          businessId,
          settingKey: "notification_invoice_paid_email",
          entityType: "invoice",
          entityId: id,
          activityAction: "notification.invoice_paid",
          subject: `Invoice paid: ${invoice.invoice_number}`,
          textLines: [
            `Invoice ${invoice.invoice_number} was marked as paid.`,
            `Total: ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(total)}`,
          ],
        });
      } catch (notificationError) {
        console.error("Failed to process invoice notifications:", notificationError);
      }
    }
    if (existingInvoice?.qbo_invoice_id) {
      try {
        await syncQuickBooksInvoiceForInvoice(id);
      } catch (quickBooksError) {
        await recordQuickBooksSyncError(businessId, quickBooksError);
        console.error("Unable to sync updated invoice to QuickBooks:", quickBooksError);
      }
    }
  } else {
    const { data, error } = await supabase
      .from("invoices")
      .insert(invoice)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath(`/dashboard/invoices/${data.id}`);
    if (invoice.status === "paid") {
      try {
        await sendAdminNotification({
          supabase,
          businessId,
          settingKey: "notification_invoice_paid_email",
          entityType: "invoice",
          entityId: data.id,
          activityAction: "notification.invoice_paid",
          subject: `Invoice paid: ${invoice.invoice_number}`,
          textLines: [
            `Invoice ${invoice.invoice_number} was marked as paid.`,
            `Total: ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(total)}`,
          ],
        });
      } catch (notificationError) {
        console.error("Failed to process invoice notifications:", notificationError);
      }
    }
  }

  revalidatePath("/dashboard/invoices");
  return { success: true };
}

export async function deleteInvoice(id: string) {
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const { error } = await supabase
    .from("invoices")
    .delete()
    .eq("id", id)
    .eq("business_id", businessId);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/invoices");
  revalidatePath(`/dashboard/invoices/${id}`);
  return { success: true };
}

export async function deleteContact(id: string) {
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const [estimateLink, invoiceLink, jobLink] = await Promise.all([
    supabase.from("estimates").select("id").eq("business_id", businessId).eq("contact_id", id).limit(1).maybeSingle(),
    supabase.from("invoices").select("id").eq("business_id", businessId).eq("contact_id", id).limit(1).maybeSingle(),
    supabase.from("jobs").select("id").eq("business_id", businessId).eq("contact_id", id).limit(1).maybeSingle(),
  ]);

  if (estimateLink.error) throw new Error(estimateLink.error.message);
  if (invoiceLink.error) throw new Error(invoiceLink.error.message);
  if (jobLink.error) throw new Error(jobLink.error.message);

  const hasLinkedRecords = Boolean(estimateLink.data || invoiceLink.data || jobLink.data);

  if (hasLinkedRecords) {
    const { error: archiveError } = await supabase
      .from("contacts")
      .update({ status: "inactive" } as TablesUpdate<"contacts">)
      .eq("id", id)
      .eq("business_id", businessId);
    if (archiveError) throw new Error(archiveError.message);
  } else {
    const { error } = await supabase
      .from("contacts")
      .delete()
      .eq("id", id)
      .eq("business_id", businessId);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/dashboard/contacts");
  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard/prospects");
  revalidatePath("/dashboard/customers");
  revalidatePath(`/dashboard/contacts/${id}`);
  return { success: true };
}

// ---- Estimate actions ----

export async function sendEstimate(estimateId: string) {
  const supabase = await createClient();

  // Fetch estimate with contact
  const { data: estimate } = await supabase
    .from("estimates")
    .select("*, contacts(*)")
    .eq("id", estimateId)
    .single();

  if (!estimate || !(estimate as any).contacts) throw new Error("Estimate not found");

  const businessId = (estimate as any).business_id as string;
  const { data: business } = await supabase
    .from("businesses")
    .select("name")
    .eq("id", businessId)
    .maybeSingle();
  const contact = (estimate as any).contacts as any;
  if (!contact.email) {
    throw new Error("This contact does not have an email address.");
  }

  const approvalToken = ((estimate as any).approval_token as string | null) || crypto.randomUUID();
  const estimateVersion = Number((estimate as any).estimate_version ?? 1) || 1;
  const approvalBaseUrl = await getEstimateApprovalBaseUrl(businessId);
  const approveLink = approvalBaseUrl
    ? `${approvalBaseUrl}/estimate/approve/${approvalToken}?v=${estimateVersion}`
    : "";
  const approveButton = approveLink
    ? `<p style="margin:24px 0;"><a href="${approveLink}" style="display:inline-block;padding:12px 20px;background:#111827;color:#ffffff;text-decoration:none;border-radius:999px;font-weight:600;">Approve Estimate</a></p>`
    : "";

  if (!(estimate as any).approval_token) {
    await supabase
      .from("estimates")
      .update({ approval_token: approvalToken } as TablesUpdate<"estimates">)
      .eq("id", estimateId)
      .eq("business_id", businessId);
  }

  const sentCount = await sendAutomationRuleEmails({
    supabase,
    businessId,
    triggerEvent: "new_estimate",
    fallbackRecipients: [{ email: contact.email, contactId: contact.id }],
    relatedType: "estimate",
    relatedId: estimateId,
    templateVariables: {
      contact_name: `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim(),
      contact_first_name: `${contact.first_name ?? ""}`.trim(),
      contact_last_name: `${contact.last_name ?? ""}`.trim(),
      contact_email: contact.email ?? "",
      business_name: business?.name?.trim() || "Your business",
      estimate_number: (estimate as any).estimate_number,
      total: String((estimate as any).total),
      estimate_version: String(estimateVersion),
      approve_link: approveLink,
      approve_button: approveButton,
    },
  });

  if (sentCount === 0) {
    throw new Error("Create an active 'New Estimate' flow with a template before sending this estimate.");
  }

  // Update estimate status
  await supabase
    .from("estimates")
    .update({ status: "sent", sent_at: new Date().toISOString() } as any)
    .eq("id", estimateId);

  // Lead progression: once an estimate is sent, the contact becomes a prospect.
  await supabase
    .from("contacts")
    .update({ status: "prospect" } as any)
    .eq("id", (estimate as any).contact_id)
    .eq("business_id", (estimate as any).business_id);

  try {
    await syncQuickBooksEstimateForEstimate(estimateId);
  } catch (quickBooksError) {
    await recordQuickBooksSyncError(businessId, quickBooksError);
    console.error("Unable to sync estimate to QuickBooks:", quickBooksError);
  }

  revalidatePath("/dashboard/estimates");
  revalidatePath("/dashboard/contacts");
  revalidateContactDetailPaths((estimate as any).contact_id);
  return { success: true };
}

export async function approveEstimateByTokenAction(token: string, formData: FormData) {
  const trimmedToken = token.trim();
  if (!trimmedToken) throw new Error("Approval token is required");

  const admin = createAdminClient();
  const expectedVersion = Math.max(1, parseInt(String(formData.get("estimate_version") || "1"), 10) || 1);
  const customerName = ((formData.get("customer_name") as string) || "").trim() || "Customer";

  const { data: estimate, error } = await admin
    .from("estimates")
    .select("id, business_id, contact_id, status, approval_token")
    .eq("approval_token", trimmedToken)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!estimate) throw new Error("Estimate not found");

  if (estimate.status !== "approved") {
    const approvedAt = new Date().toISOString();
    const { error: insertError } = await admin
      .from("estimate_approvals")
      .insert({
        business_id: estimate.business_id,
        estimate_id: estimate.id,
        estimate_version: expectedVersion,
        customer_name: customerName,
        ip_address: await getRequestIpAddress(),
        user_agent: await getRequestUserAgent(),
        approved_at: approvedAt,
      } as TablesInsert<"estimate_approvals">);
    if (insertError) throw new Error(insertError.message);

    const { error: estimateUpdateError } = await admin
      .from("estimates")
      .update({
        status: "approved",
        approved_at: approvedAt,
      } as TablesUpdate<"estimates">)
      .eq("id", estimate.id)
      .eq("business_id", estimate.business_id);
    if (estimateUpdateError) throw new Error(estimateUpdateError.message);

    if (estimate.contact_id) {
      const { error: contactError } = await admin
        .from("contacts")
        .update({ status: "customer" } as any)
        .eq("id", estimate.contact_id)
        .eq("business_id", estimate.business_id);
      if (contactError) throw new Error(contactError.message);
    }
  }

  revalidatePath("/dashboard/estimates");
  revalidatePath(`/dashboard/estimates/${estimate.id}`);
  if (estimate.contact_id) {
    revalidatePath("/dashboard/contacts");
    revalidateContactDetailPaths(estimate.contact_id);
  }
  redirect(`/estimate/approve/${trimmedToken}?approved=1`);
}

// ---- Invoice actions ----

export async function sendInvoice(invoiceId: string) {
  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, contacts(*)")
    .eq("id", invoiceId)
    .single();

  if (!invoice || !(invoice as any).contacts) throw new Error("Invoice not found");

  const businessId = (invoice as any).business_id as string;
  const { data: business } = await supabase
    .from("businesses")
    .select("name")
    .eq("id", businessId)
    .maybeSingle();
  const contact = (invoice as any).contacts as any;
  if (!contact.email) {
    throw new Error("This contact does not have an email address.");
  }

  const sentCount = await sendAutomationRuleEmails({
    supabase,
    businessId,
    triggerEvent: "new_invoice",
    fallbackRecipients: [{ email: contact.email, contactId: contact.id }],
    relatedType: "invoice",
    relatedId: invoiceId,
    templateVariables: {
      contact_name: `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim(),
      contact_first_name: `${contact.first_name ?? ""}`.trim(),
      contact_last_name: `${contact.last_name ?? ""}`.trim(),
      contact_email: contact.email ?? "",
      business_name: business?.name?.trim() || "Your business",
      invoice_number: (invoice as any).invoice_number,
      total: String((invoice as any).total),
      due_date: (invoice as any).due_date || "",
    },
  });

  if (sentCount === 0) {
    throw new Error("Create an active 'New invoice' flow with a template before sending this invoice.");
  }

  await supabase
    .from("invoices")
    .update({ status: "sent", sent_at: new Date().toISOString() } as any)
    .eq("id", invoiceId);

  try {
    await syncQuickBooksInvoiceForInvoice(invoiceId);
  } catch (quickBooksError) {
    await recordQuickBooksSyncError(businessId, quickBooksError);
    console.error("Unable to sync invoice to QuickBooks:", quickBooksError);
  }

  revalidatePath("/dashboard/invoices");
  return { success: true };
}

export async function recordPayment(formData: FormData) {
  const supabase = await createClient();

  const payment: TablesInsert<"payments"> = {
    business_id: (formData.get("business_id") as string) || "",
    invoice_id: (formData.get("invoice_id") as string) || "",
    amount: parseFloat((formData.get("amount") as string) || "0"),
    method: (formData.get("method") as any) || "other",
    reference: (formData.get("reference") as string) || null,
    notes: (formData.get("notes") as string) || null,
    paid_at: (formData.get("paid_at") as string) || new Date().toISOString(),
  };

  const { data: createdPayment, error } = await supabase
    .from("payments")
    .insert(payment)
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  // Check if invoice is fully paid
  const { data: invoice } = await supabase
    .from("invoices")
    .select("total, amount_paid")
    .eq("id", payment.invoice_id)
    .single();

  if (invoice) {
    const newPaid = ((invoice as any).amount_paid || 0) + payment.amount;
    const update: Record<string, any> = { amount_paid: newPaid };

    if (newPaid >= (invoice as any).total) {
      update.status = "paid";
      update.paid_at = new Date().toISOString();
    }

    await supabase.from("invoices").update(update).eq("id", payment.invoice_id);
  }

  try {
    if (createdPayment?.id) {
      await syncQuickBooksPaymentForPayment(createdPayment.id);
    }
  } catch (quickBooksError) {
    await recordQuickBooksSyncError(payment.business_id, quickBooksError);
    console.error("Unable to sync payment to QuickBooks:", quickBooksError);
  }

  revalidatePath("/dashboard/invoices");
  return { success: true };
}

// ---- Activity logging helper ----

export async function logActivity(
  businessId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Json | null,
  options?: {
    userId?: string | null;
  },
) {
  const admin = createAdminClient();

  const payload: TablesInsert<"activity_log"> = {
    business_id: businessId,
    user_id: options?.userId ?? null,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata: metadata ?? null,
  };

  const { error } = await admin.from("activity_log").insert(payload);
  if (error) throw new Error(error.message);
}

async function getBusinessNotificationContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
) {
  const { data: business, error } = await supabase
    .from("businesses")
    .select("name, email, settings")
    .eq("id", businessId)
    .maybeSingle();
  if (error) throw new Error(error.message);

  const settings =
    business?.settings && typeof business.settings === "object" && !Array.isArray(business.settings)
      ? (business.settings as Record<string, Json | undefined>)
      : {};

  const adminEmail = ((business?.email ?? "").trim() || null);

  return {
    businessName: (business?.name ?? "").trim() || "Your business",
    adminEmail,
    settings,
  };
}

function isNotificationEnabled(settings: Record<string, Json | undefined>, key: string) {
  return settings[key] === true;
}

function toNotificationHtml(lines: string[]) {
  return `<div>${lines.map((line) => `<p>${line}</p>`).join("")}</div>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildLeadFilesEmailContent(data: Record<string, Json | undefined>) {
  const uploadedFiles = collectUploadedFormFiles(data);
  if (uploadedFiles.length === 0) {
    return {
      htmlBlock: "",
      textBlock: "",
      htmlValue: "No files",
      textValue: "No files",
    };
  }

  const fileRows = uploadedFiles.map((file) => {
    const fileName = escapeHtml(file.file_name || "File");
    const publicUrl = file.file_url?.trim();
    if (publicUrl) {
      return {
        html: `<li><a href="${escapeHtml(publicUrl)}">${fileName}</a></li>`,
        text: `${file.file_name || "File"}: ${publicUrl}`,
        htmlInline: `<a href="${escapeHtml(publicUrl)}">${fileName}</a>`,
      };
    }

    return {
      html: `<li>${fileName}</li>`,
      text: file.file_name || "File",
      htmlInline: fileName,
    };
  });

  return {
    htmlBlock: `<div><p><strong>Files</strong></p><ul>${fileRows.map((file) => file.html).join("")}</ul></div>`,
    textBlock: `Files:\n${fileRows.map((file) => file.text).join("\n")}`,
    htmlValue: fileRows.map((file) => file.htmlInline).join("<br />"),
    textValue: fileRows.map((file) => file.text).join("\n"),
  };
}

function isValidAutomationRecipientEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getDefaultAutomationRecipientTargets(triggerEvent: PlatformAutomationTriggerValue) {
  switch (triggerEvent) {
    case "inquiry_response":
    case "review_request":
    case "new_estimate":
    case "new_invoice":
      return ["contact"];
    default:
      return [];
  }
}

function parseAutomationRuleRecipientTargets(value: Json | null | undefined) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
}

async function validateAutomationRecipientTargets(
  recipientTargets: string[],
) {
  const normalizedTargets = Array.from(new Set(recipientTargets.map((target) => target.trim()).filter(Boolean)));

  for (const recipientTarget of normalizedTargets) {
    if (recipientTarget === "contact") {
      continue;
    }

    if (!isValidAutomationRecipientEmail(recipientTarget)) {
      throw new Error("Recipient target is invalid");
    }
  }

  return normalizedTargets;
}

async function resolveAutomationRuleRecipients(options: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  businessId: string;
  recipientTargets: string[] | null;
  fallbackRecipients: Array<{ email: string; contactId?: string | null }>;
}) {
  const normalizedFallbackRecipients = Array.from(
    new Map(
      options.fallbackRecipients
        .map((recipient) => {
          const email = recipient.email.trim();
          return email ? [email.toLowerCase(), { ...recipient, email }] : null;
        })
        .filter((recipient): recipient is [string, { email: string; contactId?: string | null }] => !!recipient),
    ).values(),
  );

  const configuredTargets = Array.isArray(options.recipientTargets) ? options.recipientTargets : null;
  if (configuredTargets === null || configuredTargets.length === 0) {
    return normalizedFallbackRecipients;
  }

  const recipients = new Map<string, { email: string; contactId?: string | null }>();
  for (const recipientTarget of configuredTargets) {
    if (recipientTarget === "contact") {
      for (const recipient of normalizedFallbackRecipients) {
        recipients.set(recipient.email.toLowerCase(), recipient);
      }
      continue;
    }

    recipients.set(recipientTarget.toLowerCase(), { email: recipientTarget, contactId: null });
  }

  return Array.from(recipients.values());
}

async function sendAutomationRuleEmails(options: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  businessId: string;
  triggerEvent: PlatformAutomationTriggerValue;
  fallbackRecipients: Array<{ email: string; contactId?: string | null }>;
  relatedType: string;
  relatedId: string | null;
  templateVariables?:
    | Record<string, string>
    | {
        common?: Record<string, string>;
        html?: Record<string, string>;
        text?: Record<string, string>;
        subject?: Record<string, string>;
      };
  fallbackSubject?: string;
  fallbackHtml?: string;
  fallbackText?: string;
  appendHtml?: string;
  appendText?: string;
  activityAction?: string;
  activityEntityType?: string;
  activityEntityId?: string;
  activitySubject?: string;
  actorUserId?: string | null;
}) {
  const { data: ruleRows, error: ruleError } = await options.supabase
    .from("automation_rules")
    .select("id, template_id, recipient_targets")
    .eq("business_id", options.businessId)
    .eq("trigger_event", options.triggerEvent)
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  if (ruleError) throw new Error(ruleError.message);

  const templateIds = Array.from(new Set((ruleRows ?? []).map((rule) => rule.template_id).filter(Boolean)));
  let templatesById = new Map<string, Pick<Tables<"email_templates">, "id" | "subject" | "body_html" | "body_text">>();

  if (templateIds.length > 0) {
    const { data: templateRows, error: templateError } = await options.supabase
      .from("email_templates")
      .select("id, subject, body_html, body_text")
      .eq("business_id", options.businessId)
      .eq("is_active", true)
      .in("id", templateIds);
    if (templateError) throw new Error(templateError.message);
    templatesById = new Map((templateRows ?? []).map((template) => [template.id, template]));
  }

  const deliveries = (ruleRows ?? [])
    .map((rule) => {
      const template = templatesById.get(rule.template_id);
      if (template) {
        const rendered = renderTemplate(template, options.templateVariables ?? {});
        return {
          templateId: template.id,
          recipientTargets: parseAutomationRuleRecipientTargets(rule.recipient_targets),
          subject: rendered.subject,
          html: `${rendered.html}${options.appendHtml ?? ""}`,
          text: `${rendered.text}${options.appendText ?? ""}`,
        };
      }

      if (options.fallbackSubject && options.fallbackHtml && options.fallbackText) {
        return {
          templateId: null,
          recipientTargets: parseAutomationRuleRecipientTargets(rule.recipient_targets),
          subject: options.fallbackSubject,
          html: options.fallbackHtml,
          text: options.fallbackText,
        };
      }

      return null;
    })
    .filter(
      (
        delivery,
      ): delivery is { templateId: string | null; recipientTargets: string[]; subject: string; html: string; text: string } => !!delivery,
    );

  if (deliveries.length === 0) return 0;

  if (
    options.activityAction &&
    options.activityEntityType &&
    options.activityEntityId &&
    options.activitySubject
  ) {
    await logActivity(options.businessId, options.activityAction, options.activityEntityType, options.activityEntityId, {
      subject: options.activitySubject,
    }, {
      userId: options.actorUserId ?? null,
    });
  }

  let sentCount = 0;

  for (const delivery of deliveries) {
    const resolvedRecipients = await resolveAutomationRuleRecipients({
      supabase: options.supabase,
      businessId: options.businessId,
      recipientTargets: delivery.recipientTargets,
      fallbackRecipients: options.fallbackRecipients,
    });
    if (resolvedRecipients.length === 0) continue;

    for (const recipient of resolvedRecipients) {
      try {
        const resendData = await sendEmail({
          to: recipient.email,
          subject: delivery.subject,
          html: delivery.html,
          text: delivery.text,
          businessId: options.businessId,
        });

        const { error: logError } = await options.supabase.from("email_log").insert({
          business_id: options.businessId,
          template_id: delivery.templateId,
          contact_id: recipient.contactId ?? null,
          to_email: recipient.email,
          subject: delivery.subject,
          resend_id: resendData?.id || null,
          status: "sent",
          related_type: options.relatedType,
          related_id: options.relatedId,
          sent_at: new Date().toISOString(),
        });
        if (logError) throw new Error(logError.message);
        sentCount += 1;
      } catch (error) {
        await options.supabase.from("email_log").insert({
          business_id: options.businessId,
          template_id: delivery.templateId,
          contact_id: recipient.contactId ?? null,
          to_email: recipient.email,
          subject: delivery.subject,
          status: "failed",
          related_type: options.relatedType,
          related_id: options.relatedId,
          sent_at: new Date().toISOString(),
          resend_id: null,
        });
        throw error;
      }
    }
  }

  return sentCount;
}

async function sendAdminNotification(options: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  businessId: string;
  settingKey: string;
  entityType: string;
  entityId: string;
  activityAction: string;
  subject: string;
  textLines: string[];
  templateVariables?: Record<string, string>;
  actorUserId?: string | null;
}) {
  const context = await getBusinessNotificationContext(options.supabase, options.businessId);
  if (!isNotificationEnabled(context.settings, options.settingKey)) return;

  await logActivity(options.businessId, options.activityAction, options.entityType, options.entityId, {
    subject: options.subject,
  }, {
    userId: options.actorUserId ?? null,
  });

  const fallbackText = options.textLines.join("\n\n");
  const fallbackHtml = toNotificationHtml(options.textLines);
  const subject = options.subject;
  const text = fallbackText;
  const html = fallbackHtml;

  if (!context.adminEmail) return;

  try {
    const resendData = await sendEmail({
      to: context.adminEmail,
      subject,
      html,
      text,
      businessId: options.businessId,
    });

    await options.supabase.from("email_log").insert({
      business_id: options.businessId,
      template_id: null,
      contact_id: null,
      to_email: context.adminEmail,
      subject,
      status: "sent",
      related_type: "internal_notification",
      related_id: options.entityId,
      sent_at: new Date().toISOString(),
      resend_id: (resendData as { id?: string | null } | null)?.id ?? null,
    });
  } catch (error) {
    console.error(`Failed to send admin notification for ${options.settingKey}:`, error);
    await options.supabase.from("email_log").insert({
      business_id: options.businessId,
      template_id: null,
      contact_id: null,
      to_email: context.adminEmail,
      subject,
      status: "failed",
      related_type: "internal_notification",
      related_id: options.entityId,
      sent_at: new Date().toISOString(),
      resend_id: null,
    });
  }
}








