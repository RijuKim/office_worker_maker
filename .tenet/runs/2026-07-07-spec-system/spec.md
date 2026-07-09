---
delivery_mode: autonomous
---

# Spec: 스펙 시스템 (Credential/Spec System)

## Purpose

Add a credential/spec system (스펙) to the college career simulation game, where characters build internships, language scores, portfolios, and certifications during 3rd-4th year, then go through a realistic Korean job-seeking process (서류→인적성→코테→면접→최종합격) with company-type-specific screening stages. Add career-path tracks for 4th-year major events (워홀, 임용, 회계사, 로스쿨, 변리사, 메디컬 편입). Change the event system so choice results flow into the next event's opening narrative instead of appearing as separate result screens. Reflect Korean job-seeking reality (blind hiring, spec-overcoming, burnout, fatigue, financial burden) as gameplay mechanics.

## Tech Stack

- Next.js 16.2.10 App Router with TypeScript route handlers under `app/api/**/route.ts`.
- React 19.2.7 client UI in `app/page.tsx`.
- Prisma 7.8.0 with PostgreSQL/Neon; existing schema in `prisma/schema.prisma`.
- NextAuth 4.24.14 through existing server session helpers in `lib/server/session.ts` and API route guards.
- OpenRouter via existing `lib/game/openrouter.ts`.
- Vercel production deployment, Node `>=20.9` from `package.json`.

## Database Schema Changes

### New Enum: `SpecType`
```prisma
enum SpecType {
  INTERNSHIP
  LANGUAGE_SCORE
  PORTFOLIO
  CERTIFICATION
  EXAM_PREP
  CAREER_PATH
}
```

### New Enum: `SpecStatus`
```prisma
enum SpecStatus {
  IN_PROGRESS
  COMPLETED
  FAILED
}
```

### New Enum: `ApplicationStage`
```prisma
enum ApplicationStage {
  DOCUMENT
  PERSONALITY_TEST
  CODING_TEST
  FIRST_INTERVIEW
  SECOND_INTERVIEW
  FINAL_RESULT
}
```

### New Model: `Spec`
```prisma
model Spec {
  id             String       @id @default(uuid())
  characterRunId String
  specType       SpecType
  specName       String       // e.g. "TOEIC", "인턴 (6개월)", "공모전 수상"
  status         SpecStatus   @default(IN_PROGRESS)
  score          String?      // e.g. "900", "합격", "6개월"
  startedAt      DateTime     @default(now())
  completedAt    DateTime?
  eventFlags     Json         @default("{}")  // spec-specific flags
  characterRun   CharacterRun @relation(fields: [characterRunId], references: [id], onDelete: Cascade)
}
```

### New Model: `JobApplication`
```prisma
model JobApplication {
  id                String            @id @default(uuid())
  characterRunId    String
  companyName       String            // fictional parody company name
  companyType       String            // "대기업" | "스타트업" | "공기업" | "전문직" | "외국계"
  currentStage      ApplicationStage  @default(DOCUMENT)
  stageResults      Json              @default("[]")  // [{stage, passed, note}]
  specScore         Int               @default(0)     // calculated from specs
  documentPassed    Boolean?
  personalityPassed Boolean?
  codingTestPassed  Boolean?
  firstInterviewPassed Boolean?
  secondInterviewPassed Boolean?
  finalResult       Boolean?          // true=합격, false=불합격
  isActive          Boolean           @default(true)
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt
  characterRun      CharacterRun      @relation(fields: [characterRunId], references: [id], onDelete: Cascade)
}
```

### New Model: `CareerPath`
```prisma
model CareerPath {
  id                String       @id @default(uuid())
  characterRunId    String
  pathType          String       // "WORKING_HOLIDAY" | "TEACHER_EXAM" | "CPA" | "LAW_SCHOOL" | "PATENT_ATTORNEY" | "MEDICAL_TRANSFER"
  pathName          String       // e.g. "워킹홀리데이", "임용고시", "회계사", "로스쿨", "변리사", "메디컬 편입"
  status            String       // "PREPARING" | "IN_PROGRESS" | "PASSED" | "FAILED" | "ABANDONED"
  startedAt         DateTime     @default(now())
  completedAt       DateTime?
  eventFlags        Json         @default("{}")
  characterRun      CharacterRun @relation(fields: [characterRunId], references: [id], onDelete: Cascade)
}
```

### CharacterRun Changes
Add field:
```
specScore        Int      @default(0)  // aggregate spec score for job applications
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/characters/:id/specs` | owner | Start a new spec (e.g. "TOEIC 준비 시작") |
| GET | `/api/characters/:id/specs` | owner | List character's specs |
| POST | `/api/characters/:id/specs/:specId/complete` | owner | Complete/fail a spec (triggered by event resolution) |
| POST | `/api/characters/:id/job-applications` | owner | Apply to a company (creates JobApplication) |
| GET | `/api/characters/:id/job-applications` | owner | List job applications with stage status |
| POST | `/api/characters/:id/job-applications/:appId/advance` | owner | Advance to next stage (triggered by event) |
| POST | `/api/characters/:id/career-paths` | owner | Start a career path (워홀/임용/회계사 등) |
| GET | `/api/characters/:id/career-paths` | owner | List career paths |

