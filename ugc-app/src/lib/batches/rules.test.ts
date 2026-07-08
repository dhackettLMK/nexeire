import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertCanStartBatch,
  canAutoStartApprovedBatch,
  canStartBatch,
  canRetryVideo,
  maxBatchSize,
  minBatchSize,
  nextRetryCount,
  summarizeBatchStatus,
  validateRenderableScriptCount,
  validateBatchSize,
  validateVideoLengthSeconds,
} from "@/lib/batches/rules";

const singleVideoCampaignMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260628000007_allow_single_video_campaigns.sql",
  ),
  "utf8",
);

describe("batch rules", () => {
  it("enforces hard batch and length limits", () => {
    expect(validateBatchSize(minBatchSize)).toBe(minBatchSize);
    expect(validateBatchSize(10)).toBe(10);
    expect(() => validateBatchSize(minBatchSize - 1)).toThrow(/Batch size/);
    expect(() => validateBatchSize(11)).toThrow(/Batch size/);
    expect(validateVideoLengthSeconds(60)).toBe(60);
    expect(() => validateVideoLengthSeconds(90)).toThrow(/Video length/);
  });

  it("keeps the campaign batch-size constraint aligned with app limits", () => {
    expect(singleVideoCampaignMigration).toContain(
      "drop constraint if exists campaigns_batch_size_check",
    );
    expect(singleVideoCampaignMigration).toContain(
      `add constraint campaigns_batch_size_check check (batch_size between ${minBatchSize} and ${maxBatchSize})`,
    );
  });

  it("requires enough approved scripts for the planned batch size", () => {
    expect(validateRenderableScriptCount(10, 10)).toBe(10);
    expect(validateRenderableScriptCount(3, 3)).toBe(3);
    expect(() => validateRenderableScriptCount(9, 10)).toThrow(
      /Mark 10 scripts approved or usable before generating this batch \(9 ready\)/,
    );
  });

  it("starts generation only for unstarted planned batches", () => {
    expect(canStartBatch({ status: "needs_review", videoCount: 0 })).toBe(true);
    expect(canStartBatch({ status: "queued", videoCount: 0 })).toBe(true);
    expect(canStartBatch({ status: "ready", videoCount: 0 })).toBe(false);
    expect(canStartBatch({ status: "needs_review", videoCount: 1 })).toBe(false);
    expect(() =>
      assertCanStartBatch({ status: "needs_review", videoCount: 1 }),
    ).toThrow(/already started/);
  });

  it("auto-starts only when every planned script is explicitly approved", () => {
    expect(
      canAutoStartApprovedBatch({
        status: "needs_review",
        videoCount: 0,
        approvedScriptCount: 3,
        batchSize: 3,
      }),
    ).toBe(true);
    expect(
      canAutoStartApprovedBatch({
        status: "needs_review",
        videoCount: 0,
        approvedScriptCount: 2,
        batchSize: 3,
      }),
    ).toBe(false);
    expect(
      canAutoStartApprovedBatch({
        status: "rendering",
        videoCount: 0,
        approvedScriptCount: 3,
        batchSize: 3,
      }),
    ).toBe(false);
    expect(
      canAutoStartApprovedBatch({
        status: "needs_review",
        videoCount: 1,
        approvedScriptCount: 3,
        batchSize: 3,
      }),
    ).toBe(false);
  });

  it("allows retries only for failed videos under the limit", () => {
    expect(canRetryVideo({ status: "failed", retryCount: 1, maxRetries: 2 })).toBe(
      true,
    );
    expect(nextRetryCount({ status: "failed", retryCount: 1, maxRetries: 2 })).toBe(
      2,
    );
    expect(canRetryVideo({ status: "ready", retryCount: 0, maxRetries: 2 })).toBe(
      false,
    );
    expect(canRetryVideo({ status: "failed", retryCount: 2, maxRetries: 2 })).toBe(
      false,
    );
  });

  it("keeps partial failures in needs review", () => {
    expect(
      summarizeBatchStatus([{ status: "ready" }, { status: "failed" }]),
    ).toBe("needs_review");
    expect(summarizeBatchStatus([{ status: "ready" }, { status: "ready" }])).toBe(
      "ready",
    );
  });
});
