CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    role VARCHAR NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT users_name_not_blank CHECK (BTRIM(name) <> ''),
    CONSTRAINT users_role_valid CHECK (role IN ('ADMIN', 'SPV', 'MECHANIC'))
);

CREATE TABLE work_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR NOT NULL,
    description TEXT,
    status VARCHAR NOT NULL DEFAULT 'DRAFT',
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    assigned_mechanic_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT work_orders_title_not_blank CHECK (BTRIM(title) <> ''),
    CONSTRAINT work_orders_status_valid CHECK (status IN (
        'DRAFT',
        'SUBMITTED',
        'ASSIGNED',
        'WAITING_SPAREPART_APPROVAL',
        'READY_TO_WORK',
        'WORKING',
        'COMPLETED'
    )),
    CONSTRAINT work_orders_dates_ordered CHECK (
        end_date IS NULL OR start_date IS NULL OR end_date >= start_date
    )
);

CREATE TABLE sparepart_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE RESTRICT,
    status VARCHAR NOT NULL DEFAULT 'PENDING',
    requested_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    approved_by UUID REFERENCES users(id) ON DELETE RESTRICT,
    approval_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT sparepart_requests_status_valid CHECK (status IN ('PENDING', 'APPROVED'))
);

CREATE TABLE sparepart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sparepart_request_id UUID NOT NULL REFERENCES sparepart_requests(id) ON DELETE RESTRICT,
    name VARCHAR NOT NULL,
    qty INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT sparepart_items_name_not_blank CHECK (BTRIM(name) <> ''),
    CONSTRAINT sparepart_items_qty_positive CHECK (qty > 0)
);

CREATE INDEX work_orders_created_by_idx ON work_orders(created_by);
CREATE INDEX work_orders_assigned_mechanic_id_idx ON work_orders(assigned_mechanic_id);
CREATE INDEX sparepart_requests_work_order_id_idx ON sparepart_requests(work_order_id);
CREATE INDEX sparepart_requests_requested_by_idx ON sparepart_requests(requested_by);
CREATE INDEX sparepart_requests_approved_by_idx ON sparepart_requests(approved_by);
CREATE INDEX sparepart_items_request_id_idx ON sparepart_items(sparepart_request_id);
