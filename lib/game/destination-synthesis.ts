import { deriveLifeStageState, type DestinationCandidate } from "@/lib/game/life-stage";
import { findBestMatchingDestination, seedCareerDestinations } from "@/lib/game/career-data";

export type SynthesizedDestination = {
  destinationName: string | null;
  jobRole: string | null;
  salaryBand: string | null;
  careerPath: string;
};

export function getDestinationCandidatesForEnding(hiddenState: unknown): DestinationCandidate[] {
  const state = typeof hiddenState === "object" && hiddenState !== null
    ? hiddenState as Record<string, unknown>
    : {};
  const eventFlags = typeof state.eventFlags === "object" && state.eventFlags !== null
    ? state.eventFlags as Record<string, unknown>
    : {};
  const lifeStage = deriveLifeStageState({ eventFlags });

  return lifeStage.destinationCandidates.filter(
    (candidate) => candidate.status === "gate_passed",
  );
}

export function synthesizeDestination(
  passedCandidates: DestinationCandidate[],
  stats: Record<string, number>,
  _relationships?: { name: string; trust: number }[],
  _eventHistory?: { title: string; summary: string }[],
): SynthesizedDestination {
  if (passedCandidates.length === 0) {
    return synthesizeFallbackCareerPath(stats);
  }

  const allDestinations = seedCareerDestinations();
  const bestMatch = findBestMatchingDestination(stats, allDestinations);

  const matchedCandidate = passedCandidates.find((candidate) => {
    const normalizedName = candidate.name.replace(/\s+/g, "").toLowerCase();
    const normalizedDest = bestMatch.displayName.replace(/\s+/g, "").toLowerCase();
    return normalizedName.includes(normalizedDest) || normalizedDest.includes(normalizedName);
  });

  if (matchedCandidate) {
    const roles = Array.isArray(bestMatch.roles) ? bestMatch.roles as string[] : [];
    const role = roles.length > 0
      ? roles[Math.floor(Math.random() * roles.length)]
      : null;

    return {
      destinationName: bestMatch.displayName,
      jobRole: role,
      salaryBand: bestMatch.salaryBand,
      careerPath: getCareerPathLabel(bestMatch.destinationType),
    };
  }

  const firstCandidate = passedCandidates[0];
  const matchedSeed = allDestinations.find((dest) => {
    const normalizedName = firstCandidate.name.replace(/\s+/g, "").toLowerCase();
    const normalizedDest = dest.displayName.replace(/\s+/g, "").toLowerCase();
    return normalizedName.includes(normalizedDest) || normalizedDest.includes(normalizedName);
  });

  if (matchedSeed) {
    const roles = Array.isArray(matchedSeed.roles) ? matchedSeed.roles as string[] : [];
    return {
      destinationName: matchedSeed.displayName,
      jobRole: roles.length > 0 ? roles[Math.floor(Math.random() * roles.length)] : null,
      salaryBand: matchedSeed.salaryBand,
      careerPath: getCareerPathLabel(matchedSeed.destinationType),
    };
  }

  return {
    destinationName: firstCandidate.name,
    jobRole: null,
    salaryBand: null,
    careerPath: `${firstCandidate.kind} 경로`,
  };
}

export function synthesizeFallbackCareerPath(stats: Record<string, number>): SynthesizedDestination {
  const careerPath = pickFallbackCareerPath(stats);
  return {
    destinationName: null,
    jobRole: null,
    salaryBand: null,
    careerPath,
  };
}

function getCareerPathLabel(destinationType: string): string {
  switch (destinationType) {
    case "PARODY_COMPANY": return "기업 취업";
    case "PUBLIC_SECTOR": return "공공기관";
    case "LICENSED_PROFESSION": return "전문직";
    case "ENTREPRENEURSHIP": return "창업";
    case "SELF_EMPLOYMENT": return "자영업/프리랜서";
    case "UNEMPLOYED": return "취업 준비";
    case "INHERITANCE": return "독립적 생활";
    default: return "선택의 결과";
  }
}

function pickFallbackCareerPath(stats: Record<string, number>): string {
  if (stats.reputation <= 2 && stats.wealth >= 6) return "위험한 돈에서 겨우 발을 뺀 생존자";
  if (stats.practical >= 6 && stats.wealth >= 5) return "아르바이트 경력자";
  if (stats.health >= 6 && stats.academic >= 5 && stats.reputation >= 4) return "공공안전 직무 준비생";
  if (stats.charm >= 7 && stats.mental >= 5) return "연애와 결혼을 선택한 생활인";
  if (stats.mental >= 7 && stats.charm <= 5) return "혼자 살며 조용히 안정된 사람";
  if (stats.wealth <= 5 && stats.charm >= 5) return "해외 워홀 이후 다시 길을 찾은 사람";
  if (stats.wealth >= 6 && stats.practical >= 5) return "창업 또는 자영업";
  if (stats.academic >= 7 && stats.mental >= 5) return "전문직 시험 준비생";
  if (stats.reputation >= 6 && stats.practical >= 5) return "기업 채용 재도전";
  if (stats.academic >= 6 && stats.health >= 4) return "공공기관 또는 공무원 준비";
  if (stats.charm >= 6) return "마케팅·콘텐츠 직무";
  return "불확실하지만 계속되는 취업 준비";
}
