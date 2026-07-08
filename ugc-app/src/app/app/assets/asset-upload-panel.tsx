"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud } from "lucide-react";
import { recordOrganizationAssetUploadAction } from "@/app/app/actions";
import {
  assetTags,
  formatAssetTag,
  type AssetTag,
} from "@/lib/assets/constants";
import {
  customerAssetBucket,
  organizationAssetStoragePath,
  organizationThumbnailStoragePath,
} from "@/lib/assets/validation";
import { uploadWithTus } from "@/lib/assets/client-upload";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { inputClasses } from "@/components/ui/field";
import { AsyncButton } from "@/components/ui/loading-button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const supportedMimeTypes = "video/mp4,video/quicktime,video/webm";

type AssetUploadPanelProps = {
  organizationId: string;
  brandProfileId: string | null;
};

type ThumbnailResult = {
  blob: Blob | null;
  durationSeconds: number | null;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong";
}

function canvasToWebpBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error("Could not create thumbnail"));
      },
      "image/webp",
      0.82,
    );
  });
}

function waitForVideoEvent(
  video: HTMLVideoElement,
  eventName: "loadedmetadata" | "loadeddata" | "seeked",
) {
  return new Promise<void>((resolve, reject) => {
    const onSuccess = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Could not read video thumbnail"));
    };
    const cleanup = () => {
      video.removeEventListener(eventName, onSuccess);
      video.removeEventListener("error", onError);
    };

    video.addEventListener(eventName, onSuccess, { once: true });
    video.addEventListener("error", onError, { once: true });
  });
}

