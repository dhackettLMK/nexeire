import { NextResponse } from "next/server";
import { getRenderProgress } from "@remotion/vercel";
import {
  generatedMediaBucket,
  organizationGeneratedVideoPath,
} from "@/lib/assets/validation";
import {
  normalizeProviderCostCents,
  providerCostIdempotencyKey,
  summarizeProviderCosts,
  type ProviderCostType,
} from "@/lib/providers/costs";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

type RemotionJob = {
  id: string;
  organization_id: string;
  campaign_id: string | null;
  video_output_id: string;
  provider_job_id: string | null;
  response_payload: unknown;
  estimated_cost_cents: number | null;
};

function isAuthorized(request: Request) {
  const secret = process.env.REMOTION_PROGRESS_SECRET;
  const cronSecret = process.env.CRON_SECRET;

  if (!secret && !cronSecret) {
    return process.env.NODE_ENV !== "production";
  }

  const auth = request.headers.get("authorization");
  const token = auth?.replace(/^Bearer\s+/i, "");

  return Boolean(
    token && ((secret && token === secret) || (cronSecret && token === cronSecret)),
  );
}

function payloadRecord(payload: unknown) {
  return payload && typeof payload === "object"
    ? (payload as Record<string, unknown>)
    : {};
}

function sandboxIds(payload: unknown) {
  const record = payloadRecord(payload);
  const sandboxId = record.sandboxId;
  const cmdId = record.cmdId;

  if (typeof sandboxId !== "string" || typeof cmdId !== "string") {
    return null;
  }

  return { sandboxId, cmdId };
}

export async function GET(request: Request) {
  return handleProgressRequest(request);
}

export async function POST(request: Request) {
  return handleProgressRequest(request);
}

async function handleProgressRequest(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from("provider_jobs")
    .select(
      "id,organization_id,campaign_id,video_output_id,provider_job_id,response_payload,estimated_cost_cents",
    )
    .eq("provider", "remotion")
    .eq("job_type", "render")
    .eq("status", "running")
    .limit(10);

  if (error) {
    throw new Error(error.message);
  }

  const results = await Promise.all(
    ((data ?? []) as RemotionJob[]).map((job) => processJob(supabase, job)),
  );

  return NextResponse.json({ ok: true, results });
}

async function processJob(
  supabase: ReturnType<typeof getServiceRoleClient>,
  job: RemotionJob,
) {
  const ids = sandboxIds(job.response_payload);

  if (!ids) {
    await markRenderFailed(supabase, job, "Missing Remotion sandbox ids");
    return { jobId: job.id, status: "failed", reason: "missing_ids" };
  }

  const progress = await getRenderProgress(ids);

  if (progress.stage === "done") {
    await completeRender(supabase, job, progress.url);
    return { jobId: job.id, status: "ready" };
  }

  if (progress.stage === "error" || progress.stage === "expired") {
    await markRenderFailed(
      supabase,
      job,
      progress.stage === "error" ? progress.message : "Remotion render expired",
    );
    return { jobId: job.id, status: "failed", reason: progress.stage };
  }

  return {
    jobId: job.id,
    status: "running",
    progress: progress.overallProgress,
  };
}

async function completeRender(
  supabase: ReturnType<typeof getServiceRoleClient>,
  job: RemotionJob,
  videoUrl: string,
) {
  const { data: video, error: videoError } = await supabase
    .from("video_outputs")
    .select("id,organization_id,campaign_id,storage_bucket,retry_count,title")
    .eq("id", job.video_output_id)
    .eq("organization_id", job.organization_id)
    .single();

  if (videoError || !video) {
    await markRenderFailed(supabase, job, "Video output not found");
    return;
  }

  const response = await fetch(videoUrl);

  if (!response.ok) {
    await markRenderFailed(
      supabase,
      job,
      `Could not fetch Remotion video: ${response.status}`,
    );
    return;
  }

  const videoPath = organizationGeneratedVideoPath(
    video.organization_id,
    video.id,
  );
  const bytes = new Uint8Array(await response.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from(video.storage_bucket || generatedMediaBucket)
    .upload(videoPath, bytes, {
      contentType: "video/mp4",
      upsert: true,
    });

  if (uploadError) {
    await markRenderFailed(supabase, job, uploadError.message);
    return;
  }

  const actualCostCents = normalizeProviderCostCents(
    job.estimated_cost_cents && job.estimated_cost_cents > 0
      ? job.estimated_cost_cents
      : Number(process.env.REMOTION_ESTIMATED_CENTS_PER_VIDEO ?? "80"),
  );

  await supabase
    .from("provider_jobs")
    .update({
      status: "succeeded",
      actual_cost_cents: actualCostCents,
      completed_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", job.id);
  await recordProviderCost(supabase, {
    organizationId: job.organization_id,
    campaignId: job.campaign_id,
    videoOutputId: job.video_output_id,
    providerJobId: job.id,
    provider: "remotion",
    jobType: "render",
    costType: "actual",
    amountCents: actualCostCents,
    metadata: {
      provider_render_id: job.provider_job_id,
      billing_source: "provider_estimate",
    },
  });

  const costs = await refreshVideoCostTotals(
    supabase,
    job.organization_id,
    job.video_output_id,
  );

  await supabase
    .from("video_outputs")
    .update({
      status: "ready",
      provider: "remotion",
      video_path: videoPath,
      cost_estimate_cents: costs.estimatedCostCents,
      actual_cost_cents: costs.actualCostCents,
      ready_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", video.id)
    .eq("organization_id", video.organization_id);

  if (video.campaign_id) {
    await refreshCampaignStatus(supabase, video.organization_id, video.campaign_id);
  }
}

async function markRenderFailed(
  supabase: ReturnType<typeof getServiceRoleClient>,
  job: RemotionJob,
  message: string,
) {
  await supabase
    .from("provider_jobs")
    .update({
      status: "failed",
      error_message: message,
      completed_at: new Date().toISOString(),
    })
    .eq("id", job.id);
  await supabase
    .from("video_outputs")
    .update({
      status: "failed",
      error_message: message,
    })
    .eq("id", job.video_output_id)
    .eq("organization_id", job.organization_id);

  if (job.campaign_id) {
    await refreshCampaignStatus(supabase, job.organization_id, job.campaign_id);
  }
}

async function recordProviderCost(
  supabase: ReturnType<typeof getServiceRoleClient>,
  input: {
    organizationId: string;
    campaignId: string | null;
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
  supabase: ReturnType<typeof getServiceRoleClient>,
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

  return summarizeProviderCosts((data ?? []) as {
    cost_type: ProviderCostType;
    amount_cents: number | null;
  }[]);
}

async function refreshCampaignStatus(
  supabase: ReturnType<typeof getServiceRoleClient>,
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
  const allReady = rows.length > 0 && rows.every((video) => video.status === "ready");
  const anyFailed = rows.some((video) => video.status === "failed");
  const status = allReady ? "ready" : anyFailed ? "needs_review" : "rendering";
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
      completed_at: allReady ? new Date().toISOString() : null,
    })
    .eq("id", campaignId)
    .eq("organization_id", organizationId);
}
