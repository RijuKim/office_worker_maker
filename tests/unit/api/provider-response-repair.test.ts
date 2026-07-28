import { describe, expect, it } from "vitest";

import { parseAiEventContentDetailed } from "@/lib/game/openrouter";
import { normalizeRelationshipName } from "@/lib/game/npcs";

const validBody = "당신은 늦은 오후 도서관 창가에서 오래 미뤄 둔 지원서를 펼쳤다. 빗소리가 유리창을 두드리고, 낯선 제안이 도착한다. 선택에는 분명한 비용과 다음 장면으로 이어질 약속이 함께 놓여 있다.";

const validEvent = {
  title: "비 오는 날의 제안",
  body: validBody,
  tags: ["진로"],
  choices: [
    { id: "a", label: "제안을 검토한다", summary: "당신은 제안을 검토했다.", statDelta: { mental: -1 } },
    { id: "b", label: "다른 길을 찾는다", summary: "당신은 다른 길을 찾았다.", statDelta: { wealth: -1 } },
  ],
};

describe("provider response repair - double-escaped JSON", () => {
  it("repairs double-escaped newlines in body (literal \\\\n)", () => {
    // Raw JSON with \\n (two chars: backslash + n) in string values.
    // JSON.parse converts \\n to \n (one backslash + n) in the string.
    // repairNarrativeEscapes then converts \n to actual newlines.
    const rawJson = '{"title":"비 오는 날의 제안","body":"첫 문장입니다.\\\\n\\\\n두 번째 문장입니다.\\\\n\\\\n세 번째 문장입니다.\\\\n\\\\n네 번째 문장입니다.\\\\n\\\\n다섯 번째 문장입니다. 이것은 스키마 검증을 통과하기 위해 충분히 긴 본문입니다. 대학 생활의 여러 에피소드를 통해 주인공은 다양한 선택을 마주하게 됩니다.","tags":["진로"],"choices":[{"id":"a","label":"제안을 검토한다","summary":"당신은 제안을 검토했다.","statDelta":{"mental":-1}},{"id":"b","label":"다른 길을 찾는다","summary":"당신은 다른 길을 찾았다.","statDelta":{"wealth":-1}}]}';
    const result = parseAiEventContentDetailed(rawJson);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.event.body).toContain("\n\n");
    }
  });

  it("repairs double-escaped newlines in choice labels and summaries", () => {
    const rawJson = '{"title":"비 오는 날의 제안","body":"당신은 늦은 오후 도서관 창가에서 오래 미뤄 둔 지원서를 펼쳤다. 빗소리가 유리창을 두드리고, 낯선 제안이 도착한다. 선택에는 분명한 비용과 다음 장면으로 이어질 약속이 함께 놓여 있다.","tags":["진로"],"choices":[{"id":"a","label":"첫 번째\\\\n선택","summary":"당신은\\\\n첫 번째 선택을 했다.","statDelta":{"mental":-1}},{"id":"b","label":"두 번째 선택","summary":"당신은 두 번째 선택을 했다.","statDelta":{"wealth":-1}}]}';
    const result = parseAiEventContentDetailed(rawJson);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.event.choices[0].label).toContain("\n");
      expect(result.event.choices[0].summary).toContain("\n");
    }
  });

  it("handles JSON-string wrapper (content is a JSON string containing escaped JSON)", () => {
    const inner = JSON.stringify(validEvent);
    const wrapped = JSON.stringify(inner);
    const result = parseAiEventContentDetailed(wrapped);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.event.title).toBe(validEvent.title);
      expect(result.event.body).toBe(validEvent.body);
    }
  });

  it("preserves valid JSON without double escaping", () => {
    const normal = JSON.stringify(validEvent);
    const result = parseAiEventContentDetailed(normal);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.event.title).toBe(validEvent.title);
      expect(result.event.body).toBe(validEvent.body);
    }
  });

  it("fails safely on truly truncated JSON", () => {
    const truncated = '{"title": "비 오는 날의 제안", "body": "시작만';
    const result = parseAiEventContentDetailed(truncated);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toBe("malformed_json");
    }
  });

  it("fails safely on malformed non-JSON content", () => {
    const result = parseAiEventContentDetailed("이것은 JSON이 아닙니다. {완전히 깨짐");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toBe("malformed_json");
    }
  });

  it("handles Korean double-escaped dialogue example", () => {
    const rawJson = '{"title":"비 오는 날의 제안","body":"선배가 말했다.\\\\n\\\\n\\"00야, 요즘 어떻게 지내?\\"\\\\n\\\\n당신은 대답을 망설였다.\\\\n\\\\n그날 이후로 무언가가 달라졌다.\\\\n\\\\n당신은 그 변화를 아직 설명할 수 없었지만, 분명한 것은 선택의 순간이 다가오고 있다는 것이었다. 이것은 스키마 검증을 통과하기 위한 충분히 긴 본문입니다.","tags":["진로"],"choices":[{"id":"a","label":"제안을 검토한다","summary":"당신은 제안을 검토했다.","statDelta":{"mental":-1}},{"id":"b","label":"다른 길을 찾는다","summary":"당신은 다른 길을 찾았다.","statDelta":{"wealth":-1}}]}';
    const result = parseAiEventContentDetailed(rawJson);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.event.body).toContain("\n\n");
      expect(result.event.body).toContain("선배가 말했다.");
      expect(result.event.body).toContain("00야, 요즘 어떻게 지내?");
    }
  });
});

