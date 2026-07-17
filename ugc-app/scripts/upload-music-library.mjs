// Uploads the three curated instrumental tracks to the "music-library"
// Supabase Storage bucket. Run once after adding/replacing the source files.
//
// Usage:
//   SUPABASE_SERVICE_ROLE_KEY=... NEXT_PUBLIC_SUPABASE_URL=... \
//     node scripts/upload-music-library.mjs track-1.mp3 track-2.mp3 track-3.mp3
//
// Positional args map in order to the track ids in
// src/lib/videos/music-library.ts (track-1, track-2, track-3).

import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const bucket = "music-library";
const trackIds = ["track-1", "track-2", "track-3"];

async function main() {
  const files = process.argv.slice(2);

  if (files.length === 0 || files.length > trackIds.length) {
    console.error(
      `Provide 1-${trackIds.length} audio files, in order matching ${trackIds.join(", ")}.`,
    );
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
    );
    process.exit(1);
  }

  const supabase = createClient(url, serviceRoleKey);

  for (const [index, filePath] of files.entries()) {
    const trackId = trackIds[index];
    const storagePath = `${trackId}.mp3`;
    const bytes = await readFile(filePath);
    const { error } = await supabase.storage
      .from(bucket)
      .upload(storagePath, bytes, {
        contentType: "audio/mpeg",
        upsert: true,
      });

    if (error) {
      console.error(`Failed to upload ${filePath} -> ${storagePath}:`, error.message);
      process.exit(1);
    }

    console.log(`Uploaded ${path.basename(filePath)} -> ${bucket}/${storagePath}`);
  }
}

main();
