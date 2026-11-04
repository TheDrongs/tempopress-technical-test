import { Transform, plainToInstance } from 'class-transformer';
import { BadRequestException } from '@nestjs/common';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { UpdateWorkOrderDto } from '../../work-orders/dto/update-work-order.dto.js';
import { SparepartItemDto } from './sparepart-item.dto.js';

// Finishes Admin preparation WITH spareparts in one atomic operation.
export class CreateSparepartRequestDto extends UpdateWorkOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Transform(({ value }) => {
    let items: unknown = value;
    if (typeof items === 'string') {
      try {
        items = JSON.parse(items) as unknown;
      } catch {
        throw new BadRequestException('items must contain a valid JSON array.');
      }
    }
    return Array.isArray(items)
      ? plainToInstance(SparepartItemDto, items)
      : items;
  })
  items!: SparepartItemDto[];
}