describe("relationship name normalization", () => {
  it("maps 동아리 친구 to 은지", () => {
    expect(normalizeRelationshipName("동아리 친구")).toBe("은지");
  });

  it("maps 같은 과 동기 to 민하", () => {
    expect(normalizeRelationshipName("같은 과 동기")).toBe("민하");
  });

  it("maps 옆자리 동기 to 태수", () => {
    expect(normalizeRelationshipName("옆자리 동기")).toBe("태수");
  });

  it("maps 점심 모임 사람들 to 태수", () => {
    expect(normalizeRelationshipName("점심 모임 사람들")).toBe("태수");
  });

  it("maps 채용설명회 조교 to 소연", () => {
    expect(normalizeRelationshipName("채용설명회 조교")).toBe("소연");
  });

  it("preserves valid named NPCs", () => {
    expect(normalizeRelationshipName("서연")).toBe("서연");
    expect(normalizeRelationshipName("민하")).toBe("민하");
    expect(normalizeRelationshipName("지민")).toBe("지민");
    expect(normalizeRelationshipName("현우")).toBe("현우");
    expect(normalizeRelationshipName("도윤")).toBe("도윤");
    expect(normalizeRelationshipName("은지")).toBe("은지");
    expect(normalizeRelationshipName("태수")).toBe("태수");
    expect(normalizeRelationshipName("소연")).toBe("소연");
    expect(normalizeRelationshipName("유진")).toBe("유진");
    expect(normalizeRelationshipName("동규")).toBe("동규");
    expect(normalizeRelationshipName("명수")).toBe("명수");
    expect(normalizeRelationshipName("혜진")).toBe("혜진");
    expect(normalizeRelationshipName("노인")).toBe("노인");
  });

  it("returns null for unknown generic role labels", () => {
    expect(normalizeRelationshipName("알바 동료")).toBeNull();
    expect(normalizeRelationshipName("스터디 친구")).toBeNull();
    expect(normalizeRelationshipName("동아리 멤버")).toBeNull();
  });

  it("returns null for empty or whitespace names", () => {
    expect(normalizeRelationshipName("")).toBeNull();
    expect(normalizeRelationshipName("   ")).toBeNull();
  });

  it("preserves plausible new character names", () => {
    expect(normalizeRelationshipName("김철수")).toBe("김철수");
    expect(normalizeRelationshipName("이영희")).toBe("이영희");
  });

  it("maps 동아리 선배 to 지민", () => {
    expect(normalizeRelationshipName("동아리 선배")).toBe("지민");
  });

  it("maps 취업 선배 to 유진", () => {
    expect(normalizeRelationshipName("취업 선배")).toBe("유진");
  });

  it("maps 편의점 점장 to 명수", () => {
    expect(normalizeRelationshipName("편의점 점장")).toBe("명수");
  });

  it("maps 헬스장 트레이너 to 현우", () => {
    expect(normalizeRelationshipName("헬스장 트레이너")).toBe("현우");
  });

  it("maps 문학 동아리원 to 서연", () => {
    expect(normalizeRelationshipName("문학 동아리원")).toBe("서연");
  });
});

