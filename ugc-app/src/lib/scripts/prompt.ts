import { assetTags } from "@/lib/assets/constants";
import { ugcScriptFormats } from "@/lib/scripts/constants";
import { ugcPlaybookLibrary } from "@/lib/scripts/playbooks";
import { videoMarketingSkill } from "@/lib/scripts/skills/video-marketing";
import type {
  ScriptGenerationAsset,
  ScriptGenerationInput,
} from "@/lib/scripts/types";

export function buildScriptGenerationSystemPrompt() {
  return [
    "You are an expert UGC ad strategist and short-form scriptwriter.",
    "Create practical scripts an editor can build from real client-owned b-roll.",
    "Follow the active scriptwriting skills in the prompt as reusable production guidance.",
    "Do not invent facts, testimonials, offers, guarantees, locations, prices, or claims.",
    "If a fact is missing, write the script around confirmed information and add the concern in editor_notes.",
    "Scene plans must map to available asset tags and preferred asset IDs where possible.",
  ].join(" ");
}

function formatAsset(asset: ScriptGenerationAsset) {
  return {
    id: asset.id,
    filename: asset.filename,
    type: asset.content_type ?? "unknown",
    duration_seconds: asset.duration_seconds ?? null,
    tags: asset.tags ?? [],
    notes: asset.notes ?? "",
    status: asset.status,
  };
}

export function buildScriptGenerationPrompt(
  input: ScriptGenerationInput,
  variantCount: number,
) {
  return JSON.stringify(
    {
      task: `Generate exactly ${variantCount} UGC ad script variants.`,
      internal_ugc_playbook_library: ugcPlaybookLibrary,
      active_skills: [videoMarketingSkill],
      required_formats: ugcScriptFormats,
      asset_tag_vocabulary: assetTags,
      scene_plan_contract: {
        scene_number: "1-based scene order",
        time_range: "Approximate timestamp range, e.g. 0-3s",
        visual_direction: "What the editor should show",
        asset_tags: "Relevant tags from the provided vocabulary",
        preferred_asset_ids:
          "IDs from available_assets that best match the scene, or []",
        on_screen_text: "Short overlay text, or an empty string",
        edit_notes: "Specific production note for the scene",
      },
      output_rules: [
        "Use 15-30 second voiceovers unless the brief duration says otherwise.",
        "Every variant must have a distinct angle and hook.",
        "Use captions that are ready to post, not generic summaries.",
        "Use hashtags relevant to the client, offer, location, and platform.",
        "Every variant must include a CTA and suggested_broll list.",
        "Keep editor notes concise and production-focused.",
        "Write voiceover as spoken performance copy: conversational, specific, and easy to read aloud.",
        "Use punctuation for natural pauses and emphasis, but do not include bracketed acting notes or SSML tags in voiceover.",
      ],
      voiceover_delivery: {
        goal: "human UGC delivery that sounds like a real customer/founder talking to camera, not polished corporate narration",
        rhythm:
          "Use short sentences, contractions, one clear thought per breath, and occasional em dashes for natural turns.",
        energy:
          "Warm, direct, slightly energetic; avoid robotic list-reading, hype, and generic ad-speak.",
        field_contract:
          "The voiceover field must contain only speakable words and punctuation. No bracketed acting notes, SSML, labels, markdown, or stage directions.",
      },
      client: input.client,
      brief: input.brief,
      research: input.research ?? null,
      available_assets: input.assets.map(formatAsset),
    },
    null,
    2,
  );
}
