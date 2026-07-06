CREATE TYPE "AcademicStatus" AS ENUM ('ENROLLED', 'LEAVE', 'DROPPED_OUT', 'GRADUATED');
CREATE TYPE "EventSource" AS ENUM ('STATIC', 'AI', 'FALLBACK', 'FORCED');
CREATE TYPE "EventStatus" AS ENUM ('ACTIVE', 'RESOLVED', 'DISCARDED');
CREATE TYPE "DestinationType" AS ENUM ('PARODY_COMPANY', 'PUBLIC_SECTOR', 'LICENSED_PROFESSION', 'ENTREPRENEURSHIP', 'SELF_EMPLOYMENT');

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CharacterRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "startGradeYear" INTEGER NOT NULL,
    "currentGradeYear" INTEGER,
    "major" TEXT NOT NULL,
    "academicStatus" "AcademicStatus" NOT NULL DEFAULT 'ENROLLED',
    "lifeStatus" JSONB NOT NULL DEFAULT '[]',
    "majorEventCount" INTEGER NOT NULL DEFAULT 0,
    "coreEventCount" INTEGER NOT NULL DEFAULT 0,
    "currentEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CharacterStats" (
    "characterRunId" TEXT NOT NULL,
    "academic" INTEGER NOT NULL,
    "practical" INTEGER NOT NULL,
    "communication" INTEGER NOT NULL,
    "creativity" INTEGER NOT NULL,
    "health" INTEGER NOT NULL,
    "mental" INTEGER NOT NULL,
    "network" INTEGER NOT NULL,
    "wealth" INTEGER NOT NULL,
    "reputation" INTEGER NOT NULL,
    "charm" INTEGER NOT NULL,

    CONSTRAINT "CharacterStats_pkey" PRIMARY KEY ("characterRunId")
);

CREATE TABLE "HiddenState" (
    "characterRunId" TEXT NOT NULL,
    "majorFit" INTEGER NOT NULL,
    "burnoutRisk" INTEGER NOT NULL,
    "romanceState" JSONB NOT NULL DEFAULT '{}',
    "familyState" JSONB NOT NULL DEFAULT '{}',
    "friendState" JSONB NOT NULL DEFAULT '{}',
    "careerInterests" JSONB NOT NULL DEFAULT '[]',
    "companyRolePreferences" JSONB NOT NULL DEFAULT '[]',
    "imageFit" JSONB NOT NULL DEFAULT '{}',
    "selfCareCondition" JSONB NOT NULL DEFAULT '{}',
    "eventFlags" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "HiddenState_pkey" PRIMARY KEY ("characterRunId")
);

CREATE TABLE "Relationship" (
    "id" TEXT NOT NULL,
    "characterRunId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "trust" INTEGER NOT NULL,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Relationship_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "characterRunId" TEXT,
    "source" "EventSource" NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'ACTIVE',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "choices" JSONB NOT NULL,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "safetyChecked" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EventHistory" (
    "id" TEXT NOT NULL,
    "characterRunId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "choiceId" TEXT,
    "summary" TEXT NOT NULL,
    "statDelta" JSONB NOT NULL,
    "relationshipDelta" JSONB NOT NULL,
    "flagDelta" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CareerDestination" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "destinationType" "DestinationType" NOT NULL,
    "industry" TEXT NOT NULL,
    "roles" JSONB NOT NULL,
    "salaryBand" TEXT NOT NULL,
    "cultureTags" JSONB NOT NULL DEFAULT '[]',
    "hiringDifficulty" INTEGER NOT NULL,
    "preferredStats" JSONB NOT NULL,
    "eventTone" JSONB NOT NULL,

    CONSTRAINT "CareerDestination_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CareerEndingRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "characterRunId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "longNarrative" TEXT NOT NULL,
    "careerPath" TEXT NOT NULL,
    "jobRole" TEXT,
    "destinationName" TEXT,
    "salaryBand" TEXT,
    "workplaceTone" JSONB NOT NULL DEFAULT '[]',
    "statSnapshot" JSONB NOT NULL,
    "keyRelationships" JSONB NOT NULL,
    "majorEvents" JSONB NOT NULL,
    "satisfaction" INTEGER NOT NULL,
    "growthPotential" INTEGER NOT NULL,
    "workLifeBalance" INTEGER NOT NULL,
    "healthState" TEXT NOT NULL,
    "relationshipState" TEXT NOT NULL,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "similarityKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareerEndingRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "AiUsage_userId_date_key" ON "AiUsage"("userId", "date");

ALTER TABLE "CharacterRun" ADD CONSTRAINT "CharacterRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CharacterStats" ADD CONSTRAINT "CharacterStats_characterRunId_fkey" FOREIGN KEY ("characterRunId") REFERENCES "CharacterRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HiddenState" ADD CONSTRAINT "HiddenState_characterRunId_fkey" FOREIGN KEY ("characterRunId") REFERENCES "CharacterRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Relationship" ADD CONSTRAINT "Relationship_characterRunId_fkey" FOREIGN KEY ("characterRunId") REFERENCES "CharacterRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Event" ADD CONSTRAINT "Event_characterRunId_fkey" FOREIGN KEY ("characterRunId") REFERENCES "CharacterRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventHistory" ADD CONSTRAINT "EventHistory_characterRunId_fkey" FOREIGN KEY ("characterRunId") REFERENCES "CharacterRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventHistory" ADD CONSTRAINT "EventHistory_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CareerEndingRecord" ADD CONSTRAINT "CareerEndingRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CareerEndingRecord" ADD CONSTRAINT "CareerEndingRecord_characterRunId_fkey" FOREIGN KEY ("characterRunId") REFERENCES "CharacterRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
