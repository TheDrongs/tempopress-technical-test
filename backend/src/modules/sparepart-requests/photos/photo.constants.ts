export const UPLOADS_DIRECTORY = Symbol('UPLOADS_DIRECTORY');
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
export const MAX_REQUEST_PHOTOS = 10;
export const PHOTO_KEY_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
export const PHOTO_PATH_PATTERN =
  /^spareparts\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$/;

export function photoUrl(
  itemId: string,
  imagePath: string | null,
): string | null {
  return imagePath ? `/api/sparepart-items/${itemId}/image` : null;
}