## Event System Change: Choice Result Integration

**Current behavior**: When a player makes a choice, the response shows `summary` (narrative text) + stat delta labels, then the next event loads separately.

**New behavior**: When a player makes a choice:
1. The choice is persisted (stat/relationship/flag deltas applied).
2. The response returns stat delta labels (e.g. `{ statDelta: { academic: 5, mental: -2 } }`) — **these stat change labels are KEPT visible** so the player can see what changed.
3. The narrative `summary` text is **removed** from the choice response — it no longer appears as a separate result screen.
4. Instead, the next event's `body` (narrative text) **begins with a natural narrative reference to the previous choice's outcome**.
5. The event engine (`lib/game/event-engine.ts`) must be extended so that `selectNextEvent` can optionally prepend a "previous choice consequence" paragraph to the event body.

This applies to ALL events, not just spec-related ones. The `EventSelectionContext` gains a `previousChoiceSummary` field.

### Implementation approach:
- In `app/api/characters/[id]/choices/route.ts`: keep `statDelta` in the response, but **remove `summary`** from the response. Return `{ eventResolved: true, statDelta, endingTriggered, resultType, lifeStage }`.
- In `app/api/characters/[id]/events/next/route.ts`: when selecting the next event, read the most recent `EventHistory` entry and pass its `summary` to the event engine.
- In `lib/game/event-engine.ts`: add a `previousChoiceSummary` field to `EventSelectionContext`. When present, the selected event's body gets a prepended paragraph like: `"지난 선택의 결과, {summary}. 그리고..."` (AI-generated events will naturally incorporate this; static events get a prepended narrative bridge).
- The `selectNextEvent` function returns the event with the prepended narrative.

## Spec System Details

### Spec Types and Examples
- **INTERNSHIP**: "스타트업 인턴 (3개월)", "대기업 인턴 (6개월)" - requires application event
- **LANGUAGE_SCORE**: "TOEIC 900", "TOEFL 100", "HSK 5급", "JLPT N1" - requires exam event sequence (2-step: 접수 → 결과)
- **PORTFOLIO**: "공모전 수상", "동아리 프로젝트", "학회 논문" - requires activity event
- **CERTIFICATION**: "정보처리기사", "한국사 1급", "MOS Master" - requires study event
- **EXAM_PREP**: "고시 준비", "공기업 필기" - ongoing prep event
- **CAREER_PATH**: "워홀 준비", "임용 준비" - major 4th-year track

### Spec Event Flow (2-step)
1. **Step 1 - Initiation**: Player encounters a spec-related event choice (e.g. "토익 시험 접수하기"). Choosing it creates a `Spec` record with `IN_PROGRESS` status.
2. **Step 2 - Resolution**: The next event's narrative naturally incorporates the spec outcome (e.g. "접수했던 토익 시험 결과가 나왔다..."). The event's flagDelta triggers `Spec` completion with score.

### Spec Score Calculation
Each completed spec contributes to the character's aggregate `specScore`:
- INTERNSHIP: +10-30 (duration-based)
- LANGUAGE_SCORE: +5-25 (score-based, e.g. TOEIC 900=+20)
- PORTFOLIO: +5-20 (quality-based)
- CERTIFICATION: +5-15 (difficulty-based)
- EXAM_PREP: +3-10 (progress-based)

## Job Application Process (6-Stage)

### Company Types and Their Stages
| Company Type | Stages | Notes |
|---|---|---|
| **대기업** | 서류 → 인적성(GSAT) → 코딩테스트 → 1차면접(실무) → 2차면접(임원) → 최종합격 | Full 6 stages |
| **스타트업** | 서류 → 1차면접 → 2차면접 → 최종합격 | 4 stages, no 인적성/코테 |
| **공기업** | 서류 → NCS필기 → 1차면접 → 2차면접 → 최종합격 | 5 stages, NCS instead of 코테 |
| **전문직** | 서류 → 1차면접 → 최종합격 | 3 stages |
| **외국계** | 서류 → 영어면접 → 코딩테스트 → 최종면접 → 최종합격 | 5 stages |

### Stage Mechanics
- **서류 (Document)**: Pass rate based on `specScore` + `academic` stat + `practical` stat. Higher spec score = higher pass rate.
- **인적성 (Personality Test)**: Based on `mental` + `reputation` stats. Random element included (blind hiring element).
- **코딩테스트 (Coding Test)**: Based on `practical` + `academic` stats.
- **1차면접 (First Interview)**: Based on `communication` + `charm` + `practical` stats.
- **2차면접 (Second Interview)**: Based on `reputation` + `mental` + `charm` stats.
- **최종합격 (Final Result)**: Aggregate score + random factor (spec-overcoming luck element).

