"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import {
  assetStatuses,
  assetTags,
  type AssetStatus,
} from "@/lib/assets/constants";
import {
  validateOrganizationAssetUpload,
  type OrganizationAssetUploadPayload,
} from "@/lib/assets/validation";
import { brandIntakeQuestions } from "@/lib/brand-intake/questions";
import {
  brandProfileStatus,
  splitSocialLinks,
  type BrandProfile,
} from "@/lib/brand-intake/profile";
import {
  canRetryVideo,
  normalizeBatchSize,
  nextRetryCount,
  validateBatchSize,
  validateVideoLengthSeconds,
  type VideoStatus,
} from "@/lib/batches/rules";
import {
  requireOrganization,
  requireUser,
} from "@/lib/customer/organization";
import {
  createQueuedVideoOutputs,
  runCampaignGenerationWorker,
  runVideoOutputRetryWorker,
} from "@/lib/videos/background-generation";
import { sweepStaleRenderJobs } from "@/lib/providers/stale-jobs";
import { pollRemotionRenders } from "@/lib/videos/render-progress";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

const assetTagSet = new Set<string>(assetTags);
const assetStatusSet = new Set<string>(assetStatuses);

function optionalString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function optionalInteger(
  formData: FormData,
  key: string,
  fallback: number,
) {
  const value = optionalString(formData, key);

  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed)) {
    throw new Error(`${key} must be an integer`);
  }

  return parsed;
}

function requiredString(formData: FormData, key: string) {
  const value = optionalString(formData, key);

  if (!value) {
    throw new Error(`${key} is required`);
  }

  return value;
}

function slugify(value: string) {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return base || "workspace";
}

function tagsFromForm(formData: FormData) {
  return formData
    .getAll("tags")
    .filter((tag): tag is string => typeof tag === "string" && assetTagSet.has(tag));
}

function assetStatusFromForm(formData: FormData): AssetStatus {
  const status = optionalString(formData, "status") ?? "uploaded";

  if (!assetStatusSet.has(status)) {
    throw new Error("Invalid asset status");
  }

  return status as AssetStatus;
}

function revalidateCustomerMvpPaths() {
  revalidatePath("/app");
  revalidatePath("/app/assets");
  revalidatePath("/app/inbox");
}

function campaignTitleFromProfile(profile: BrandProfile | null, fallback: string) {
  return profile?.business_name
    ? `${profile.business_name} UGC batch`
    : fallback;
}

function brandProfilePayloadFromForm(formData: FormData) {
  const socialLinks = splitSocialLinks(optionalString(formData, "social_links"));
  const profile: BrandProfile = {
    business_name: requiredString(formData, "business_name"),
    website_url: optionalString(formData, "website_url"),
    social_links: socialLinks,
    location: optionalString(formData, "location"),
    industry: optionalString(formData, "industry"),
    what_they_do: optionalString(formData, "what_they_do"),
    why_they_do_it: optionalString(formData, "why_they_do_it"),
    promoting: optionalString(formData, "promoting"),
    target_customer: optionalString(formData, "target_customer"),
    main_pain_points: optionalString(formData, "main_pain_points"),
    offer_cta: optionalString(formData, "offer_cta"),
    tone: optionalString(formData, "tone"),
    tone_examples: optionalString(formData, "tone_examples"),
    raw_notes: optionalString(formData, "raw_notes"),
  };

  return {
    ...profile,
    status: brandProfileStatus(profile),
  };
}

function intakeTranscriptRows(
  organizationId: string,
  brandProfileId: string,
  profile: BrandProfile,
) {
  return brandIntakeQuestions.flatMap((question, index) => {
    const value = profile[question.name];
    const answer = Array.isArray(value) ? value.join("\n") : value;
    const sortOrder = index * 2;

    return [
      {
        organization_id: organizationId,
        brand_profile_id: brandProfileId,
        author: "assistant",
        prompt_key: question.name,
        content: question.prompt,
        sort_order: sortOrder,
      },
      {
        organization_id: organizationId,
        brand_profile_id: brandProfileId,
        author: "user",
        prompt_key: question.name,
        content: typeof answer === "string" && answer.trim() ? answer.trim() : "Skipped",
        sort_order: sortOrder + 1,
      },
    ];
  });
}

