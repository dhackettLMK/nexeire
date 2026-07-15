import { BrandMark } from "@/components/ui/brand-mark";

/** Route-level loading boundary for every /app tab: the brand mark inside a
 *  spinning gradient ring with a breathing glow, centered where page content
 *  will land. The shell and sidebar stay put while content swaps. */
export default function AppLoading() {
  return (
    <div className="app-loader" role="status">
      <div className="app-loader-badge">
        <BrandMark size={52} alt="" className="app-loader-mark" />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