async function createThumbnail(file: File): Promise<ThumbnailResult> {
  if (!file.type.startsWith("video/")) {
    return { blob: null, durationSeconds: null };
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.src = objectUrl;

    await waitForVideoEvent(video, "loadedmetadata");

    const durationSeconds = Number.isFinite(video.duration)
      ? video.duration
      : null;
    const seekTime =
      durationSeconds && durationSeconds > 0.5
        ? Math.min(1, Math.max(0.1, durationSeconds * 0.1))
        : 0;

    if (seekTime > 0) {
      const seekPromise = waitForVideoEvent(video, "seeked");
      video.currentTime = seekTime;
      await seekPromise;
    } else {
      await waitForVideoEvent(video, "loadeddata");
    }

    if (video.videoWidth <= 0 || video.videoHeight <= 0) {
      throw new Error("Media has no visible frame");
    }

    const width = Math.min(560, video.videoWidth);
    const height = Math.max(1, Math.round(width * (video.videoHeight / video.videoWidth)));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Canvas is not available");
    }

    canvas.width = width;
    canvas.height = height;
    context.drawImage(video, 0, 0, width, height);

    return {
      blob: await canvasToWebpBlob(canvas),
      durationSeconds,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function AssetUploadPanel({
  organizationId,
  brandProfileId,
}: AssetUploadPanelProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [selectedTags, setSelectedTags] = useState<AssetTag[]>([]);
  const [notes, setNotes] = useState("");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [thumbnailWarning, setThumbnailWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();
  const disabled = isUploading || isPending;

  function toggleTag(tag: AssetTag) {
    setSelectedTags((currentTags) =>
      currentTags.includes(tag)
        ? currentTags.filter((currentTag) => currentTag !== tag)
        : [...currentTags, tag],
    );
  }

  async function handleUpload() {
    if (!file) {
      setError("Choose a video clip first.");
      return;
    }

    if (!rightsConfirmed) {
      setError("Confirm that you own or have permission to use this footage.");
      return;
    }

    setError(null);
    setMessage(null);
    setThumbnailWarning(null);
    setProgress(0);
    setIsUploading(true);

    const supabase = createSupabaseClient();
    const assetId = crypto.randomUUID();
    const storagePath = organizationAssetStoragePath(
      organizationId,
      assetId,
      file.name,
    );
    const plannedThumbnailPath = organizationThumbnailStoragePath(
      organizationId,
      assetId,
    );

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw new Error(sessionError.message);
      }

      if (!session?.access_token) {
        throw new Error("Sign in again before uploading.");
      }

      setMessage("Uploading original file.");
      await uploadWithTus({
        accessToken: session.access_token,
        file,
        onProgress: setProgress,
        storagePath,
      });

      let thumbnailPath: string | null = null;
      let durationSeconds: number | null = null;

      try {
        setMessage("Creating thumbnail.");
        const thumbnail = await createThumbnail(file);
        durationSeconds = thumbnail.durationSeconds;

        if (thumbnail.blob) {
          const { error: thumbnailError } = await supabase.storage
            .from(customerAssetBucket)
            .upload(plannedThumbnailPath, thumbnail.blob, {
              cacheControl: "3600",
              contentType: "image/webp",
              upsert: false,
            });

          if (thumbnailError) {
            throw new Error(thumbnailError.message);
          }

          thumbnailPath = plannedThumbnailPath;
        }
      } catch (thumbnailError) {
        setThumbnailWarning(
          `Original uploaded, but thumbnail generation failed: ${errorMessage(
            thumbnailError,
          )}`,
        );
      }

      setMessage("Saving asset record.");
      await recordOrganizationAssetUploadAction({
        id: assetId,
        organizationId,
        brandProfileId,
        storagePath,
        thumbnailPath,
        filename: file.name,
        contentType: file.type || null,
        sizeBytes: file.size,
        durationSeconds,
        rightsConfirmed,
        tags: selectedTags,
        notes,
      });

      setMessage("Asset uploaded.");
      showToast({ title: "Clip uploaded.", variant: "success" });
      setFile(null);
      setRightsConfirmed(false);
      setSelectedTags([]);
      setNotes("");
      setProgress(0);

      if (inputRef.current) {
        inputRef.current.value = "";
      }

      startTransition(() => router.refresh());
    } catch (uploadError) {
      setError(errorMessage(uploadError));
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <Card className="grid gap-5">
      <div>
        <h2 className="font-display text-xl font-medium tracking-tight">
          Upload b-roll
        </h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Private video clips upload in resumable 6MB chunks and are signed only
          when needed for previews or rendering.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <div className="grid gap-4">
          <label className="grid gap-2 text-sm font-medium text-foreground">
            Source video
            <input
              ref={inputRef}
              type="file"
              accept={supportedMimeTypes}
              disabled={disabled}
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setError(null);
                setMessage(null);
                setThumbnailWarning(null);
              }}
              className={cn(
                inputClasses,
                "file:mr-4 file:rounded-full file:border-0 file:bg-primary file:px-3 file:py-1 file:text-sm file:font-semibold file:text-primary-foreground",
              )}
            />
          </label>

          <label className="flex items-start gap-3 rounded-xl bg-muted/50 p-3 text-sm font-medium text-foreground ring-1 ring-foreground/[0.05]">
            <input
              type="checkbox"
              checked={rightsConfirmed}
              disabled={disabled}
              onChange={(event) => setRightsConfirmed(event.target.checked)}
              className="mt-0.5 size-4 accent-primary"
            />
            <span>I own or have permission to use this footage.</span>
          </label>

          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium text-foreground">Tags</legend>
            <div className="flex flex-wrap gap-2">
              {assetTags.map((tag) => (
                <label
                  key={tag}
                  className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full bg-muted px-3 text-sm font-medium text-foreground ring-1 ring-foreground/[0.06] transition-colors has-[:checked]:bg-primary/10 has-[:checked]:text-primary has-[:checked]:ring-primary/20"
                >
                  <input
                    type="checkbox"
                    checked={selectedTags.includes(tag)}
                    disabled={disabled}
                    onChange={() => toggleTag(tag)}
                    className="size-4 accent-primary"
                  />
                  {formatAssetTag(tag)}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="grid gap-2 text-sm font-medium text-foreground">
            Notes
            <textarea
              rows={4}
              value={notes}
              disabled={disabled}
              onChange={(event) => setNotes(event.target.value)}
              className={inputClasses}
              placeholder="Shot quality, important moments, or edit cautions"
            />
          </label>
        </div>

        <div className="grid content-start gap-4 rounded-2xl bg-muted/40 p-4 ring-1 ring-foreground/[0.05]">
          {file ? (
            <dl className="grid gap-2 text-sm text-muted-foreground">
              <div className="flex justify-between gap-3">
                <dt>Selected</dt>
                <dd className="truncate text-right font-medium text-foreground">
                  {file.name}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Type</dt>
                <dd>{file.type || "Unknown"}</dd>
              </div>
            </dl>
          ) : null}

          {disabled ? (
            <div className="h-2 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          ) : null}

          <AsyncButton
            disabled={!file || !rightsConfirmed}
            icon={<UploadCloud className="size-4" />}
            isLoading={disabled}
            onClick={handleUpload}
          >
            Upload clip
          </AsyncButton>

          {message ? <p className="text-sm font-medium text-foreground">{message}</p> : null}
          {thumbnailWarning ? (
            <p className="text-sm leading-6 text-amber-700">
              {thumbnailWarning}
            </p>
          ) : null}
          {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
        </div>
      </div>
    </Card>
  );
}
