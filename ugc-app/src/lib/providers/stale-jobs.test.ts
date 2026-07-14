import { describe, expect, it } from "vitest";
import { sweepStaleRenderJobs } from "@/lib/providers/stale-jobs";

type QueryResult = { data: unknown; error: { message: string } | null };

type RecordedCall = {
  table: string;
  op: "select" | "update";
  payload?: Record<string, unknown>;
  filters: Array<{ method: string; args: unknown[] }>;
};

function createQueryStub(
  table: string,
  op: "select" | "update",
  result: QueryResult,
  calls: RecordedCall[],
  payload?: Record<string, unknown>,
) {
  const record: RecordedCall = { table, op, payload, filters: [] };
  calls.push(record);

  const chain = {
    select: () => chain,
    eq: (...args: unknown[]) => {
      record.filters.push({ method: "eq", args });
      return chain;
    },
    in: (...args: unknown[]) => {
      record.filters.push({ method: "in", args });
      return chain;
    },
    lt: (...args: unknown[]) => {
      record.filters.push({ method: "lt", args });
      return chain;
    },
    then: (
      resolve: (value: QueryResult) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject),
  };

  return chain;
}

/**
 * Minimal fluent Supabase stub. `queues` maps a table name to an ordered list
 * of canned results; each `.from(table)` call pops the next queued result
 * for that table, regardless of whether it's a select or an update.
 */
function createSupabaseStub(queues: Record<string, QueryResult[]>) {
  const calls: RecordedCall[] = [];
  const cursors: Record<string, number> = {};

  const client = {
    from(table: string) {
      const index = cursors[table] ?? 0;
      cursors[table] = index + 1;
      const queue = queues[table] ?? [];
      const result = queue[index] ?? { data: null, error: null };

      return {
        select: () => createQueryStub(table, "select", result, calls),
        update: (payload: Record<string, unknown>) =>
          createQueryStub(table, "update", result, calls, payload),
      };
    },
    calls,
  };

  return client;
}

describe("sweepStaleRenderJobs", () => {
  it("does nothing when there are no stale render jobs", async () => {
    const supabase = createSupabaseStub({
      provider_jobs: [{ data: [], error: null }],
    });

    const result = await sweepStaleRenderJobs(supabase as never);

    expect(result).toEqual({ swept: 0, jobIds: [] });
    expect(supabase.calls).toHaveLength(1);
  });

  it("fails stale provider_jobs, fails their video_outputs, and refreshes campaign status", async () => {
    const staleJobs = [
      {
        id: "job-1",
        organization_id: "org-1",
        campaign_id: "camp-1",
        video_output_id: "video-1",
      },
      {
        id: "job-2",
        organization_id: "org-1",
        campaign_id: "camp-1",
        video_output_id: "video-2",
      },
    ];

    const supabase = createSupabaseStub({
      provider_jobs: [
        { data: staleJobs, error: null },
        { data: null, error: null },
        { data: null, error: null },
      ],
      video_outputs: [
        { data: null, error: null },
        { data: null, error: null },
        {
          data: [
            { status: "failed", cost_estimate_cents: 80, actual_cost_cents: 80 },
            { status: "failed", cost_estimate_cents: 80, actual_cost_cents: 80 },
          ],
          error: null,
        },
      ],
      campaigns: [{ data: null, error: null }],
    });

    const result = await sweepStaleRenderJobs(supabase as never, {
      maxAgeMinutes: 20,
    });

    expect(result.swept).toBe(2);
    expect(result.jobIds).toEqual(["job-1", "job-2"]);

    const providerJobSelect = supabase.calls.find(
      (call) => call.table === "provider_jobs" && call.op === "select",
    );
    expect(providerJobSelect?.filters.some((f) => f.method === "lt")).toBe(
      true,
    );

    const providerJobUpdates = supabase.calls.filter(
      (call) => call.table === "provider_jobs" && call.op === "update",
    );
    expect(providerJobUpdates).toHaveLength(2);
    expect(providerJobUpdates[0]?.payload).toMatchObject({
      status: "failed",
      error_message: expect.stringContaining("stale-job sweep"),
    });

    const videoOutputUpdates = supabase.calls.filter(
      (call) => call.table === "video_outputs" && call.op === "update",
    );
    expect(videoOutputUpdates).toHaveLength(2);
    expect(videoOutputUpdates[0]?.payload).toMatchObject({
      status: "failed",
    });

    const campaignUpdate = supabase.calls.find(
      (call) => call.table === "campaigns" && call.op === "update",
    );
    expect(campaignUpdate?.payload).toMatchObject({ status: "failed" });
  });

  it("uses maxAgeMinutes to compute the staleness cutoff", async () => {
    const supabase = createSupabaseStub({
      provider_jobs: [{ data: [], error: null }],
    });

    const before = Date.now();
    await sweepStaleRenderJobs(supabase as never, { maxAgeMinutes: 5 });
    const after = Date.now();

    const providerJobSelect = supabase.calls[0];
    const ltFilter = providerJobSelect?.filters.find((f) => f.method === "lt");
    const cutoff = new Date(ltFilter?.args[1] as string).getTime();

    expect(cutoff).toBeGreaterThanOrEqual(before - 5 * 60_000 - 1000);
    expect(cutoff).toBeLessThanOrEqual(after - 5 * 60_000 + 1000);
  });
});
