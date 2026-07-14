import Link from "next/link";
import { Download, GitBranch, Inbox, RotateCcw } from "lucide-react";
import { retryVideoOutputAction } from "@/app/app/actions";
import { RenderPollingBridge } from "@/components/videos/render-polling";
import { signedUrlTtlSeconds } from "@/lib/assets/validation";
import { canRetryVideo, type VideoStatus } from "@/lib/batches/rules";
import { requireOrganization } from "@/lib/customer/organization";
import { videoDownloadUrl } from "@/lib/videos/downloads";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClasses } from "@/components/ui/button";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/loading-button";
import { cn } from "@/lib/utils";

function statusVariant(status: string): BadgeVariant {
  if (status === "ready") return "success";
  if (status === "failed") return "danger";
  if (status === "needs_review") return "warning";
  if (
    ["planned", "queued", "scripting", "voiceover", "rendering"].includes(
      status,
    )
  ) {
    return "primary";
  }
  return "muted";
}

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

function statusProgress(status: string) {
  switch (status) {
    case "planned":
      return 5;
    case "queued":
      return 12;
    case "scripting":
      return 30;
    case "voiceover":
      return 55;
    case "rendering":
      return 80;
    case "ready":
    case "failed":
    case "needs_review":
      return 100;
    default:
      return 0;
  }
}

function statusHint(status: string) {
  switch (status) {
    case "planned":
      return "Planned";
    case "queued":
      return "Queued for worker";
    case "scripting":
      return "Writing scripts";
    case "voiceover":
      return "Generating voiceover";
    case "rendering":
      return "Rendering video";
    case "ready":
      return "Ready to download";
    case "failed":
      return "Failed";
    case "needs_review":
      return "Needs review";
    default:
      return formatStatus(status);
  }
}

function progressTone(status: string) {
  if (status === "failed") return "var(--destructive)";
  if (status === "ready") return "oklch(0.627 0.194 149.214)";
  if (status === "needs_review") return "oklch(0.666 0.179 58.318)";
  return "var(--primary)";
}

function StatusProgressRing({ status }: { status: string }) {
  const progress = statusProgress(status);
  const degrees = Math.round(progress * 3.6);
  const label = `${statusHint(status)}: ${progress}%`;

  return (
    <span
      aria-label={label}
      className="grid size-11 shrink-0 place-items-center rounded-full ring-1 ring-border"
      style={{
        background: `conic-gradient(${progressTone(status)} ${degrees}deg, color-mix(in oklab, var(--muted-foreground) 16%, transparent) 0deg)`,
      }}
      title={label}
    >
      <span className="grid size-8 place-items-center rounded-full bg-card font-mono text-[0.625rem] font-medium tabular-nums text-muted-foreground ring-1 ring-border">
        {progress}
      </span>
    </span>
  );
}

type VideoOutput = {
  id: string;
  title: string;
  status: string;
  source: string;
  storage_bucket: string | null;
  video_path: string | null;
  caption: string | null;
  campaign_id: string | null;
  retry_count: number;
  max_retries: number;
  error_message: string | null;
  updated_at: string;
  notes: string | null;
};

type SignedVideoOutput = VideoOutput & {
  downloadUrl: string | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

async function getVideoOutputs(
  supabase: Awaited<ReturnType<typeof requireOrganization>>["supabase"],
  organizationId: string,
) {
  const { data, error } = await supabase
    .from("video_outputs")
    .select(
      "id,title,status,source,storage_bucket,video_path,caption,campaign_id,retry_count,max_retries,error_message,updated_at,notes",
    )
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as VideoOutput[];
}

export default async function InboxPage() {
  const { supabase, organization } = await requireOrganization("/app/inbox");
  const outputs = await getVideoOutputs(supabase, organization.id);
  const signedOutputs: SignedVideoOutput[] = await Promise.all(
    outputs.map(async (output) => {
      if (output.status !== "ready" || !output.video_path) {
        return { ...output, downloadUrl: null };
      }

      const { data } = await supabase.storage
        .from(output.storage_bucket || "generated-videos")
        .createSignedUrl(output.video_path, signedUrlTtlSeconds);

      if (!data?.signedUrl) {
        return { ...output, downloadUrl: null };
      }

      return {
        ...output,
        downloadUrl: videoDownloadUrl(data.signedUrl, output.title),
      };
    }),
  );

  const hasRenderingVideos = signedOutputs.some(
    (output) => output.status === "rendering",
  );

  return (
    <div className="grid gap-8">
      <RenderPollingBridge active={hasRenderingVideos} />
      <PageHeader
        eyebrow="Library"
        title="Your videos"
        description="Finished videos land here, ready to download. Failed renders can be retried."
      />
      {signedOutputs.length > 0 ? (
        <Card className="overflow-hidden p-0">
          <div className="divide-y divide-border">
            {signedOutputs.map((output) => {
              const retryAction = retryVideoOutputAction.bind(null, output.id);
              const retryable = canRetryVideo({
                status: output.status as VideoStatus,
                retryCount: output.retry_count,
                maxRetries: output.max_retries,
              });

              return (
                <article
                  key={output.id}
                  className="grid gap-5 px-5 py-5 md:grid-cols-[minmax(0,1fr)_180px]"
                >
                  <div className="flex min-w-0 flex-col gap-4">
                    <div>
                      <p className="font-medium">{output.title}</p>
                      <p className="mt-1 text-muted-foreground">
                        {output.caption ?? output.notes ?? "No caption"}
                      </p>
                      {output.error_message ? (
                        <p className="mt-2 text-sm text-destructive">
                          {output.error_message}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/app/inbox/${output.id}/trace`}
                        className={cn(
                          buttonClasses({ variant: "secondary", size: "sm" }),
                          "w-fit",
                        )}
                      >
                        <GitBranch className="size-4" aria-hidden="true" />
                        View trace
                      </Link>
                      {output.downloadUrl ? (
                        <a
                          href={output.downloadUrl}
                          className={cn(
                            buttonClasses({ variant: "secondary", size: "sm" }),
                            "w-fit",
                          )}
                        >
                          <Download className="size-4" aria-hidden="true" />
                          Download
                        </a>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-col items-end justify-start gap-3">
                    <div className="flex items-start justify-end gap-3">
                      <StatusProgressRing status={output.status} />
                      <div className="grid gap-2 md:justify-items-end">
                        <Badge variant={statusVariant(output.status)}>
                          {formatStatus(output.status)}
                        </Badge>
                        <p className="text-xs text-muted-foreground">
                          {statusHint(output.status)}
                        </p>
                        <p className="text-xs tabular-nums text-muted-foreground">
                          Retry {output.retry_count}/{output.max_retries}
                        </p>
                        {retryable ? (
                          <ActionForm
                            action={retryAction}
                            successToast={{ title: "Retry started." }}
                          >
                            <SubmitButton
                              icon={<RotateCcw className="size-4" />}
                              variant="secondary"
                              size="sm"
                              className="w-fit"
                            >
                              Retry
                            </SubmitButton>
                          </ActionForm>
                        ) : null}
                      </div>
                    </div>
                    <p className="text-right text-sm tabular-nums text-muted-foreground">
                      {formatDate(output.updated_at)}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </Card>
      ) : (
        <EmptyState
          icon={<Inbox className="size-6" aria-hidden="true" />}
          title="No videos yet"
          description="Upload some clips and hit generate — your finished videos will show up here."
        />
      )}
    </div>
  );
}
