import { put } from '@vercel/blob'

export async function uploadImageToBlob(
  filename: string,
  file: ArrayBuffer,
  mimeType: string
): Promise<string> {
  const { url } = await put(filename, file, {
    access: 'public',
    contentType: mimeType,
    addRandomSuffix: true,
  })
  return url
}
