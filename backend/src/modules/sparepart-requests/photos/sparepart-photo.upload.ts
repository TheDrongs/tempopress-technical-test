import { BadRequestException } from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import {
  MAX_PHOTO_BYTES,
  MAX_REQUEST_PHOTOS,
  PHOTO_KEY_PATTERN,
} from './photo.constants.js';

// Memory storage is the Multer default. Nothing reaches disk before validation.
export const SparepartPhotoUpload = AnyFilesInterceptor({
  limits: {
    fileSize: MAX_PHOTO_BYTES,
    files: MAX_REQUEST_PHOTOS,
    fields: 3,
    parts: MAX_REQUEST_PHOTOS + 3,
    fieldSize: 256 * 1024,
    fieldNameSize: 80,
  },
  fileFilter: (_request, file, callback) => {
    const key = file.fieldname.startsWith('photos.')
      ? file.fieldname.slice('photos.'.length)
      : '';
    if (
      !PHOTO_KEY_PATTERN.test(key) ||
      !['image/jpeg', 'image/png'].includes(file.mimetype)
    ) {
      return callback(
        new BadRequestException(
          'Use photos.<photoKey> fields containing JPG/PNG files.',
        ),
        false,
      );
    }
    callback(null, true);
  },
});
