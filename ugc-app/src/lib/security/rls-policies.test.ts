import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260616000003_complete_mvp_schema.sql"),
  "utf8",
);

describe("MVP RLS policies", () => {
  it("does not let organization members directly mutate billing/provider internals", () => {
    expect(migration).not.toContain(
      'create policy "Organization members can manage provider jobs"',
    );
    expect(migration).not.toContain(
      'create policy "Organization members can manage provider costs"',
    );
    expect(migration).not.toContain(
      'create policy "Organization members can manage credit reservations"',
    );
    expect(migration).not.toContain(
      'create policy "Organization members can manage stripe checkout sessions"',
    );
    expect(migration).not.toContain(
      'create policy "Organization members can create credit ledger entries"',
    );
  });

  it("does not let organization members directly mutate generated video outputs", () => {
    expect(migration).not.toContain(
      'create policy "Organization members can manage video outputs"',
    );
    expect(migration).toContain(
      'create policy "Organization members can read video outputs"',
    );
    expect(migration).toContain('create policy "Admins can manage video outputs"');
  });

  it("does not let organization members directly mutate campaigns or generated scripts", () => {
    expect(migration).not.toContain(
      'create policy "Organization members can manage campaigns"',
    );
    expect(migration).not.toContain(
      'create policy "Organization members can manage campaign scripts"',
    );
    expect(migration).toContain(
      'create policy "Organization members can read campaigns"',
    );
    expect(migration).toContain(
      'create policy "Organization members can read campaign scripts"',
    );
    expect(migration).toContain('create policy "Admins can manage campaigns"');
    expect(migration).toContain(
      'create policy "Admins can manage campaign scripts"',
    );
  });

  it("does not let organization members directly mutate research reports", () => {
    expect(migration).not.toContain(
      'create policy "Organization members can manage research reports"',
    );
    expect(migration).toContain(
      'create policy "Organization members can read research reports"',
    );
    expect(migration).toContain(
      'create policy "Admins can manage research reports"',
    );
  });

  it("keeps beta feedback append-only for organization members", () => {
    expect(migration).not.toContain(
      'create policy "Organization members can manage beta feedback"',
    );
    expect(migration).toContain(
      'create policy "Organization members can read beta feedback"',
    );
    expect(migration).toContain(
      'create policy "Organization members can submit beta feedback"',
    );
    expect(migration).toContain('create policy "Admins can manage beta feedback"');
  });

  it("keeps generated media storage server/admin-written", () => {
    expect(migration).toContain(
      'create policy "Organization members can read scoped storage objects"',
    );
    expect(migration).toContain(
      'create policy "Organization members can upload client asset storage objects"',
    );
    expect(migration).toContain(
      'create policy "Organization members can update client asset storage objects"',
    );
    expect(migration).toContain(
      'create policy "Organization members can delete client asset storage objects"',
    );
    expect(migration).toContain(
      'create policy "Admins can manage generated media storage objects"',
    );
    expect(migration).not.toContain(
      'create policy "Organization members can upload scoped storage objects"',
    );
    expect(migration).not.toContain(
      'create policy "Organization members can update scoped storage objects"',
    );
    expect(migration).not.toContain(
      'create policy "Organization members can delete scoped storage objects"',
    );
    expect(migration).not.toMatch(
      /on storage\.objects\s+for insert\s+to authenticated\s+with check \(\s+bucket_id in \('client-assets', 'generated-videos'\)/,
    );
    expect(migration).not.toMatch(
      /on storage\.objects\s+for update\s+to authenticated[\s\S]{0,240}bucket_id in \('client-assets', 'generated-videos'\)/,
    );
    expect(migration).not.toMatch(
      /on storage\.objects\s+for delete\s+to authenticated[\s\S]{0,240}bucket_id in \('client-assets', 'generated-videos'\)/,
    );
  });

  it("keeps organization-scoped read access but admin-only mutations", () => {
    expect(migration).toContain(
      'create policy "Organization members can read provider jobs"',
    );
    expect(migration).toContain(
      'create policy "Organization members can read provider costs"',
    );
    expect(migration).toContain(
      'create policy "Organization members can read credit ledger"',
    );
    expect(migration).toContain(
      'create policy "Organization members can read credit reservations"',
    );
    expect(migration).toContain(
      'create policy "Organization members can read stripe checkout sessions"',
    );

    expect(migration).toContain('create policy "Admins can manage provider jobs"');
    expect(migration).toContain('create policy "Admins can manage provider costs"');
    expect(migration).toContain('create policy "Admins can manage credit ledger"');
    expect(migration).toContain(
      'create policy "Admins can manage credit reservations"',
    );
    expect(migration).toContain(
      'create policy "Admins can manage stripe checkout sessions"',
    );
  });
});
