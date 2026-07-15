import "server-only";

import type { requireOrganization } from "@/lib/customer/organization";
import { customerAssetBucket, signedUrlTtlSeconds } from "@/lib/assets/validation";

type SupabaseClientLike = Awaited<
  ReturnType<typeof requireOrganization>
>["supabase"];

/** Signs the workspace's uploaded logo path, if one is set. */
export async function signedOrganizationLogoUrl(
  supabase: SupabaseClientLike,
  logoPath: string | null,
) {
  if (!logoPath) {
    return null;
  }

  const { data } = await supabase.storage
    .from(customerAssetBucket)
    .createSignedUrl(logoPath, signedUrlTtlSeconds);

  return data?.signedUrl ?? null;
}
