import "server-only";

import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type Organization = {
  id: string;
  name: string;
  slug: string;
  status: string;
  owner_user_id: string;
};

export type OrganizationMembership = {
  organization_id: string;
  role: string;
  email: string | null;
};

function loginUrl(nextPath: string) {
  return `/login?next=${encodeURIComponent(nextPath)}`;
}

export async function requireUser(nextPath = "/app") {
  if (!isSupabaseConfigured()) {
    redirect(`/login?setup=required&next=${encodeURIComponent(nextPath)}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(loginUrl(nextPath));
  }

  return { supabase, user };
}

export async function getCurrentOrganizationForUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: User,
) {
  const { data: memberships, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id,role,email")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  if (!memberships || memberships.length === 0) {
    return {
      membership: null,
      organization: null,
    };
  }

  const organizationIds = memberships.map((membership) => membership.organization_id);
  const [assetResult, campaignResult] = await Promise.all([
    supabase
      .from("organization_assets")
      .select("organization_id")
      .in("organization_id", organizationIds)
      .neq("status", "archived"),
    supabase
      .from("campaigns")
      .select("organization_id")
      .in("organization_id", organizationIds),
  ]);

  if (assetResult.error) {
    throw new Error(assetResult.error.message);
  }

  if (campaignResult.error) {
    throw new Error(campaignResult.error.message);
  }

  const organizationsWithData = new Set([
    ...(assetResult.data ?? []).map((asset) => asset.organization_id),
    ...(campaignResult.data ?? []).map((campaign) => campaign.organization_id),
  ]);
  const membership =
    memberships.find((row) => organizationsWithData.has(row.organization_id)) ??
    memberships[0];
  const typedMembership = membership as OrganizationMembership;
  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("id,name,slug,status,owner_user_id")
    .eq("id", typedMembership.organization_id)
    .single();

  if (organizationError || !organization) {
    throw new Error(organizationError?.message ?? "Organization not found");
  }

  return {
    membership: typedMembership,
    organization: organization as Organization,
  };
}

export async function requireOrganization(nextPath = "/app") {
  const { supabase, user } = await requireUser(nextPath);
  const { membership, organization } = await getCurrentOrganizationForUser(
    supabase,
    user,
  );

  if (!organization || !membership) {
    redirect("/app/setup");
  }

  return {
    supabase,
    user,
    organization,
    membership,
  };
}
