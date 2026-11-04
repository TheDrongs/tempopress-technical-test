ALTER TABLE sparepart_items ADD COLUMN image_path TEXT;

ALTER TABLE sparepart_items ADD CONSTRAINT sparepart_items_image_path_check
  CHECK (image_path IS NULL OR image_path ~ '^spareparts/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$');
