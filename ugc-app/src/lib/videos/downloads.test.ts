import { describe, expect, it } from "vitest";
import {
  videoDownloadFilename,
  videoDownloadUrl,
} from "@/lib/videos/downloads";

describe("video downloads", () => {
  it("appends a download filename to signed URLs", () => {
    expect(
      videoDownloadUrl("https://storage.example/video.mp4?token=abc", "Offer Push"),
    ).toBe("https://storage.example/video.mp4?token=abc&download=Offer%20Push.mp4");
    expect(videoDownloadUrl("https://storage.example/video.mp4", "Founder Story")).toBe(
      "https://storage.example/video.mp4?download=Founder%20Story.mp4",
    );
  });

  it("keeps generated download filenames filesystem-safe", () => {
    expect(videoDownloadFilename(' Before/After: "Summer" ')).toBe(
      "Before-After- -Summer-.mp4",
    );
    expect(videoDownloadFilename("   ")).toBe("ugc-video.mp4");
  });
});
