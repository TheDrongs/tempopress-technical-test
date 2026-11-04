import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';
import { PublicRoute } from './modules/auth/auth.guard.js';

@Controller('api')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  @PublicRoute()
  getHealth() {
    return this.appService.getHealth();
  }
}