describe("parseAiEventContentDetailed with relationship name normalization", () => {
  it("normalizes generic role labels in relationshipDelta", () => {
    const rawJson = '{"title":"비 오는 날의 제안","body":"당신은 늦은 오후 도서관 창가에서 오래 미뤄 둔 지원서를 펼쳤다. 빗소리가 유리창을 두드리고, 낯선 제안이 도착한다. 선택에는 분명한 비용과 다음 장면으로 이어질 약속이 함께 놓여 있다.","tags":["진로"],"choices":[{"id":"a","label":"동아리 친구와 이야기한다","summary":"당신은 동아리 친구와 이야기했다.","statDelta":{"mental":1},"relationshipDelta":[{"name":"동아리 친구","trust":5}]},{"id":"b","label":"혼자 있다","summary":"당신은 혼자 시간을 보냈다.","statDelta":{"mental":-1}}]}';
    const result = parseAiEventContentDetailed(rawJson);
    expect(result.success).toBe(true);
    if (result.success) {
      const relDelta = result.event.choices[0].relationshipDelta;
      expect(relDelta).toBeDefined();
      expect(relDelta![0].name).toBe("은지");
    }
  });

  it("omits relationshipDelta entries with unresolvable generic names", () => {
    const rawJson = '{"title":"비 오는 날의 제안","body":"당신은 늦은 오후 도서관 창가에서 오래 미뤄 둔 지원서를 펼쳤다. 빗소리가 유리창을 두드리고, 낯선 제안이 도착한다. 선택에는 분명한 비용과 다음 장면으로 이어질 약속이 함께 놓여 있다.","tags":["진로"],"choices":[{"id":"a","label":"알바 동료와 이야기한다","summary":"당신은 알바 동료와 이야기했다.","statDelta":{"mental":1},"relationshipDelta":[{"name":"알바 동료","trust":5}]},{"id":"b","label":"혼자 있다","summary":"당신은 혼자 시간을 보냈다.","statDelta":{"mental":-1}}]}';
    const result = parseAiEventContentDetailed(rawJson);
    expect(result.success).toBe(true);
    if (result.success) {
      const relDelta = result.event.choices[0].relationshipDelta;
      expect(relDelta).toBeDefined();
      expect(relDelta!.length).toBe(0);
    }
  });

  it("preserves valid named NPCs in relationshipDelta", () => {
    const rawJson = '{"title":"비 오는 날의 제안","body":"당신은 늦은 오후 도서관 창가에서 오래 미뤄 둔 지원서를 펼쳤다. 빗소리가 유리창을 두드리고, 낯선 제안이 도착한다. 선택에는 분명한 비용과 다음 장면으로 이어질 약속이 함께 놓여 있다.","tags":["진로"],"choices":[{"id":"a","label":"서연과 이야기한다","summary":"당신은 서연과 이야기했다.","statDelta":{"mental":1},"relationshipDelta":[{"name":"서연","trust":5}]},{"id":"b","label":"혼자 있다","summary":"당신은 혼자 시간을 보냈다.","statDelta":{"mental":-1}}]}';
    const result = parseAiEventContentDetailed(rawJson);
    expect(result.success).toBe(true);
    if (result.success) {
      const relDelta = result.event.choices[0].relationshipDelta;
      expect(relDelta).toBeDefined();
      expect(relDelta![0].name).toBe("서연");
      expect(relDelta![0].trust).toBe(5);
    }
  });
});
