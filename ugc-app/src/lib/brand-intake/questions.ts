export const brandIntakeQuestions = [
  {
    name: "business_name",
    prompt: "What is the business or brand name?",
    helper: "Use the public-facing name customers recognize.",
    input: "text",
    required: true,
  },
  {
    name: "what_they_do",
    prompt: "What does the business do?",
    helper: "Explain the service, product, or offer in plain language.",
    input: "textarea",
    required: true,
  },
  {
    name: "why_they_do_it",
    prompt: "Why does the business do this work?",
    helper: "A founder story, mission, or customer outcome helps scripts feel specific.",
    input: "textarea",
    required: false,
  },
  {
    name: "target_customer",
    prompt: "Who is the ideal customer?",
    helper: "Mention the location, situation, budget, or pain that makes them a fit.",
    input: "textarea",
    required: true,
  },
  {
    name: "main_pain_points",
    prompt: "What problems or objections should the videos speak to?",
    helper: "Include doubts, frustrations, risks, or common reasons people delay buying.",
    input: "textarea",
    required: true,
  },
  {
    name: "offer_cta",
    prompt: "What should viewers do next?",
    helper: "Add the offer, deadline, booking action, or CTA you want repeated.",
    input: "textarea",
    required: true,
  },
  {
    name: "tone",
    prompt: "What tone should the videos use?",
    helper: "Examples: calm and premium, practical and direct, warm founder-led, playful.",
    input: "textarea",
    required: true,
  },
  {
    name: "promoting",
    prompt: "What are you promoting right now?",
    helper: "Name the campaign, package, product, event, or priority service.",
    input: "textarea",
    required: false,
  },
  {
    name: "tone_examples",
    prompt: "Any examples of copy, creators, or brands you like?",
    helper: "Paste reference links or describe the style to borrow from.",
    input: "textarea",
    required: false,
  },
  {
    name: "website_url",
    prompt: "What is the website?",
    helper: "Optional, but useful for later research and proof points.",
    input: "url",
    required: false,
  },
  {
    name: "social_links",
    prompt: "Where can we find the brand on social?",
    helper: "Use one link per line, or separate links with commas.",
    input: "textarea",
    required: false,
  },
  {
    name: "location",
    prompt: "Where does the business operate?",
    helper: "Add city, region, service area, or online-only if relevant.",
    input: "text",
    required: false,
  },
  {
    name: "industry",
    prompt: "What industry or category is this in?",
    helper: "This helps choose hooks and expectations for the audience.",
    input: "text",
    required: false,
  },
  {
    name: "raw_notes",
    prompt: "Anything else the editor or scriptwriter should know?",
    helper: "Add constraints, claims to avoid, proof, seasonal context, or internal notes.",
    input: "textarea",
    required: false,
  },
] as const;

export type BrandIntakeQuestion = (typeof brandIntakeQuestions)[number];
export type BrandIntakeField = BrandIntakeQuestion["name"];

export const requiredBrandIntakeFields = brandIntakeQuestions
  .filter((question) => question.required)
  .map((question) => question.name);
