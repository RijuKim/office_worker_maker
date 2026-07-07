-- CreateEnum
CREATE TYPE "SpecType" AS ENUM ('INTERNSHIP', 'LANGUAGE_SCORE', 'PORTFOLIO', 'CERTIFICATION', 'EXAM_PREP', 'CAREER_PATH');

-- CreateEnum
CREATE TYPE "SpecStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ApplicationStage" AS ENUM ('DOCUMENT', 'PERSONALITY_TEST', 'CODING_TEST', 'FIRST_INTERVIEW', 'SECOND_INTERVIEW', 'FINAL_RESULT');

-- AlterTable
ALTER TABLE "CharacterRun" ADD COLUMN     "specScore" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Spec" (
    "id" TEXT NOT NULL,
    "characterRunId" TEXT NOT NULL,
    "specType" "SpecType" NOT NULL,
    "specName" TEXT NOT NULL,
    "status" "SpecStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "score" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "eventFlags" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "Spec_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobApplication" (
    "id" TEXT NOT NULL,
    "characterRunId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "companyType" TEXT NOT NULL,
    "currentStage" "ApplicationStage" NOT NULL DEFAULT 'DOCUMENT',
    "stageResults" JSONB NOT NULL DEFAULT '[]',
    "specScore" INTEGER NOT NULL DEFAULT 0,
    "documentPassed" BOOLEAN,
    "personalityPassed" BOOLEAN,
    "codingTestPassed" BOOLEAN,
    "firstInterviewPassed" BOOLEAN,
    "secondInterviewPassed" BOOLEAN,
    "finalResult" BOOLEAN,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareerPath" (
    "id" TEXT NOT NULL,
    "characterRunId" TEXT NOT NULL,
    "pathType" TEXT NOT NULL,
    "pathName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "eventFlags" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "CareerPath_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Spec" ADD CONSTRAINT "Spec_characterRunId_fkey" FOREIGN KEY ("characterRunId") REFERENCES "CharacterRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_characterRunId_fkey" FOREIGN KEY ("characterRunId") REFERENCES "CharacterRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerPath" ADD CONSTRAINT "CareerPath_characterRunId_fkey" FOREIGN KEY ("characterRunId") REFERENCES "CharacterRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
