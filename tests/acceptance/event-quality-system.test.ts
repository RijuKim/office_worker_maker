import { describe, expect, it } from "vitest";

import {
  evaluateEventQuality,
  inferThreadLifecycle,
  stripNumericStatExposure,
} from "@/lib/game/event-quality";

describe("event quality system acceptance", () => {
  it("slice 1: keeps accepted-but-closed activity as history, not an active invitation", () => {
    const lifecycle = inferThreadLifecycle({
      eventFlags: {
        outsideReadingClub: "accepted",
        outsideReadingClubParticipation: "low_participation",
        outsideReadingClubClosure: "quit",
      },
      recentSummaries: [
        "전시 독서모임에 가입했지만 몇 번 빠진 뒤 결국 그만두었다.",
      ],
    });

    expect(lifecycle.closedThreads).toContain("outsideReadingClub");
    expect(lifecycle.activeThreads).not.toContain("outsideReadingClub");

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

  it("slice 1: blocks neutral reissued offers for closed proposals", () => {
    const verdict = evaluateEventQuality({
      source: "AI",
      candidate: {
        title: "공모전 팀 구성",
        body: "공모전 팀을 꾸려 기획서와 발표 역할을 나눌 사람을 모은다.",
        tags: ["공모전", "팀"],
        choices: [
          {
            id: "join",
            label: "팀 구성에 참여한다.",
            summary: "당신은 공모전 팀에 합류했다.",
            statDelta: { practical: 1 },
            relationshipDelta: [],
          },
          {
            id: "skip",
            label: "이번 일정은 맡지 않는다.",
            summary: "당신은 공모전 대신 다른 일정을 택했다.",
            statDelta: { mental: 1 },
            relationshipDelta: [],
          },
        ],
      },
      context: {
        lifeStage: "college_mid",
        academicStatus: "ENROLLED",
        eventFlags: {
          contestSkipped: true,
        },
        recentSummaries: ["공모전 제안을 거절하고 다른 일정에 집중했다."],
        recentEvents: [],
      },
    });

    expect(verdict.status).toBe("fail");
    expect(verdict.reasons).toContain("closed_thread_repeat");
  });

  it("slice 1: closes flag-backed Korean activity threads from recent history", () => {
    const lifecycle = inferThreadLifecycle({
      eventFlags: {
        campusBand: "accepted",
      },
      recentSummaries: ["밴드 동아리에서 퇴출되었다."],
    });

    expect(lifecycle.closedThreads).toContain("campusBand");
    expect(lifecycle.activeThreads).not.toContain("campusBand");
  });

  it("slice 1: allows a lifecycle closure consequence for an accepted activity", () => {
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

  it("slice 1: rejects direct pass/fail choices before persistence", () => {
    const verdict = evaluateEventQuality({
      source: "AI",
      candidate: {
        title: "서류 결과 확인",
        body: "지원한 회사의 서류 결과가 도착했다.",
        tags: ["취업", "서류"],
        choices: [
          {
            id: "pass",
            label: "서류 합격을 선택한다.",
            summary: "당신은 서류 합격을 골랐다.",
            statDelta: { reputation: 1 },
            relationshipDelta: [],
          },
          {
            id: "fail",
            label: "불합격한다.",
            summary: "당신은 불합격을 골랐다.",
            statDelta: { mental: -1 },
            relationshipDelta: [],
          },
        ],
      },
      context: { lifeStage: "college_late", academicStatus: "ENROLLED", eventFlags: {}, recentEvents: [] },
    });

    expect(verdict.status).toBe("fail");
    expect(verdict.hardFailure).toBe(true);
    expect(verdict.reasons).toContain("direct_result_choice");
  });

  it("slice 1: rejects forced expulsion as a player-selected outcome", () => {
    const verdict = evaluateEventQuality({
      source: "AI",
      candidate: {
        title: "동아리 운영 회의",
        body: "동아리 운영진이 최근 갈등을 논의한다.",
        tags: ["동아리", "관계"],
        choices: [
          {
            id: "expelled",
            label: "동아리에서 퇴출된다.",
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

  it("slice 2: removes numeric stat exposure from result prose", () => {
    expect(stripNumericStatExposure("학점 10의 지식은 빛났지만 네트워크 3의 현실이었다.")).toBe(
      "탄탄한 학업 기반은 빛났지만 관계망의 현실이었다.",
    );
  });
});
