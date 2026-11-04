import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  StreamableFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { ActiveUser } from '../users/active-user.decorator.js';
import type { User } from '../users/user.types.js';
import { ApproveSparepartRequestDto } from './dto/approve-sparepart-request.dto.js';
import { CreateSparepartRequestDto } from './dto/create-sparepart-request.dto.js';
import { SparepartRequestsService } from './sparepart-requests.service.js';
import { SparepartPhotoUpload } from './photos/sparepart-photo.upload.js';

@Controller('api')
export class SparepartRequestsController {
  constructor(private readonly requests: SparepartRequestsService) {}

  @Post('work-orders/:id/request-sparepart')
  @UseInterceptors(SparepartPhotoUpload)
  create(
    @ActiveUser() actor: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: CreateSparepartRequestDto,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
  ) {
    return this.requests.create(actor, id, input, files);
  }

  // Same-origin images use the login cookie and the parent WO visibility rules.
  @Get('sparepart-items/:id/image')
  @Header('X-Content-Type-Options', 'nosniff')
  async image(
    @ActiveUser() actor: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const photo = await this.requests.readPhoto(actor, id);
    return new StreamableFile(photo.buffer, {
      type: photo.contentType,
      disposition: 'inline',
    });
  }

  @Post('sparepart-requests/:id/approve')
  @HttpCode(HttpStatus.OK)
  approve(
    @ActiveUser() actor: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: ApproveSparepartRequestDto,
  ) {
    return this.requests.approve(actor, id, input);
  }
}
