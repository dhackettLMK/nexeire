import { openai } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import { z } from "zod";
import { assetTags, type AssetTag } from "@/lib/assets/constants";
import {
  buildScriptGenerationPrompt,
  buildScriptGenerationSystemPrompt,
} from "@/lib/scripts/prompt";
import { generatedScriptVariantSchema } from "@/lib/scripts/schema";
import type {
  ScriptGenerationInput,
  ScriptGenerationResult,
} from "@/lib/scripts/types";

const defaultOpenAiModel = "gpt-5.4-mini";
const fixtureModel = "fixture-script-generator-v1";
const fixtureAssetTagSet = new Set<string>(assetTags);

function normalizeVariantCount(value: number) {
  if (!Number.isFinite(value)) {
    return 3;
  }

  return Math.min(Math.max(Math.trunc(value), 1), 10);
}

export async function generateScriptVariants(
  input: ScriptGenerationInput,
): Promise<ScriptGenerationResult> {
  if (process.env.SCRIPT_GENERATION_PROVIDER === "fixture") {
    return generateFixtureScriptVariants(input);
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY. Add it before generating scripts.");
  }

  const variantCount = normalizeVariantCount(input.variantCount);
  const model = process.env.OPENAI_MODEL || defaultOpenAiModel;
  const outputSchema = z.object({
    variants: z.array(generatedScriptVariantSchema).length(variantCount),
  });

  const { output } = await generateText({
    model: openai.responses(model),
    system: buildScriptGenerationSystemPrompt(),
    prompt: buildScriptGenerationPrompt(input, variantCount),
    output: Output.object({
      schema: outputSchema,
      name: "ugc_script_variants",
      description: "UGC script variants with captions, hashtags, and scene plans.",
    }),
    providerOptions: {
      openai: {
        reasoningEffort: "low",
        store: false,
        textVerbosity: "medium",
      },
    },
  });

  return {
    variants: output.variants,
    model,
  };
}

export function generateFixtureScriptVariants(
  input: ScriptGenerationInput,
): ScriptGenerationResult {
  const variantCount = normalizeVariantCount(input.variantCount);
  const businessName = input.client.business_name;
  const offer =
    input.brief.offer_cta ??
    input.client.offer ??
    input.brief.promoting ??
    "book a consultation";
  const location = input.client.location ?? "your area";
  const formats = [
    "problem/solution",
    "founder/local story",
    "objection handling",
    "before/after",
    "direct offer",
  ];
  const usableAssets = input.assets.filter((asset) => asset.status !== "archived");
  const fallbackAssetTags = usableAssets
    .flatMap((asset) => asset.tags ?? [])
    .filter((tag): tag is AssetTag => fixtureAssetTagSet.has(tag));
  const preferredAssetIds = usableAssets.slice(0, 3).map((asset) => asset.id);

  return {
    model: fixtureModel,
    variants: Array.from({ length: variantCount }, (_, index) => {
      const format = formats[index % formats.length];
      const title = `${businessName} ${format} concept ${index + 1}`;
      const hook =
        index % 2 === 0
          ? `Still trying to solve this the hard way in ${location}?`
          : `Here is why ${businessName} built this offer for local customers.`;
      const cta = offer;
      const suggestedBroll: AssetTag[] =
        fallbackAssetTags.length > 0
          ? Array.from(new Set(fallbackAssetTags)).slice(0, 4)
          : ["founder", "product", "process", "testimonial"];

      return {
        title,
        format,
        hook,
        voiceover: `${hook} ${businessName} helps ${
          input.client.target_customer ?? "busy local customers"
        } get a clearer next step without guesswork. ${
          input.brief.main_pain_points ??
          input.research?.likely_objections?.[0] ??
          "The process is simple and practical."
        } When you are ready, ${cta}.`,
        scene_plan: [
          {
            scene_number: 1,
            time_range: "0-3s",
            visual_direction: "Open on the strongest founder, premises, or product clip.",
            asset_tags: suggestedBroll.slice(0, 2),
            preferred_asset_ids: preferredAssetIds,
            on_screen_text: hook,
            edit_notes: "Keep the first cut fast and native to phone-shot UGC.",
          },
          {
            scene_number: 2,
            time_range: "3-12s",
            visual_direction:
              "Show the process and proof points that support the voiceover.",
            asset_tags: suggestedBroll.slice(1, 4),
            preferred_asset_ids: preferredAssetIds,
            on_screen_text: input.brief.promoting ?? input.client.offer ?? "",
            edit_notes: "Avoid unsupported claims; use only confirmed visuals.",
          },
          {
            scene_number: 3,
            time_range: "12-25s",
            visual_direction: "End with CTA text over product, premises, or founder b-roll.",
            asset_tags: ["CTA"],
            preferred_asset_ids: preferredAssetIds,
            on_screen_text: cta,
            edit_notes: "Match CTA wording exactly to the approved offer.",
          },
        ],
        suggested_broll: suggestedBroll,
        cta,
        caption: `${businessName} makes the next step clear. ${cta}`,
        hashtags: [
          "#ugc",
          "#localbusiness",
          `#${location.replace(/[^a-z0-9]/gi, "").toLowerCase() || "local"}`,
        ],
        editor_notes:
          "Fixture output for local/test workflows. Review for risky claims before rendering.",
      };
    }),
  };
}
