import type React from "react";
import Link from "next/link";
import { ArrowLeft, Bot, Coins, GitBranch, ShieldAlert } from "lucide-react";
import { requireOrganization } from "@/lib/customer/organization";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TracePageProps = {
  params: Promise<{ videoOutputId: string }>;
};

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type VideoTraceOutput = {
  id: string;
  title: string;
  status: string;
  campaign_id: string | null;
  campaign_script_id: string | null;
  provider: string | null;
  provider_render_id: string | null;
  error_message: string | null;
  cost_estimate_cents: number;
  actual_cost_cents: number;
  created_at: string;
  updated_at: string;
};

type ProviderJob = {
  id: string;
  provider: string;
  job_type: string;
  provider_job_id: string | null;
  status: string;
  attempt: number;
  max_retries: number;
  idempotency_key: string;
  request_payload: JsonValue;
  response_payload: JsonValue;
  error_message: string | null;
  estimated_cost_cents: number;
  actual_cost_cents: number;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
};

type ProviderCost = {
  id: string;
  provider: string;
  job_type: string;
  cost_type: string;
  amount_cents: number;
  metadata: JsonValue;
  created_at: string;
};

type CampaignScript = {
  title: string;
  format: string;
  hook: string;
  voiceover: string;
  scene_plan: JsonValue;
  suggested_broll: JsonValue;
  cta: string;
  caption: string;
  hashtags: string[];
  editor_notes: string | null;
  risk_flags: string[];
  review_status: string;
  created_at: string;
  updated_at: string;
};

const redactedKeyPattern = /(token|secret|key|authorization|cookie|signedurl|signed_url|url|audio|video)/i;

function redactTraceValue(value: unknown, key = ""): unknown {
  if (redactedKeyPattern.test(key)) {
    return "[REDACTED]";
  }

  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value) || value.length > 4_000) {
      return "[REDACTED]";
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactTraceValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        redactTraceValue(childValue, childKey),
      ]),
    );
  }

  return value;
}

function prettyJson(value: unknown) {
  return JSON.stringify(redactTraceValue(value), null, 2);
}

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-IE", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(value));
}

function formatCents(value: number) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
  }).format(value / 100);
}

function statusVariant(status: string): BadgeVariant {
  if (["ready", "succeeded", "processed"].includes(status)) return "success";
  if (["failed", "canceled"].includes(status)) return "danger";
  if (["running", "rendering", "voiceover", "scripting", "queued"].includes(status)) {
    return "primary";
  }
  return "muted";
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <details className="rounded-xl bg-muted/40 p-4">
      <summary className="cursor-pointer text-sm font-medium text-foreground">
        {title}
      </summary>
      <pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-background p-3 text-xs leading-5 text-muted-foreground ring-1 ring-border">
        {prettyJson(value)}
      </pre>
    </details>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 text-sm text-foreground">{value}</div>
    </div>
  );
}

