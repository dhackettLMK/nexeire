export const ugcPlaybookLibrary = {
  version: "2026-06-mvp",
  hooks: [
    "Lead with the specific customer frustration in plain language.",
    "Open with a founder or staff line that sounds native to phone-shot UGC.",
    "Use a local proof hook only when the location or community detail is confirmed.",
  ],
  painPointFormats: [
    "Problem-agitate-solution with one concrete visual proof point.",
    "Before/after contrast without inventing measurable outcomes.",
    "Objection-first, then show the process that reduces the perceived risk.",
  ],
  founderStory: [
    "Show why the business exists, then connect that motivation to the offer.",
    "Use founder clips for trust-building and keep claims grounded in the brief.",
  ],
  offerPush: [
    "State the offer and CTA clearly in the final third.",
    "Avoid urgency, pricing, or guarantees unless explicitly confirmed.",
  ],
  localProof: [
    "Use premises, customer, and neighborhood footage as proof of local presence.",
    "Reference location only when it is confirmed by the brand profile or research.",
  ],
  objectionHandling: [
    "Name the likely objection and answer it with process, testimonial, or premises b-roll.",
    "Flag risky or unsupported claims before rendering.",
  ],
  beforeAfter: [
    "Use before/after only when the asset tags or brief support that contrast.",
    "Do not imply regulated, medical, financial, or guaranteed outcomes.",
  ],
} as const;

export type UgcPlaybookLibrary = typeof ugcPlaybookLibrary;
