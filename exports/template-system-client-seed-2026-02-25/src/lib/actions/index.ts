"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertAdminDashboardAction } from "@/lib/authz/dashboard";
import { syncGoogleBusinessProfileReviews } from "@/lib/integrations/googleBusinessProfile";
import {
  refreshQuickBooksInvoiceStatusForInvoice,
  syncAllQuickBooksCustomersForBusiness,
  syncQuickBooksEstimateForEstimate,
  syncQuickBooksInvoiceForInvoice,
} from "@/lib/integrations/quickbooks";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, renderTemplate } from "@/lib/utils/email";
import { parseImportedContentToBlocks } from "@/lib/content/blockImport";
import { sanitizePageContentForSave } from "@/lib/content/templatePages";
import type { Json, Tables, TablesInsert, TablesUpdate } from "@/lib/types/database";

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
  supabase: Awaited<ReturnType<typeof createClient>>;
  businessId: string;
  formType: Tables<"form_submissions">["form_type"];
  formId?: string | null;
  data: Record<string, Json | undefined>;
}) {
  const { supabase, businessId, formType, formId, data } = options;
  const admin = createAdminClient();

  const { data: business, error: businessError } = await admin
    .from("businesses")
    .select("name, settings")
    .eq("id", businessId)
    .maybeSingle();
  if (businessError) throw new Error(businessError.message);
  if (!business) return;

  const email = String(data.email ?? "").trim();
  if (!email) return;

  let template: Tables<"email_templates"> | null = null;

  if (formId) {
    const { data: form, error: formError } = await admin
      .from("forms")
      .select("id, auto_response_template_id")
      .eq("business_id", businessId)
      .eq("id", formId)
      .maybeSingle();

    const isMissingAutoResponseColumn =
      Boolean(formError) &&
      /auto_response_template_id/i.test(formError?.message ?? "") &&
      /column/i.test(formError?.message ?? "");

    if (formError && !isMissingAutoResponseColumn) throw new Error(formError.message);

    if (!isMissingAutoResponseColumn && form?.auto_response_template_id) {
      const { data: selectedTemplate, error: selectedTemplateError } = await admin
        .from("email_templates")
        .select("*")
        .eq("business_id", businessId)
        .eq("id", form.auto_response_template_id)
        .eq("is_active", true)
        .maybeSingle();
      if (selectedTemplateError) throw new Error(selectedTemplateError.message);
      template = (selectedTemplate ?? null) as Tables<"email_templates"> | null;
    }
  }

  // Legacy fallback for forms without an explicit template configured.
  if (!template) {
    const settings = parseFormAutoResponseSettings(business.settings);
    if (!settings.enabled) return;
    if (!settings[formType]) return;

    const templateNameByFormType: Record<Tables<"form_submissions">["form_type"], string> = {
      contact: "Auto Response - Contact Form",
      quote_request: "Auto Response - Quote Request",
      booking: "Auto Response - Booking Request",
      newsletter: "Auto Response - Contact Form",
    };

    const templateName = templateNameByFormType[formType];
    const { data: fallbackTemplate, error: templateError } = await admin
      .from("email_templates")
      .select("*")
      .eq("business_id", businessId)
      .eq("name", templateName)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (templateError) throw new Error(templateError.message);
    template = (fallbackTemplate ?? null) as Tables<"email_templates"> | null;
  }

  if (!template) return;

  const firstName = String(data.first_name ?? "").trim();
  const lastName = String(data.last_name ?? "").trim();
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const customerName = fullName || String(data.name ?? "").trim() || "there";
  const businessName = business.name;

  const rendered = renderTemplate(template, {
    customer_name: customerName,
    business_name: businessName,
    form_type: formType,
  });

  const resendData = await sendEmail({
    to: email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  });

  await admin.from("email_log").insert({
    business_id: businessId,
    contact_id: null,
    template_id: template.id,
    to_email: email,
    subject: rendered.subject,
    resend_id: resendData?.id || null,
    status: "sent",
    related_type: "form_submission_auto_response",
    related_id: null,
    sent_at: new Date().toISOString(),
  });
}

// ---- Form submission (public, no auth required) ----

