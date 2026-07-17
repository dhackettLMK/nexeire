import "server-only";

import { getServiceRoleClient } from "@/lib/supabase/service-role";

export const musicLibraryBucket = "music-library";

export type MusicLibraryTrack = {
  id: string;
  name: string;
  description: string;
  storagePath: string;
};

// Curated instrumental tracks shipped with the app. Files live in the
// public "music-library" Storage bucket at these paths.
export const musicLibraryTracks: MusicLibraryTrack[] = [
  {
    id: "track-1",
    name: "Young Kanye West Inspired Instrumental",
    description: "Soulful, sample-driven boom-bap instrumental",
    storagePath: "track-1.mp3",
  },
  {
    id: "track-2",
    name: "Chill",
    description: "Laid-back, easygoing instrumental",
    storagePath: "track-2.mp3",
  },
  {
    id: "track-3",
    name: "Momentum",
    description: "Driving, energetic instrumental",
    storagePath: "track-3.mp3",
  },
];

const musicLibraryTracksById = new Map(
  musicLibraryTracks.map((track) => [track.id, track]),
);

export function findMusicLibraryTrack(trackId: string | null | undefined) {
  if (!trackId) {
    return null;
  }

  return musicLibraryTracksById.get(trackId) ?? null;
}

export function musicLibraryPublicUrl(trackId: string | null | undefined) {
  const track = findMusicLibraryTrack(trackId);

  if (!track) {
    return null;
  }

  const { data } = getServiceRoleClient()
    .storage.from(musicLibraryBucket)
    .getPublicUrl(track.storagePath);

  return data.publicUrl;
}
