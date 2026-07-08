import * as tus from "tus-js-client";
import { customerAssetBucket } from "@/lib/assets/validation";

const sixMegabytes = 6 * 1024 * 1024;
const retryDelays = [0, 3000, 5000, 10000, 20000];

function getTusEndpoint() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }

  const url = new URL(supabaseUrl);

  if (url.hostname.endsWith(".supabase.co")) {
    const projectRef = url.hostname.split(".")[0];

    return `${url.protocol}//${projectRef}.storage.supabase.co/storage/v1/upload/resumable`;
  }

  return `${url.origin}/storage/v1/upload/resumable`;
}

export function uploadWithTus(input: {
  accessToken: string;
  bucketName?: string;
  file: File;
  onProgress: (progress: number) => void;
  storagePath: string;
}) {
  return new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(input.file, {
      endpoint: getTusEndpoint(),
      retryDelays,
      chunkSize: sixMegabytes,
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      storeFingerprintForResuming: true,
      fingerprint: async () =>
        `${input.storagePath}-${input.file.name}-${input.file.size}-${input.file.lastModified}`,
      headers: {
        authorization: `Bearer ${input.accessToken}`,
      },
      metadata: {
        bucketName: input.bucketName ?? customerAssetBucket,
        objectName: input.storagePath,
        contentType: input.file.type || "application/octet-stream",
        cacheControl: "3600",
      },
      onError: reject,
      onProgress: (bytesUploaded, bytesTotal) => {
        if (bytesTotal > 0) {
          input.onProgress(Math.round((bytesUploaded / bytesTotal) * 100));
        }
      },
      onSuccess: () => resolve(),
    });

    upload
      .findPreviousUploads()
      .then((previousUploads) => {
        if (previousUploads.length > 0) {
          upload.resumeFromPreviousUpload(previousUploads[0]);
        }

        upload.start();
      })
      .catch(reject);
  });
}
