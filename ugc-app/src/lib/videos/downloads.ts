export function videoDownloadFilename(title: string) {
  const safeTitle = title
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 80);

  return `${safeTitle || "ugc-video"}.mp4`;
}

export function videoDownloadUrl(signedUrl: string, title: string) {
  const separator = signedUrl.includes("?") ? "&" : "?";

  return `${signedUrl}${separator}download=${encodeURIComponent(
    videoDownloadFilename(title),
  )}`;
}
