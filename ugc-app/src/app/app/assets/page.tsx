import { Download, ExternalLink, Save, Trash2, UploadCloud } from "lucide-react";
import {
  deleteOrganizationAssetAction,
  updateOrganizationAssetAction,
} from "@/app/app/actions";
import {
  assetStatuses,
  assetTags,
  formatAssetStatus,
  formatAssetTag,
} from "@/lib/assets/constants";
import { signedUrlTtlSeconds } from "@/lib/assets/validation";
import { requireOrganization } from "@/lib/customer/organization";
import { AssetUploadPanel } from "./asset-upload-panel";
import { PageHeader, TitleAccent } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, inputClasses } from "@/components/ui/field";
import { buttonClasses } from "@/components/ui/button";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/loading-button";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { cn } from "@/lib/utils";

const dtClass =
  "font-mono text-[0.625rem] uppercase tracking-[0.14em] text-primary/75";

type AssetRecord = {
  id: string;
  brand_profile_id: string | null;
  created_at: string;
  storage_bucket: string | null;
  storage_path: string;
  thumbnail_path: string | null;
  filename: string;
  content_type: string | null;
  size_bytes: number | string | null;
  duration_seconds: number | string | null;
  tags: string[] | null;
  notes: string | null;
  rights_confirmed: boolean;
  selected: boolean;
  status: string;
};

type SignedAsset = AssetRecord & {
  signedUrl: string | null;
  thumbnailUrl: string | null;
  downloadUrl: string | null;
};

