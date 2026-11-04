import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import sharp from 'sharp';
import {
  MAX_PHOTO_BYTES,
  PHOTO_PATH_PATTERN,
  UPLOADS_DIRECTORY,
} from './photo.constants.js';

export interface PreparedPhoto {
  imagePath: string;
  buffer: Buffer;
}

@Injectable()
export class SparepartPhotoStorage {
  private readonly logger = new Logger(SparepartPhotoStorage.name);

  constructor(@Inject(UPLOADS_DIRECTORY) private readonly directory: string) {}

  async prepare(file: Express.Multer.File): Promise<PreparedPhoto> {
    if (file.size > MAX_PHOTO_BYTES) {
      throw new BadRequestException('Each photo must be at most 2 MiB.');
    }
    try {
      const image = sharp(file.buffer, {
        failOn: 'warning',
        limitInputPixels: 20_000_000,
        animated: true,
      });
      const metadata = await image.metadata();
      if (
        !['jpeg', 'png'].includes(metadata.format ?? '') ||
        (metadata.pages ?? 1) !== 1 ||
        file.mimetype !== `image/${metadata.format}`
      ) {
        throw new Error('Unsupported image content.');
      }
      // Decode and re-encode the image; original names and metadata are not stored.
      const rotated = image.rotate();
      const buffer = await (
        metadata.format === 'jpeg'
          ? rotated.jpeg({ quality: 90 })
          : rotated.png()
      ).toBuffer();
      if (buffer.length > MAX_PHOTO_BYTES) {
        throw new Error('Decoded photo is too large.');
      }
      const extension = metadata.format === 'jpeg' ? 'jpg' : 'png';
      return { imagePath: `spareparts/${randomUUID()}.${extension}`, buffer };
    } catch {
      throw new BadRequestException(
        'Photos must be valid, single-frame JPG/PNG images (max 2 MiB and 20 megapixels).',
      );
    }
  }

  async save(photo: PreparedPhoto): Promise<void> {
    const path = this.resolve(photo.imagePath);
    await mkdir(dirname(path), { recursive: true });
    try {
      await writeFile(path, photo.buffer, { flag: 'wx' });
    } catch (error) {
      // A failed write can leave a partial file. Never remove an existing file.
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        await this.remove(photo.imagePath);
      }
      throw error;
    }
  }

  async remove(imagePath: string): Promise<void> {
    try {
      await unlink(this.resolve(imagePath));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.error(`Could not clean up upload ${imagePath}.`);
        throw error;
      }
    }
  }

  async read(
    imagePath: string,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    try {
      const buffer = await readFile(this.resolve(imagePath));
      return {
        buffer,
        contentType: imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg',
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new NotFoundException('Sparepart photo was not found.');
      }
      throw error;
    }
  }

  private resolve(imagePath: string): string {
    if (!PHOTO_PATH_PATTERN.test(imagePath)) {
      throw new NotFoundException('Sparepart photo was not found.');
    }
    return join(this.directory, imagePath);
  }
}
