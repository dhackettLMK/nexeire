import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { RenderPlan } from "@/lib/videos/render-plan";

export type RenderRequest = {
  videoOutputId: string;
  scriptId: string;
  organizationId: string;
  title: string;
  voiceoverUrl: string;
  brollUrls?: string[];
  hook: string;
  caption: string;
  cta: string;
  scenePlan: unknown;
  renderPlan: RenderPlan;
  webhookUrl?: string;
};

export type RenderResult = {
  provider: "remotion" | "test";
  providerJobId: string;
  status: "queued" | "succeeded";
  estimatedCostCents: number;
  videoBytes?: Uint8Array;
  testVideoBytes?: Uint8Array;
  responsePayload?: Record<string, unknown>;
};

export function configuredRenderProvider() {
  return process.env.RENDER_PROVIDER === "test" ? "test" : "remotion";
}

export async function startRender(request: RenderRequest): Promise<RenderResult> {
  if (process.env.RENDER_PROVIDER === "test") {
    return startTestRender(request);
  }

  return startRemotionRender(request);
}

async function startRemotionRender(request: RenderRequest): Promise<RenderResult> {
  const entryPoint = path.join(process.cwd(), "src/remotion/index.ts");
  const bundle = await resolveRemotionBundle(entryPoint);
  const estimatedCostCents = Number(
    process.env.REMOTION_ESTIMATED_CENTS_PER_VIDEO ?? "80",
  );
  const detached = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  const outputFile = `/tmp/${request.videoOutputId}.mp4`;

  const remotionVercel = await import("@remotion/vercel");
  const sandbox = await remotionVercel.createSandbox({
    resources: {
      vcpus: Number(process.env.REMOTION_SANDBOX_VCPUS ?? "4"),
    },
    timeoutInMilliseconds: Number(
      process.env.REMOTION_SANDBOX_TIMEOUT_MS ?? "600000",
    ),
  });

  try {
    await sandbox.mkDir("remotion-bundle").catch(() => undefined);
    await remotionVercel.addBundleToSandbox({
      sandbox,
      bundleDir: bundle.bundleDir,
    });

    if (detached) {
      const result = await remotionVercel.renderMediaOnVercel({
        sandbox,
        compositionId: "UGCVideo",
        inputProps: { plan: request.renderPlan },
        outputFile,
        codec: "h264",
        imageFormat: "jpeg",
        logLevel: "warn",
        timeoutInMilliseconds: Number(
          process.env.REMOTION_RENDER_TIMEOUT_MS ?? "600000",
        ),
        detached: true,
        vercelBlob: {
          blobToken: process.env.BLOB_READ_WRITE_TOKEN!,
          access: "public",
          blobPath: `renders/${request.organizationId}/${request.videoOutputId}.mp4`,
        },
      });

      return {
        provider: "remotion",
        providerJobId: `${result.sandboxId}:${result.cmdId}`,
        status: "queued",
        estimatedCostCents,
        responsePayload: {
          mode: "detached",
          bundleSource: bundle.source,
          sandboxId: result.sandboxId,
          cmdId: result.cmdId,
          outputFile: result.outputFile,
        },
      };
    }

    const result = await remotionVercel.renderMediaOnVercel({
      sandbox,
      compositionId: "UGCVideo",
      inputProps: { plan: request.renderPlan },
      outputFile,
      codec: "h264",
      imageFormat: "jpeg",
      logLevel: "warn",
      timeoutInMilliseconds: Number(
        process.env.REMOTION_RENDER_TIMEOUT_MS ?? "600000",
      ),
      detached: false,
    });
    const bytes = await sandbox.readFileToBuffer({
      path: result.sandboxFilePath,
    });

    if (!bytes) {
      throw new Error("Remotion render completed without an output file");
    }

    return {
      provider: "remotion",
      providerJobId: `remotion:${request.videoOutputId}:${Date.now()}`,
      status: "succeeded",
      estimatedCostCents,
      videoBytes: new Uint8Array(bytes),
      responsePayload: {
        mode: "sync",
        bundleSource: bundle.source,
        contentType: result.contentType,
        sandboxFilePath: result.sandboxFilePath,
      },
    };
  } finally {
    if (!detached) {
      await sandbox.stop().catch(() => undefined);
    }

    if (bundle.cleanup) {
      await rm(bundle.bundleDir, { force: true, recursive: true }).catch(
        () => undefined,
      );
    }
  }
}

async function pathExists(value: string) {
  try {
    await access(value);
    return true;
  } catch {
    return false;
  }
}

async function resolveRemotionBundle(entryPoint: string) {
  const configuredDir = process.env.REMOTION_BUNDLE_DIR
    ? path.resolve(process.env.REMOTION_BUNDLE_DIR)
    : null;
  const prebuiltDir =
    configuredDir ?? path.join(process.cwd(), ".remotion/bundle");

  if (await pathExists(prebuiltDir)) {
    return {
      bundleDir: prebuiltDir,
      cleanup: false,
      source: configuredDir ? "configured" : "prebuilt",
    };
  }

  if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
    throw new Error(
      "Missing prebuilt Remotion bundle. Run pnpm remotion:bundle before deploying.",
    );
  }

  const bundleDir = await mkdtemp(path.join(tmpdir(), "ugc-remotion-"));
  const dynamicImport = new Function("specifier", "return import(specifier)") as (
    specifier: string,
  ) => Promise<typeof import("@remotion/bundler")>;
  const { bundle } = await dynamicImport("@remotion/bundler");

  await bundle({
    entryPoint,
    outDir: bundleDir,
    publicDir: null,
    enableCaching: true,
    onProgress: () => undefined,
    ignoreRegisterRootWarning: false,
    keyboardShortcutsEnabled: false,
    askAIEnabled: false,
    symlinkPublicDir: false,
  });

  return {
    bundleDir,
    cleanup: true,
    source: "dynamic",
  };
}

function startTestRender(request: RenderRequest): RenderResult {
  const bytes = new TextEncoder().encode(
    `TEST MP4 PLACEHOLDER\n${request.title}\n${request.caption}\n${request.cta}`,
  );

  return {
    provider: "test",
    providerJobId: `test-render:${request.videoOutputId}`,
    status: "succeeded",
    estimatedCostCents: 0,
    videoBytes: bytes,
    testVideoBytes: bytes,
  };
}
