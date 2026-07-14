import { NextResponse } from "next/server";
import { sweepStaleRenderJobs } from "@/lib/providers/stale-jobs";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { pollRemotionRenders } from "@/lib/videos/render-progress";

export const runtime = "nodejs";

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
  const swept = await sweepStaleRenderJobs(supabase);
  const results = await pollRemotionRenders(supabase);

  return NextResponse.json({ ok: true, swept: swept.swept, results });
}
