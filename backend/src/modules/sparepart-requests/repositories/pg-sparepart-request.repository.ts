import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service.js';
import type { SparepartRequestDetail } from '../sparepart-request.types.js';
import type {
  CreateSparepartRequestRecord,
  SparepartRequestRepository,
  UpdateSparepartRequestRecord,
} from './sparepart-request.repository.js';
import { fetchSparepartRequests } from './sparepart-request.queries.js';

@Injectable()
export class PgSparepartRequestRepository implements SparepartRequestRepository {
  constructor(private readonly database: DatabaseService) {}

  async findItemImage(id: string) {
    const result = await this.database.query<{
      imagePath: string | null;
      workOrderId: string;
    }>(
      `SELECT i.image_path AS "imagePath", r.work_order_id AS "workOrderId"
       FROM sparepart_items i JOIN sparepart_requests r ON r.id = i.sparepart_request_id WHERE i.id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async findById(id: string): Promise<SparepartRequestDetail | null> {
    return (await fetchSparepartRequests(this.database, { id }))[0] ?? null;
  }

  findByWorkOrderId(workOrderId: string): Promise<SparepartRequestDetail[]> {
    return fetchSparepartRequests(this.database, { workOrderId });
  }

  async countPending(workOrderId: string): Promise<number> {
    const result = await this.database.query<{ count: number }>(
      "SELECT COUNT(*)::integer AS count FROM sparepart_requests WHERE work_order_id = $1 AND status = 'PENDING'",
      [workOrderId],
    );
    return result.rows[0].count;
  }

  // Caller coordinates this operation and the WO update in one transaction.
  async create(
    input: CreateSparepartRequestRecord,
  ): Promise<SparepartRequestDetail> {
    const result = await this.database.query<{ id: string }>(
      'INSERT INTO sparepart_requests (work_order_id, status, requested_by) VALUES ($1, $2, $3) RETURNING id',
      [input.workOrderId, input.status, input.requestedBy],
    );
    const id = result.rows[0].id;
    await this.database.query(
      `
      INSERT INTO sparepart_items (sparepart_request_id, name, qty, image_path)
      SELECT $1, name, qty, image_path
      FROM UNNEST($2::text[], $3::integer[], $4::text[]) AS item(name, qty, image_path)
    `,
      [
        id,
        input.items.map((item) => item.name),
        input.items.map((item) => item.qty),
        input.items.map((item) => item.imagePath),
      ],
    );
    const request = await this.findById(id);
    if (!request) throw new Error('Created sparepart request is missing.');
    return request;
  }

  async update(
    id: string,
    input: UpdateSparepartRequestRecord,
  ): Promise<SparepartRequestDetail | null> {
    const columns: Record<keyof UpdateSparepartRequestRecord, string> = {
      status: 'status',
      approvedBy: 'approved_by',
      approvalNote: 'approval_note',
    };
    const values: unknown[] = [];
    const assignments = ['updated_at = NOW()'];
    for (const key of Object.keys(
      columns,
    ) as (keyof UpdateSparepartRequestRecord)[]) {
      if (input[key] !== undefined) {
        values.push(input[key]);
        assignments.push(`${columns[key]} = $${values.length}`);
      }
    }
    values.push(id);
    const result = await this.database.query<{ id: string }>(
      `UPDATE sparepart_requests SET ${assignments.join(', ')} WHERE id = $${values.length} RETURNING id`,
      values,
    );
    return result.rows.length ? this.findById(id) : null;
  }
}
