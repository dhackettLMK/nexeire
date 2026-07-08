import { describe, expect, it } from "vitest";
import { generateFixtureScriptVariants } from "@/lib/scripts/generator";

describe("fixture script generator", () => {
  it.each([3, 5, 10])("generates %i scripts for local batch sizing", (variantCount) => {
    const result = generateFixtureScriptVariants({
      client: {
        business_name: "Demo Trade Service",
        website_url: "https://example.com",
        social_links: [],
        location: "San Antonio",
        industry: "Trade service",
        offer: "Same-week quote",
        target_customer: "Homeowners",
        tone: "Practical and direct",
        notes: null,
      },
      brief: {
        campaign_goal: "Drive quote requests",
        platform: "short_form",
        duration_seconds: 30,
        batch_size: variantCount,
        raw_notes: null,
        generated_summary: null,
        what_they_do: "Repairs and maintenance",
        why_they_do_it: "Help homeowners fix problems quickly",
        promoting: "Same-week quote",
        main_pain_points: "Unclear arrival windows",
        offer_cta: "Request a quote",
        tone_examples: null,
      },
      assets: [
        {
          id: "asset-1",
          filename: "van.mp4",
          content_type: "video/mp4",
          duration_seconds: 12,
          tags: ["premises", "process"],
          notes: null,
          status: "selected",
        },
      ],
      variantCount,
    });

    expect(result.variants).toHaveLength(variantCount);
    expect(result.variants.every((variant) => variant.scene_plan.length > 0)).toBe(
      true,
    );
  });

  it("returns the required script shape for 3-10 local/test scripts", () => {
    const result = generateFixtureScriptVariants({
      client: {
        business_name: "Demo Restaurant",
        website_url: "https://example.com",
        social_links: [],
        location: "San Antonio",
        industry: "Restaurant",
        offer: "Lunch special",
        target_customer: "Office workers",
        tone: "Warm and direct",
        notes: null,
      },
      brief: {
        campaign_goal: "Drive bookings",
        platform: "short_form",
        duration_seconds: 30,
        batch_size: 5,
        raw_notes: null,
        generated_summary: null,
        what_they_do: "Fresh lunch service",
        why_they_do_it: "Make lunch easier",
        promoting: "Lunch special",
        main_pain_points: "Slow lunch breaks",
        offer_cta: "Book a table",
        tone_examples: null,
      },
      assets: [
        {
          id: "asset-1",
          filename: "kitchen.mp4",
          content_type: "video/mp4",
          duration_seconds: 12,
          tags: ["process", "product"],
          notes: null,
          status: "selected",
        },
      ],
      variantCount: 5,
    });

    expect(result.variants).toHaveLength(5);
    expect(result.variants[0]).toMatchObject({
      hook: expect.any(String),
      voiceover: expect.any(String),
      cta: "Book a table",
      caption: expect.any(String),
    });
    expect(result.variants[0].scene_plan.length).toBeGreaterThan(0);
    expect(result.variants[0].suggested_broll).toContain("process");
    expect(result.variants[0].hashtags.length).toBeGreaterThan(0);
  });
});
