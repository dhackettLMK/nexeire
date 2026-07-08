import { describe, expect, it } from "vitest";
import {
  buildScriptGenerationPrompt,
  buildScriptGenerationSystemPrompt,
} from "@/lib/scripts/prompt";

const baseInput = {
  client: {
    business_name: "Nexeire Demo Clinic",
    website_url: "https://example.com",
    social_links: ["https://instagram.com/example"],
    location: "Dublin",
    industry: "Aesthetics",
    offer: "Consultation package",
    target_customer: "Busy professionals",
    tone: "Warm and direct",
    notes: "Use founder-led content.",
  },
  brief: {
    campaign_goal: "Book consultations",
    platform: "Instagram Reels",
    duration_seconds: 30,
    batch_size: 3,
    raw_notes: "Avoid medical claims.",
    generated_summary: "Founder-led local clinic ad.",
    what_they_do: "Skin consultations",
    why_they_do_it: "Make customers confident about treatment choices",
    promoting: "Consultation package",
    main_pain_points: "Confusing options and fear of downtime",
    offer_cta: "Book a consultation",
    tone_examples: "Clear, practical, reassuring",
  },
  assets: [
    {
      id: "asset-1",
      filename: "founder-intro.mp4",
      content_type: "video/mp4",
      duration_seconds: 12,
      tags: ["founder", "location"],
      notes: "Founder outside clinic.",
      status: "selected",
    },
  ],
  variantCount: 3,
};

describe("script generation prompt", () => {
  it("includes the adapted video marketing skill in the OpenAI prompt", () => {
    const prompt = JSON.parse(buildScriptGenerationPrompt(baseInput, 3));

    expect(prompt.active_skills).toHaveLength(1);
    expect(prompt.active_skills[0].name).toBe("video-marketing");
    expect(prompt.active_skills[0].version).toBe("1.0.1-adapted");
    expect(prompt.active_skills[0].instructions.hookPatterns).toContain(
      "Question-led: ask the specific question the target customer is already thinking.",
    );
    expect(prompt.available_assets[0].id).toBe("asset-1");
  });

  it("tells the model to follow active scriptwriting skills", () => {
    expect(buildScriptGenerationSystemPrompt()).toContain(
      "Follow the active scriptwriting skills",
    );
  });

  it("specifies human spoken delivery for the voiceover field", () => {
    const prompt = JSON.parse(buildScriptGenerationPrompt(baseInput, 3));

    expect(prompt.voiceover_delivery).toMatchObject({
      goal: expect.stringContaining("human"),
    });
    expect(prompt.output_rules).toContain(
      "Write voiceover as spoken performance copy: conversational, specific, and easy to read aloud.",
    );
    expect(prompt.output_rules).toContain(
      "Use punctuation for natural pauses and emphasis, but do not include bracketed acting notes or SSML tags in voiceover.",
    );
  });
});
