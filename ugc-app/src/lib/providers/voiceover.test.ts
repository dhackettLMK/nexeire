import { afterEach, describe, expect, it, vi } from "vitest";
import {
  alignmentToWordCues,
  generateVoiceover,
} from "@/lib/providers/voiceover";

const originalEnv = { ...process.env };

afterEach(() => {
  vi.unstubAllGlobals();
  process.env = { ...originalEnv };
});

describe("voiceover provider", () => {
  it("generates ElevenLabs voiceover bytes", async () => {
    process.env.ELEVENLABS_API_KEY = "test-key";
    process.env.ELEVENLABS_VOICE_ID = "voice-1";
    process.env.ELEVENLABS_ESTIMATED_CENTS_PER_1K_CHARS = "30";
    const fetchMock = vi.fn(async () => {
      return new Response(new Uint8Array([1, 2, 3]), {
        headers: { "content-type": "audio/mpeg" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateVoiceover({
      scriptId: "script-1",
      text: "Book a trial today.",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.elevenlabs.io/v1/text-to-speech/voice-1",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "xi-api-key": "test-key",
          accept: "audio/mpeg",
        }),
      }),
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      voice_settings: {
        stability: 0.3,
        similarity_boost: 0.85,
        style: 0.65,
        use_speaker_boost: true,
      },
    });
    expect(result.provider).toBe("elevenlabs");
    expect(result.providerJobId).toMatch(/^elevenlabs:script-1:/);
    expect(result.audioBytes.byteLength).toBe(3);
    expect(result.cues).toBeNull();
    expect(result.estimatedCostCents).toBe(1);
  });

  it("generates ElevenLabs voiceover bytes with word cues", async () => {
    process.env.ELEVENLABS_API_KEY = "test-key";
    process.env.ELEVENLABS_VOICE_ID = "voice-1";
    const fetchMock = vi.fn(async () => {
      return Response.json({
        audio_base64: Buffer.from(new Uint8Array([4, 5, 6])).toString("base64"),
        normalized_alignment: {
          characters: ["B", "o", "o", "k", " ", "n", "o", "w"],
          character_start_times_seconds: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7],
          character_end_times_seconds: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
        },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateVoiceover({
      scriptId: "script-1",
      text: "Book now",
      withTimestamps: true,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.elevenlabs.io/v1/text-to-speech/voice-1/with-timestamps",
      expect.objectContaining({
        headers: expect.objectContaining({
          accept: "application/json",
        }),
      }),
    );
    expect(result.audioBytes).toEqual(new Uint8Array([4, 5, 6]));
    expect(result.cues).toEqual([
      { text: "Book", startSeconds: 0, endSeconds: 0.4 },
      { text: "now", startSeconds: 0.5, endSeconds: 0.8 },
    ]);
  });

  it("converts millisecond character alignment into word cues", () => {
    expect(
      alignmentToWordCues({
        characters: ["H", "i", " ", "t", "h", "e", "r", "e"],
        char_start_times_ms: [0, 50, 100, 200, 250, 300, 350, 400],
        char_end_times_ms: [50, 100, 150, 250, 300, 350, 400, 450],
      }),
    ).toEqual([
      { text: "Hi", startSeconds: 0, endSeconds: 0.1 },
      { text: "there", startSeconds: 0.2, endSeconds: 0.45 },
    ]);
  });

  it("fails live ElevenLabs generation when required credentials are missing", async () => {
    delete process.env.ELEVENLABS_API_KEY;
    delete process.env.ELEVENLABS_VOICE_ID;

    await expect(
      generateVoiceover({
        scriptId: "script-1",
        text: "Book a trial today.",
      }),
    ).rejects.toThrow(/ELEVENLABS_API_KEY/);
  });

  it("lets production tune expressive delivery without code changes", async () => {
    process.env.ELEVENLABS_API_KEY = "test-key";
    process.env.ELEVENLABS_VOICE_ID = "voice-1";
    process.env.ELEVENLABS_STABILITY = "0.22";
    process.env.ELEVENLABS_SIMILARITY_BOOST = "0.9";
    process.env.ELEVENLABS_STYLE = "0.8";
    process.env.ELEVENLABS_USE_SPEAKER_BOOST = "false";
    const fetchMock = vi.fn(async () => new Response(new Uint8Array([1])));
    vi.stubGlobal("fetch", fetchMock);

    await generateVoiceover({
      scriptId: "script-1",
      text: "Quick question — are you still guessing?",
    });

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      voice_settings: {
        stability: 0.22,
        similarity_boost: 0.9,
        style: 0.8,
        use_speaker_boost: false,
      },
    });
  });
});
