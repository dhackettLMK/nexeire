export const maxBatchSize = 10;
export const minBatchSize = 1;
export const maxVideoLengthSeconds = 60;
export const minVideoLengthSeconds = 5;
export const maxVideoRetries = 2;

export const batchStatuses = [
  "queued",
  "scripting",
  "voiceover",
  "rendering",
  "ready",
  "failed",
  "needs_review",
] as const;

export type BatchStatus = (typeof batchStatuses)[number];

export const videoStatuses = [
  "planned",
  "queued",
  "scripting",
  "voiceover",
  "rendering",
  "ready",
  "failed",
  "needs_review",
  "archived",
] as const;

export type VideoStatus = (typeof videoStatuses)[number];

export type VideoStatusSummaryInput = {
  status: VideoStatus;
};

export type RetryState = {
  status: VideoStatus;
  retryCount: number;
  maxRetries?: number | null;
};

export type BatchStartState = {
  status: string;
  videoCount: number;
};

export type ApprovedBatchStartState = BatchStartState & {
  approvedScriptCount: number;
  batchSize: number;
};

export function normalizeBatchSize(value: number) {
  if (!Number.isFinite(value)) {
    return minBatchSize;
  }

  return Math.min(Math.max(Math.trunc(value), minBatchSize), maxBatchSize);
}

export function validateBatchSize(value: number) {
  if (!Number.isInteger(value) || value < minBatchSize || value > maxBatchSize) {
    throw new Error(`Batch size must be between ${minBatchSize} and ${maxBatchSize}`);
  }

  return value;
}

export function validateRenderableScriptCount(
  renderableScriptCount: number,
  batchSize: number,
  label = "approved or usable",
) {
  const required = validateBatchSize(batchSize);
  const renderable = Number.isInteger(renderableScriptCount)
    ? Math.max(renderableScriptCount, 0)
    : 0;

  if (renderable < required) {
    throw new Error(
      `Mark ${required} scripts ${label} before generating this batch (${renderable} ready).`,
    );
  }

  return required;
}

export function validateVideoLengthSeconds(value: number) {
  if (
    !Number.isInteger(value) ||
    value < minVideoLengthSeconds ||
    value > maxVideoLengthSeconds
  ) {
    throw new Error(
      `Video length must be between ${minVideoLengthSeconds} and ${maxVideoLengthSeconds} seconds`,
    );
  }

  return value;
}

export function canRetryVideo(state: RetryState) {
  const limit = state.maxRetries ?? maxVideoRetries;

  return state.status === "failed" && state.retryCount < limit;
}

export function nextRetryCount(state: RetryState) {
  if (!canRetryVideo(state)) {
    throw new Error("Retry limit reached or video is not failed");
  }

  return state.retryCount + 1;
}

export function canStartBatch(state: BatchStartState) {
  return (
    (state.status === "queued" || state.status === "needs_review") &&
    state.videoCount === 0
  );
}

export function canAutoStartApprovedBatch(state: ApprovedBatchStartState) {
  if (!canStartBatch(state)) {
    return false;
  }

  try {
    validateRenderableScriptCount(
      state.approvedScriptCount,
      state.batchSize,
      "approved",
    );

    return true;
  } catch {
    return false;
  }
}

export function assertCanStartBatch(state: BatchStartState) {
  if (state.videoCount > 0) {
    throw new Error(
      "This batch has already started. Retry failed videos from the inbox.",
    );
  }

  if (!canStartBatch(state)) {
    throw new Error("This batch is not ready to start generation.");
  }
}

export function summarizeBatchStatus(videos: VideoStatusSummaryInput[]): BatchStatus {
  if (videos.length === 0) {
    return "queued";
  }

  if (videos.some((video) => video.status === "needs_review")) {
    return "needs_review";
  }

  if (videos.every((video) => video.status === "ready")) {
    return "ready";
  }

  if (videos.every((video) => video.status === "failed")) {
    return "failed";
  }

  if (videos.some((video) => video.status === "rendering")) {
    return "rendering";
  }

  if (videos.some((video) => video.status === "voiceover")) {
    return "voiceover";
  }

  if (videos.some((video) => video.status === "scripting")) {
    return "scripting";
  }

  if (videos.some((video) => video.status === "queued")) {
    return "queued";
  }

  if (videos.some((video) => video.status === "failed")) {
    return "needs_review";
  }

  return "queued";
}

export function formatBatchStatus(status: string) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
