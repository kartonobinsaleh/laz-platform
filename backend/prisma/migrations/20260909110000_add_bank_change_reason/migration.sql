ALTER TABLE "bank_account_change_requests"
ADD COLUMN "changeReason" TEXT NOT NULL DEFAULT 'Alasan tidak dicatat pada pengajuan lama';

ALTER TABLE "bank_account_change_requests"
ALTER COLUMN "changeReason" DROP DEFAULT;
