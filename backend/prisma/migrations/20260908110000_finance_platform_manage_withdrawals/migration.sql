-- Grant the existing withdrawal management capability to platform finance.
-- Preserve all other role assignments and custom permissions.
INSERT INTO "permissions" ("id", "key", "description", "createdAt")
VALUES (
    'permission_finance_withdrawals_manage',
    'withdrawals.manage',
    'Menyetujui/menolak pencairan dana dan mencoba ulang payout (Super Admin dan Finance Platform)',
    CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO UPDATE SET "description" = EXCLUDED."description";

INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT
    'finance_wd_manage_' || MD5(r."id" || ':' || p."id"),
    r."id",
    p."id",
    CURRENT_TIMESTAMP
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."name" = 'FINANCE_PLATFORM' AND p."key" = 'withdrawals.manage'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

UPDATE "roles"
SET "description" = 'Memantau keuangan lintas lembaga, menyetujui/menolak pencairan dana, dan mengajukan penarikan amil platform',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" = 'FINANCE_PLATFORM';
