import { describe, expect, it } from "vitest";

import {
  EVENT_QUALITY_DEFAULTS,
  evaluateEventQuality,
  inferThreadLifecycle,
  stripNumericStatExposure,
} from "@/lib/game/event-quality";

describe("inferThreadLifecycle", () => {
  it("keeps accepted activities active before terminal evidence", () => {
    const lifecycle = inferThreadLifecycle({
      eventFlags: {
        jobStudyGroup: "accepted",
      },
      recentSummaries: ["취업 스터디에 참여하며 첫 과제를 받았다."],
    });

    expect(lifecycle.activeThreads).toContain("jobStudyGroup");
    expect(lifecycle.closedThreads).not.toContain("jobStudyGroup");
  });

  it("moves accepted activities through low participation to quit", () => {
    const lifecycle = inferThreadLifecycle({
      eventFlags: {
        outsideReadingClub: "accepted",
        outsideReadingClubParticipation: "low_participation",
        outsideReadingClubClosure: "quit",
      },
      recentSummaries: ["전시 독서모임에 가입했지만 몇 번 빠진 뒤 결국 그만두었다."],
    });

    expect(lifecycle.lowParticipationThreads).not.toContain("outsideReadingClub");
    expect(lifecycle.closedThreads).toContain("outsideReadingClub");
    expect(lifecycle.activeThreads).not.toContain("outsideReadingClub");
    expect(lifecycle.threads.outsideReadingClub.state).toBe("quit");
  });

  it("treats expulsion and completion flags as closed history", () => {
    const lifecycle = inferThreadLifecycle({
      eventFlags: {
        campusBand: "accepted",
        campusBandExpelled: true,
        contestTeam: "accepted",
        contestTeamCompleted: true,
      },
    });

    expect(lifecycle.closedThreads).toEqual(expect.arrayContaining(["campusBand", "contestTeam"]));
    expect(lifecycle.activeThreads).not.toContain("campusBand");
    expect(lifecycle.activeThreads).not.toContain("contestTeam");
  });

  it("uses Korean summary evidence to close the original accepted flag-backed thread", () => {
    const lifecycle = inferThreadLifecycle({
      eventFlags: {
        campusBand: "accepted",
      },
      recentSummaries: ["밴드 동아리에서 퇴출되었다."],
    });

    expect(lifecycle.closedThreads).toContain("campusBand");
    expect(lifecycle.activeThreads).not.toContain("campusBand");
    expect(lifecycle.threads.campusBand.state).toBe("expelled");
  });
});