export async function submitForm(formData: FormData) {
  const supabase = await createClient();

  const businessId = (formData.get("business_id") as string) || "";
  const formId = ((formData.get("form_id") as string) || "").trim() || null;
  const formType =
    ((formData.get("form_type") as string) || "contact") as Tables<"form_submissions">["form_type"];

  // Collect all form fields into a JSON object
  const data: Json = {};
  formData.forEach((value, key) => {
    if (key !== "business_id" && key !== "form_type" && key !== "form_id") {
      (data as Record<string, Json | undefined>)[key] = value.toString();
    }
  });

  const payload: TablesInsert<"form_submissions"> = {
    business_id: businessId,
    form_type: formType,
    data,
    page_url: (formData.get("page_url") as string) || null,
    utm_source: (formData.get("utm_source") as string) || null,
    utm_medium: (formData.get("utm_medium") as string) || null,
    utm_campaign: (formData.get("utm_campaign") as string) || null,
  };

  const { error } = await supabase.from("form_submissions").insert(payload);
  if (error) throw new Error(error.message);

  try {
    await sendFormAutoResponseEmail({
      supabase,
      businessId,
      formType,
      formId,
      data: data as Record<string, Json | undefined>,
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

  const post: TablesInsert<"blog_posts"> = {
    title: ((formData.get("title") as string) || "").trim(),
    slug:
      ((formData.get("slug") as string) || "").trim() ||
      slugify((formData.get("title") as string) || ""),
    excerpt: ((formData.get("excerpt") as string) || "").trim() || null,
    content: JSON.parse((formData.get("content") as string) || "[]") as Json,
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
  const teamMember: TablesInsert<"team_members"> = {
    business_id: businessId,
    first_name: firstName,
    last_name: lastName,
    title: ((formData.get("title") as string) || "").trim() || null,
    bio: ((formData.get("bio") as string) || "").trim() || null,
    photo_url: ((formData.get("photo_url") as string) || "").trim() || null,
    sort_order: parseNullableNumber(formData.get("sort_order")) ?? 0,
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

  const adminSupabase = createAdminClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const inviteRedirectTo = siteUrl ? `${siteUrl.replace(/\/+$/, "")}/login` : undefined;

  const inviteResult = await adminSupabase.auth.admin.inviteUserByEmail(employment.login_email, {
    data: {
      business_id: businessId,
    },
    ...(inviteRedirectTo ? { redirectTo: inviteRedirectTo } : {}),
  });
  if (inviteResult.error) throw new Error(inviteResult.error.message);

  const invitedUserId = inviteResult.data.user?.id;
  if (!invitedUserId) throw new Error("Invite created but user record was not returned");

  const memberFirstName =
    (member as { first_name?: string | null }).first_name?.trim() || null;
  const memberLastName =
    (member as { last_name?: string | null }).last_name?.trim() || null;

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
    customer_location: ((formData.get("customer_location") as string) || "").trim() || null,
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
  await syncGoogleBusinessProfileReviews();
  revalidatePath("/dashboard/testimonials");
  revalidatePath("/");
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
      name: "Auto Response - Contact Form",
      subject: "We got your message",
      body_html:
        "<p>Hi {{customer_name}},</p><p>Thanks for reaching out. We received your message and will get back to you shortly.</p><p>- {{business_name}}</p>",
      body_text:
        "Hi {{customer_name}},\n\nThanks for reaching out. We received your message and will get back to you shortly.\n\n- {{business_name}}",
    },
    {
      name: "Auto Response - Quote Request",
      subject: "Your quote request is in",
      body_html:
        "<p>Hi {{customer_name}},</p><p>Thanks for requesting a quote. We are reviewing your details and will follow up with next steps soon.</p><p>- {{business_name}}</p>",
      body_text:
        "Hi {{customer_name}},\n\nThanks for requesting a quote. We are reviewing your details and will follow up with next steps soon.\n\n- {{business_name}}",
    },
    {
      name: "Auto Response - Booking Request",
      subject: "Booking request received",
      body_html:
        "<p>Hi {{customer_name}},</p><p>Thanks for your booking request. We will confirm availability and contact you as soon as possible.</p><p>- {{business_name}}</p>",
      body_text:
        "Hi {{customer_name}},\n\nThanks for your booking request. We will confirm availability and contact you as soon as possible.\n\n- {{business_name}}",
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
          type: "custom",
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
      type: "custom",
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

  const id = ((formData.get("id") as string) || "").trim() || null;
  const name = ((formData.get("name") as string) || "").trim();
  const type = ((formData.get("type") as string) || "custom").trim();
  const subject = ((formData.get("subject") as string) || "").trim();
  const bodyHtml = ((formData.get("body_html") as string) || "").trim();
  const bodyText = ((formData.get("body_text") as string) || "").trim();
  const isActive = (formData.get("is_active") as string) === "on";

  if (!name) throw new Error("Template name is required");
  if (!subject) throw new Error("Subject is required");
  if (!bodyHtml && !bodyText) throw new Error("At least HTML or text body is required");

  const payload: TablesInsert<"email_templates"> = {
    business_id: businessId,
    name,
    type: type as TablesInsert<"email_templates">["type"],
    subject,
    body_html: bodyHtml || bodyText,
    body_text: bodyText || bodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    is_active: isActive,
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
  revalidatePath("/areas");
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

export async function refreshQuickBooksInvoiceStatusAction(invoiceId: string) {
  await assertAdminDashboardAction();
  const result = await refreshQuickBooksInvoiceStatusForInvoice(invoiceId);
  revalidatePath("/dashboard/invoices");
  revalidatePath(`/dashboard/invoices/${invoiceId}`);
  revalidatePath("/dashboard/settings");
  return { success: true, ...result };
}

export async function saveBusinessSettingsAction(formData: FormData) {
  await assertAdminDashboardAction();
  const supabase = await createClient();
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

  const payload: TablesUpdate<"businesses"> = {
    name,
    phone: ((formData.get("phone") as string) || "").trim() || null,
    email: ((formData.get("email") as string) || "").trim() || null,
    domain: ((formData.get("domain") as string) || "").trim() || null,
    logo_url: ((formData.get("logo_url") as string) || "").trim() || null,
    address_line1: ((formData.get("address_line1") as string) || "").trim() || null,
    address_line2: ((formData.get("address_line2") as string) || "").trim() || null,
    city: ((formData.get("city") as string) || "").trim() || null,
      state: ((formData.get("state") as string) || "").trim() || null,
      zip: ((formData.get("zip") as string) || "").trim() || null,
      timezone: ((formData.get("timezone") as string) || "").trim() || "America/New_York",
      settings: {
        ...existingSettings,
        team_title_types: teamTitleTypes as unknown as Json,
        contact_form_id: (contactFormId || null) as unknown as Json,
        contact_form_slug: null as unknown as Json,
      },
    };

  const { error } = await supabase
    .from("businesses")
    .update(payload)
    .eq("id", businessId);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/settings");
  revalidateCommonSitePaths();
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
    contact_form_slug: null as unknown as Json,
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
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const schemaRaw = ((formData.get("schema_org_data") as string) || "").trim();
  let schemaOrgData: Json | null = null;
  if (schemaRaw) {
    try {
      schemaOrgData = JSON.parse(schemaRaw) as Json;
    } catch {
      throw new Error("Schema.org JSON is invalid");
    }
  }

  const excludesRaw = ((formData.get("sitemap_excludes") as string) || "").trim();
  const sitemapExcludes = excludesRaw
    ? excludesRaw
        .split(/\r?\n|,/)
        .map((entry) => entry.trim())
        .filter(Boolean)
    : null;

  const payload: TablesInsert<"seo_settings"> = {
    business_id: businessId,
    default_meta_title_suffix:
      ((formData.get("default_meta_title_suffix") as string) || "").trim() || null,
    google_analytics_id: ((formData.get("google_analytics_id") as string) || "").trim() || null,
    google_tag_manager_id:
      ((formData.get("google_tag_manager_id") as string) || "").trim() || null,
    google_business_profile_url:
      ((formData.get("google_business_profile_url") as string) || "").trim() || null,
    robots_txt: ((formData.get("robots_txt") as string) || "").trim() || null,
    schema_org_data: schemaOrgData,
    sitemap_excludes: sitemapExcludes,
  };

  const { error } = await supabase
    .from("seo_settings")
    .upsert(payload, { onConflict: "business_id" });
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/settings");
  revalidateCommonSitePaths();
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
  const fromPath = ((formData.get("from_path") as string) || "").trim();
  const toPath = ((formData.get("to_path") as string) || "").trim();
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


type BulkImportTargetTable = "blog_posts" | "pages" | "services" | "service_areas";

export async function bulkImportContentAction(formData: FormData) {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const table = ((formData.get("table") as string) || "").trim() as BulkImportTargetTable;
  const recordId = ((formData.get("record_id") as string) || "").trim();
  const mode = (((formData.get("mode") as string) || "replace").trim() || "replace") as
    | "append"
    | "replace";
  const rawContent = ((formData.get("import_text") as string) || "").trim();

  if (!["blog_posts", "pages", "services", "service_areas"].includes(table)) {
    throw new Error("Unsupported content type");
  }
  if (!recordId) throw new Error("Select a destination record");
  if (!rawContent) throw new Error("Paste content to import");

  const importedBlocks = parseImportedContentToBlocks(rawContent);
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

  const currentBlocks = Array.isArray(existing.content) ? (existing.content as Json[]) : [];
  const nextContent =
    mode === "append"
      ? ([...currentBlocks, ...(importedBlocks as unknown as Json[])] as Json)
      : (importedBlocks as unknown as Json);

  const { error: updateError } = await supabase
    .from(table)
    .update({ content: nextContent } as any)
    .eq("id", recordId)
    .eq("business_id", businessId);
  if (updateError) throw new Error(updateError.message);

  if (table === "blog_posts") {
    revalidatePath("/dashboard/blog");
    revalidatePath(`/dashboard/blog/${recordId}`);
    revalidatePath("/blog");
    if (existing.slug) revalidatePath(`/blog/${existing.slug}`);
  }
  if (table === "pages") {
    revalidatePath("/dashboard/pages");
    revalidatePath(`/dashboard/pages/${recordId}`);
    if (existing.slug) revalidatePath(`/${existing.slug}`);
  }
  if (table === "services") {
    revalidatePath("/dashboard/services");
    revalidatePath(`/dashboard/services/${recordId}`);
    revalidatePath("/services");
    revalidatePath("/areas");
    if (existing.slug) revalidatePath(`/services/${existing.slug}`);
  }
  if (table === "service_areas") {
    revalidatePath("/dashboard/areas");
    revalidatePath(`/dashboard/areas/${recordId}`);
    revalidatePath("/areas");
    if (existing.slug) revalidatePath(`/areas/${existing.slug}`);
  }

  return {
    success: true,
    importedBlocks: importedBlocks.length,
    mode,
    table,
    recordId,
  };
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
  service_area_ids: string[];
}

interface EditableBeforeAfterGroup {
  before_urls: string[];
  after_urls: string[];
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
            service_area_ids: [],
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
        const AreaIds = Array.isArray(row.service_area_ids)
          ? row.service_area_ids
              .filter((value): value is string => typeof value === "string")
              .map((value) => value.trim())
              .filter(Boolean)
          : [];

        return {
          title,
          summary,
          photo_urls: photoUrls,
          service_area_ids: Array.from(new Set(AreaIds)),
        };
      })
      .filter((item) => item.title || item.summary || item.photo_urls.length > 0);
  } catch {
    return [];
  }
}

function trimTrailingEmptyStrings(values: string[]) {
  const next = [...values];
  while (next.length > 0 && !next[next.length - 1]) next.pop();
  return next;
}

function parseBeforeAfterGroups(raw: string): EditableBeforeAfterGroup[] {
  if (!raw.trim()) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          return { before_urls: [], after_urls: [] };
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
        return { before_urls: beforeUrls, after_urls: afterUrls };
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

interface EditableLineItem {
  description: string;
  qty: number;
  unit_price: number;
  total: number;
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
        };
      })
      .filter((item) => item.description.length > 0);
  } catch {
    return [];
  }
}

async function resolveCurrentBusinessId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("business_id")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return profile?.business_id ?? null;
}

async function ensureUniqueSlug(options: {
  table: "blog_posts" | "pages" | "services" | "service_areas" | "projects";
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
  await assertAdminDashboardAction();
  const supabase = await createClient();

  const id = (formData.get("id") as string) || null;
  const businessId =
    (formData.get("business_id") as string) || (await resolveCurrentBusinessId()) || "";

  if (!businessId) throw new Error("Business context is required");

  const title = (formData.get("title") as string) || "";
  const explicitSlug = (formData.get("slug") as string) || "";
  const slug = explicitSlug || slugify(title);

  if (!title.trim()) throw new Error("Title is required");
  if (!slug) throw new Error("Slug is required");
  const parentServiceId = ((formData.get("parent_service_id") as string) || "").trim() || null;
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
    content = sanitizePageContentForSave(parsed) as unknown as Json;
  } catch {
    content = [];
  }
  const beforeGalleryUrls = parseJsonStringArray(
    (formData.get("before_gallery_urls") as string) || "[]",
  );
  const afterGalleryUrls = parseJsonStringArray(
    (formData.get("after_gallery_urls") as string) || "[]",
  );
  const parsedBeforeAfterGroups = parseBeforeAfterGroups(
    (formData.get("before_after_groups") as string) || "[]",
  );
  const beforeAfterGroups =
    parsedBeforeAfterGroups.length > 0
      ? parsedBeforeAfterGroups
      : Array.from({ length: Math.max(beforeGalleryUrls.length, afterGalleryUrls.length) }, (_, index) => ({
          before_urls: beforeGalleryUrls[index] ? [beforeGalleryUrls[index]] : [],
          after_urls: afterGalleryUrls[index] ? [afterGalleryUrls[index]] : [],
        })).filter((group) => group.before_urls.length > 0 || group.after_urls.length > 0);
  const legacyBeforeGalleryUrls = trimTrailingEmptyStrings(
    beforeAfterGroups.map((group) => group.before_urls[0] ?? ""),
  );
  const legacyAfterGalleryUrls = trimTrailingEmptyStrings(
    beforeAfterGroups.map((group) => group.after_urls[0] ?? ""),
  );
  const serviceProjects = parseServiceProjects(
    (formData.get("service_projects") as string) || "[]",
  );

  const service: TablesInsert<"services"> = {
    after_gallery_urls: legacyAfterGalleryUrls,
    before_after_groups: beforeAfterGroups as unknown as Json,
    business_id: businessId,
    before_gallery_urls: legacyBeforeGalleryUrls,
    title: title.trim(),
    slug,
    excerpt: ((formData.get("excerpt") as string) || "").trim() || null,
    content,
    icon: ((formData.get("icon") as string) || "").trim() || null,
    featured_image_url:
      ((formData.get("featured_image_url") as string) || "").trim() || null,
    price_range_min: parseNullableNumber(formData.get("price_range_min")),
    price_range_max: parseNullableNumber(formData.get("price_range_max")),
    sort_order: parseNullableNumber(formData.get("sort_order")) ?? 0,
    meta_title: ((formData.get("meta_title") as string) || "").trim() || null,
    meta_description:
      ((formData.get("meta_description") as string) || "").trim() || null,
    parent_service_id: parentServiceId,
    service_projects: serviceProjects as unknown as Json,
  };

  if (id) {
    const { data, error } = await supabase
      .from("services")
      .update(service)
      .eq("id", id)
      .eq("business_id", businessId)
      .select("id, slug")
      .single();

    if (error) throw new Error(error.message);

    revalidatePath("/dashboard/services");
    revalidatePath(`/dashboard/services/${id}`);
    revalidatePath("/services");
    revalidatePath(`/services/${data.slug}`);
    return { success: true, id: data.id };
  }

  const { data, error } = await supabase
    .from("services")
    .insert(service)
    .select("id, slug")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/services");
  revalidatePath(`/dashboard/services/${data.id}`);
  revalidatePath("/services");
  revalidatePath(`/services/${data.slug}`);
  return { success: true, id: data.id };
}

export async function deleteService(id: string) {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
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
  revalidatePath("/services");
  revalidatePath(`/services/${existing.slug}`);
  return { success: true };
}

export async function deleteServicesBulk(ids: string[]) {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
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
    revalidatePath(`/services/${row.slug}`);
  }

  return { success: true, deleted: deletableIds.length };
}

