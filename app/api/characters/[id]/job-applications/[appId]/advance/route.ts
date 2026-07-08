import { NextResponse } from "next/server";

import {
  calculateFinancialBurden,
  calculateSpecFatigue,
  evaluateCodingTest,
  evaluateDocumentStage,
  evaluateFinalResult,
  evaluateFirstInterview,
  evaluatePersonalityTest,
  evaluateSecondInterview,
  getCompanyStages,
  type StageEvaluation,
} from "@/lib/game/spec-system";
import { prisma } from "@/lib/server/prisma";
import { requireCurrentUserId } from "@/lib/server/session";
import { logger } from "@/lib/server/logger";

type RouteContext = { params: Promise<{ id: string; appId: string }> };

type ApplicationStageValue =
  | "DOCUMENT"
  | "PERSONALITY_TEST"
  | "CODING_TEST"
  | "FIRST_INTERVIEW"
  | "SECOND_INTERVIEW"
  | "FINAL_RESULT";

type StageResult = {
  stage: string;
  passed: boolean;
  score: number;
  evaluatedAt: string;
};

const STAGE_TO_FIELD: Record<string, string> = {
  DOCUMENT: "documentPassed",
  PERSONALITY_TEST: "personalityPassed",
  CODING_TEST: "codingTestPassed",
  FIRST_INTERVIEW: "firstInterviewPassed",
  SECOND_INTERVIEW: "secondInterviewPassed",
  FINAL_RESULT: "finalResult",
};

export async function POST(request: Request, context: RouteContext) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const log = logger.withRequestId(requestId);
  const userId = await requireCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id, appId } = await context.params;

  const character = await prisma.characterRun.findFirst({
    where: { id, userId },
    include: {
      stats: true,
      hiddenState: true,
    },
  });

  if (!character) {
    return NextResponse.json({ error: "캐릭터를 찾을 수 없습니다." }, { status: 404 });
  }

  if (!character.stats || !character.hiddenState) {
    return NextResponse.json({ error: "캐릭터 데이터가 불완전합니다." }, { status: 500 });
  }

  const application = await prisma.jobApplication.findFirst({
    where: { id: appId, characterRunId: id },
  });

  if (!application) {
    return NextResponse.json({ error: "지원서를 찾을 수 없습니다." }, { status: 404 });
  }

  if (!application.isActive) {
    return NextResponse.json({ error: "이미 종료된 지원 전형입니다." }, { status: 400 });
  }

  const stages = getCompanyStages(application.companyType);
  const currentStage = application.currentStage;
  const currentIndex = stages.indexOf(currentStage);

  if (currentIndex === -1) {
    return NextResponse.json({ error: "현재 단계를 확인할 수 없습니다." }, { status: 500 });
  }

  const stats = character.stats;
  const previousResults = Array.isArray(application.stageResults)
    ? (application.stageResults as StageResult[])
    : [];
  const previousScoreTotal = previousResults.reduce(
    (sum, result) => sum + (typeof result.score === "number" ? result.score : 0),
    0,
  );

  let evaluation: StageEvaluation;
  switch (currentStage) {
    case "DOCUMENT":
      evaluation = evaluateDocumentStage(
        application.specScore,
        stats.academic,
        stats.practical,
      );
      break;
    case "PERSONALITY_TEST":
      evaluation = evaluatePersonalityTest(stats.mental, stats.reputation);
      break;
    case "CODING_TEST":
      evaluation = evaluateCodingTest(stats.practical, stats.academic);
      break;
    case "FIRST_INTERVIEW":
      evaluation = evaluateFirstInterview(
        stats.communication,
        stats.charm,
        stats.practical,
      );
      break;
    case "SECOND_INTERVIEW":
      evaluation = evaluateSecondInterview(
        stats.reputation,
        stats.mental,
        stats.charm,
      );
      break;
    case "FINAL_RESULT":
      evaluation = evaluateFinalResult(previousScoreTotal);
      break;
    default:
      return NextResponse.json({ error: "지원 단계를 처리할 수 없습니다." }, { status: 500 });
  }

  const nextIndex = currentIndex + 1;
  const isTerminal = currentStage === "FINAL_RESULT" || !evaluation.passed || nextIndex >= stages.length;
  const nextStage = (evaluation.passed && nextIndex < stages.length ? stages[nextIndex] : currentStage) as ApplicationStageValue;

  const stageResult: StageResult = {
    stage: currentStage,
    passed: evaluation.passed,
    score: evaluation.score,
    evaluatedAt: new Date().toISOString(),
  };
  const updatedResults = [...previousResults, stageResult];

  const stageField = STAGE_TO_FIELD[currentStage];
  const stageFieldUpdate: Record<string, boolean> = stageField
    ? { [stageField]: evaluation.passed }
    : {};

  const rejections = updatedResults.filter((result) => !result.passed).length;
  const nextBurnoutRisk = calculateSpecFatigue(character.hiddenState.burnoutRisk, rejections);
  const nextWealth = calculateFinancialBurden(stats.wealth, application.companyType);

  const [updatedApplication] = await prisma.$transaction([
    prisma.jobApplication.update({
      where: { id: appId },
      data: {
        currentStage: nextStage,
        stageResults: updatedResults as object,
        isActive: !isTerminal,
        ...stageFieldUpdate,
      },
    }),
    prisma.hiddenState.update({
      where: { characterRunId: id },
      data: { burnoutRisk: nextBurnoutRisk },
    }),
    prisma.characterStats.update({
      where: { characterRunId: id },
      data: { wealth: nextWealth },
    }),
  ]);

  log.info("지원 전형 진행", {
    userId,
    characterId: id,
    applicationId: appId,
    stage: currentStage,
    passed: evaluation.passed,
    nextStage,
    isTerminal,
  });

  return NextResponse.json({
    application: updatedApplication,
    stageResult,
    burnoutRisk: nextBurnoutRisk,
    wealth: nextWealth,
  });
}
