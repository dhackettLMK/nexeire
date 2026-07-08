import { z } from "zod";
import { assetTags } from "@/lib/assets/constants";

export const scriptScenePlanSchema = z.object({
  scene_number: z.number().int().min(1),
  time_range: z.string().min(1),
  visual_direction: z.string().min(1),
  asset_tags: z.array(z.enum(assetTags)),
  preferred_asset_ids: z.array(z.string()),
  on_screen_text: z.string(),
  edit_notes: z.string(),
});

export const generatedScriptVariantSchema = z.object({
  title: z.string().min(1),
  format: z.string().min(1),
  hook: z.string().min(1),
  voiceover: z.string().min(1),
  scene_plan: z.array(scriptScenePlanSchema).min(1),
  suggested_broll: z.array(z.string().min(1)).min(1),
  cta: z.string().min(1),
  caption: z.string().min(1),
  hashtags: z.array(z.string().min(1)).min(1).max(20),
  editor_notes: z.string().min(1),
});

export type ScriptScenePlan = z.infer<typeof scriptScenePlanSchema>;
export type GeneratedScriptVariant = z.infer<typeof generatedScriptVariantSchema>;
