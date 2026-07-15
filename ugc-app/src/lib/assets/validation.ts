import { assetTags, type AssetTag } from "@/lib/assets/constants";

export const customerAssetBucket = "client-assets";
export const generatedMediaBucket = "generated-videos";
export const signedUrlTtlSeconds = 60 * 60;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const assetTagSet = new Set<string>(assetTags);

export type OrganizationAssetUploadPayload = {
  id: string;
  organizationId: string;
  brandProfileId?: string | null;
  storagePath: string;
  thumbnailPath?: string | null;
  filename: string;
  contentType?: string | null;
  sizeBytes: number;
  durationSeconds?: number | null;
  rightsConfirmed: boolean;
  tags: string[];
  notes?: string | null;
};

export function isUuid(value: string) {
  return uuidPattern.test(value);
}

export function assertUuid(value: string, label: string) {
  if (!isUuid(value)) {
    throw new Error(`Invalid ${label}`);
  }
}

export function safeFilename(filename: string) {
  const cleaned = filename
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "")
    .toLowerCase();

  return cleaned || `asset-${Date.now()}`;
}

export function organizationAssetStoragePath(
  organizationId: string,
  assetId: string,
  filename: string,
) {
  return `organizations/${organizationId}/assets/${assetId}/${safeFilename(
    filename,
  )}`;
}

export function organizationThumbnailStoragePath(
  organizationId: string,
  assetId: string,
) {
  return `organizations/${organizationId}/thumbnails/${assetId}.webp`;
}

// Matches the client-assets bucket's allowed_mime_types (see
// supabase/migrations/20260614000000_phase_1_minimal_data_model.sql).
export const organizationLogoMimeTypes = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export const organizationLogoMaxBytes = 4 * 1024 * 1024;

export function organizationLogoStoragePath(
  organizationId: string,
  logoId: string,
  filename: string,
) {
  return `organizations/${organizationId}/brand-logo/${logoId}-${safeFilename(
    filename,
  )}`;
}

export function organizationGeneratedVideoPath(
  organizationId: string,
  videoOutputId: string,
) {
  return `organizations/${organizationId}/videos/${videoOutputId}.mp4`;
}

export function organizationVoiceoverPath(
  organizationId: string,
  videoOutputId: string,
) {
  return `organizations/${organizationId}/voiceovers/${videoOutputId}.mp3`;
}

export function organizationScriptVoiceoverPath(
  organizationId: string,
  scriptId: string,
) {
  return `organizations/${organizationId}/voiceovers/scripts/${scriptId}.mp3`;
}

export function validateOrganizationAssetPath(
  organizationId: string,
  assetId: string,
  storagePath: string,
) {
  const prefix = `organizations/${organizationId}/assets/${assetId}/`;

  if (!storagePath.startsWith(prefix)) {
    throw new Error("Invalid asset storage path");
  }
}

export function validateOrganizationThumbnailPath(
  organizationId: string,
  assetId: string,
  thumbnailPath: string | null | undefined,
) {
  if (!thumbnailPath) {
    return;
  }

  const expectedPath = organizationThumbnailStoragePath(organizationId, assetId);

  if (thumbnailPath !== expectedPath) {
    throw new Error("Invalid thumbnail storage path");
  }
}

export function filterAssetTags(values: unknown): AssetTag[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.filter(
    (tag): tag is AssetTag => typeof tag === "string" && assetTagSet.has(tag),
  );
}

export function validateOrganizationAssetUpload(
  payload: OrganizationAssetUploadPayload,
) {
  assertUuid(payload.id, "asset id");
  assertUuid(payload.organizationId, "organization id");
  validateOrganizationAssetPath(
    payload.organizationId,
    payload.id,
    payload.storagePath,
  );
  validateOrganizationThumbnailPath(
    payload.organizationId,
    payload.id,
    payload.thumbnailPath,
  );

  if (payload.brandProfileId) {
    assertUuid(payload.brandProfileId, "brand profile id");
  }

  if (!payload.rightsConfirmed) {
    throw new Error(
      "Confirm that you own or have permission to use this footage.",
    );
  }

  if (!payload.filename.trim()) {
    throw new Error("filename is required");
  }

  if (!Number.isFinite(payload.sizeBytes) || payload.sizeBytes <= 0) {
    throw new Error("sizeBytes must be greater than 0");
  }

  return {
    tags: filterAssetTags(payload.tags),
    durationSeconds:
      typeof payload.durationSeconds === "number" &&
      Number.isFinite(payload.durationSeconds) &&
      payload.durationSeconds > 0
        ? payload.durationSeconds
        : null,
  };
}