// ---- Page CRUD ----

export async function savePage(formData: FormData) {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const id = (formData.get("id") as string) || null;
  const businessId =
    (formData.get("business_id") as string) || (await resolveCurrentBusinessId()) || "";

  if (!businessId) throw new Error("Business context is required");

  let content: Json = [];
  const contentRaw = (formData.get("content") as string) || "[]";
  try {
    const parsed = JSON.parse(contentRaw) as unknown;
    content = sanitizePageContentForSave(parsed) as unknown as Json;
  } catch {
    content = [];
  }

  const page: TablesInsert<"pages"> = {
    business_id: businessId,
    title: ((formData.get("title") as string) || "").trim(),
    slug:
      ((formData.get("slug") as string) || "").trim() ||
      slugify((formData.get("title") as string) || ""),
    content,
    show_in_nav: (formData.get("show_in_nav") as string) === "on",
    sort_order: parseNullableNumber(formData.get("sort_order")) ?? 0,
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
      .single();
    if (error) throw new Error(error.message);

    revalidatePath("/dashboard/pages");
    revalidatePath(`/dashboard/pages/${id}`);
    revalidatePath(`/${data.slug}`);
    return { success: true, id: data.id };
  }

  const { data, error } = await supabase
    .from("pages")
    .insert(page)
    .select("id, slug")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/pages");
  revalidatePath(`/dashboard/pages/${data.id}`);
  revalidatePath(`/${data.slug}`);
  return { success: true, id: data.id };
}

