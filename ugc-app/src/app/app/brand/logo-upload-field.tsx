"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImageUp, Trash2 } from "lucide-react";
import { saveOrganizationLogoAction } from "@/app/app/actions";
import {
  customerAssetBucket,
  organizationLogoMaxBytes,
  organizationLogoMimeTypes,
  organizationLogoStoragePath,
} from "@/lib/assets/validation";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { inputClasses } from "@/components/ui/field";
import { AsyncButton } from "@/components/ui/loading-button";
import { WorkspaceAvatar } from "@/components/ui/workspace-avatar";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong";
}

export function LogoUploadField({
  organizationId,
  orgInitial,
  logoUrl,
}: {
  organizationId: string;
  orgInitial: string;
  logoUrl: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();
  const disabled = isUploading || isPending;

  async function handleFile(file: File) {
    const allowedTypes: readonly string[] = organizationLogoMimeTypes;
    if (!allowedTypes.includes(file.type)) {
      setError("Use a PNG, JPEG, or WebP file.");
      return;
    }

    if (file.size > organizationLogoMaxBytes) {
      setError("Keep the logo under 4MB.");
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      const supabase = createSupabaseClient();
      const storagePath = organizationLogoStoragePath(
        organizationId,
        crypto.randomUUID(),
        file.name,
      );

      const { error: uploadError } = await supabase.storage
        .from(customerAssetBucket)
        .upload(storagePath, file, {
          cacheControl: "3600",
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      await saveOrganizationLogoAction({ organizationId, storagePath });

      showToast({ title: "Logo updated.", variant: "success" });
      startTransition(() => router.refresh());
    } catch (uploadError) {
      setError(errorMessage(uploadError));
    } finally {
      setIsUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  async function handleRemove() {
    setError(null);
    setIsUploading(true);

    try {
      await saveOrganizationLogoAction({ organizationId, storagePath: null });
      showToast({ title: "Logo removed.", variant: "success" });
      startTransition(() => router.refresh());
    } catch (removeError) {
      setError(errorMessage(removeError));
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <WorkspaceAvatar logoUrl={logoUrl} initial={orgInitial} size={56} />
      <div className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <label>
            <span
              className={cn(
                inputClasses,
                "inline-flex w-fit cursor-pointer items-center gap-2 px-3 py-1.5 text-sm font-semibold text-foreground",
                disabled && "pointer-events-none opacity-60",
              )}
            >
              <ImageUp className="size-4" aria-hidden="true" />
              {logoUrl ? "Replace logo" : "Upload logo"}
            </span>
            <input
              ref={inputRef}
              type="file"
              accept={organizationLogoMimeTypes.join(",")}
              disabled={disabled}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(file);
              }}
              className="sr-only"
            />
          </label>
          {logoUrl ? (
            <AsyncButton
              type="button"
              variant="outline"
              size="sm"
              isLoading={disabled}
              icon={<Trash2 className="size-4" />}
              onClick={handleRemove}
            >
              Remove
            </AsyncButton>
          ) : null}
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          PNG, JPEG, or WebP. Shown in place of the workspace initial across
          the app.
        </p>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}
