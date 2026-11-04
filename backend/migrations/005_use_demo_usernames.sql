ALTER TABLE users RENAME COLUMN email TO username;
ALTER TABLE users RENAME CONSTRAINT users_email_key TO users_username_key;
ALTER TABLE users RENAME CONSTRAINT users_email_check TO users_username_check;

-- Upgrade only the known seed credentials introduced in migration 004.
-- Business data and custom accounts are preserved.
UPDATE users SET username = 'admin', password_hash = NULL
WHERE id = '00000000-0000-4000-8000-000000000001' AND username = 'admin@tempopress.test';
UPDATE users SET username = 'spv', password_hash = NULL
WHERE id = '00000000-0000-4000-8000-000000000002' AND username = 'spv@tempopress.test';
UPDATE users SET username = 'mekanik', password_hash = NULL
WHERE id = '00000000-0000-4000-8000-000000000003' AND username = 'mechanic@tempopress.test';
