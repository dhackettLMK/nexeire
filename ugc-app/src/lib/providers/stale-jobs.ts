import type { SupabaseClient } from "@supabase/supabase-js";
import { summarizeBatchStatus } from "@/lib/batches/rules";

type ServiceSupabaseClient = SupabaseClient;

const staleRenderMessage = "Render timed out or was orphaned (stale-job sweep)";

type StaleJobRow = {
  id: string;
  organization_id: string;
  campaign_id: string | null;
  video_output_id: string;
};

export type SweepStaleRenderJobsResult = {
  swept: number;
  jobIds: string[];
};

/**
 * Marks Remotion render provider_jobs stuck in `queued` or `running` beyond
 * `maxAgeMinutes` as `failed`, fails the corresponding video_outputs so the
 * UI reflects reality (and retries become available), and refreshes the
 * owning campaign's status.
 *
 * This exists because a killed/orphaned serverless function or an expired
 * detached sandbox never runs its catch block, so without this sweep a
 * render can stay stuck in `queued`/`running` forever with no error message.
 */
export async function sweepStaleRenderJobs(
  supabase: ServiceSupabaseClient,
  options?: { maxAgeMinutes?: number; organizationId?: string },
): Promise<SweepStaleRenderJobsResult> {
  const maxAgeMinutes = options?.maxAgeMinutes ?? 20;
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60_000).toISOString();

  let query = supabase
    .from("provider_jobs")
    .select("id,organization_id,campaign_id,video_output_id")
    .eq("provider", "remotion")
    .eq("job_type", "render")
    .in("status", ["queued", "running"])
    .lt("created_at", cutoff);

  if (options?.organizationId) {
    query = query.eq("organization_id", options.organizationId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const staleJobs = (data ?? []) as StaleJobRow[];

  if (staleJobs.length === 0) {
    return { swept: 0, jobIds: [] };
  }

  const campaignIds = new Set<string>();

  for (const job of staleJobs) {
    await failStaleJob(supabase, job);

    if (job.campaign_id) {
      campaignIds.add(`${job.organization_id}::${job.campaign_id}`);
    }
  }

  await Promise.all(
    Array.from(campaignIds).map((key) => {
      const [organizationId, campaignId] = key.split("::");
      return refreshCampaignStatus(supabase, organizationId, campaignId);
    }),
  );

  return { swept: staleJobs.length, jobIds: staleJobs.map((job) => job.id) };
}

async function failStaleJob(supabase: ServiceSupabaseClient, job: StaleJobRow) {
  await supabase
    .from("provider_jobs")
    .update({
      status: "failed",
      error_message: staleRenderMessage,
      completed_at: new Date().toISOString(),
    })
    .eq("id", job.id);

  await supabase
    .from("video_outputs")
    .update({
      status: "failed",
      error_message: staleRenderMessage,
    })
    .eq("id", job.video_output_id)
    .eq("organization_id", job.organization_id);
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
