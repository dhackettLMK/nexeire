import { describe, expect, it } from "vitest";
import {
  normalizeProviderCostCents,
  providerCostIdempotencyKey,
  summarizeProviderCosts,
} from "@/lib/providers/costs";

describe("provider costs", () => {
  it("builds distinct idempotency keys per provider stage and cost type", () => {
    expect(
      providerCostIdempotencyKey({
        costType: "estimate",
        provider: "elevenlabs",
        jobType: "voiceover",
        videoOutputId: "video-1",
      }),
    ).toBe("provider-cost:estimate:elevenlabs:voiceover:video-1");

    expect(
      providerCostIdempotencyKey({
        costType: "actual",
        provider: "creatomate",
        jobType: "render",
        videoOutputId: "video-1",
      }),
    ).toBe("provider-cost:actual:creatomate:render:video-1");
  });

  it("normalizes cost cents before persistence", () => {
    expect(normalizeProviderCostCents(12.4)).toBe(12);
    expect(normalizeProviderCostCents(-10)).toBe(0);
    expect(() => normalizeProviderCostCents(Number.NaN)).toThrow(/finite/);
  });

  it("summarizes estimate and actual cost rows independently", () => {
    expect(
      summarizeProviderCosts([
        { cost_type: "estimate", amount_cents: 30 },
        { cost_type: "estimate", amount_cents: 120 },
        { cost_type: "actual", amount_cents: 28 },
        { cost_type: "actual", amount_cents: 121 },
      ]),
    ).toEqual({
      estimatedCostCents: 150,
      actualCostCents: 149,
    });
  });
});
