import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from './database/database.service.js';

@Injectable()
export class AppService {
  constructor(private readonly database: DatabaseService) {}

  async getHealth() {
    try {
      await this.database.checkConnection();
      return { status: 'ok', service: 'backend', database: 'connected' };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        service: 'backend',
        database: 'unavailable',
      });
    }
  }
}