function appendDownloadParameter(url: string, filename: string) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}download=${encodeURIComponent(filename)}`;
}

function formatBytes(value: number | string | null) {
  if (value === null) {
    return "Unknown size";
  }

  const size = Number(value);

  if (!Number.isFinite(size) || size <= 0) {
    return "Unknown size";
  }

  const units = ["B", "KB", "MB", "GB"];
  let unitIndex = 0;
  let currentSize = size;

  while (currentSize >= 1024 && unitIndex < units.length - 1) {
    currentSize /= 1024;
    unitIndex += 1;
  }

  return `${currentSize.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDuration(value: number | string | null) {
  if (value === null) {
    return "No duration";
  }

  const totalSeconds = Math.round(Number(value));

  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return "No duration";
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function AssetLink({
  href,
  children,
}: {
  href: string | null;
  children: React.ReactNode;
}) {
  if (!href) {
    return (
      <span
        className={cn(
          buttonClasses({ variant: "secondary", size: "sm" }),
          "cursor-not-allowed text-muted-foreground opacity-60",
        )}
      >
        {children}
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={buttonClasses({ variant: "secondary", size: "sm" })}
    >
      {children}
    </a>
  );
}

function AssetCard({ asset, index }: { asset: SignedAsset; index: number }) {
  const updateAction = updateOrganizationAssetAction.bind(null, asset.id);
  const deleteAction = deleteOrganizationAssetAction.bind(null, asset.id);
  const updateFormId = `asset_update_${asset.id}`;
  const tags = asset.tags ?? [];

  return (
    <Card
      className="app-rise-in grid overflow-hidden p-0"
      style={{ animationDelay: `${Math.min(index, 7) * 70}ms` }}
    >
      <div className="aspect-video bg-muted ring-1 ring-inset ring-primary/10">
        {asset.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.thumbnailUrl}
            alt={`Preview of ${asset.filename}`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center text-sm font-medium text-muted-foreground">
            Preview thumbnail unavailable
          </div>
        )}
      </div>
      <div className="flex h-full flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">{asset.filename}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatDate(asset.created_at)}
            </p>
          </div>
          <Badge variant={asset.selected ? "primary" : "muted"}>
            {formatAssetStatus(asset.status)}
          </Badge>
        </div>

        <dl className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
          <div>
            <dt className={dtClass}>Size</dt>
            <dd className="mt-1 tabular-nums text-foreground">
              {formatBytes(asset.size_bytes)}
            </dd>
          </div>
          <div>
            <dt className={dtClass}>Duration</dt>
            <dd className="mt-1 tabular-nums text-foreground">
              {formatDuration(asset.duration_seconds)}
            </dd>
          </div>
          <div>
            <dt className={dtClass}>Rights</dt>
            <dd className="mt-1 text-foreground">
              {asset.rights_confirmed ? "Confirmed" : "Missing"}
            </dd>
          </div>
          <div>
            <dt className={dtClass}>Selected</dt>
            <dd className="mt-1 text-foreground">{asset.selected ? "Yes" : "No"}</dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-2">
          <AssetLink href={asset.signedUrl}>
            <ExternalLink className="size-4" aria-hidden="true" />
            Preview
          </AssetLink>
          <AssetLink href={asset.downloadUrl}>
            <Download className="size-4" aria-hidden="true" />
            Download
          </AssetLink>
        </div>

        <ActionForm
          id={updateFormId}
          action={updateAction}
          successToast={{ title: "Asset saved." }}
          className="grid gap-3 border-t border-border pt-4"
        >
          <Field label="Status" htmlFor={`status_${asset.id}`}>
            <select
              id={`status_${asset.id}`}
              name="status"
              defaultValue={asset.status}
              className={inputClasses}
            >
              {assetStatuses.map((status) => (
                <option key={status} value={status}>
                  {formatAssetStatus(status)}
                </option>
              ))}
            </select>
          </Field>
          <label className="inline-flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              name="selected"
              defaultChecked={asset.selected || asset.status === "selected"}
              className="size-4 accent-primary"
            />
            Select for generation
          </label>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">Tags</legend>
            <div className="flex flex-wrap gap-2">
              {assetTags.map((tag) => (
                <label
                  key={tag}
                  className="inline-flex h-8 items-center gap-2 rounded-full bg-muted px-2.5 text-xs font-medium ring-1 ring-border transition-colors has-[:checked]:bg-primary/10 has-[:checked]:text-primary has-[:checked]:ring-primary/30"
                >
                  <input
                    name="tags"
                    value={tag}
                    type="checkbox"
                    defaultChecked={tags.includes(tag)}
                    className="size-3.5 accent-primary"
                  />
                  {formatAssetTag(tag)}
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="Notes" htmlFor={`notes_${asset.id}`}>
            <textarea
              id={`notes_${asset.id}`}
              name="notes"
              rows={3}
              defaultValue={asset.notes ?? ""}
              className={inputClasses}
            />
          </Field>
        </ActionForm>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-4">
          <SubmitButton
            form={updateFormId}
            icon={<Save className="size-4" />}
            size="sm"
            className="w-fit"
          >
            Save
          </SubmitButton>
          <ActionForm
            action={deleteAction}
            successToast={{ title: "Asset deleted." }}
            className="contents"
          >
            <SubmitButton
              icon={<Trash2 className="size-4" />}
              variant="secondary"
              size="sm"
              className="w-fit text-destructive ring-destructive/25 hover:bg-red-400/10 hover:ring-destructive/40"
            >
              Delete
            </SubmitButton>
          </ActionForm>
        </div>
      </div>
    </Card>
  );
}

export default async function AssetsPage() {
  const { supabase, organization } = await requireOrganization("/app/assets");
  const [profileResult, assetsResult] = await Promise.all([
    supabase
      .from("brand_profiles")
      .select("id")
      .eq("organization_id", organization.id)
      .maybeSingle(),
    supabase
      .from("organization_assets")
      .select(
        "id,brand_profile_id,created_at,storage_bucket,storage_path,thumbnail_path,filename,content_type,size_bytes,duration_seconds,tags,notes,rights_confirmed,selected,status",
      )
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false }),
  ]);

  if (profileResult.error) {
    throw new Error(profileResult.error.message);
  }

  if (assetsResult.error) {
    throw new Error(assetsResult.error.message);
  }

  const assets = (assetsResult.data ?? []) as AssetRecord[];
  const signedAssets = await Promise.all(
    assets.map(async (asset) => {
      const bucket = asset.storage_bucket || "client-assets";
      const [rawUrlResult, thumbnailUrlResult] = await Promise.all([
        supabase.storage
          .from(bucket)
          .createSignedUrl(asset.storage_path, signedUrlTtlSeconds),
        asset.thumbnail_path
          ? supabase.storage
              .from(bucket)
              .createSignedUrl(asset.thumbnail_path, signedUrlTtlSeconds)
          : Promise.resolve({ data: null, error: null }),
      ]);
      const signedUrl = rawUrlResult.data?.signedUrl ?? null;
      const thumbnailUrl = thumbnailUrlResult.data?.signedUrl ?? null;

      return {
        ...asset,
        signedUrl,
        thumbnailUrl,
        downloadUrl: signedUrl
          ? appendDownloadParameter(signedUrl, asset.filename)
          : null,
      };
    }),
  );
  const selectedCount = assets.filter(
    (asset) => asset.selected || asset.status === "selected",
  ).length;

  return (
    <div className="app-stagger grid gap-8">
      <PageHeader
        eyebrow="Step 02"
        title={
          <>
            B-roll <TitleAccent>library</TitleAccent>
          </>
        }
        description="Upload phone-shot clips, confirm usage rights, tag usable moments, and select the footage that should feed script and render generation."
      />

      <AssetUploadPanel
        organizationId={organization.id}
        brandProfileId={(profileResult.data?.id as string | undefined) ?? null}
      />

      <Card className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Library
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Signed preview and download links expire after 1 hour.
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-xl bg-muted/60 px-3.5 py-3 ring-1 ring-primary/15">
            <dt className={dtClass}>Total</dt>
            <dd className="mt-1.5 text-lg font-bold tabular-nums text-foreground">
              <AnimatedNumber value={assets.length} />
            </dd>
          </div>
          <div className="rounded-xl bg-muted/60 px-3.5 py-3 ring-1 ring-primary/15">
            <dt className={dtClass}>Selected</dt>
            <dd className="mt-1.5 text-lg font-bold tabular-nums text-foreground">
              <AnimatedNumber value={selectedCount} />
            </dd>
          </div>
          <div className="rounded-xl bg-muted/60 px-3.5 py-3 ring-1 ring-primary/15">
            <dt className={dtClass}>Tagged</dt>
            <dd className="mt-1.5 text-lg font-bold tabular-nums text-foreground">
              <AnimatedNumber
                value={assets.filter((asset) => (asset.tags ?? []).length > 0).length}
              />
            </dd>
          </div>
        </dl>
      </Card>

      {signedAssets.length > 0 ? (
        <section className="grid gap-4 xl:grid-cols-2">
          {signedAssets.map((asset, index) => (
            <AssetCard key={asset.id} asset={asset} index={index} />
          ))}
        </section>
      ) : (
        <EmptyState
          icon={<UploadCloud className="size-6" aria-hidden="true" />}
          title={
            <>
              No clips <TitleAccent>yet</TitleAccent>
            </>
          }
          description="Upload 20-50 realistic phone clips for best batch generation coverage."
        />
      )}
    </div>
  );
}
