import { describe, expect, it } from "vitest";

import { gateConcreteResultFields, getPassedDestinationCandidates } from "@/lib/game/result-gating";

describe("gateConcreteResultFields", () => {
  it("strips AI-provided concrete destination fields without a validated prior process", () => {
    const result = gateConcreteResultFields(
      {
        destinationName: "다람소프트",
        jobRole: "신입 백엔드 개발자",
        salaryBand: "4500~6000만원",
      },
      {
        eventFlags: {},
      },
    );

    expect(result).toEqual({
      destinationName: null,
      jobRole: null,
      salaryBand: null,
    });
  });

  it("allows concrete job fields only when a passed destination candidate exists and the name matches", () => {
    const result = gateConcreteResultFields(
      {
        destinationName: " 다람소프트 ",
        jobRole: "신입 서비스 기획자",
        salaryBand: "4000~5200만원",
      },
      {
        eventFlags: {
          destinationCandidates: [
            {
              id: "career-company",
              kind: "company",
              name: "다람소프트",
              introducedBy: "career-gate-event",
              status: "gate_passed",
            },
          ],
        },
      },
    );

    expect(result).toEqual({
      destinationName: "다람소프트",
      jobRole: "신입 서비스 기획자",
      salaryBand: "4000~5200만원",
    });
  });

  it("keeps job fields gated but rejects an unsupported destination name mismatch", () => {
    const result = gateConcreteResultFields(
      {
        destinationName: "갑자기글로벌",
        jobRole: "신입 개발자",
        salaryBand: "5000만원",
      },
      {
        eventFlags: {
          destinationCandidates: [
            {
              id: "career-company",
              kind: "company",
              name: "다람소프트",
              introducedBy: "career-gate-event",
              status: "gate_passed",
            },
          ],
        },
      },
    );

    expect(result).toEqual({
      destinationName: null,
      jobRole: "신입 개발자",
      salaryBand: "5000만원",
    });
  });
});

describe("getPassedDestinationCandidates", () => {
  it("ignores introduced or failed candidates for concrete result persistence", () => {
    const candidates = getPassedDestinationCandidates({
      eventFlags: {
        destinationCandidates: [
          {
            id: "introduced",
            kind: "company",
            name: "서류만 낸 회사",
            introducedBy: "resume-event",
            status: "applied",
          },
          {
            id: "failed",
            kind: "public_sector",
            name: "공공안전 전형",
            introducedBy: "career-gate-event",
            status: "gate_failed",
          },
        ],
      },
    });

    expect(candidates).toEqual([]);
  });
});
