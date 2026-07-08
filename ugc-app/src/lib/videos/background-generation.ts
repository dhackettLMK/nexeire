import "server-only";

import {
  customerAssetBucket,
  generatedMediaBucket,
  organizationGeneratedVideoPath,
  organizationVoiceoverPath,
  signedUrlTtlSeconds,
} from "@/lib/assets/validation";
import {
  maxVideoRetries,
  summarizeBatchStatus,
  validateRenderableScriptCount,
} from "@/lib/batches/rules";
import {
  splitSocialLinks,
  type BrandProfile,
} from "@/lib/brand-intake/profile";
import {
  normalizeProviderCostCents,
  providerCostIdempotencyKey,
  summarizeProviderCosts,
  type ProviderCostType,
} from "@/lib/providers/costs";
import {
  configuredRenderProvider,
  startRender,
} from "@/lib/providers/rendering";
import { generateVoiceover } from "@/lib/providers/voiceover";
import { generateScriptVariants } from "@/lib/scripts/generator";
import type {
  ScriptGenerationAsset,
  ScriptGenerationBrief,
  ScriptGenerationClient,
  ScriptGenerationResearch,
} from "@/lib/scripts/types";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import {
  createDefaultRenderPlan,
  normalizePersistedRenderPlan,
  renderPlanAssetsFromRows,
  withSignedAssetUrls,
  type RenderPlan,
  type RenderPlanAsset,
  type RenderPlanScriptInput,
} from "@/lib/videos/render-plan";

type ServiceSupabaseClient = ReturnType<typeof getServiceRoleClient>;

type CampaignGenerationCampaign = {
  id: string;
  organization_id: string;
  brand_profile_id: string | null;
  research_report_id: string | null;
  title: string;
  goal: string | null;
  batch_size: number;
  status: string;
  video_length_seconds: number;
};

type CampaignGenerationScript = {
  id: string;
  title: string;
  hook: string;
  voiceover: string;
  scene_plan: unknown;
  render_plan: unknown;
  suggested_broll: unknown;
  cta: string;
  caption: string;
};

type CampaignGenerationPlan = {
  campaign: CampaignGenerationCampaign;
  scripts: CampaignGenerationScript[];
};

type WorkerResult =
  | { status: "skipped"; campaignId?: string; reason: string }
  | { status: "succeeded"; campaignId: string; videos: number }
  | { status: "failed"; campaignId: string; error: string };

function messageFromError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function socialLinksValue(value: string[] | string | null | undefined) {
  return splitSocialLinks(value);
}

export async function createQueuedVideoOutputs(input: {
  organizationId: string;
  campaignId: string;
  title: string;
  batchSize: number;
  durationSeconds: number;
}) {
  const rows = Array.from({ length: input.batchSize }, (_, index) => ({
    organization_id: input.organizationId,
    campaign_id: input.campaignId,
    title:
      input.batchSize === 1
        ? input.title
        : `${input.title} ${index + 1}`,
    status: "queued",
    source: "automation",
    storage_bucket: generatedMediaBucket,
    caption: null,
    cta: null,
    duration_seconds: input.durationSeconds,
    max_retries: maxVideoRetries,
  }));

  const { error } = await getServiceRoleClient()
    .from("video_outputs")
    .insert(rows);

  if (error) {
    throw new Error(error.message);
  }
}

export async function runQueuedCampaignGenerationWorker(input?: {
  limit?: number;
}) {
  const limit = Math.min(Math.max(input?.limit ?? 3, 1), 10);
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select("id")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return Promise.all(
    (data ?? []).map((campaign) =>
      runCampaignGenerationWorker({ campaignId: campaign.id }),
    ),
  );
}

