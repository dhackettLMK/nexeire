export const videoMarketingSkill = {
  name: "video-marketing",
  version: "1.0.1-adapted",
  license: "MIT",
  source:
    "https://github.com/kostja94/marketing-skills/tree/70987bad4ebe9dce1f74858c1c64f3f8810f18e4/skills/content/video",
  purpose:
    "Plan and write short-form video scripts with strong hooks, clear structure, and platform-aware direction.",
  instructions: {
    assessment: [
      "Classify the request by format, goal, and platform before choosing angles.",
      "Default to short-form UGC ad structure for TikTok, Reels, Shorts, and paid social briefs.",
      "Use the client brief and available b-roll as constraints; do not invent missing claims or proof.",
    ],
    shortFormStructure: [
      "Open with a hook in the first 0-3 seconds.",
      "Move quickly from problem or desire into the solution or offer.",
      "Reserve the final beat for a clear CTA tied to the confirmed offer.",
      "Use Hook-Value-CTA, PAS, AIDA, or Before-After-Bridge when it fits the brief.",
    ],
    hookPatterns: [
      "Story-driven: a concrete before/after or founder/customer moment.",
      "Contrarian: challenge a common assumption without being clickbait.",
      "Question-led: ask the specific question the target customer is already thinking.",
      "Result-focused: lead with a confirmed outcome, benefit, or transformation.",
    ],
    platformNotes: [
      "TikTok: fast, direct, native, and caption-friendly.",
      "Instagram Reels: polished enough for brand trust but still creator-led.",
      "YouTube Shorts: make the hook and title searchable when the brief implies search intent.",
    ],
    outputRules: [
      "Every script must have a distinct angle, not just different wording.",
      "Write voiceover that can be read naturally by a creator.",
      "Scene plans must be buildable from the supplied asset tags and asset IDs.",
      "Call out missing information or risky claims in editor_notes instead of filling gaps.",
    ],
  },
} as const;

export type ScriptSkill = typeof videoMarketingSkill;
