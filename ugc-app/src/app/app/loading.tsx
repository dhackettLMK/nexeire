import { Skeleton, PageHeaderSkeleton } from "@/components/ui/skeleton";

/** Route-level loading boundary for every /app tab: the shell and sidebar stay
 *  put while page content swaps, so navigation feels instant even mid-fetch. */
export default function AppLoading() {
  return (
    <div className="grid gap-8">
      <PageHeaderSkeleton />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}
