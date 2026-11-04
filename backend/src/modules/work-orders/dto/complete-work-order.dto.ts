import { IsISO8601, Matches } from 'class-validator';

export class CompleteWorkOrderDto {
  @IsISO8601({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/, {
    message: 'endDate must include a timezone.',
  })
  endDate!: string;
}