export async function runCampaignGenerationWorker(input: {
  campaignId: string;
  organizationId?: string;
}): Promise<WorkerResult> {
  const supabase = getServiceRoleClient();
  let query = supabase
    .from("campaigns")
    .update({
      status: "scripting",
      started_at: new Date().toISOString(),
      failed_at: null,
      error_message: null,
    })
    .eq("id", input.campaignId)
    .eq("status", "queued");

  if (input.organizationId) {
    query = query.eq("organization_id", input.organizationId);
  }

  const { data: campaign, error: claimError } = await query
    .select(
      "id,organization_id,brand_profile_id,research_report_id,title,goal,batch_size,status,video_length_seconds",
    )
    .maybeSingle();

  if (claimError) {
    throw new Error(claimError.message);
  }

  if (!campaign) {
    return {
      status: "skipped",
      campaignId: input.campaignId,
      reason: "campaign_not_queued",
    };
  }

  const typedCampaign = campaign as CampaignGenerationCampaign;

  try {
    await supabase
      .from("video_outputs")
      .update({ status: "scripting", error_message: null })
      .eq("campaign_id", typedCampaign.id)
      .eq("organization_id", typedCampaign.organization_id)
      .in("status", ["planned", "queued"]);

    const [profile, assets, research] = await Promise.all([
      getCampaignBrandProfile(supabase, typedCampaign),
      getScriptGenerationAssets(supabase, typedCampaign.organization_id),
      getCampaignResearch(supabase, typedCampaign),
    ]);
    const generated = await generateScriptVariants({
      client: brandProfileToScriptClient(profile),
      brief: brandProfileToScriptBrief(profile, {
        goal:
          typedCampaign.goal ??
          profile.promoting ??
          profile.offer_cta ??
          "Generate UGC ad concepts",
        batchSize: typedCampaign.batch_size,
        videoLengthSeconds: typedCampaign.video_length_seconds,
        researchSummary: research?.notes ?? null,
      }),
      assets,
      variantCount: typedCampaign.batch_size,
      research: researchToScriptInput(research),
    });
    const scripts = await insertCampaignScripts({
      supabase,
      campaign: typedCampaign,
      variants: generated.variants,
      riskyClaims: research?.risky_claims ?? [],
    });

    validateRenderableScriptCount(scripts.length, typedCampaign.batch_size);

    await attachVideoOutputsToScripts({
      supabase,
      organizationId: typedCampaign.organization_id,
      campaignId: typedCampaign.id,
      scripts,
      durationSeconds: typedCampaign.video_length_seconds,
    });
    await startCampaignGeneration(supabase, typedCampaign.organization_id, {
      campaign: typedCampaign,
      scripts,
    });

    return {
      status: "succeeded",
      campaignId: typedCampaign.id,
      videos: scripts.length,
    };
  } catch (error) {
    const message = messageFromError(error, "Video generation failed");

    await failCampaignGeneration(
      supabase,
      typedCampaign.organization_id,
      typedCampaign.id,
      message,
    );

    return { status: "failed", campaignId: typedCampaign.id, error: message };
  }
}

export async function runVideoOutputRetryWorker(input: {
  videoOutputId: string;
  organizationId: string;
}) {
  const supabase = getServiceRoleClient();
  const { data: video, error: videoError } = await supabase
    .from("video_outputs")
    .select("id,campaign_id,campaign_script_id,status,duration_seconds")
    .eq("id", input.videoOutputId)
    .eq("organization_id", input.organizationId)
    .eq("status", "queued")
    .single();

  if (videoError || !video) {
    return {
      status: "skipped" as const,
      videoOutputId: input.videoOutputId,
      reason: "video_not_queued",
    };
  }

  try {
    if (!video.campaign_id || !video.campaign_script_id) {
      throw new Error("Script not found for retry");
    }

    const { data: script, error: scriptError } = await supabase
      .from("campaign_scripts")
      .select(
        "id,title,hook,voiceover,scene_plan,render_plan,suggested_broll,cta,caption",
      )
      .eq("id", video.campaign_script_id)
      .eq("organization_id", input.organizationId)
      .single();

    if (scriptError || !script) {
      throw new Error("Script not found for retry");
    }

    await processVideoOutput(
      supabase,
      input.organizationId,
      video.campaign_id,
      input.videoOutputId,
      script as CampaignGenerationScript,
      video.duration_seconds,
    );
    await refreshCampaignStatus(
      supabase,
      input.organizationId,
      video.campaign_id,
    );

    return {
      status: "succeeded" as const,
      videoOutputId: input.videoOutputId,
    };
  } catch (error) {
    const message = messageFromError(error, "Video retry failed");

    await supabase
      .from("video_outputs")
      .update({ status: "failed", error_message: message })
      .eq("id", input.videoOutputId)
      .eq("organization_id", input.organizationId);

    if (video.campaign_id) {
      await refreshCampaignStatus(supabase, input.organizationId, video.campaign_id);
    }

    return { status: "failed" as const, videoOutputId: input.videoOutputId, error: message };
  }
}

