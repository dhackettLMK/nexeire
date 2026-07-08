import { describe, expect, it } from "vitest";
import { generateFixtureScriptVariants } from "@/lib/scripts/generator";
import {
  hasResearchSignal,
  scoreGeneratedScript,
  usableRate,
} from "@/lib/scripts/quality";
import type {
  ScriptGenerationAsset,
  ScriptGenerationInput,
  ScriptGenerationResearch,
} from "@/lib/scripts/types";

const sharedAssets: ScriptGenerationAsset[] = [
  {
    id: "asset-founder",
    filename: "founder-intro.mp4",
    content_type: "video/mp4",
    duration_seconds: 14,
    tags: ["founder", "premises"],
    notes: "Founder outside the business.",
    status: "selected",
  },
  {
    id: "asset-process",
    filename: "process.mp4",
    content_type: "video/mp4",
    duration_seconds: 18,
    tags: ["process", "product"],
    notes: "Hands-on process footage.",
    status: "tagged",
  },
  {
    id: "asset-proof",
    filename: "customer-proof.mp4",
    content_type: "video/mp4",
    duration_seconds: 9,
    tags: ["customer", "testimonial", "lifestyle"],
    notes: "Customer-style proof shot.",
    status: "tagged",
  },
];

const niches = [
  {
    industry: "Gym",
    businessName: "Demo Strength Studio",
    location: "San Antonio",
    audience: "Busy professionals who want structure",
    offer: "Book a 7-day trial",
    objection: "No time to plan workouts",
  },
  {
    industry: "Restaurant",
    businessName: "Demo Lunch Bar",
    location: "San Antonio",
    audience: "Office workers choosing lunch quickly",
    offer: "Reserve lunch today",
    objection: "Slow lunch breaks",
  },
  {
    industry: "Trade service",
    businessName: "Demo Plumbing Co",
    location: "San Antonio",
    audience: "Homeowners with urgent repairs",
    offer: "Request a same-week quote",
    objection: "Not knowing who will show up",
  },
  {
    industry: "Beauty clinic",
    businessName: "Demo Skin Clinic",
    location: "San Antonio",
    audience: "Customers nervous about first appointments",
    offer: "Book a consultation",
    objection: "Fear of downtime",
  },
  {
    industry: "Local ecommerce",
    businessName: "Demo Candle Shop",
    location: "San Antonio",
    audience: "Gift buyers looking for local products",
    offer: "Shop the new gift box",
    objection: "Not knowing which scent to choose",
  },
] as const;

describe("five-niche script quality evaluation", () => {
  it("generates and scores researched batches across five local SMB categories", () => {
    const allResults = niches.flatMap((niche) => {
      const research: NonNullable<ScriptGenerationResearch> = {
        offer: niche.offer,
        audience: niche.audience,
        tone: "Clear, local, and practical",
        competitors: [],
        likely_objections: [niche.objection],
        recommended_formats: [
          "problem/solution",
          "founder/local story",
          "objection handling",
        ],
        citations: [
          {
            url: "https://example.com",
            title: `${niche.businessName} website`,
            note: "Fixture citation for local quality evaluation.",
          },
        ],
        risky_claims: [],
        notes: `${niche.industry} research fixture.`,
      };
      const input = inputForNiche(niche, research);
      const baseline = generateFixtureScriptVariants({
        ...input,
        research: null,
      }).variants;
      const researched = generateFixtureScriptVariants(input).variants;

      expect(researched).toHaveLength(3);
      expect(
        researched.some((script) => hasResearchSignal(script, research)),
      ).toBe(true);
      expect(
        researched.map((script) => script.voiceover).join(" "),
      ).toContain(niche.objection);
      expect(
        baseline.map((script) => script.voiceover).join(" "),
      ).not.toContain(niche.objection);

      return researched.map((script) =>
        scoreGeneratedScript(script, sharedAssets, research),
      );
    });

    expect(usableRate(allResults)).toBeGreaterThanOrEqual(0.7);
    expect(allResults.every((result) => result.riskyClaimCount === 0)).toBe(true);
  });
});

function inputForNiche(
  niche: (typeof niches)[number],
  research: ScriptGenerationResearch,
): ScriptGenerationInput {
  return {
    client: {
      business_name: niche.businessName,
      website_url: "https://example.com",
      social_links: ["https://instagram.com/example"],
      location: niche.location,
      industry: niche.industry,
      offer: niche.offer,
      target_customer: niche.audience,
      tone: "Warm and direct",
      notes: null,
    },
    brief: {
      campaign_goal: `Generate ${niche.industry} UGC ad concepts`,
      platform: "short_form",
      duration_seconds: 30,
      batch_size: 3,
      raw_notes: null,
      generated_summary: null,
      what_they_do: `${niche.businessName} serves local customers.`,
      why_they_do_it: "Make the next step feel easier.",
      promoting: niche.offer,
      main_pain_points: null,
      offer_cta: niche.offer,
      tone_examples: "Clear, practical, local",
    },
    assets: sharedAssets,
    variantCount: 3,
    research,
  };
}
