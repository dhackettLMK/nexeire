import {
  brandIntakeQuestions,
  requiredBrandIntakeFields,
  type BrandIntakeField,
} from "@/lib/brand-intake/questions";

type BrandProfileTextField = Exclude<BrandIntakeField, "social_links">;

export type BrandProfile = Partial<Record<BrandProfileTextField, string | null>> & {
  id?: string;
  organization_id?: string;
  status?: string;
  social_links?: string[] | string | null;
};

export type BrandProfileCompletion = {
  completedRequired: number;
  totalRequired: number;
  missingRequired: BrandIntakeField[];
  percent: number;
  isComplete: boolean;
};

export function splitSocialLinks(value: string | string[] | null | undefined) {
  if (Array.isArray(value)) {
    return value
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (!value) {
    return [];
  }

  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function brandProfileValue(
  profile: BrandProfile | null | undefined,
  field: BrandIntakeField,
) {
  const value = profile?.[field];

  if (Array.isArray(value)) {
    return value.join("\n");
  }

  return typeof value === "string" ? value : "";
}

export function isFilled(value: unknown) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return typeof value === "string" && value.trim().length > 0;
}

export function getBrandProfileCompletion(
  profile: BrandProfile | null | undefined,
): BrandProfileCompletion {
  const missingRequired = requiredBrandIntakeFields.filter(
    (field) => !isFilled(profile?.[field]),
  );
  const totalRequired = requiredBrandIntakeFields.length;
  const completedRequired = totalRequired - missingRequired.length;

  return {
    completedRequired,
    totalRequired,
    missingRequired,
    percent: Math.round((completedRequired / totalRequired) * 100),
    isComplete: missingRequired.length === 0,
  };
}

export function brandProfileStatus(profile: BrandProfile | null | undefined) {
  return getBrandProfileCompletion(profile).isComplete ? "complete" : "draft";
}

export function brandProfileSummaryItems(
  profile: BrandProfile | null | undefined,
) {
  return brandIntakeQuestions
    .filter((question) => question.name !== "raw_notes")
    .map((question) => ({
      label: question.prompt,
      value: brandProfileValue(profile, question.name),
      required: question.required,
    }));
}