export async function createWorkspaceAction(formData: FormData) {
  const { supabase, user } = await requireUser("/app/setup");
  const businessName = requiredString(formData, "business_name");
  const organizationId = crypto.randomUUID();
  const slug = `${slugify(businessName)}-${organizationId.slice(0, 8)}`;

  const { error: organizationError } = await supabase
    .from("organizations")
    .insert({
      id: organizationId,
      name: businessName,
      slug,
      owner_user_id: user.id,
    });

  if (organizationError) {
    throw new Error(organizationError.message);
  }

  const { error: membershipError } = await supabase
    .from("organization_members")
    .insert({
      organization_id: organizationId,
      user_id: user.id,
      email: user.email?.toLowerCase() ?? null,
      role: "owner",
    });

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  const { error: profileError } = await supabase.from("brand_profiles").insert({
    organization_id: organizationId,
    business_name: businessName,
    website_url: optionalString(formData, "website_url"),
    social_links: splitSocialLinks(optionalString(formData, "social_links")),
    location: optionalString(formData, "location"),
    industry: optionalString(formData, "industry"),
    status: "draft",
  });

  if (profileError) {
    throw new Error(profileError.message);
  }

  revalidatePath("/app");
  redirect("/app/brand");
}

export async function saveBrandProfileAction(formData: FormData) {
  const { supabase, organization } = await requireOrganization("/app/brand");
  const payload = brandProfilePayloadFromForm(formData);

  const { data: profile, error: profileError } = await supabase
    .from("brand_profiles")
    .upsert(
      {
        organization_id: organization.id,
        ...payload,
      },
      { onConflict: "organization_id" },
    )
    .select("id")
    .single();

  if (profileError || !profile) {
    throw new Error(profileError?.message ?? "Brand profile could not be saved");
  }

  const profileId = profile.id as string;
  const { error: deleteError } = await supabase
    .from("intake_messages")
    .delete()
    .eq("organization_id", organization.id)
    .eq("brand_profile_id", profileId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const rows = intakeTranscriptRows(organization.id, profileId, payload);
  const { error: transcriptError } = await supabase
    .from("intake_messages")
    .insert(rows);

  if (transcriptError) {
    throw new Error(transcriptError.message);
  }

  await supabase
    .from("organizations")
    .update({ name: payload.business_name })
    .eq("id", organization.id);

  revalidatePath("/app");
  revalidatePath("/app/brand");
  redirect("/app/brand?saved=1");
}

export async function recordOrganizationAssetUploadAction(
  payload: OrganizationAssetUploadPayload,
) {
  const { supabase, organization } = await requireOrganization("/app/assets");

  if (payload.organizationId !== organization.id) {
    throw new Error("Asset does not belong to this workspace");
  }

  const validation = validateOrganizationAssetUpload(payload);

  if (payload.brandProfileId) {
    const { data: profile, error: profileError } = await supabase
      .from("brand_profiles")
      .select("id")
      .eq("id", payload.brandProfileId)
      .eq("organization_id", organization.id)
      .single();

    if (profileError || !profile) {
      throw new Error("Brand profile not found for this workspace");
    }
  }

  const { error } = await supabase.from("organization_assets").insert({
    id: payload.id,
    organization_id: organization.id,
    brand_profile_id: payload.brandProfileId ?? null,
    storage_path: payload.storagePath,
    thumbnail_path: payload.thumbnailPath ?? null,
    filename: payload.filename,
    content_type: payload.contentType ?? null,
    size_bytes: Math.trunc(payload.sizeBytes),
    duration_seconds: validation.durationSeconds,
    rights_confirmed: true,
    tags: validation.tags,
    notes: optionalPayloadString(payload.notes),
    selected: false,
    status: validation.tags.length > 0 ? "tagged" : "uploaded",
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidateCustomerMvpPaths();

  return { id: payload.id };
}

export async function updateOrganizationAssetAction(
  assetId: string,
  formData: FormData,
) {
  const { supabase, organization } = await requireOrganization("/app/assets");
  const tags = tagsFromForm(formData);
  const status = assetStatusFromForm(formData);
  const selected = formData.get("selected") === "on" || status === "selected";

  const { error } = await supabase
    .from("organization_assets")
    .update({
      tags,
      notes: optionalString(formData, "notes"),
      selected,
      status: selected ? "selected" : status,
    })
    .eq("id", assetId)
    .eq("organization_id", organization.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidateCustomerMvpPaths();
}

export async function deleteOrganizationAssetAction(assetId: string) {
  const { supabase, organization } = await requireOrganization("/app/assets");
  const { data: asset, error: findError } = await supabase
    .from("organization_assets")
    .select("storage_bucket,storage_path,thumbnail_path")
    .eq("id", assetId)
    .eq("organization_id", organization.id)
    .single();

  if (findError || !asset) {
    throw new Error("Asset not found");
  }

  const paths = [asset.storage_path, asset.thumbnail_path].filter(
    (path): path is string => typeof path === "string" && path.length > 0,
  );

  if (paths.length > 0) {
    const { error: removeError } = await supabase.storage
      .from(asset.storage_bucket || "client-assets")
      .remove(paths);

    if (removeError) {
      throw new Error(removeError.message);
    }
  }

  const { error } = await supabase
    .from("organization_assets")
    .delete()
    .eq("id", assetId)
    .eq("organization_id", organization.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidateCustomerMvpPaths();
}

function scheduleCampaignGenerationWorker(input: {
  campaignId: string;
  organizationId: string;
}) {
  after(async () => {
    try {
      const result = await runCampaignGenerationWorker(input);

      if (result.status === "failed") {
        console.error("Background video generation failed", result);
      }
    } catch (error) {
      console.error("Background video generation worker crashed", error);
    }
  });
}

function scheduleVideoRetryWorker(input: {
  videoOutputId: string;
  organizationId: string;
}) {
  after(async () => {
    try {
      const result = await runVideoOutputRetryWorker(input);

      if (result.status === "failed") {
        console.error("Background video retry failed", result);
      }
    } catch (error) {
      console.error("Background video retry worker crashed", error);
    }
  });
}

// Powers the dashboard "Generate videos" button. It only creates queued
// campaign/video rows; script writing, voiceover, and rendering continue in
// the background worker.
export async function generateVideosAction(formData: FormData) {
  const { supabase, organization } = await requireOrganization("/app");
  const serviceSupabase = getServiceRoleClient();
  const { profile } = await getRequiredBrandProfile(supabase, organization.id);
  const batchSize = validateBatchSize(
    normalizeBatchSize(optionalInteger(formData, "batch_size", 3)),
  );
  const videoLengthSeconds = validateVideoLengthSeconds(
    optionalInteger(formData, "video_length_seconds", 30),
  );
  const title = campaignTitleFromProfile(profile, "UGC videos");
  const goal =
    profile.promoting ?? profile.offer_cta ?? "Generate UGC ad concepts";
  const research = await getLatestResearch(supabase, organization.id);

  const { data: campaign, error: campaignError } = await serviceSupabase
    .from("campaigns")
    .insert({
      organization_id: organization.id,
      brand_profile_id: profile.id ?? null,
      research_report_id: research?.id ?? null,
      title,
      goal,
      batch_size: batchSize,
      video_length_seconds: videoLengthSeconds,
      status: "queued",
      admin_review_required: false,
    })
    .select("id")
    .single();

  if (campaignError || !campaign) {
    throw new Error(campaignError?.message ?? "Campaign could not be created");
  }

  try {
    await createQueuedVideoOutputs({
      organizationId: organization.id,
      campaignId: campaign.id,
      title,
      batchSize,
      durationSeconds: videoLengthSeconds,
    });
  } catch (error) {
    await serviceSupabase
      .from("campaigns")
      .update({
        status: "failed",
        failed_at: new Date().toISOString(),
        error_message:
          error instanceof Error ? error.message : "Video generation failed",
      })
      .eq("id", campaign.id)
      .eq("organization_id", organization.id);

    throw error;
  }

  scheduleCampaignGenerationWorker({
    campaignId: campaign.id,
    organizationId: organization.id,
  });
  revalidateCustomerMvpPaths();
  redirect("/app/inbox?generated=1");
}

// Powers the in-app polling loop on the inbox page: while a video is
// `rendering`, the client calls this every ~30s so a detached Remotion
// render's completion (or failure) shows up without waiting on the daily
// cron. Scoped to the caller's own organization so an authenticated user
// can only nudge their own render jobs.
export async function pollRendersAction() {
  const { organization } = await requireOrganization("/app/inbox");
  const serviceSupabase = getServiceRoleClient();

  const swept = await sweepStaleRenderJobs(serviceSupabase, {
    organizationId: organization.id,
  });
  const results = await pollRemotionRenders(serviceSupabase, {
    organizationId: organization.id,
  });

  revalidateCustomerMvpPaths();

  return {
    swept: swept.swept,
    running: results.filter((result) => result.status === "running").length,
    ready: results.filter((result) => result.status === "ready").length,
    failed: results.filter((result) => result.status === "failed").length,
  };
}

export async function retryVideoOutputAction(videoOutputId: string) {
  const { supabase, organization } = await requireOrganization("/app/inbox");
  const { data: video, error: videoError } = await supabase
    .from("video_outputs")
    .select("id,status,retry_count,max_retries")
    .eq("id", videoOutputId)
    .eq("organization_id", organization.id)
    .single();

  if (videoError || !video) {
    throw new Error("Video not found");
  }

  if (
    !canRetryVideo({
      status: video.status as VideoStatus,
      retryCount: video.retry_count,
      maxRetries: video.max_retries,
    })
  ) {
    throw new Error("Retry limit reached or video is not failed");
  }

  const retryAttempt = nextRetryCount({
    status: video.status as VideoStatus,
    retryCount: video.retry_count,
    maxRetries: video.max_retries,
  });
  const serviceSupabase = getServiceRoleClient();
  const { data: retryClaim, error: retryClaimError } = await serviceSupabase
    .from("video_outputs")
    .update({
      status: "queued",
      retry_count: retryAttempt,
      error_message: null,
    })
    .eq("id", videoOutputId)
    .eq("organization_id", organization.id)
    .eq("status", "failed")
    .eq("retry_count", video.retry_count)
    .select("id")
    .single();

  if (retryClaimError || !retryClaim) {
    throw new Error("Video is already being retried or is no longer failed");
  }

  scheduleVideoRetryWorker({
    videoOutputId,
    organizationId: organization.id,
  });
  revalidateCustomerMvpPaths();
}

function optionalPayloadString(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function getRequiredBrandProfile(
  supabase: Awaited<ReturnType<typeof requireOrganization>>["supabase"],
  organizationId: string,
) {
  const { data: profile, error } = await supabase
    .from("brand_profiles")
    .select(
      "id,organization_id,business_name,website_url,social_links,location,industry,what_they_do,why_they_do_it,promoting,target_customer,main_pain_points,offer_cta,tone,tone_examples,raw_notes,status",
    )
    .eq("organization_id", organizationId)
    .single();

  if (error || !profile) {
    throw new Error("Complete brand intake before continuing");
  }

  return { profile: profile as BrandProfile };
}

async function getLatestResearch(
  supabase: Awaited<ReturnType<typeof requireOrganization>>["supabase"],
  organizationId: string,
) {
  const { data, error } = await supabase
    .from("research_reports")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("status", "ready")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as { id: string } | null;
}
