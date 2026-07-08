import { assetTags } from "@/lib/assets/constants";
import type { GeneratedScriptVariant } from "@/lib/scripts/schema";
import type {
  ScriptGenerationAsset,
  ScriptGenerationResearch,
} from "@/lib/scripts/types";

export type ScriptQualityScore = "usable" | "needs-edit" | "unusable";

export type ScriptQualityResult = {
  score: ScriptQualityScore;
  reasons: string[];
  mappedSceneCount: number;
  riskyClaimCount: number;
};

const assetTagSet = new Set<string>(assetTags);
const highRiskPatterns = [
  /\bguarantee(?:d|s)?\b/i,
  /\bcure(?:s|d)?\b/i,
  /\bclinically proven\b/i,
  /\b100%\b/i,
  /\bno risk\b/i,
  /\binstant(?:ly)?\b/i,
];

export function scoreGeneratedScript(
  script: GeneratedScriptVariant,
  assets: ScriptGenerationAsset[],
  research: ScriptGenerationResearch = null,
): ScriptQualityResult {
  const reasons: string[] = [];
  const usableAssets = assets.filter((asset) => asset.status !== "archived");
  const availableAssetIds = new Set(usableAssets.map((asset) => asset.id));
  const availableTags = new Set(
    usableAssets.flatMap((asset) => asset.tags ?? []).filter((tag) => assetTagSet.has(tag)),
  );
  const missingRequiredFields = [
    ["hook", script.hook],
    ["voiceover", script.voiceover],
    ["cta", script.cta],
    ["caption", script.caption],
  ].filter(([, value]) => typeof value !== "string" || value.trim().length === 0);

  if (missingRequiredFields.length > 0) {
    reasons.push(
      `Missing required fields: ${missingRequiredFields
        .map(([field]) => field)
        .join(", ")}`,
    );
  }

  if (script.scene_plan.length === 0) {
    reasons.push("Scene plan is empty");
  }

  if (script.suggested_broll.length === 0) {
    reasons.push("Suggested b-roll is empty");
  }

  const unsupportedSceneTags = script.scene_plan.flatMap((scene) =>
    scene.asset_tags.filter((tag) => !assetTagSet.has(tag)),
  );

  if (unsupportedSceneTags.length > 0) {
    reasons.push(`Unsupported scene tags: ${unsupportedSceneTags.join(", ")}`);
  }

  const mappableScenes = script.scene_plan.filter(
    (scene) =>
      scene.asset_tags.length === 0 ||
      scene.asset_tags.some((tag) => tag !== "CTA"),
  );
  const mappedSceneCount = mappableScenes.filter((scene) => {
    const mapsById = scene.preferred_asset_ids.some((id) => availableAssetIds.has(id));
    const mapsByTag = scene.asset_tags.some((tag) => availableTags.has(tag));

    return mapsById || mapsByTag;
  }).length;

  if (usableAssets.length > 0 && mappableScenes.length > 0 && mappedSceneCount === 0) {
    reasons.push("No scenes map to available b-roll");
  }

  if (
    usableAssets.length > 0 &&
    mappableScenes.length > 0 &&
    mappedSceneCount < Math.ceil(mappableScenes.length / 2)
  ) {
    reasons.push("Less than half of scenes map to available b-roll");
  }

  const riskyClaims = findScriptRiskyClaims(script, research);

  if (riskyClaims.length > 0) {
    reasons.push(`Risky claims need review: ${riskyClaims.join("; ")}`);
  }

  if (missingRequiredFields.length > 0 || script.scene_plan.length === 0) {
    return {
      score: "unusable",
      reasons,
      mappedSceneCount,
      riskyClaimCount: riskyClaims.length,
    };
  }

  if (
    reasons.length > 0 ||
    riskyClaims.length > 0 ||
    mappedSceneCount < mappableScenes.length
  ) {
    return {
      score: "needs-edit",
      reasons,
      mappedSceneCount,
      riskyClaimCount: riskyClaims.length,
    };
  }

  return {
    score: "usable",
    reasons,
    mappedSceneCount,
    riskyClaimCount: riskyClaims.length,
  };
}

export function usableRate(results: ScriptQualityResult[]) {
  if (results.length === 0) {
    return 0;
  }

  const usableCount = results.filter((result) => result.score === "usable").length;

  return usableCount / results.length;
}

export function hasResearchSignal(
  script: GeneratedScriptVariant,
  research: NonNullable<ScriptGenerationResearch>,
) {
  const text = [
    script.hook,
    script.voiceover,
    script.caption,
    script.editor_notes,
  ]
    .join(" ")
    .toLowerCase();
  const signals = [
    ...(research.likely_objections ?? []),
    ...(research.recommended_formats ?? []),
    research.offer,
    research.audience,
    research.tone,
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase());

  return signals.some((signal) =>
    signal
      .split(/[\s,;/.-]+/)
      .filter((part) => part.length > 4)
      .some((part) => text.includes(part)),
  );
}

function findScriptRiskyClaims(
  script: GeneratedScriptVariant,
  research: ScriptGenerationResearch,
) {
  const scriptText = [
    script.hook,
    script.voiceover,
    script.cta,
    script.caption,
    script.editor_notes,
  ].join(" ");
  const patternMatches = highRiskPatterns
    .filter((pattern) => pattern.test(scriptText))
    .map((pattern) => pattern.source);
  const researchRiskMatches = (research?.risky_claims ?? []).filter((claim) =>
    claimIncludesMeaningfulTerms(scriptText, claim),
  );

  return [...patternMatches, ...researchRiskMatches];
}

function claimIncludesMeaningfulTerms(scriptText: string, claim: string) {
  const normalized = scriptText.toLowerCase();
  const terms = claim
    .toLowerCase()
    .split(/[\s,;/.-]+/)
    .filter((term) => term.length > 4);

  return terms.length > 0 && terms.some((term) => normalized.includes(term));
}
