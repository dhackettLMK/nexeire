import { describe, expect, it } from "vitest";
import {
  brandProfileStatus,
  getBrandProfileCompletion,
  splitSocialLinks,
} from "@/lib/brand-intake/profile";

const completeProfile = {
  business_name: "Nexeire Demo Clinic",
  what_they_do: "Skin consultations and treatment plans",
  target_customer: "Busy professionals in Dublin",
  main_pain_points: "Confusing options and fear of downtime",
  offer_cta: "Book a consultation",
  tone: "Warm, practical, and direct",
};

describe("brand profile intake helpers", () => {
  it("marks a profile complete when all required intake fields are filled", () => {
    const completion = getBrandProfileCompletion(completeProfile);

    expect(completion.isComplete).toBe(true);
    expect(completion.percent).toBe(100);
    expect(brandProfileStatus(completeProfile)).toBe("complete");
  });

  it("tracks missing required fields for draft profiles", () => {
    const completion = getBrandProfileCompletion({
      ...completeProfile,
      offer_cta: " ",
      tone: null,
    });

    expect(completion.isComplete).toBe(false);
    expect(completion.missingRequired).toEqual(["offer_cta", "tone"]);
    expect(brandProfileStatus({ business_name: "Nexeire" })).toBe("draft");
  });

  it("normalizes social links from textarea values", () => {
    expect(
      splitSocialLinks("https://instagram.example/nexeire, https://tiktok.example/nexeire\n"),
    ).toEqual([
      "https://instagram.example/nexeire",
      "https://tiktok.example/nexeire",
    ]);
  });
});
