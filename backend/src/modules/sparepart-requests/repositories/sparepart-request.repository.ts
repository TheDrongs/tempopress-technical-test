import type {
  SparepartItem,
  SparepartRequest,
  SparepartRequestDetail,
} from '../sparepart-request.types.js';

export const SPAREPART_REQUEST_REPOSITORY = Symbol(
  'SPAREPART_REQUEST_REPOSITORY',
);

export type CreateSparepartRequestRecord = Pick<
  SparepartRequest,
  'workOrderId' | 'status' | 'requestedBy'
> & {
  items: Pick<SparepartItem, 'name' | 'qty' | 'imagePath'>[];
};

export type UpdateSparepartRequestRecord = Partial<
  Pick<SparepartRequest, 'status' | 'approvedBy' | 'approvalNote'>
>;

export interface SparepartRequestRepository {
  findItemImage(
    id: string,
  ): Promise<{ imagePath: string | null; workOrderId: string } | null>;
  findById(id: string): Promise<SparepartRequestDetail | null>;
  findByWorkOrderId(workOrderId: string): Promise<SparepartRequestDetail[]>;
  countPending(workOrderId: string): Promise<number>;
  create(input: CreateSparepartRequestRecord): Promise<SparepartRequestDetail>;
  update(
    id: string,
    input: UpdateSparepartRequestRecord,
  ): Promise<SparepartRequestDetail | null>;
}
