import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ActiveUser } from '../users/active-user.decorator.js';
import type { User } from '../users/user.types.js';
import { AssignMechanicDto } from './dto/assign-mechanic.dto.js';
import { CompleteWorkOrderDto } from './dto/complete-work-order.dto.js';
import { CreateWorkOrderDto } from './dto/create-work-order.dto.js';
import { UpdateWorkOrderDto } from './dto/update-work-order.dto.js';
import { WorkOrdersService } from './work-orders.service.js';
import { SubmitWorkOrderDto } from './dto/submit-work-order.dto.js';

@Controller('api/work-orders')
export class WorkOrdersController {
  constructor(private readonly workOrders: WorkOrdersService) {}

  @Get()
  findAll(@ActiveUser() actor: User) {
    return this.workOrders.findAll(actor);
  }

  @Get(':id')
  findDetail(
    @ActiveUser() actor: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.workOrders.findDetail(actor, id);
  }

  @Post()
  create(@ActiveUser() actor: User, @Body() input: CreateWorkOrderDto) {
    return this.workOrders.create(actor, input);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  submit(
    @ActiveUser() actor: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: SubmitWorkOrderDto,
  ) {
    return this.workOrders.submit(actor, id, input?.spvId);
  }

  @Post(':id/assign')
  @HttpCode(HttpStatus.OK)
  assign(
    @ActiveUser() actor: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: AssignMechanicDto,
  ) {
    return this.workOrders.assign(actor, id, input.mechanicId);
  }

  @Post(':id/update')
  @HttpCode(HttpStatus.OK)
  update(
    @ActiveUser() actor: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateWorkOrderDto,
  ) {
    return this.workOrders.prepareWithoutSpareparts(actor, id, input);
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  start(@ActiveUser() actor: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.workOrders.start(actor, id);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  complete(
    @ActiveUser() actor: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: CompleteWorkOrderDto,
  ) {
    return this.workOrders.complete(actor, id, new Date(input.endDate));
  }
}