export async function deletePage(id: string) {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const { data: existing, error: fetchError } = await supabase
    .from("pages")
    .select("slug")
    .eq("id", id)
    .eq("business_id", businessId)
    .single();
  if (fetchError) throw new Error(fetchError.message);
  if (existing.slug === "home") throw new Error("The Home page cannot be deleted.");

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
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const uniqueIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
  if (uniqueIds.length === 0) return { success: true, deletedCount: 0 };

  const { data: existing, error: fetchError } = await supabase
    .from("pages")
    .select("id, slug")
    .eq("business_id", businessId)
    .in("id", uniqueIds);
  if (fetchError) throw new Error(fetchError.message);

  const existingPages = (existing ?? []).filter((page) => page.slug !== "home");
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
    is_active: ((formData.get("is_active") as string) || "on") !== "off",
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
    sort_order: parseNullableNumber(formData.get("sort_order")) ?? 0,
    is_global: (formData.get("is_global") as string) === "on",
    schema_markup: (formData.get("schema_markup") as string) !== "off",
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
  revalidatePath("/areas");
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
  revalidatePath("/areas");
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
  revalidatePath("/areas");
  for (const id of existingIds) {
    revalidatePath(`/dashboard/faqs/${id}`);
  }
  return { success: true, deletedCount: existingIds.length };
}

