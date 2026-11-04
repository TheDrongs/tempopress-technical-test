import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service.js';
import type { UserSummary } from '../../users/user.types.js';
import type { User } from '../../users/user.types.js';
import { UserRole } from '../../users/user.types.js';
import { fetchSparepartRequests } from '../../sparepart-requests/repositories/sparepart-request.queries.js';
import type { WorkOrder, WorkOrderDetail } from '../work-order.types.js';
import type {
  CreateWorkOrderRecord,
  UpdateWorkOrderRecord,
  WorkOrderRepository,
} from './work-order.repository.js';

const COLUMNS = `id, title, description, status, created_by AS "createdBy",
  assigned_spv_id AS "assignedSpvId", assigned_mechanic_id AS "assignedMechanicId", start_date AS "startDate",
  end_date AS "endDate", created_at AS "createdAt", updated_at AS "updatedAt"`;

@Injectable()
export class PgWorkOrderRepository implements WorkOrderRepository {
  constructor(private readonly database: DatabaseService) {}

  async findAll(actor: User): Promise<WorkOrder[]> {
    const condition =
      actor.role === UserRole.ADMIN
        ? 'TRUE'
        : actor.role === UserRole.SPV
          ? "status <> 'DRAFT' AND assigned_spv_id = $1"
          : "status <> 'DRAFT' AND assigned_mechanic_id = $1";
    const result = await this.database.query<WorkOrder>(
      `SELECT ${COLUMNS} FROM work_orders WHERE ${condition} ORDER BY created_at DESC, id`,
      actor.role === UserRole.ADMIN ? [] : [actor.id],
    );
    return result.rows;
  }

  async findById(id: string): Promise<WorkOrder | null> {
    const result = await this.database.query<WorkOrder>(
      `SELECT ${COLUMNS} FROM work_orders WHERE id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async findByIdForUpdate(id: string): Promise<WorkOrder | null> {
    const result = await this.database.query<WorkOrder>(
      `SELECT ${COLUMNS} FROM work_orders WHERE id = $1 FOR UPDATE`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async findDetail(id: string): Promise<WorkOrderDetail | null> {
    const order = await this.findById(id);
    if (!order) return null;
    const users = await this.database.query<UserSummary>(
      'SELECT id, name, role FROM users WHERE id = ANY($1::uuid[])',
      [
        [order.createdBy, order.assignedMechanicId, order.assignedSpvId].filter(
          (value): value is string => value !== null,
        ),
      ],
    );
    const createdByUser = users.rows.find(
      (user) => user.id === order.createdBy,
    );
    if (!createdByUser) throw new Error('Work Order creator is missing.');
    return {
      ...order,
      createdByUser,
      assignedSpv:
        users.rows.find((user) => user.id === order.assignedSpvId) ?? null,
      assignedMechanic:
        users.rows.find((user) => user.id === order.assignedMechanicId) ?? null,
      sparepartRequests: await fetchSparepartRequests(this.database, {
        workOrderId: id,
      }),
    };
  }

  async create(input: CreateWorkOrderRecord): Promise<WorkOrder> {
    const result = await this.database.query<WorkOrder>(
      `
      INSERT INTO work_orders (title, description, status, created_by)
      VALUES ($1, $2, $3, $4) RETURNING ${COLUMNS}
    `,
      [input.title, input.description, input.status, input.createdBy],
    );
    return result.rows[0];
  }

  async update(
    id: string,
    input: UpdateWorkOrderRecord,
  ): Promise<WorkOrder | null> {
    const columns: Record<keyof UpdateWorkOrderRecord, string> = {
      title: 'title',
      description: 'description',
      status: 'status',
      assignedMechanicId: 'assigned_mechanic_id',
      assignedSpvId: 'assigned_spv_id',
      startDate: 'start_date',
      endDate: 'end_date',
    };
    const values: unknown[] = [];
    const assignments = ['updated_at = NOW()'];
    for (const key of Object.keys(columns) as (keyof UpdateWorkOrderRecord)[]) {
      if (input[key] !== undefined) {
        values.push(input[key]);
        assignments.push(`${columns[key]} = $${values.length}`);
      }
    }
    values.push(id);
    const result = await this.database.query<WorkOrder>(
      `UPDATE work_orders SET ${assignments.join(', ')} WHERE id = $${values.length} RETURNING ${COLUMNS}`,
      values,
    );
    return result.rows[0] ?? null;
  }
}