export default async function VideoTracePage({ params }: TracePageProps) {
  const { videoOutputId } = await params;
  const { supabase, organization } = await requireOrganization("/app/inbox");

  const { data: output, error: outputError } = await supabase
    .from("video_outputs")
    .select(
      "id,title,status,campaign_id,campaign_script_id,provider,provider_render_id,error_message,cost_estimate_cents,actual_cost_cents,created_at,updated_at",
    )
    .eq("id", videoOutputId)
    .eq("organization_id", organization.id)
    .single();

  if (outputError || !output) {
    throw new Error(outputError?.message ?? "Video output not found");
  }

  const typedOutput = output as VideoTraceOutput;

  const [{ data: jobs }, { data: costs }, { data: script }] = await Promise.all([
    supabase
      .from("provider_jobs")
      .select(
        "id,provider,job_type,provider_job_id,status,attempt,max_retries,idempotency_key,request_payload,response_payload,error_message,estimated_cost_cents,actual_cost_cents,created_at,updated_at,started_at,completed_at",
      )
      .eq("organization_id", organization.id)
      .eq("video_output_id", videoOutputId)
      .order("created_at", { ascending: true }),
    supabase
      .from("provider_costs")
      .select("id,provider,job_type,cost_type,amount_cents,metadata,created_at")
      .eq("organization_id", organization.id)
      .eq("video_output_id", videoOutputId)
      .order("created_at", { ascending: true }),
    typedOutput.campaign_script_id
      ? supabase
          .from("campaign_scripts")
          .select(
            "title,format,hook,voiceover,scene_plan,suggested_broll,cta,caption,hashtags,editor_notes,risk_flags,review_status,created_at,updated_at",
          )
          .eq("organization_id", organization.id)
          .eq("id", typedOutput.campaign_script_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const providerJobs = (jobs ?? []) as ProviderJob[];
  const providerCosts = (costs ?? []) as ProviderCost[];
  const campaignScript = script as CampaignScript | null;

  return (
    <div className="app-stagger grid gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          eyebrow="Pipeline trace"
          title={typedOutput.title}
          description="Inspect the stored model output, provider jobs, render payloads, retries, and cost telemetry behind this video. Hidden model chain-of-thought is not available; this view shows persisted prompts/payloads and provider responses only."
        />
        <Link
          href="/app/inbox"
          className={buttonClasses({ variant: "secondary", size: "sm" })}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to inbox
        </Link>
      </div>

      <Card className="grid gap-5">
        <div className="flex items-center gap-3">
          <GitBranch className="size-5 text-primary" aria-hidden="true" />
          <h2 className="font-display text-2xl font-medium">Output state</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <Field
            label="Status"
            value={<Badge variant={statusVariant(typedOutput.status)}>{typedOutput.status}</Badge>}
          />
          <Field label="Provider" value={typedOutput.provider ?? "—"} />
          <Field label="Provider render id" value={typedOutput.provider_render_id ?? "—"} />
          <Field label="Updated" value={formatDate(typedOutput.updated_at)} />
          <Field label="Estimated cost" value={formatCents(typedOutput.cost_estimate_cents)} />
          <Field label="Actual cost" value={formatCents(typedOutput.actual_cost_cents)} />
          <Field label="Campaign id" value={typedOutput.campaign_id ?? "—"} />
          <Field label="Script id" value={typedOutput.campaign_script_id ?? "—"} />
        </div>
        {typedOutput.error_message ? (
          <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
            {typedOutput.error_message}
          </p>
        ) : null}
      </Card>

      <Card className="grid gap-5">
        <div className="flex items-center gap-3">
          <Bot className="size-5 text-primary" aria-hidden="true" />
          <h2 className="font-display text-2xl font-medium">LLM/script output</h2>
        </div>
        {campaignScript ? (
          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Format" value={campaignScript.format} />
              <Field label="Review" value={campaignScript.review_status} />
              <Field label="Created" value={formatDate(campaignScript.created_at)} />
            </div>
            <Field label="Hook" value={campaignScript.hook} />
            <Field label="Voiceover" value={campaignScript.voiceover} />
            <Field label="CTA" value={campaignScript.cta} />
            <Field label="Caption" value={campaignScript.caption} />
            <JsonBlock title="Scene plan" value={campaignScript.scene_plan} />
            <JsonBlock title="Suggested b-roll" value={campaignScript.suggested_broll} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No campaign script is attached to this output yet.
          </p>
        )}
      </Card>

      <Card className="grid gap-5">
        <div className="flex items-center gap-3">
          <ShieldAlert className="size-5 text-primary" aria-hidden="true" />
          <h2 className="font-display text-2xl font-medium">Provider calls</h2>
        </div>
        {providerJobs.length > 0 ? (
          <div className="grid gap-4">
            {providerJobs.map((job) => (
              <section key={job.id} className="grid gap-4 rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {job.job_type} · {job.provider}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {job.idempotency_key}
                    </p>
                  </div>
                  <Badge variant={statusVariant(job.status)}>{job.status}</Badge>
                </div>
                <div className="grid gap-4 md:grid-cols-4">
                  <Field label="Provider job id" value={job.provider_job_id ?? "—"} />
                  <Field label="Attempt" value={`${job.attempt}/${job.max_retries}`} />
                  <Field label="Started" value={formatDate(job.started_at)} />
                  <Field label="Completed" value={formatDate(job.completed_at)} />
                  <Field label="Estimate" value={formatCents(job.estimated_cost_cents)} />
                  <Field label="Actual" value={formatCents(job.actual_cost_cents)} />
                  <Field label="Created" value={formatDate(job.created_at)} />
                  <Field label="Updated" value={formatDate(job.updated_at)} />
                </div>
                {job.error_message ? (
                  <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                    {job.error_message}
                  </p>
                ) : null}
                <div className="grid gap-3 lg:grid-cols-2">
                  <JsonBlock title="Request payload" value={job.request_payload} />
                  <JsonBlock title="Response payload" value={job.response_payload} />
                </div>
              </section>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No provider jobs have been recorded for this output yet.
          </p>
        )}
      </Card>

      <Card className="grid gap-5">
        <div className="flex items-center gap-3">
          <Coins className="size-5 text-primary" aria-hidden="true" />
          <h2 className="font-display text-2xl font-medium">Cost events</h2>
        </div>
        {providerCosts.length > 0 ? (
          <div className="grid gap-3">
            {providerCosts.map((cost) => (
              <div
                key={cost.id}
                className={cn(
                  "grid gap-3 rounded-xl border border-border p-4 md:grid-cols-[1fr_auto]",
                  cost.cost_type === "actual" ? "bg-primary/5" : "bg-muted/30",
                )}
              >
                <div>
                  <p className="font-medium">
                    {cost.provider} · {cost.job_type} · {cost.cost_type}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDate(cost.created_at)}
                  </p>
                  <JsonBlock title="Metadata" value={cost.metadata} />
                </div>
                <p className="font-mono text-sm font-medium tabular-nums">
                  {formatCents(cost.amount_cents)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No provider costs have been recorded for this output yet.
          </p>
        )}
      </Card>
    </div>
  );
}