// ---- Area CRUD ----

export async function saveArea(formData: FormData) {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const id = (formData.get("id") as string) || null;
  const businessId =
    (formData.get("business_id") as string) || (await resolveCurrentBusinessId()) || "";
  if (!businessId) throw new Error("Business context is required");

  let content: Json = [];
  const contentRaw = (formData.get("content") as string) || "[]";
  try {
    content = JSON.parse(contentRaw) as Json;
  } catch {
    content = [];
  }

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

  const area: TablesInsert<"service_areas"> = {
    business_id: businessId,
    name: ((formData.get("name") as string) || "").trim(),
    slug:
      ((formData.get("slug") as string) || "").trim() ||
      slugify((formData.get("name") as string) || ""),
    content,
    featured_image_url:
      ((formData.get("featured_image_url") as string) || "").trim() || null,
    meta_title: ((formData.get("meta_title") as string) || "").trim() || null,
    meta_description:
      ((formData.get("meta_description") as string) || "").trim() || null,
  };

  if (!area.name) throw new Error("Name is required");
  if (!area.slug) throw new Error("Slug is required");
  await ensureUniqueSlug({
    table: "service_areas",
    businessId,
    slug: area.slug,
    id,
    label: "Area",
  });

  let areaId = id;
  if (id) {
    const { data, error } = await supabase
      .from("service_areas")
      .update(area)
      .eq("id", id)
      .eq("business_id", businessId)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    areaId = data.id;
  } else {
    const { data, error } = await supabase
      .from("service_areas")
      .insert(area)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    areaId = data.id;
  }

  if (!areaId) throw new Error("Unable to save Area");

  const { error: deleteLinksError } = await supabase
    .from("service_area_services")
    .delete()
    .eq("service_area_id", areaId);
  if (deleteLinksError) throw new Error(deleteLinksError.message);

  if (linkedServiceIds.length > 0) {
    const linkRows: TablesInsert<"service_area_services">[] = linkedServiceIds.map(
      (serviceId) => ({
        service_area_id: areaId as string,
        service_id: serviceId,
      })
    );
    const { error: insertLinksError } = await supabase
      .from("service_area_services")
      .insert(linkRows);
    if (insertLinksError) throw new Error(insertLinksError.message);
  }

  revalidatePath("/dashboard/areas");
  revalidatePath(`/dashboard/areas/${areaId}`);
  revalidatePath("/areas");
  return { success: true, id: areaId };
}

