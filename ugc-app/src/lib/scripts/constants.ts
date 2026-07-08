export const ugcScriptFormats = [
  "problem/solution",
  "founder/local story",
  "objection handling",
  "before/after",
  "direct offer",
] as const;

export const scriptStatuses = [
  "draft",
  "approved",
  "rejected",
  "archived",
] as const;

export type ScriptStatus = (typeof scriptStatuses)[number];

export function formatScriptStatus(status: string) {
  switch (status) {
    case "draft":
      return "Needs edit";
    case "approved":
      return "Usable / ready";
    case "rejected":
      return "Unusable";
    case "archived":
      return "Archived";
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

export function scriptStatusDescription(status: string) {
  switch (status) {
    case "draft":
      return "Review and edit before production.";
    case "approved":
      return "Ready for the editor production pack.";
    case "rejected":
      return "Do not use this version.";
    case "archived":
      return "Hidden from the normal workflow.";
    default:
      return "Review state unknown.";
  }
}