describe("evaluateEventQuality lifecycle closure", () => {
  const validChoices = [
    {
      id: "focus",
      label: "상황을 살피고 다음 행동을 정한다.",
      summary: "당신은 무리하지 않고 상황을 정리했다.",
      statDelta: { mental: 1 },
      relationshipDelta: [],
    },
    {
      id: "ask",
      label: "관련된 사람에게 조언을 구한다.",
      summary: "당신은 조언을 듣고 판단 근거를 늘렸다.",
      statDelta: { reputation: 1 },
      relationshipDelta: [],
    },
  ];

  it("exports the centralized scorecard defaults from the spec", () => {
    expect(EVENT_QUALITY_DEFAULTS).toEqual({
      recentEventLookback: 5,
      strongRepeatLookback: 3,
      hardRetryThreshold: 60,
    });
  });

  it("rejects ordinary enrolled campus life for dropout characters", () => {
    const verdict = evaluateEventQuality({
      source: "AI",
      candidate: {
        title: "전공 수업 과제",
        body: "자퇴한 뒤인데도 평소처럼 강의실에 출석해 이번 학기 전공 수업 과제를 제출해야 한다.",
        tags: ["학업", "강의"],
        choices: validChoices,
      },
      context: {
        academicStatus: "DROPPED_OUT",
        recentEvents: [],
      },
    });

    expect(verdict.status).toBe("fail");
    expect(verdict.hardFailure).toBe(true);
    expect(verdict.reasons).toContain("academic_conflict");
  });

  it("allows dropout paperwork and outside study contact instead of ordinary enrollment", () => {
    const verdict = evaluateEventQuality({
      source: "AI",
      candidate: {
        title: "자퇴 서류 확인",
        body: "학교 행정실에서 자퇴 서류와 재입학 상담 가능 시점을 확인하고, 학교 밖 온라인 강의 계획을 세운다.",
        tags: ["행정", "진로"],
        choices: validChoices,
      },
      context: {
        academicStatus: "DROPPED_OUT",
        recentEvents: [],
      },
    });

    expect(verdict.status).toBe("pass");
    expect(verdict.reasons).not.toContain("academic_conflict");
  });

  it("rejects malformed choices with invalid relationship delta shape", () => {
    const verdict = evaluateEventQuality({
      source: "AI",
      candidate: {
        title: "상담 약속",
        body: "선배가 진로 이야기를 들어주겠다고 한다.",
        tags: ["진로", "관계"],
        choices: [
          {
            id: "meet",
            label: "약속 장소로 간다.",
            summary: "당신은 선배를 만났다.",
            statDelta: { practical: 1 },
            relationshipDelta: [{ name: "선배", trust: "높음" }],
          },
          validChoices[1],
        ],
      },
      context: { academicStatus: "ENROLLED", recentEvents: [] },
    });

    expect(verdict.status).toBe("fail");
    expect(verdict.hardFailure).toBe(true);
    expect(verdict.reasons).toContain("malformed_event");
  });

  it("rejects ordinary AI health or mental drops below minus one", () => {
    const verdict = evaluateEventQuality({
      source: "AI",
      candidate: {
        title: "무리한 밤샘",
        body: "친구가 오늘 밤 모든 일을 끝내자고 한다.",
        tags: ["학업", "압박"],
        choices: [
          {
            id: "all_night",
            label: "밤을 새워 밀어붙인다.",
            summary: "당신은 무리하게 일을 끝냈다.",
            statDelta: { health: -2, academic: 1 },
            relationshipDelta: [],
          },
          validChoices[0],
        ],
      },
      context: { academicStatus: "ENROLLED", recentEvents: [] },
    });

    expect(verdict.status).toBe("fail");
    expect(verdict.reasons).toContain("health_mental_delta_violation");
  });

  it("rejects numeric stat exposure in event and choice text", () => {
    const verdict = evaluateEventQuality({
      source: "AI",
      candidate: {
        title: "평가표",
        body: "상담자는 학점 10과 네트워크 3이 결과를 갈랐다고 말한다.",
        tags: ["진로", "상담"],
        choices: validChoices,
      },
      context: { academicStatus: "ENROLLED", recentEvents: [] },
    });

    expect(verdict.status).toBe("fail");
    expect(verdict.reasons).toContain("numeric_stat_exposure");
  });

  it("fails stale repeated study events by score without marking them as hard failures", () => {
    const verdict = evaluateEventQuality({
      source: "AI",
      candidate: {
        title: "도서관 스터디",
        body: "오늘도 도서관에서 같은 스터디와 강의 과제를 정리한다.",
        tags: ["학업", "스터디"],
        choices: validChoices,
      },
      context: {
        academicStatus: "ENROLLED",
        recentEvents: [
          { title: "도서관 공부", body: "도서관에서 스터디를 했다.", tags: ["학업", "스터디"] },
          { title: "강의 과제", body: "도서관에서 과제를 했다.", tags: ["학업", "스터디"] },
          { title: "스터디 복습", body: "도서관에서 복습했다.", tags: ["학업", "스터디"] },
          { title: "수업 준비", body: "도서관에서 수업 내용을 정리했다.", tags: ["학업"] },
          { title: "조용한 공부", body: "도서관에서 공부했다.", tags: ["학업"] },
        ],
      },
    });

    expect(verdict.status).toBe("fail");
    expect(verdict.hardFailure).toBe(false);
    expect(verdict.diversityScore).toBeLessThan(EVENT_QUALITY_DEFAULTS.hardRetryThreshold);
    expect(verdict.reasons).toContain("low_diversity_score");
  });

  it("allows job process continuation with a continuity exemption despite repeated company tags", () => {
    const verdict = evaluateEventQuality({
      source: "AI",
      candidate: {
        title: "채용 인성검사 안내",
        body: "지난 서류 지원을 통과한 회사가 다음 단계로 인성검사 일정을 보낸다.",
        tags: ["취업", "회사", "서류"],
        choices: validChoices,
      },
      context: {
        academicStatus: "ENROLLED",
        recentSummaries: ["회사 서류 지원을 마치고 결과를 기다렸다."],
        recentEvents: [
          { title: "회사 서류 지원", body: "채용 서류를 제출했다.", tags: ["취업", "회사", "서류"] },
          { title: "지원서 수정", body: "회사 지원서를 고쳤다.", tags: ["취업", "회사"] },
        ],
      },
    });

    expect(verdict.status).toBe("pass");
    expect(verdict.diversityScore).toBe(100);
    expect(verdict.continuityExemptions).toContain("job_application");
  });

  it("strips numeric stat exposure examples from narrative prose", () => {
    expect(stripNumericStatExposure("학점 10의 지식과 academic: 7, 건강 6, 네트워크 3이 보였다.")).toBe(
      "탄탄한 학업 기반과 학업 기반, 몸 상태, 관계망이 보였다.",
    );
  });

  it("hard-fails when a closed activity is offered again as the same invitation", () => {
    const verdict = evaluateEventQuality({
      source: "AI",
      candidate: {
        title: "전시 독서모임의 새 초대",
        body: "지난번에 그만둔 전시 독서모임에서 다시 같은 방식으로 참여해보지 않겠냐고 묻는다.",
        tags: ["외부모임", "독서"],
        choices: [
          {
            id: "join_again",
            label: "다시 같은 전시 독서모임에 참여한다.",
            summary: "당신은 모임에 다시 들어갔다.",
            statDelta: { charm: 1 },
            relationshipDelta: [],
          },
          {
            id: "decline",
            label: "닫힌 제안이라고 말하고 거절한다.",
            summary: "당신은 같은 제안을 거절했다.",
            statDelta: { mental: 1 },
            relationshipDelta: [],
          },
        ],
      },
      context: {
        academicStatus: "ENROLLED",
        eventFlags: {
          outsideReadingClub: "accepted",
          outsideReadingClubParticipation: "low_participation",
          outsideReadingClubClosure: "quit",
        },
        recentSummaries: ["전시 독서모임에 가입했지만 몇 번 빠진 뒤 결국 그만두었다."],
        recentEvents: [],
      },
    });

    expect(verdict.status).toBe("fail");
    expect(verdict.hardFailure).toBe(true);
    expect(verdict.reasons).toContain("closed_thread_repeat");
  });

  it("hard-fails neutral wording when state says the same proposal is closed", () => {
    const verdict = evaluateEventQuality({
      source: "AI",
      candidate: {
        title: "공모전 팀 구성",
        body: "이번 학기 공모전 팀을 꾸려 기획서를 준비할 사람을 모은다.",
        tags: ["공모전", "팀"],
        choices: [
          {
            id: "join",
            label: "팀 구성에 참여한다.",
            summary: "당신은 공모전 팀에 들어갔다.",
            statDelta: { practical: 1 },
            relationshipDelta: [],
          },
          {
            id: "decline",
            label: "이번 일정은 맡지 않는다.",
            summary: "당신은 공모전 일정을 비웠다.",
            statDelta: { mental: 1 },
            relationshipDelta: [],
          },
        ],
      },
      context: {
        academicStatus: "ENROLLED",
        eventFlags: {
          contestSkipped: true,
        },
        recentSummaries: ["공모전 제안을 거절하고 다른 일정에 집중했다."],
        recentEvents: [],
      },
    });

    expect(verdict.status).toBe("fail");
    expect(verdict.hardFailure).toBe(true);
    expect(verdict.reasons).toContain("closed_thread_repeat");
  });

  it("rejects choices that directly choose forced lifecycle outcomes", () => {
    const verdict = evaluateEventQuality({
      source: "AI",
      candidate: {
        title: "동아리 징계 회의",
        body: "동아리 운영진이 최근 갈등을 두고 회의를 연다.",
        tags: ["동아리", "관계"],
        choices: [
          {
            id: "expelled",
            label: "퇴출된다.",
            summary: "당신은 동아리에서 나간다.",
            statDelta: { mental: -1 },
            relationshipDelta: [],
          },
          {
            id: "ask",
            label: "운영진에게 개선 기회를 요청한다.",
            summary: "당신은 운영진에게 앞으로의 기준을 물었다.",
            statDelta: { reputation: 1 },
            relationshipDelta: [],
          },
        ],
      },
      context: {
        academicStatus: "ENROLLED",
        eventFlags: {},
        recentSummaries: [],
        recentEvents: [],
      },
    });

    expect(verdict.status).toBe("fail");
    expect(verdict.hardFailure).toBe(true);
    expect(verdict.reasons).toContain("direct_lifecycle_outcome_choice");
  });

  it("allows voluntary quit wording as player action", () => {
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
        recentSummaries: [],
        recentEvents: [],
      },
    });

    expect(verdict.status).toBe("pass");
    expect(verdict.reasons).not.toContain("direct_lifecycle_outcome_choice");
  });

  it("allows low-participation consequences that close an accepted activity", () => {
    const verdict = evaluateEventQuality({
      source: "AI",
      candidate: {
        title: "스터디 퇴출 통보",
        body: "취업 스터디에서 최근 참여율이 낮았던 일을 이유로 이번 주를 끝으로 함께하기 어렵겠다고 통보한다.",
        tags: ["스터디", "취업", "관계"],
        choices: [
          {
            id: "accept_exit",
            label: "퇴출 통보를 받아들이고 자료를 정리한다.",
            summary: "당신은 스터디에서 빠진 뒤 계획을 다시 세웠다.",
            statDelta: { mental: -1, practical: 1 },
            relationshipDelta: [],
          },
          {
            id: "ask_feedback",
            label: "부족했던 점을 마지막으로 물어본다.",
            summary: "당신은 불편한 피드백을 들었다.",
            statDelta: { mental: -1, reputation: 1 },
            relationshipDelta: [],
          },
        ],
      },
      context: {
        academicStatus: "ENROLLED",
        eventFlags: {
          jobStudyGroup: "accepted",
          jobStudyGroupParticipation: "low_participation",
        },
        recentSummaries: ["취업 스터디에 참여했지만 과제 제출과 출석이 계속 밀렸다."],
        recentEvents: [
          { title: "스터디 첫 주", tags: ["스터디", "취업"], people: ["스터디 운영진"] },
        ],
      },
    });

    expect(verdict.status).toBe("pass");
    expect(verdict.continuityExemptions).toContain("lifecycle_closure");
  });
});
