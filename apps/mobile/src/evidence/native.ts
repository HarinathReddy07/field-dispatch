import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import { base64ToBytes, bytesToHex, sniffImageType } from '../lib/base64';
import type { PreparedImage } from './pipeline';

const MAX_BYTES = 5 * 1024 * 1024;

/** Reads the picked file, checks it really is a JPEG/PNG, and computes its SHA-256 (the server re-verifies all of it). */
export async function prepareImage(uri: string): Promise<PreparedImage> {
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const bytes = base64ToBytes(base64);
  const contentType = sniffImageType(bytes);
  if (!contentType) throw new Error('Only JPEG or PNG photos are accepted.');
  if (bytes.length > MAX_BYTES) throw new Error('That photo is larger than 5 MB.');
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes);
  return { sizeBytes: bytes.length, sha256: bytesToHex(new Uint8Array(digest)), contentType };
}

/** PUT the file to the presigned URL (RN fetch has no upload progress; the upload task does). */
export async function uploadFile(
  url: string,
  uri: string,
  headers: Record<string, string>,
  onProgress: (fraction: number) => void,
): Promise<void> {
  const task = FileSystem.createUploadTask(
    url,
    uri,
    { httpMethod: 'PUT', uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT, headers },
    (p) => onProgress(p.totalBytesExpectedToSend > 0 ? p.totalBytesSent / p.totalBytesExpectedToSend : 0),
  );
  const res = await task.uploadAsync();
  if (!res || res.status < 200 || res.status >= 300) {
    throw new Error(`Upload failed (${res ? res.status : 'no response'}). Check your connection and retry.`);
  }
}
