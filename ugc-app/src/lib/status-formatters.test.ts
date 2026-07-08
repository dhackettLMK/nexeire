import { describe, expect, it } from "vitest";
import { formatAssetStatus, formatAssetTag } from "@/lib/assets/constants";

describe("status and tag formatters", () => {
  it("preserves CTA asset tags while title-casing other tags", () => {
    expect(formatAssetTag("CTA")).toBe("CTA");
    expect(formatAssetTag("product")).toBe("Product");
  });

  it("formats asset statuses for display", () => {
    expect(formatAssetStatus("selected")).toBe("Selected");
  });
});
