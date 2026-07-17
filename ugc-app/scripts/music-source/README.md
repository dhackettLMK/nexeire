# Music library source files

Raw instrumental files staged here for upload to the `music-library` Supabase
Storage bucket. Filenames map to track ids in `src/lib/videos/music-library.ts`.

Run once you have `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set:

    node scripts/upload-music-library.mjs scripts/music-source/track-1.mp3 [track-2.mp3] [track-3.mp3]
