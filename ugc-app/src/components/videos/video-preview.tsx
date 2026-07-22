"use client";

import { Play, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * "Watch before you download" preview: a Play button that opens the finished
 * vertical MP4 in an accessible modal player. Uses the raw signed URL (not the
 * download-forced one) so the browser streams it inline instead of saving it.
 */
export function VideoPreview({ src, title }: { src: string; title: string }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger
        className={cn(buttonClasses({ variant: "secondary", size: "sm" }), "w-fit")}
      >
        <Play className="size-4" aria-hidden="true" />
        Preview
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-[#05050f]/80 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=open]:fade-in",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out",
          )}
        />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 grid max-h-[calc(100dvh_-_32px)] w-[min(440px,calc(100vw_-_32px))] -translate-x-1/2 -translate-y-1/2 gap-3",
            "data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95",
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <Dialog.Title className="min-w-0 truncate text-sm font-semibold text-white">
              {title}
            </Dialog.Title>
            <Dialog.Close className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <X className="size-4" aria-hidden="true" />
              <span className="sr-only">Close preview</span>
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            Preview of your generated video before downloading.
          </Dialog.Description>
          <video
            src={src}
            controls
            autoPlay
            playsInline
            className="max-h-[calc(100dvh_-_112px)] w-full rounded-2xl bg-black shadow-2xl ring-1 ring-white/10"
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