export async function deleteArea(id: string) {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const { error: deleteLinksError } = await supabase
    .from("service_area_services")
    .delete()
    .eq("service_area_id", id);
  if (deleteLinksError) throw new Error(deleteLinksError.message);

  const { error } = await supabase
    .from("service_areas")
    .delete()
    .eq("id", id)
    .eq("business_id", businessId);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/areas");
  revalidatePath("/areas");
  return { success: true };
}

export async function deleteAreasBulk(ids: string[]) {
  await assertAdminDashboardAction();
  const supabase = await createClient();
  const businessId = await resolveCurrentBusinessId();
  if (!businessId) throw new Error("Business context is required");

  const uniqueIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
  if (uniqueIds.length === 0) return { success: true, deletedCount: 0 };

  const { data: existingAreas, error: fetchError } = await supabase
    .from("service_areas")
    .select("id")
    .eq("business_id", businessId)
    .in("id", uniqueIds);
  if (fetchError) throw new Error(fetchError.message);

  const existingIds = (existingAreas ?? []).map((area) => area.id);
  if (existingIds.length === 0) return { success: true, deletedCount: 0 };

  const { error: deleteLinksError } = await supabase
    .from("service_area_services")
    .delete()
    .in("service_area_id", existingIds);
  if (deleteLinksError) throw new Error(deleteLinksError.message);

  const { error } = await supabase
    .from("service_areas")
    .delete()
    .eq("business_id", businessId)
    .in("id", existingIds);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/areas");
  revalidatePath("/areas");
  for (const id of existingIds) {
    revalidatePath(`/dashboard/areas/${id}`);
  }
  return { success: true, deletedCount: existingIds.length };
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
    .select("name")
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

  const { data: template, error: templateError } = await supabase
    .from("email_templates")
    .select("*")
    .eq("business_id", businessId)
    .eq("type", "review_request")
    .eq("is_active", true)
    .maybeSingle();
  if (templateError) throw new Error(templateError.message);

  const customerName =
    [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim() || "there";
  const businessName = business?.name ?? "our team";

  const fallbackSubject = `How did we do on your ${jobTitle} project?`;
  const fallbackText = `Hi ${customerName}, thanks for choosing ${businessName}. If you have a moment, please leave us a quick Google review: ${reviewUrl}`;
  const fallbackHtml = `<p>Hi ${customerName},</p><p>Thanks for choosing ${businessName}.</p><p>If you have a moment, please leave us a quick Google review:</p><p><a href="${reviewUrl}">${reviewUrl}</a></p>`;

  const rendered = template
    ? renderTemplate(template, {
        customer_name: customerName,
        business_name: businessName,
        review_link: reviewUrl,
        job_title: jobTitle,
      })
    : { subject: fallbackSubject, html: fallbackHtml, text: fallbackText };

  try {
    const resendData = await sendEmail({
      to: contact.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });

    const { error: logError } = await supabase.from("email_log").insert({
      business_id: businessId,
      template_id: template?.id ?? null,
      contact_id: contact.id,
      to_email: contact.email,
      subject: rendered.subject,
      resend_id: resendData?.id || null,
      status: "sent",
      related_type: "job_review_request",
      related_id: jobId,
      sent_at: new Date().toISOString(),
    });
    if (logError) throw new Error(logError.message);
  } catch (sendError) {
    const message = sendError instanceof Error ? sendError.message : "Failed to send review request";
    await supabase.from("email_log").insert({
      business_id: businessId,
      template_id: template?.id ?? null,
      contact_id: contact.id,
      to_email: contact.email,
      subject: rendered.subject,
      status: "failed",
      related_type: "job_review_request",
      related_id: jobId,
      sent_at: new Date().toISOString(),
    });
    throw new Error(message);
  }
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

  const contact: TablesInsert<"contacts"> = {
    first_name: ((formData.get("first_name") as string) || "").trim() || null,
    last_name: ((formData.get("last_name") as string) || "").trim() || null,
    email: ((formData.get("email") as string) || "").trim() || null,
    phone: ((formData.get("phone") as string) || "").trim() || null,
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

  if (!contact.first_name && !contact.last_name) {
    throw new Error("At least a first or last name is required");
  }

  if (id) {
    const { error } = await supabase
      .from("contacts")
      .update(contact)
      .eq("id", id)
      .eq("business_id", businessId);
    if (error) throw new Error(error.message);
    revalidatePath(`/dashboard/contacts/${id}`);
  } else {
    const { data, error } = await supabase
      .from("contacts")
      .insert(contact)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath(`/dashboard/contacts/${data.id}`);
  }

  revalidatePath("/dashboard/contacts");
  return { success: true };
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
    revalidatePath(`/dashboard/contacts/${estimate.contact_id}`);
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

  const invoice: TablesInsert<"invoices"> = {
    business_id: businessId,
    contact_id: ((formData.get("contact_id") as string) || "").trim(),
    invoice_number:
      ((formData.get("invoice_number") as string) || "").trim() || `INV-${Date.now()}`,
    status: (formData.get("status") as any) || "draft",
    due_date: ((formData.get("due_date") as string) || "").trim() || null,
    notes: ((formData.get("notes") as string) || "").trim() || null,
    line_items: lineItems as unknown as Json,
    subtotal,
    tax_rate: taxRate,
    tax,
    total,
    amount_paid: parseNullableNumber(formData.get("amount_paid")) ?? 0,
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
  } else {
    const { data, error } = await supabase
      .from("invoices")
      .insert(invoice)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath(`/dashboard/invoices/${data.id}`);
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

  const { error } = await supabase
    .from("contacts")
    .delete()
    .eq("id", id)
    .eq("business_id", businessId);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/contacts");
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

  // Fetch email template
  const { data: template } = await supabase
    .from("email_templates")
    .select("*")
    .eq("business_id", (estimate as any).business_id)
    .eq("type", "estimate_sent")
    .eq("is_active", true)
    .single();

  if (template) {
    const contact = (estimate as any).contacts as any;

    const rendered = renderTemplate(template as any, {
      customer_name: `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim(),
      estimate_number: (estimate as any).estimate_number,
      total: String((estimate as any).total),
    });

    const resendData = await sendEmail({
      to: contact.email,
      ...rendered,
    });

    // Log the email
    await supabase.from("email_log").insert({
      business_id: (estimate as any).business_id,
      template_id: (template as any).id,
      contact_id: contact.id,
      to_email: contact.email,
      subject: rendered.subject,
      resend_id: (resendData as any)?.id || null,
      status: "sent",
      related_id: estimateId,
      related_type: "estimate",
      sent_at: new Date().toISOString(),
    });
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
    console.error("Unable to sync estimate to QuickBooks:", quickBooksError);
  }

  revalidatePath("/dashboard/estimates");
  revalidatePath("/dashboard/contacts");
  revalidatePath(`/dashboard/contacts/${(estimate as any).contact_id}`);
  return { success: true };
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

  const { data: template } = await supabase
    .from("email_templates")
    .select("*")
    .eq("business_id", (invoice as any).business_id)
    .eq("type", "invoice_sent")
    .eq("is_active", true)
    .single();

  if (template) {
    const contact = (invoice as any).contacts as any;

    const rendered = renderTemplate(template as any, {
      customer_name: `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim(),
      invoice_number: (invoice as any).invoice_number,
      total: String((invoice as any).total),
      due_date: (invoice as any).due_date || "",
    });

    const resendData = await sendEmail({
      to: contact.email,
      ...rendered,
    });

    await supabase.from("email_log").insert({
      business_id: (invoice as any).business_id,
      template_id: (template as any).id,
      contact_id: contact.id,
      to_email: contact.email,
      subject: rendered.subject,
      resend_id: (resendData as any)?.id || null,
      status: "sent",
      related_type: "invoice",
      related_id: invoiceId,
      sent_at: new Date().toISOString(),
    });
  }

  await supabase
    .from("invoices")
    .update({ status: "sent", sent_at: new Date().toISOString() } as any)
    .eq("id", invoiceId);

  try {
    await syncQuickBooksInvoiceForInvoice(invoiceId);
  } catch (quickBooksError) {
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

  const { error } = await supabase.from("payments").insert(payment);
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

  revalidatePath("/dashboard/invoices");
  return { success: true };
}

// ---- Activity logging helper ----

export async function logActivity(
  businessId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Json | null
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const payload: TablesInsert<"activity_log"> = {
    business_id: businessId,
    user_id: user?.id ?? null,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata: metadata ?? null,
  };

  const { error } = await supabase.from("activity_log").insert(payload);
  if (error) throw new Error(error.message);
}






