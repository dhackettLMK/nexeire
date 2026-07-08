import type { CaptionCue } from "@/lib/videos/render-plan";

export type VoiceoverRequest = {
  scriptId: string;
  text: string;
  withTimestamps?: boolean;
};

export type VoiceoverResult = {
  provider: "elevenlabs";
  providerJobId: string;
  audioBytes: Uint8Array;
  contentType: string;
  estimatedCostCents: number;
  cues: CaptionCue[] | null;
};

type ElevenLabsVoiceSettings = {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
};

function numberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);

  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(value, 0), 1);
}

function booleanEnv(name: string, fallback: boolean) {
  const value = process.env[name];

  if (value === undefined) {
    return fallback;
  }

  return !["0", "false", "no", "off"].includes(value.toLowerCase());
}

export function elevenLabsVoiceSettings(): ElevenLabsVoiceSettings {
  return {
    stability: numberEnv("ELEVENLABS_STABILITY", 0.3),
    similarity_boost: numberEnv("ELEVENLABS_SIMILARITY_BOOST", 0.85),
    style: numberEnv("ELEVENLABS_STYLE", 0.65),
    use_speaker_boost: booleanEnv("ELEVENLABS_USE_SPEAKER_BOOST", true),
  };
}

export async function generateVoiceover(
  request: VoiceoverRequest,
): Promise<VoiceoverResult> {
  return generateElevenLabsVoiceover(request);
}

async function generateElevenLabsVoiceover(
  request: VoiceoverRequest,
): Promise<VoiceoverResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  const modelId = process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2";

  if (!apiKey || !voiceId) {
    throw new Error("Missing ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID");
  }

  const endpoint = request.withTimestamps
    ? `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`
    : `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
  const response = await fetch(
    endpoint,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "content-type": "application/json",
        accept: request.withTimestamps ? "application/json" : "audio/mpeg",
      },
      body: JSON.stringify({
        text: request.text,
        model_id: modelId,
        voice_settings: elevenLabsVoiceSettings(),
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`ElevenLabs voiceover failed: ${response.status}`);
  }

  const timestamped = request.withTimestamps
    ? await timestampedVoiceoverResponse(response)
    : null;
  const audioBytes =
    timestamped?.audioBytes ?? new Uint8Array(await response.arrayBuffer());

  return {
    provider: "elevenlabs",
    providerJobId: `elevenlabs:${request.scriptId}:${Date.now()}`,
    audioBytes,
    contentType: "audio/mpeg",
    estimatedCostCents: estimateElevenLabsCostCents(request.text),
    cues: timestamped?.cues ?? null,
  };
}

type ElevenLabsAlignment = {
  characters?: unknown;
  character_start_times_seconds?: unknown;
  character_end_times_seconds?: unknown;
  char_start_times_ms?: unknown;
  char_end_times_ms?: unknown;
};

type ElevenLabsTimestampResponse = {
  audio_base64?: unknown;
  alignment?: ElevenLabsAlignment | null;
  normalized_alignment?: ElevenLabsAlignment | null;
};

async function timestampedVoiceoverResponse(response: Response) {
  const body = (await response.json()) as ElevenLabsTimestampResponse;
  const audioBase64 = typeof body.audio_base64 === "string" ? body.audio_base64 : "";

  if (!audioBase64) {
    throw new Error("ElevenLabs timestamp response did not include audio");
  }

  return {
    audioBytes: new Uint8Array(Buffer.from(audioBase64, "base64")),
    cues: alignmentToWordCues(body.normalized_alignment ?? body.alignment ?? null),
  };
}

function numericArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is number => typeof item === "number")
    : [];
}

function alignmentSeconds(alignment: ElevenLabsAlignment | null, key: "start" | "end") {
  if (!alignment) {
    return [];
  }

  const seconds = numericArray(
    key === "start"
      ? alignment.character_start_times_seconds
      : alignment.character_end_times_seconds,
  );

  if (seconds.length > 0) {
    return seconds;
  }

  const milliseconds = numericArray(
    key === "start" ? alignment.char_start_times_ms : alignment.char_end_times_ms,
  );

  return milliseconds.map((value) => value / 1000);
}

export function alignmentToWordCues(
  alignment: ElevenLabsAlignment | null,
): CaptionCue[] | null {
  if (!alignment || !Array.isArray(alignment.characters)) {
    return null;
  }

  const characters = alignment.characters.filter(
    (item): item is string => typeof item === "string",
  );
  const starts = alignmentSeconds(alignment, "start");
  const ends = alignmentSeconds(alignment, "end");
  const cues: CaptionCue[] = [];
  let text = "";
  let startSeconds: number | null = null;
  let endSeconds: number | null = null;

  function pushCue(cueText: string, start: number, end: number) {
    cues.push({
      text: cueText,
      startSeconds: Number(start.toFixed(3)),
      endSeconds: Number(end.toFixed(3)),
    });
  }

  characters.forEach((character, index) => {
    const characterStart = starts[index];
    const characterEnd = ends[index];

    if (!Number.isFinite(characterStart) || !Number.isFinite(characterEnd)) {
      return;
    }

    if (/\s/.test(character)) {
      if (text && startSeconds !== null && endSeconds !== null) {
        pushCue(text, startSeconds, endSeconds);
      }

      text = "";
      startSeconds = null;
      endSeconds = null;
      return;
    }

    startSeconds ??= characterStart;
    endSeconds = characterEnd;
    text += character;
  });

  if (text && startSeconds !== null && endSeconds !== null) {
    pushCue(text, startSeconds, endSeconds);
  }

  return cues.length > 0 ? cues : null;
}

function estimateElevenLabsCostCents(text: string) {
  const characterCount = text.length;
  const estimatedCentsPerThousandCharacters = Number(
    process.env.ELEVENLABS_ESTIMATED_CENTS_PER_1K_CHARS ?? "30",
  );

  return Math.max(
    1,
    Math.ceil((characterCount / 1000) * estimatedCentsPerThousandCharacters),
  );
}
