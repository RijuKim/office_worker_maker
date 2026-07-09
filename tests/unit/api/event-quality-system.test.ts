import { describe, expect, it } from "vitest";

import {
  evaluateEventQuality,
  inferThreadLifecycle,
  stripNumericStatExposure,
} from "@/lib/game/event-quality";

describe("event quality system acceptance", () => {
  it.each([
    "밴드 동아리에서 제명되었다.",
    "밴드 동아리에서 탈락했다.",
    "밴드 동아리에서 강제로 나갔다.",
    "밴드 동아리에서 강제로 나가게 되었다.",
    "밴드 동아리에서 거절당했다.",
    "밴드 동아리에서 내보내졌다.",
    "밴드 동아리에서 제외되었다.",
    "밴드 동아리에서 방출되었다.",
    "밴드 동아리에서 쫓겨났다.",
    "밴드 동아리에서 퇴출되었다.",
  ])("closes the original accepted flag-backed thread from terminal Korean summary: %s", (summary) => {
    const lifecycle = inferThreadLifecycle({
      eventFlags: {
        campusBand: "accepted",
      },
      recentSummaries: [summary],
    });

    expect(lifecycle.closedThreads).toContain("campusBand");
    expect(lifecycle.activeThreads).not.toContain("campusBand");
  });

  it("keeps accepted-but-closed activity as history, not an active invitation", () => {
    const verdict = evaluateEventQuality({
      source: "AI",
      candidate: {
        title: "전시 독서모임의 새 초대",
        body: "지난번에 그만둔 전시 독서모임에서 다시 같은 방식으로 참여해보지 않겠냐고 묻는다.",
        tags: ["외부모임", "독서", "관계"],
        choices: [
          {
            id: "join_again",
            label: "다시 같은 전시 독서모임에 참여한다.",
            summary: "당신은 그만둔 모임에 다시 참여하기로 했다.",
            statDelta: { charm: 1 },
            relationshipDelta: [],
          },
          {
            id: "decline_again",
            label: "이번에도 거절한다.",
            summary: "당신은 이미 닫힌 모임 제안을 다시 거절했다.",
            statDelta: { mental: 1 },
            relationshipDelta: [],
          },
        ],
      },
      context: {
        lifeStage: "college_mid",
        academicStatus: "ENROLLED",
        eventFlags: {
          outsideReadingClub: "accepted",
          outsideReadingClubParticipation: "low_participation",
          outsideReadingClubClosure: "quit",
        },
        recentSummaries: [
          "전시 독서모임에 가입했지만 몇 번 빠진 뒤 결국 그만두었다.",
        ],
        recentEvents: [],
      },
    });

    expect(verdict.status).toBe("fail");
    expect(verdict.hardFailure).toBe(true);
    expect(verdict.reasons).toContain("closed_thread_repeat");
  });

  it("rejects forced expulsion as a player-selected outcome", () => {
    const verdict = evaluateEventQuality({
      source: "AI",
      candidate: {
        title: "동아리 운영 회의",
        body: "동아리 운영진이 최근 갈등을 논의한다.",
        tags: ["동아리", "관계"],
        choices: [
          {
            id: "expelled",
            label: "동아리에서 강제로 나가게 된다.",
            summary: "당신은 운영진 결정으로 나간다.",
            statDelta: { mental: -1 },
            relationshipDelta: [],
          },
          {
            id: "feedback",
            label: "운영진에게 개선 기준을 물어본다.",
            summary: "당신은 남은 가능성을 확인했다.",
            statDelta: { reputation: 1 },
            relationshipDelta: [],
          },
        ],
      },
      context: { lifeStage: "college_mid", academicStatus: "ENROLLED", eventFlags: {}, recentEvents: [] },
    });

    expect(verdict.status).toBe("fail");
    expect(verdict.reasons).toContain("direct_lifecycle_outcome_choice");
  });

  it("allows voluntary quit wording as a player action", () => {
    const verdict = evaluateEventQuality({
      source: "AI",
      candidate: {
        title: "동아리 활동 정리",
        body: "이번 학기 일정이 겹쳐 동아리 활동을 계속할지 정해야 한다.",
        tags: ["동아리", "관계"],
        choices: [
          {
            id: "quit",
            label: "자발적으로 동아리를 그만둔다.",
            summary: "당신은 활동을 정리하고 남은 일정을 비웠다.",
            statDelta: { mental: 1 },
            relationshipDelta: [],
          },
          {
            id: "reduce",
            label: "운영진과 역할을 줄이는 방안을 상의한다.",
            summary: "당신은 부담을 낮추는 방식으로 조율했다.",
            statDelta: { reputation: 1 },
            relationshipDelta: [],
          },
        ],
      },
      context: {
        academicStatus: "ENROLLED",
        eventFlags: {
          campusBand: "accepted",
        },
        recentEvents: [],
        recentSummaries: [],
      },
    });

    expect(verdict.status).toBe("pass");
    expect(verdict.reasons).not.toContain("direct_lifecycle_outcome_choice");
  });

  it("allows a lifecycle closure consequence for an accepted low-participation activity", () => {
    const verdict = evaluateEventQuality({
      source: "AI",
      candidate: {
        title: "스터디 퇴출 통보",
        body: "최근 참여율이 낮았던 취업 스터디에서 운영진이 이번 주를 끝으로 함께하기 어렵겠다고 알린다.",
        tags: ["스터디", "취업", "관계"],
        choices: [
          {
            id: "accept_exit",
            label: "상황을 받아들이고 남은 자료를 정리한다.",
            summary: "당신은 스터디에서 빠진 뒤 혼자 계획을 다시 세웠다.",
            statDelta: { mental: -1, practical: 1 },
            relationshipDelta: [],
          },
          {
            id: "ask_feedback",
            label: "마지막으로 부족했던 점을 물어본다.",
            summary: "당신은 불편한 통보를 피하지 않고 피드백을 들었다.",
            statDelta: { mental: -1, reputation: 1 },
            relationshipDelta: [],
          },
        ],
      },
      context: {
        lifeStage: "college_late",
        academicStatus: "ENROLLED",
        eventFlags: {
          jobStudyGroup: "accepted",
          jobStudyGroupParticipation: "low_participation",
        },
        recentSummaries: [
          "취업 스터디에 참여했지만 과제 제출과 출석이 계속 밀렸다.",
        ],
        recentEvents: [
          { title: "스터디 첫 주", tags: ["스터디", "취업"], people: ["스터디 운영진"] },
        ],
      },
    });

    expect(verdict.status).toBe("pass");
    expect(verdict.continuityExemptions).toContain("lifecycle_closure");
  });

  it("removes numeric stat exposure from result prose", () => {
    expect(stripNumericStatExposure("학점 10의 지식은 빛났지만 네트워크 3의 현실이었다.")).toBe(
      "탄탄한 학업 기반은 빛났지만 관계망의 현실이었다.",
    );
  });
});
