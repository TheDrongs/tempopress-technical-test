import type { DatabaseService } from '../../../database/database.service.js';
import { photoUrl } from '../photos/photo.constants.js';
import type {
  SparepartItem,
  SparepartRequestDetail,
} from '../sparepart-request.types.js';

// Shared read projection used by request persistence and the Work Order detail view.
export async function fetchSparepartRequests(
  database: DatabaseService,
  selector: { id: string } | { workOrderId: string },
): Promise<SparepartRequestDetail[]> {
  const byId = 'id' in selector;
  const condition = byId ? 'r.id = $1' : 'r.work_order_id = $1';
  const value = byId ? selector.id : selector.workOrderId;
  const requests = await database.query<Omit<SparepartRequestDetail, 'items'>>(
    `
    SELECT r.id, r.work_order_id AS "workOrderId", r.status,
      r.requested_by AS "requestedBy", r.approved_by AS "approvedBy",
      r.approval_note AS "approvalNote", r.created_at AS "createdAt", r.updated_at AS "updatedAt",
      json_build_object('id', requester.id, 'name', requester.name, 'role', requester.role) AS "requestedByUser",
      CASE WHEN approver.id IS NULL THEN NULL
        ELSE json_build_object('id', approver.id, 'name', approver.name, 'role', approver.role)
      END AS "approvedByUser"
    FROM sparepart_requests r
    JOIN users requester ON requester.id = r.requested_by
    LEFT JOIN users approver ON approver.id = r.approved_by
    WHERE ${condition}
    ORDER BY r.created_at, r.id
  `,
    [value],
  );
  if (requests.rows.length === 0) return [];

  const items = await database.query<Omit<SparepartItem, 'imageUrl'>>(
    `
    SELECT id, sparepart_request_id AS "sparepartRequestId", name, qty,
      image_path AS "imagePath", created_at AS "createdAt", updated_at AS "updatedAt"
    FROM sparepart_items WHERE sparepart_request_id = ANY($1::uuid[])
    ORDER BY created_at, id
  `,
    [requests.rows.map((request) => request.id)],
  );
  const byRequest = new Map<string, SparepartItem[]>();
  for (const item of items.rows) {
    const group = byRequest.get(item.sparepartRequestId) ?? [];
    group.push({ ...item, imageUrl: photoUrl(item.id, item.imagePath) });
    byRequest.set(item.sparepartRequestId, group);
  }
  return requests.rows.map((request) => ({
    ...request,
    items: byRequest.get(request.id) ?? [],
  }));
}
