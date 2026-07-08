import { describe, expect, it } from "vitest";
import { assetTags } from "@/lib/assets/constants";
import {
  organizationAssetStoragePath,
  organizationThumbnailStoragePath,
  safeFilename,
  validateOrganizationAssetUpload,
} from "@/lib/assets/validation";

const organizationId = "11111111-1111-4111-8111-111111111111";
const assetId = "22222222-2222-4222-8222-222222222222";

describe("organization asset validation", () => {
  it("includes the required self-serve manual tag vocabulary", () => {
    expect(assetTags).toEqual(
      expect.arrayContaining([
        "product",
        "founder",
        "premises",
        "customer",
        "before/after",
        "process",
        "lifestyle",
        "testimonial",
      ]),
    );
  });

  it("sanitizes filenames before building storage paths", () => {
    expect(safeFilename("../Founder Clip Final.mov")).toBe(
      "founder-clip-final.mov",
    );
    expect(
      organizationAssetStoragePath(organizationId, assetId, "../Founder Clip.mov"),
    ).toBe(
      `organizations/${organizationId}/assets/${assetId}/founder-clip.mov`,
    );
  });

  it("requires explicit rights confirmation", () => {
    expect(() =>
      validateOrganizationAssetUpload({
        id: assetId,
        organizationId,
        storagePath: organizationAssetStoragePath(
          organizationId,
          assetId,
          "Founder Clip.mov",
        ),
        thumbnailPath: organizationThumbnailStoragePath(organizationId, assetId),
        filename: "Founder Clip.mov",
        sizeBytes: 1024,
        rightsConfirmed: false,
        tags: ["founder"],
      }),
    ).toThrow(/permission/);
  });

  it("rejects paths outside the organization scope", () => {
    expect(() =>
      validateOrganizationAssetUpload({
        id: assetId,
        organizationId,
        storagePath: organizationAssetStoragePath(
          "33333333-3333-4333-8333-333333333333",
          assetId,
          "clip.mp4",
        ),
        filename: "clip.mp4",
        sizeBytes: 1024,
        rightsConfirmed: true,
        tags: ["founder"],
      }),
    ).toThrow(/storage path/);
  });

  it("keeps only supported manual tags", () => {
    const result = validateOrganizationAssetUpload({
      id: assetId,
      organizationId,
      storagePath: organizationAssetStoragePath(organizationId, assetId, "clip.mp4"),
      filename: "clip.mp4",
      sizeBytes: 1024,
      durationSeconds: 12,
      rightsConfirmed: true,
      tags: ["founder", "testimonial", "unsupported"],
    });

    expect(result.tags).toEqual(["founder", "testimonial"]);
    expect(result.durationSeconds).toBe(12);
  });
});
