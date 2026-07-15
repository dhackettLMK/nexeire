import Image from "next/image";
import { cn } from "@/lib/utils";

/** The Nexeire "N°" brand mark (transparent PNG in /public). Decorative by
 *  default — pass an `alt` when it stands alone. */
export function BrandMark({
  size = 28,
  alt = "",
  className,
}: {
  size?: number;
  alt?: string;
  className?: string;
}) {
  return (
    <Image
      src="/nexeire-mark.png"
      alt={alt}
      width={size}
      height={size}
      priority
      className={cn("select-none", className)}
    />
  );
}