async function getCampaignBrandProfile(
  supabase: ServiceSupabaseClient,
  campaign: CampaignGenerationCampaign,
) {
  let query = supabase
    .from("brand_profiles")
    .select(
      "id,organization_id,business_name,website_url,social_links,location,industry,what_they_do,why_they_do_it,promoting,target_customer,main_pain_points,offer_cta,tone,tone_examples,raw_notes,status",
    )
    .eq("organization_id", campaign.organization_id);

  if (campaign.brand_profile_id) {
    query = query.eq("id", campaign.brand_profile_id);
  }

  const { data, error } = await query.single();

  if (error || !data) {
    throw new Error("Complete brand intake before continuing");
  }

  return data as BrandProfile;
}

async function getScriptGenerationAssets(
  supabase: ServiceSupabaseClient,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from("organization_assets")
    .select("id,filename,content_type,duration_seconds,tags,notes,status,selected")
    .eq("organization_id", organizationId)
    .neq("status", "archived")
    .order("selected", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const assets = (data ?? []) as (ScriptGenerationAsset & { selected: boolean })[];
  const selected = assets.filter(
    (asset) => asset.selected || asset.status === "selected",
  );

  return selected.length > 0
    ? selected
    : assets.filter((asset) => (asset.tags ?? []).length > 0);
}

async function getCampaignResearch(
  supabase: ServiceSupabaseClient,
  campaign: CampaignGenerationCampaign,
) {
  let query = supabase
    .from("research_reports")
    .select(
      "id,offer,audience,tone,competitors,likely_objections,recommended_formats,citations,notes,risky_claims,status",
    )
    .eq("organization_id", campaign.organization_id)
    .eq("status", "ready");

  if (campaign.research_report_id) {
    query = query.eq("id", campaign.research_report_id);
  } else {
    query = query.order("updated_at", { ascending: false }).limit(1);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as
    | (ScriptGenerationResearch & {
        id: string;
        status: string;
      })
    | null;
}

function brandProfileToScriptClient(profile: BrandProfile): ScriptGenerationClient {
  return {
    business_name: profile.business_name ?? "Local business",
    website_url: profile.website_url ?? null,
    social_links: socialLinksValue(profile.social_links),
    location: profile.location ?? null,
    industry: profile.industry ?? null,
    offer: profile.offer_cta ?? profile.promoting ?? null,
    target_customer: profile.target_customer ?? null,
    tone: profile.tone ?? null,
    notes: profile.raw_notes ?? null,
  };
}

function brandProfileToScriptBrief(
  profile: BrandProfile,
  options: {
    goal: string;
    batchSize: number;
    videoLengthSeconds: number;
    researchSummary: string | null;
  },
): ScriptGenerationBrief {
  return {
    campaign_goal: options.goal,
    platform: "short_form",
    duration_seconds: options.videoLengthSeconds,
    batch_size: options.batchSize,
    raw_notes: profile.raw_notes ?? null,
    generated_summary: options.researchSummary,
    what_they_do: profile.what_they_do ?? null,
    why_they_do_it: profile.why_they_do_it ?? null,
    promoting: profile.promoting ?? null,
    main_pain_points: profile.main_pain_points ?? null,
    offer_cta: profile.offer_cta ?? null,
    tone_examples: profile.tone_examples ?? null,
  };
}

function researchToScriptInput(
  research:
    | (ScriptGenerationResearch & {
        id: string;
        status: string;
      })
    | null,
): ScriptGenerationResearch {
  if (!research) {
    return null;
  }

  return {
    offer: research.offer,
    audience: research.audience,
    tone: research.tone,
    competitors: research.competitors,
    likely_objections: research.likely_objections,
    recommended_formats: research.recommended_formats,
    citations: research.citations,
    risky_claims: research.risky_claims,
    notes: research.notes,
  };
}

async function insertCampaignScripts(input: {
  supabase: ServiceSupabaseClient;
  campaign: CampaignGenerationCampaign;
  variants: Array<{
    title: string;
    format: string;
    hook: string;
    voiceover: string;
    scene_plan: unknown;
    suggested_broll: unknown;
    cta: string;
    caption: string;
    hashtags: string[];
    editor_notes: string | null;
  }>;
  riskyClaims: string[];
}) {
  const { data, error } = await input.supabase
    .from("campaign_scripts")
    .insert(
      input.variants.map((variant) => ({
        campaign_id: input.campaign.id,
        organization_id: input.campaign.organization_id,
        title: variant.title,
        format: variant.format,
        hook: variant.hook,
        voiceover: variant.voiceover,
        scene_plan: variant.scene_plan,
        suggested_broll: variant.suggested_broll,
        cta: variant.cta,
        caption: variant.caption,
        hashtags: variant.hashtags,
        editor_notes: variant.editor_notes,
        risk_flags: input.riskyClaims,
        review_status: "usable",
      })),
    )
    .select("id,title,hook,voiceover,scene_plan,render_plan,suggested_broll,cta,caption");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as CampaignGenerationScript[];
}

async function attachVideoOutputsToScripts(input: {
  supabase: ServiceSupabaseClient;
  organizationId: string;
  campaignId: string;
  scripts: CampaignGenerationScript[];
  durationSeconds: number;
}) {
  const { data, error } = await input.supabase
    .from("video_outputs")
    .select("id,campaign_script_id")
    .eq("campaign_id", input.campaignId)
    .eq("organization_id", input.organizationId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const existing = data ?? [];
  const availablePlaceholders = existing.filter((row) => !row.campaign_script_id);

  for (const script of input.scripts) {
    const reusable =
      existing.find((row) => row.campaign_script_id === script.id) ??
      availablePlaceholders.shift();

    if (reusable) {
      const { error: updateError } = await input.supabase
        .from("video_outputs")
        .update({
          campaign_script_id: script.id,
          title: script.title,
          status: "queued",
          source: "automation",
          storage_bucket: generatedMediaBucket,
          caption: script.caption,
          cta: script.cta,
          duration_seconds: input.durationSeconds,
          error_message: null,
        })
        .eq("id", reusable.id)
        .eq("organization_id", input.organizationId);

      if (updateError) {
        throw new Error(updateError.message);
      }
    } else {
      await createVideoOutputForScript({
        supabase: input.supabase,
        organizationId: input.organizationId,
        campaignId: input.campaignId,
        script,
        durationSeconds: input.durationSeconds,
      });
    }
  }
}

async function startCampaignGeneration(
  supabase: ServiceSupabaseClient,
  organizationId: string,
  plan: CampaignGenerationPlan,
) {
  const campaignId = plan.campaign.id;
  const { data: claimedCampaign, error: claimError } = await supabase
    .from("campaigns")
    .update({
      status: "voiceover",
      started_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", campaignId)
    .eq("organization_id", organizationId)
    .in("status", ["scripting", "queued", "needs_review"])
    .select("id")
    .single();

  if (claimError || !claimedCampaign) {
    throw new Error("This batch is already being generated.");
  }

  for (const script of plan.scripts) {
    const video = await createOrReuseVideoOutput(
      supabase,
      organizationId,
      campaignId,
      script,
      plan.campaign.video_length_seconds,
    );

    await processVideoOutput(
      supabase,
      organizationId,
      campaignId,
      video.id,
      script,
      plan.campaign.video_length_seconds,
    );
  }

  await refreshCampaignStatus(supabase, organizationId, campaignId);
}

async function createOrReuseVideoOutput(
  supabase: ServiceSupabaseClient,
  organizationId: string,
  campaignId: string,
  script: {
    id: string;
    title: string;
    caption: string;
    cta: string;
  },
  durationSeconds: number,
) {
  const { data: existing, error: existingError } = await supabase
    .from("video_outputs")
    .select("id")
    .eq("campaign_script_id", script.id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing) {
    return existing as { id: string };
  }

  return createVideoOutputForScript({
    supabase,
    organizationId,
    campaignId,
    script,
    durationSeconds,
  });
}

async function createVideoOutputForScript(input: {
  supabase: ServiceSupabaseClient;
  organizationId: string;
  campaignId: string;
  script: {
    id: string;
    title: string;
    caption: string;
    cta: string;
  };
  durationSeconds: number;
}) {
  const { data, error } = await input.supabase
    .from("video_outputs")
    .insert({
      organization_id: input.organizationId,
      campaign_id: input.campaignId,
      campaign_script_id: input.script.id,
      title: input.script.title,
      status: "queued",
      source: "automation",
      storage_bucket: generatedMediaBucket,
      caption: input.script.caption,
      cta: input.script.cta,
      duration_seconds: input.durationSeconds,
      max_retries: maxVideoRetries,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Video output could not be created");
  }

  return data as { id: string };
}

async function processVideoOutput(
  supabase: ServiceSupabaseClient,
  organizationId: string,
  campaignId: string,
  videoOutputId: string,
  script: {
    id: string;
    title: string;
    hook: string;
    voiceover: string;
    scene_plan: unknown;
    suggested_broll: unknown;
    cta: string;
    caption: string;
    render_plan: unknown;
  },
  durationSeconds: number | null,
) {
  let activeProviderJobKey: string | null = null;

  try {
    await supabase
      .from("video_outputs")
      .update({ status: "voiceover", error_message: null })
      .eq("id", videoOutputId)
      .eq("organization_id", organizationId);

    const voiceoverJobKey = `voiceover:${videoOutputId}`;
    activeProviderJobKey = voiceoverJobKey;
    await recordProviderJob(supabase, {
      organizationId,
      campaignId,
      videoOutputId,
      provider: "elevenlabs",
      jobType: "voiceover",
      providerJobId: null,
      status: "queued",
      idempotencyKey: voiceoverJobKey,
      estimatedCostCents: 0,
    });

    const availableAssets = await renderPlanAssetsForOrganization(
      supabase,
      organizationId,
    );
    const scriptInput = renderPlanScriptInput(script);
    const renderPlan =
      normalizePersistedRenderPlan({
        value: script.render_plan,
        script: scriptInput,
        assets: availableAssets,
        durationSeconds,
      }) ??
      createDefaultRenderPlan({
        script: scriptInput,
        assets: availableAssets,
        durationSeconds,
      });
    let renderPlanWithVoiceover: RenderPlan;
    let voiceoverPath = renderPlan.voiceoverStoragePath;
    let voiceoverEstimatedCostCents = 0;
    let voiceoverProviderJobId: string | null = null;
    let voiceoverProvider = "stored-voiceover";

    if (voiceoverPath) {
      renderPlanWithVoiceover = renderPlan;
    } else {
      const voiceover = await generateVoiceover({
        scriptId: script.id,
        text: renderPlan.voiceoverText,
        withTimestamps: true,
      });
      voiceoverPath = organizationVoiceoverPath(organizationId, videoOutputId);
      const { error: voiceoverUploadError } = await supabase.storage
        .from(generatedMediaBucket)
        .upload(voiceoverPath, voiceover.audioBytes, {
          contentType: voiceover.contentType,
          upsert: true,
        });

      if (voiceoverUploadError) {
        throw new Error(voiceoverUploadError.message);
      }

      renderPlanWithVoiceover = {
        ...renderPlan,
        voiceoverStoragePath: voiceoverPath,
        voiceoverCues: voiceover.cues,
        voiceoverStale: false,
      };
      voiceoverEstimatedCostCents = voiceover.estimatedCostCents;
      voiceoverProviderJobId = voiceover.providerJobId;
      voiceoverProvider = voiceover.provider;
    }

    const voiceoverJob = await recordProviderJob(supabase, {
      organizationId,
      campaignId,
      videoOutputId,
      provider: voiceoverProvider,
      jobType: "voiceover",
      providerJobId: voiceoverProviderJobId,
      status: "succeeded",
      idempotencyKey: voiceoverJobKey,
      estimatedCostCents: voiceoverEstimatedCostCents,
      actualCostCents: voiceoverEstimatedCostCents,
      responsePayload:
        voiceoverProvider === "stored-voiceover"
          ? { reused_voiceover_path: voiceoverPath }
          : undefined,
    });
    activeProviderJobKey = null;
    if (voiceoverEstimatedCostCents > 0) {
      await recordProviderCost(supabase, {
        organizationId,
        campaignId,
        videoOutputId,
        providerJobId: voiceoverJob.id,
        provider: voiceoverProvider,
        jobType: "voiceover",
        costType: "estimate",
        amountCents: voiceoverEstimatedCostCents,
        metadata: { billing_source: "provider_estimate" },
      });
      await recordProviderCost(supabase, {
        organizationId,
        campaignId,
        videoOutputId,
        providerJobId: voiceoverJob.id,
        provider: voiceoverProvider,
        jobType: "voiceover",
        costType: "actual",
        amountCents: voiceoverEstimatedCostCents,
        metadata: { billing_source: "provider_estimate" },
      });
    }

    const voiceoverSignedUrl = await signedUrlForPath(
      supabase,
      generatedMediaBucket,
      voiceoverPath,
    );
    const signedAssets = await signedRenderPlanAssets(
      supabase,
      renderPlanWithVoiceover,
      availableAssets,
    );
    const musicSignedUrl =
      renderPlanWithVoiceover.musicSource === "upload" &&
      renderPlanWithVoiceover.musicStoragePath
        ? await signedUrlForPath(
            supabase,
            customerAssetBucket,
            renderPlanWithVoiceover.musicStoragePath,
          )
        : null;
    const signedRenderPlan = withSignedAssetUrls(
      renderPlanWithVoiceover,
      signedAssets,
      voiceoverSignedUrl,
      musicSignedUrl,
    );
    const voiceoverCosts = await refreshVideoCostTotals(
      supabase,
      organizationId,
      videoOutputId,
    );

    await supabase
      .from("video_outputs")
      .update({
        status: "rendering",
        voiceover_path: voiceoverPath,
        caption: signedRenderPlan.caption,
        cta: signedRenderPlan.cta,
        duration_seconds: signedRenderPlan.durationSeconds,
        cost_estimate_cents: voiceoverCosts.estimatedCostCents,
        actual_cost_cents: voiceoverCosts.actualCostCents,
      })
      .eq("id", videoOutputId)
      .eq("organization_id", organizationId);

    const renderJobKey = `render:${videoOutputId}`;
    activeProviderJobKey = renderJobKey;
    await recordProviderJob(supabase, {
      organizationId,
      campaignId,
      videoOutputId,
      provider: configuredRenderProvider(),
      jobType: "render",
      providerJobId: null,
      status: "queued",
      idempotencyKey: renderJobKey,
      estimatedCostCents: 0,
      requestPayload: {
        composition_id: "UGCVideo",
        render_plan: signedRenderPlan,
      },
    });

    const render = await startRender({
      videoOutputId,
      scriptId: script.id,
      organizationId,
      title: script.title,
      voiceoverUrl: voiceoverSignedUrl,
      hook: script.hook,
      caption: signedRenderPlan.caption,
      cta: signedRenderPlan.cta,
      scenePlan: script.scene_plan,
      renderPlan: signedRenderPlan,
    });

    const renderJob = await recordProviderJob(supabase, {
      organizationId,
      campaignId,
      videoOutputId,
      provider: render.provider,
      jobType: "render",
      providerJobId: render.providerJobId,
      status: render.status === "succeeded" ? "succeeded" : "running",
      idempotencyKey: renderJobKey,
      estimatedCostCents: render.estimatedCostCents,
      actualCostCents:
        render.status === "succeeded" ? render.estimatedCostCents : 0,
      requestPayload: {
        composition_id: "UGCVideo",
        render_plan: signedRenderPlan,
      },
      responsePayload: render.responsePayload,
    });
    activeProviderJobKey = null;
    await recordProviderCost(supabase, {
      organizationId,
      campaignId,
      videoOutputId,
      providerJobId: renderJob.id,
      provider: render.provider,
      jobType: "render",
      costType: "estimate",
      amountCents: render.estimatedCostCents,
      metadata: { billing_source: "provider_estimate" },
    });

    if (render.status === "succeeded") {
      await recordProviderCost(supabase, {
        organizationId,
        campaignId,
        videoOutputId,
        providerJobId: renderJob.id,
        provider: render.provider,
        jobType: "render",
        costType: "actual",
        amountCents: render.estimatedCostCents,
        metadata: { billing_source: "provider_estimate" },
      });
    }

    const renderCosts = await refreshVideoCostTotals(
      supabase,
      organizationId,
      videoOutputId,
    );
    const renderedBytes = render.videoBytes ?? render.testVideoBytes;

    if (render.status === "succeeded" && renderedBytes) {
      const videoPath = organizationGeneratedVideoPath(organizationId, videoOutputId);
      const { error: videoUploadError } = await supabase.storage
        .from(generatedMediaBucket)
        .upload(videoPath, renderedBytes, {
          contentType: "video/mp4",
          upsert: true,
        });

      if (videoUploadError) {
        throw new Error(videoUploadError.message);
      }

      await supabase
        .from("video_outputs")
        .update({
          status: "ready",
          provider: render.provider,
          provider_render_id: render.providerJobId,
          video_path: videoPath,
          cost_estimate_cents: renderCosts.estimatedCostCents,
          actual_cost_cents: renderCosts.actualCostCents,
          ready_at: new Date().toISOString(),
        })
        .eq("id", videoOutputId)
        .eq("organization_id", organizationId);
    } else {
      await supabase
        .from("video_outputs")
        .update({
          status: "rendering",
          provider: render.provider,
          provider_render_id: render.providerJobId,
          cost_estimate_cents: renderCosts.estimatedCostCents,
          actual_cost_cents: renderCosts.actualCostCents,
        })
        .eq("id", videoOutputId)
        .eq("organization_id", organizationId);
    }
  } catch (error) {
    const message = messageFromError(error, "Video generation failed");
    const providerJobError = activeProviderJobKey
      ? await markProviderJobFailed(
          supabase,
          organizationId,
          activeProviderJobKey,
          message,
        )
      : null;
    const visibleMessage = providerJobError
      ? `${message} Provider job update failed: ${providerJobError}`
      : message;

    await supabase
      .from("video_outputs")
      .update({
        status: "failed",
        error_message: visibleMessage,
      })
      .eq("id", videoOutputId)
      .eq("organization_id", organizationId);
  }
}

function renderPlanScriptInput(script: {
  title: string;
  hook: string;
  voiceover: string;
  scene_plan: unknown;
  cta: string;
  caption: string;
}): RenderPlanScriptInput {
  return {
    title: script.title,
    hook: script.hook,
    voiceover: script.voiceover,
    scene_plan: script.scene_plan,
    cta: script.cta,
    caption: script.caption,
  };
}

async function renderPlanAssetsForOrganization(
  supabase: ServiceSupabaseClient,
  organizationId: string,
) {
  const { data: assets, error } = await supabase
    .from("organization_assets")
    .select("id,storage_bucket,storage_path,filename,content_type,duration_seconds,tags")
    .eq("organization_id", organizationId)
    .neq("status", "archived")
    .order("selected", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) {
    throw new Error(error.message);
  }

  return renderPlanAssetsFromRows(assets ?? []);
}

async function signedUrlForPath(
  supabase: ServiceSupabaseClient,
  bucket: string,
  path: string,
) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, signedUrlTtlSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Could not sign storage URL");
  }

  return data.signedUrl;
}

async function signedRenderPlanAssets(
  supabase: ServiceSupabaseClient,
  renderPlan: RenderPlan,
  availableAssets: RenderPlanAsset[],
) {
  const ids = new Set(
    [
      ...renderPlan.scenes.map((scene) => scene.assetId),
      renderPlan.musicAssetId,
    ].filter((assetId): assetId is string => Boolean(assetId)),
  );
  const assets = availableAssets.filter((asset) => ids.has(asset.id));

  return Promise.all(
    assets.map(async (asset) => ({
      ...asset,
      signedUrl: await signedUrlForPath(
        supabase,
        asset.storageBucket,
        asset.storagePath,
      ),
    })),
  );
}

async function recordProviderJob(
  supabase: ServiceSupabaseClient,
  input: {
    organizationId: string;
    campaignId: string;
    videoOutputId: string;
    provider: string;
    jobType: "voiceover" | "render";
    providerJobId: string | null;
    status: "queued" | "running" | "succeeded" | "failed";
    idempotencyKey: string;
    estimatedCostCents: number;
    actualCostCents?: number;
    errorMessage?: string;
    requestPayload?: Record<string, unknown>;
    responsePayload?: Record<string, unknown>;
  },
) {
  const { data, error } = await supabase
    .from("provider_jobs")
    .upsert(
      {
        organization_id: input.organizationId,
        campaign_id: input.campaignId,
        video_output_id: input.videoOutputId,
        provider: input.provider,
        job_type: input.jobType,
        provider_job_id: input.providerJobId,
        status: input.status,
        idempotency_key: input.idempotencyKey,
        estimated_cost_cents: input.estimatedCostCents,
        actual_cost_cents: input.actualCostCents ?? 0,
        request_payload: input.requestPayload ?? {},
        response_payload: input.responsePayload ?? {},
        error_message: input.errorMessage ?? null,
        completed_at:
          input.status === "succeeded" || input.status === "failed"
            ? new Date().toISOString()
            : null,
      },
      { onConflict: "idempotency_key" },
    )
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Provider job could not be recorded");
  }

  return data as { id: string };
}

async function markProviderJobFailed(
  supabase: ServiceSupabaseClient,
  organizationId: string,
  idempotencyKey: string,
  errorMessage: string,
) {
  const { error } = await supabase
    .from("provider_jobs")
    .update({
      status: "failed",
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId)
    .eq("idempotency_key", idempotencyKey);

  return error?.message ?? null;
}

async function recordProviderCost(
  supabase: ServiceSupabaseClient,
  input: {
    organizationId: string;
    campaignId: string;
    videoOutputId: string;
    providerJobId: string | null;
    provider: string;
    jobType: "scripting" | "voiceover" | "render";
    costType: ProviderCostType;
    amountCents: number;
    metadata?: Record<string, unknown>;
  },
) {
  const { error } = await supabase.from("provider_costs").upsert(
    {
      organization_id: input.organizationId,
      campaign_id: input.campaignId,
      video_output_id: input.videoOutputId,
      provider_job_id: input.providerJobId,
      provider: input.provider,
      cost_type: input.costType,
      amount_cents: normalizeProviderCostCents(input.amountCents),
      currency: "eur",
      idempotency_key: providerCostIdempotencyKey({
        costType: input.costType,
        provider: input.provider,
        jobType: input.jobType,
        videoOutputId: input.videoOutputId,
      }),
      metadata: input.metadata ?? {},
    },
    { onConflict: "idempotency_key" },
  );

  if (error) {
    throw new Error(error.message);
  }
}

async function refreshVideoCostTotals(
  supabase: ServiceSupabaseClient,
  organizationId: string,
  videoOutputId: string,
) {
  const { data, error } = await supabase
    .from("provider_costs")
    .select("cost_type,amount_cents")
    .eq("organization_id", organizationId)
    .eq("video_output_id", videoOutputId);

  if (error) {
    throw new Error(error.message);
  }

  const totals = summarizeProviderCosts((data ?? []) as {
    cost_type: ProviderCostType;
    amount_cents: number | null;
  }[]);

  await supabase
    .from("video_outputs")
    .update({
      cost_estimate_cents: totals.estimatedCostCents,
      actual_cost_cents: totals.actualCostCents,
    })
    .eq("id", videoOutputId)
    .eq("organization_id", organizationId);

  return totals;
}

async function refreshCampaignStatus(
  supabase: ServiceSupabaseClient,
  organizationId: string,
  campaignId: string,
) {
  const { data: videos, error } = await supabase
    .from("video_outputs")
    .select("status,cost_estimate_cents,actual_cost_cents")
    .eq("campaign_id", campaignId)
    .eq("organization_id", organizationId);

  if (error) {
    throw new Error(error.message);
  }

  const rows = videos ?? [];
  const status = summarizeBatchStatus(rows);
  const estimatedCost = rows.reduce(
    (total, video) => total + (video.cost_estimate_cents ?? 0),
    0,
  );
  const actualCost = rows.reduce(
    (total, video) => total + (video.actual_cost_cents ?? 0),
    0,
  );

  await supabase
    .from("campaigns")
    .update({
      status,
      estimated_cost_cents: estimatedCost,
      actual_cost_cents: actualCost,
      completed_at: status === "ready" ? new Date().toISOString() : null,
      failed_at: status === "failed" ? new Date().toISOString() : null,
    })
    .eq("id", campaignId)
    .eq("organization_id", organizationId);
}

async function failCampaignGeneration(
  supabase: ServiceSupabaseClient,
  organizationId: string,
  campaignId: string,
  message: string,
) {
  await supabase
    .from("campaigns")
    .update({
      status: "failed",
      failed_at: new Date().toISOString(),
      error_message: message,
    })
    .eq("id", campaignId)
    .eq("organization_id", organizationId);

  await supabase
    .from("video_outputs")
    .update({
      status: "failed",
      error_message: message,
    })
    .eq("campaign_id", campaignId)
    .eq("organization_id", organizationId)
    .in("status", ["planned", "queued", "scripting", "voiceover", "rendering"]);
}
