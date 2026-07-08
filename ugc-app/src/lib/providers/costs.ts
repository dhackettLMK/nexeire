export type ProviderCostType = "estimate" | "actual";

export type ProviderCostRecord = {
  cost_type: ProviderCostType;
  amount_cents: number | null;
};

export type ProviderCostKeyInput = {
  costType: ProviderCostType;
  provider: string;
  jobType: "scripting" | "voiceover" | "render";
  videoOutputId: string;
};

export function normalizeProviderCostCents(amountCents: number) {
  if (!Number.isFinite(amountCents)) {
    throw new Error("Provider cost must be a finite number");
  }

  return Math.max(0, Math.round(amountCents));
}

export function providerCostIdempotencyKey(input: ProviderCostKeyInput) {
  return [
    "provider-cost",
    input.costType,
    input.provider,
    input.jobType,
    input.videoOutputId,
  ].join(":");
}

export function summarizeProviderCosts(records: ProviderCostRecord[]) {
  return records.reduce(
    (totals, record) => {
      const amount = normalizeProviderCostCents(record.amount_cents ?? 0);

      if (record.cost_type === "estimate") {
        return {
          ...totals,
          estimatedCostCents: totals.estimatedCostCents + amount,
        };
      }

      return {
        ...totals,
        actualCostCents: totals.actualCostCents + amount,
      };
    },
    { estimatedCostCents: 0, actualCostCents: 0 },
  );
}
