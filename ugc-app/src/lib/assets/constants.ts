export const assetTags = [
  "product",
  "founder",
  "premises",
  "location",
  "process",
  "before/after",
  "testimonial",
  "result",
  "customer",
  "lifestyle",
  "proof",
  "problem",
  "CTA",
] as const;

export type AssetTag = (typeof assetTags)[number];

export const assetStatuses = [
  "uploaded",
  "tagged",
  "selected",
  "archived",
] as const;

export type AssetStatus = (typeof assetStatuses)[number];

export function formatAssetTag(tag: string) {
  if (tag === "CTA") {
    return "CTA";
  }

  if (tag === "before/after") {
    return "Before/after";
  }

  return tag.charAt(0).toUpperCase() + tag.slice(1);
}

export function formatAssetStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}
