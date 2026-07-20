-- Persist generation ownership so JSON/SSE requests converge across server instances.
ALTER TABLE "CharacterRun"
ADD COLUMN "eventGenerationToken" TEXT,
ADD COLUMN "eventGenerationStartedAt" TIMESTAMP(3);