### Korean Job-Seeking Reality Mechanics
- **Spec Fatigue**: Each job application attempt increases `burnoutRisk`. Multiple rejections add `riskDebt`.
- **Blind Hiring**: Some stages have a hidden random factor that can override stat-based pass/fail (representing blind hiring's unpredictability).
- **Spec-Overcoming**: Low spec score but high relevant stats can still pass (representing "스펙 초월 합격").
- **Financial Burden**: Application fees, exam prep costs reduce `wealth`.
- **Mental Health**: Repeated failures trigger mental stat checks; low mental can force a break/career path change.

## Career Paths (4th Year Major Events)

| Path | Requirements | Gameplay |
|---|---|---|
| **워킹홀리데이** | `wealth >= 4`, `mental >= 4` | Series of events: 준비 → 출국 → 생활 → 귀국/정착 |
| **임용고시** | `academic >= 6`, major must be 교육학과 | Events: 교생실습 → 필기시험 → 면접 → 합격/불합격 |
| **회계사(CPA)** | `academic >= 7`, `mental >= 6` | Events: 수험준비 → 1차시험 → 2차시험 → 합격/불합격 |
| **로스쿨** | `academic >= 7`, `communication >= 5` | Events: LEET준비 → LEET응시 → 로스쿨진학 → 변호사시험 |
| **변리사** | `academic >= 7`, `practical >= 5` | Events: 시험준비 → 1차 → 2차 → 합격/불합격 |
| **메디컬 편입** | `academic >= 8`, `health >= 6`, `wealth >= 5` | Events: 편입준비 → 필기 → 면접 → 합격/불합격 |

Each career path is a series of 3-5 events. Success/failure is determined by stats + choices made during the path events. Success creates a `CareerEndingRecord` with the path name. Failure routes back to general job-seeking.

## Event Engine Changes

### New Event Selection Context Fields
```typescript
interface EventSelectionContext {
  // ... existing fields
  previousChoiceSummary?: string;  // NEW: summary of the most recent choice
  specs?: { specType: string; specName: string; status: string; score?: string }[];  // NEW
  jobApplications?: { companyName: string; currentStage: string; isActive: boolean }[];  // NEW
  careerPaths?: { pathType: string; status: string }[];  // NEW
}
```

### New Static Events
Add 15+ new static events for:
- Spec initiation events (TOEIC 접수, 인턴 지원, 공모전 참가)
- Spec resolution events (시험 결과, 인턴 종료, 공모전 결과)
- Job application stage events (서류 합격/불합격, 인적성, 코테, 면접)
- Career path events (워홀 준비, 임용 시험, 회계사 시험)
- Korean job-seeking reality events (취준 우울, 스펙 초월 합격, 블라인드 채용 반전)

### Conditional Events for Spec/Job/Career
Add conditional events that trigger based on:
- `requiredSpecs`: character has certain specs
- `requiredApplicationStage`: job application at specific stage
- `requiredCareerPath`: character started a career path
- `specScoreBelow/Above`: spec score thresholds

## Design Direction

Use existing `.tenet/project/design.md`: Korean text-adventure, compact side panels, narrative-first, restrained cards, mobile single-column behavior.

New UI elements:
- **Spec Panel**: Shows current specs with progress status, accessible from character sidebar
- **Job Application Panel**: Shows active applications with stage progress bars
- **Career Path Panel**: Shows active career path with step indicators
- **Spec Score Display**: Aggregate spec score shown in character stats area

## Auth Flow

Same as existing: NextAuth credentials, `requireCurrentUserId()` guard on all new API routes, owner-scoped queries.

## Success Criteria

1. Player can start a spec (e.g. "TOEIC 접수") through an event choice, and a `Spec` record is created.
2. After 1-2 events, the spec resolves (e.g. "TOEIC 결과 900점") and the score is recorded.
3. Player can apply to companies; a `JobApplication` is created with company-type-specific stages.
4. Job application stages advance through events; each stage has stat-based pass/fail logic.
5. Player can start a career path (워홀/임용/회계사/로스쿨/변리사/메디컬편입) in 4th year.
6. Career path success creates an ending record; failure routes back to job-seeking.
7. Choice results show stat delta labels (e.g. `+5 학업, -2 멘탈`) but the narrative summary text no longer appears as a separate screen — it flows into the next event's opening narrative.
8. Korean job-seeking reality mechanics (spec fatigue, blind hiring, spec-overcoming, financial burden, mental health) are implemented as gameplay systems.
9. Spec score affects job application document pass rates.
10. All new Prisma models have migrations and are owner-scoped.
11. Unit tests cover spec score calculation, job application stage logic, career path eligibility, and event narrative prepending.

## Out of Scope

- Real company names or real exam score systems (all fictional/parody).
- Social login.
- Payments.
- Admin tools.
- Native mobile/Unity clients.
- Full illustration system.
