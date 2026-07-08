import type { GeneratedScriptVariant } from "@/lib/scripts/schema";

export type ScriptGenerationClient = {
  business_name: string;
  website_url: string | null;
  social_links: string[] | null;
  location: string | null;
  industry: string | null;
  offer: string | null;
  target_customer: string | null;
  tone: string | null;
  notes: string | null;
};

export type ScriptGenerationBrief = {
  campaign_goal: string | null;
  platform: string | null;
  duration_seconds: number | null;
  batch_size: number | null;
  raw_notes: string | null;
  generated_summary: string | null;
  what_they_do: string | null;
  why_they_do_it: string | null;
  promoting: string | null;
  main_pain_points: string | null;
  offer_cta: string | null;
  tone_examples: string | null;
};

export type ScriptGenerationAsset = {
  id: string;
  filename: string;
  content_type: string | null;
  duration_seconds: number | string | null;
  tags: string[] | null;
  notes: string | null;
  status: string;
};

export type ScriptGenerationResearch = {
  offer: string | null;
  audience: string | null;
  tone: string | null;
  competitors: string[] | null;
  likely_objections: string[] | null;
  recommended_formats: string[] | null;
  citations: { url: string; title?: string | null; note?: string | null }[] | null;
  risky_claims: string[] | null;
  notes: string | null;
} | null;

export type ScriptGenerationInput = {
  client: ScriptGenerationClient;
  brief: ScriptGenerationBrief;
  assets: ScriptGenerationAsset[];
  variantCount: number;
  research?: ScriptGenerationResearch;
};

export type ScriptGenerationResult = {
  variants: GeneratedScriptVariant[];
  model: string;
};
