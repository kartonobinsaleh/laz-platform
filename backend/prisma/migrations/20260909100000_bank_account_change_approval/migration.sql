CREATE TYPE "BankAccountChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "bank_account_change_requests" (
    "id" TEXT NOT NULL,
    "lembagaId" TEXT,
    "bankCode" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountHolder" TEXT NOT NULL,
    "label" TEXT,
    "previousBankCode" TEXT NOT NULL,
    "previousAccountNumber" TEXT NOT NULL,
    "previousAccountHolder" TEXT NOT NULL,
    "status" "BankAccountChangeStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "bank_account_change_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "bank_changes_lembaga_fkey" FOREIGN KEY ("lembagaId") REFERENCES "lembagas"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "bank_changes_requester_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "bank_changes_reviewer_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "bank_changes_review_check" CHECK (
      ("status" = 'PENDING' AND "reviewedById" IS NULL AND "reviewedAt" IS NULL AND "rejectionReason" IS NULL) OR
      ("status" = 'APPROVED' AND "reviewedById" IS NOT NULL AND "reviewedAt" IS NOT NULL AND "rejectionReason" IS NULL) OR
      ("status" = 'REJECTED' AND "reviewedById" IS NOT NULL AND "reviewedAt" IS NOT NULL AND length(trim("rejectionReason")) > 0 AND "rejectionReason" IS NOT NULL)
    )
);
CREATE INDEX "bank_account_change_requests_lembagaId_createdAt_idx" ON "bank_account_change_requests"("lembagaId", "createdAt");
CREATE INDEX "bank_account_change_requests_status_createdAt_idx" ON "bank_account_change_requests"("status", "createdAt");
CREATE UNIQUE INDEX "bank_changes_one_pending_lembaga" ON "bank_account_change_requests"("lembagaId") WHERE "status" = 'PENDING' AND "lembagaId" IS NOT NULL;
CREATE UNIQUE INDEX "bank_changes_one_pending_platform" ON "bank_account_change_requests"((1)) WHERE "status" = 'PENDING' AND "lembagaId" IS NULL;
