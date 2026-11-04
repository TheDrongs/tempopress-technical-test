ALTER TABLE work_orders
  ADD COLUMN assigned_spv_id UUID REFERENCES users(id) ON DELETE RESTRICT;

CREATE INDEX work_orders_assigned_spv_id_idx ON work_orders(assigned_spv_id);

-- Existing submitted work belongs to the sole SPV in the demo. Do not guess
-- ownership if there are multiple supervisors; those legacy rows stay admin-only.
UPDATE work_orders
SET assigned_spv_id = (
  SELECT id FROM users WHERE role = 'SPV' LIMIT 1
)
WHERE status <> 'DRAFT'
  AND (SELECT COUNT(*) FROM users WHERE role = 'SPV') = 1;
