import { NextResponse } from "next/server";
import {
  runCampaignGenerationWorker,
  runQueuedCampaignGenerationWorker,
} from "@/lib/videos/background-generation";

export const runtime = "nodejs";
export const maxDuration = 300;

function isAuthorized(request: Request) {
  const secret = process.env.VIDEO_WORKER_SECRET;
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

async function requestPayload(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return {};
  }

  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function limitFromValue(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined;
}

async function handleWorkerRequest(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const payload = await requestPayload(request);
  const campaignId =
    typeof payload.campaignId === "string"
      ? payload.campaignId
      : url.searchParams.get("campaignId");
  const organizationId =
    typeof payload.organizationId === "string"
      ? payload.organizationId
      : url.searchParams.get("organizationId") ?? undefined;

  if (campaignId) {
    const result = await runCampaignGenerationWorker({
      campaignId,
      organizationId,
    });

    return NextResponse.json({ ok: true, result });
  }

  const results = await runQueuedCampaignGenerationWorker({
    limit: limitFromValue(payload.limit ?? url.searchParams.get("limit")),
  });

  return NextResponse.json({ ok: true, results });
}

export async function GET(request: Request) {
  return handleWorkerRequest(request);
}

export async function POST(request: Request) {
  return handleWorkerRequest(request);
}
