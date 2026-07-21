ALTER TABLE "User" ADD COLUMN "tossAnonymousKey" TEXT;

CREATE UNIQUE INDEX "User_tossAnonymousKey_key" ON "User"("tossAnonymousKey");
