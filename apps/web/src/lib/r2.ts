import "server-only";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Env } from "./env";

let cached: S3Client | null = null;

function client(): S3Client {
  if (cached) return cached;
  const { accountId, accessKeyId, secretAccessKey } = r2Env();
  cached = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return cached;
}

/**
 * Presign a direct browser PUT to R2 and return the eventual public URL.
 * The client uploads the bytes itself; the app never proxies the file.
 */
export async function presignUpload(opts: {
  key: string;
  contentType: string;
}): Promise<{ uploadUrl: string; fileUrl: string }> {
  const { bucket, publicUrl } = r2Env();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: opts.key,
    ContentType: opts.contentType,
  });
  const uploadUrl = await getSignedUrl(client(), command, { expiresIn: 90 });
  return { uploadUrl, fileUrl: `${publicUrl}/${opts.key}` };
}
