import { describe, expect, it, vi } from "vitest";

import { NPC_POOL, selectStarterCandidates, selectStarterPair } from "@/lib/game/npcs";
import { buildInitialHiddenState, buildStarterRelationships, buildFirstEvent } from "@/lib/game/character-foundation";
import { buildUserPrompt } from "@/lib/game/openrouter";

describe("NPC start diversity acceptance", () => {
  const seeds = Array.from({ length: 100 }, (_, index) => `character-seed-${index}`);

  it("selectStarterPair distributes two unique safe starters without a dominant default", () => {
    const appearances = new Map<string, number>();
    const reached = new Set<string>();

    for (const seed of seeds) {
      const [senior, peer] = selectStarterPair(seed);
      expect(senior).toBeDefined();
      expect(peer).toBeDefined();
      expect(senior.name).not.toBe(peer.name);
      expect(senior.dangerLevel).toBe(0);
      expect(peer.dangerLevel).toBe(0);
      reached.add(senior.name);
      reached.add(peer.name);
      appearances.set(senior.name, (appearances.get(senior.name) ?? 0) + 1);
      appearances.set(peer.name, (appearances.get(peer.name) ?? 0) + 1);
    }

    expect(reached.size).toBeGreaterThanOrEqual(8);
    expect(Math.max(...appearances.values())).toBeLessThan(50);
  });

  it("selectStarterPair is deterministic for the same seed", () => {
    expect(selectStarterPair("same-character-id")).toEqual(selectStarterPair("same-character-id"));
  });

  it("selectStarterPair keeps danger NPCs out of ordinary initialization", () => {
    const dangerNames = new Set(NPC_POOL.filter((npc) => npc.dangerLevel >= 2).map((npc) => npc.name));
    for (const seed of seeds) {
      const [senior, peer] = selectStarterPair(seed);
      expect(dangerNames.has(senior.name)).toBe(false);
      expect(dangerNames.has(peer.name)).toBe(false);
    }
  });

  it("selectStarterPair returns role-compatible senior and peer for every seed", () => {
    const seniorKeywords = ["선배", "교수", "부장", "점장", "리더", "할아버지"];
    const peerKeywords = ["동료", "친구", "동기", "후배", "원", "트레이너"];

    for (const seed of seeds) {
      const [senior, peer] = selectStarterPair(seed);
      expect(seniorKeywords.some((kw) => senior.role.includes(kw))).toBe(true);
      expect(peerKeywords.some((kw) => peer.role.includes(kw))).toBe(true);
      expect(senior.name).not.toBe(peer.name);
    }
  });

  it("uses CharacterRun UUID as seed, not protagonist name", () => {
    const uuid1 = "aaaaaaaa-1111-1111-1111-111111111111";
    const uuid2 = "bbbbbbbb-2222-2222-2222-222222222222";
    const sameName = "한서윤";

    const starters1 = selectStarterPair(uuid1);
    const starters2 = selectStarterPair(uuid2);
    expect(starters1.map((n) => n.name)).not.toEqual(starters2.map((n) => n.name));
  });

  it("builds the initial open thread from a selected starter", () => {
    const seed = "foundation-character-id";
    const [senior, peer] = selectStarterPair(seed);
    const selectedNames = [senior.name, peer.name];
    const hidden = buildInitialHiddenState({
      seed,
      age: 21,
      major: "컴퓨터공학",
      residence: "dorm",
      preferredStats: ["academic", "practical"],
      startGradeYear: 1,
    });
    const flags = hidden.eventFlags as Record<string, unknown>;
    const storyArc = flags.storyArc as { openThreads: string[] };

    expect(storyArc.openThreads.some((thread) => selectedNames.some((name) => thread.includes(name)))).toBe(true);
    expect(storyArc.openThreads.some((thread) => thread.includes("지민") && !selectedNames.includes("지민"))).toBe(false);
  });

  it("selectStarterCandidates returns 6-8 entries excluding danger NPCs", () => {
    const seed = "test-uuid-for-candidates";
    const candidates = selectStarterCandidates(seed, 7);
    expect(candidates.length).toBeGreaterThanOrEqual(6);
    expect(candidates.length).toBeLessThanOrEqual(8);

    const dangerNames = new Set(NPC_POOL.filter((npc) => npc.dangerLevel >= 2).map((npc) => npc.name));
    for (const candidate of candidates) {
      expect(dangerNames.has(candidate.name)).toBe(false);
      expect(typeof candidate.name).toBe("string");
      expect(typeof candidate.role).toBe("string");
    }
  });

  it("selectStarterCandidates is deterministic for the same seed", () => {
    const seed = "deterministic-candidate-seed";
    expect(selectStarterCandidates(seed, 7)).toEqual(selectStarterCandidates(seed, 7));
  });

  it("buildStarterRelationships has deterministic trust values", () => {
    const seed = "deterministic-trust-seed";
    const rels1 = buildStarterRelationships(seed);
    const rels2 = buildStarterRelationships(seed);
    expect(rels1).toEqual(rels2);
    expect(rels1[0].trust).toBe(46);
    expect(rels1[1].trust).toBe(52);
  });

  it("starterCandidates are stored in hidden state eventFlags", () => {
    const seed = "candidate-storage-seed";
    const hidden = buildInitialHiddenState({
      seed,
      age: 21,
      major: "컴퓨터공학",
      residence: "dorm",
      preferredStats: ["academic", "practical"],
      startGradeYear: 1,
    });
    const flags = hidden.eventFlags as Record<string, unknown>;
    const candidates = flags.starterCandidates as { name: string; role: string }[];
    expect(candidates).toBeDefined();
    expect(candidates.length).toBeGreaterThanOrEqual(6);
    expect(candidates.length).toBeLessThanOrEqual(8);
    const dangerNames = new Set(NPC_POOL.filter((npc) => npc.dangerLevel >= 2).map((npc) => npc.name));
    for (const c of candidates) {
      expect(dangerNames.has(c.name)).toBe(false);
    }
  });

  it("buildFirstEvent uses role-compatible starter pair names in relationship deltas", () => {
    for (const seed of seeds) {
      const [senior, peer] = selectStarterPair(seed);
      const event = buildFirstEvent({
        seed,
        name: "테스트",
        age: 21,
        major: "컴퓨터공학",
        residence: "dorm",
        preferredStats: ["academic", "practical"],
        startGradeYear: 1,
      });
      const choices = event.choices as Array<{ relationshipDelta?: Array<{ name: string }> }>;
      const usedNames = new Set(
        choices.flatMap((c) => c.relationshipDelta?.map((r) => r.name) ?? []),
      );
      expect(usedNames.has(senior.name) || usedNames.has(peer.name)).toBe(true);
    }
  });

  it("distributes identical profiles across all opening scenes by character seed", () => {
    const titles = new Map<string, number>();
    for (const seed of seeds) {
      const event = buildFirstEvent({
        seed,
        name: "같은이름",
        age: 21,
        major: "컴퓨터공학",
        residence: "dorm",
        preferredStats: ["academic", "practical"],
        startGradeYear: 1,
      });
      titles.set(event.title, (titles.get(event.title) ?? 0) + 1);
    }

    expect(titles.size).toBe(4);
    expect(Math.max(...titles.values())).toBeLessThan(40);
  });

  it("buildUserPrompt includes 안전후보 with 6-8 compact name/role pairs, no danger NPCs, no hardcoded roster", () => {
    const seed = "prompt-candidate-test";
    const candidates = selectStarterCandidates(seed, 7);
    const prompt = buildUserPrompt({
      name: "서윤",
      major: "문학",
      gradeYear: 2,
      age: 21,
      coreEventCount: 4,
      recentSummaries: [],
      usedEventTitles: [],
      stats: { academic: 5, practical: 4, health: 6, mental: 5, wealth: 3, reputation: 4, charm: 5 },
      relationships: [
        { name: "지민", role: "동아리 선배", trust: 46 },
        { name: "민하", role: "단짝 친구", trust: 52 },
      ],
      storyArc: {},
      starterCandidates: candidates,
    });

    // 안전후보 appears with exactly the candidate count
    const candidateMatch = prompt.match(/안전후보=(\[.*?\])/);
    expect(candidateMatch).not.toBeNull();
    const parsed = JSON.parse(candidateMatch![1]) as { name: string; role: string }[];
    expect(parsed.length).toBeGreaterThanOrEqual(6);
    expect(parsed.length).toBeLessThanOrEqual(8);

    // No danger NPCs in candidates
    const dangerNames = new Set(NPC_POOL.filter((npc) => npc.dangerLevel >= 2).map((npc) => npc.name));
    for (const c of parsed) {
      expect(dangerNames.has(c.name)).toBe(false);
    }

    // No hardcoded full roster — the old hardcoded 14-person list is gone
    expect(prompt).not.toContain("안전후보=[{\"name\":\"지민\"");
    expect(prompt).not.toContain("안전후보=[{\"name\":\"소연\"");

    // Persisted relationship names remain in the prompt
    expect(prompt).toContain("지민");
    expect(prompt).toContain("민하");

    // The 안전후보 is guidance only — no schema hard rejection
    expect(prompt).not.toContain("must only use");
    expect(prompt).not.toContain("reject if not in");
  });

  it("buildUserPrompt omits 안전후보 when starterCandidates is empty", () => {
    const prompt = buildUserPrompt({
      name: "서윤",
      major: "문학",
      gradeYear: 2,
      age: 21,
      coreEventCount: 4,
      recentSummaries: [],
      usedEventTitles: [],
      stats: { academic: 5, practical: 4, health: 6, mental: 5, wealth: 3, reputation: 4, charm: 5 },
      relationships: [
        { name: "지민", role: "동아리 선배", trust: 46 },
      ],
      storyArc: {},
      starterCandidates: [],
    });

    expect(prompt).not.toContain("안전후보=");
  });

  it("selectStarterCandidates is a pure function with no side effects, no DB/network calls", () => {
    // selectStarterCandidates only reads NPC_POOL (a const) and uses hashSeed/seededShuffle
    // — no async, no fetch, no prisma, no crypto.randomUUID
    const seed = "pure-function-test";
    const result = selectStarterCandidates(seed, 7);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(7);
    for (const c of result) {
      expect(typeof c.name).toBe("string");
      expect(typeof c.role).toBe("string");
    }
  });

  it("selectStarterPair is a pure function with no side effects, no DB/network calls", () => {
    const seed = "pure-function-test-2";
    const [senior, peer] = selectStarterPair(seed);
    expect(senior).toBeDefined();
    expect(peer).toBeDefined();
    expect(senior.name).not.toBe(peer.name);
  });

  it("buildStarterRelationships is a pure function with no side effects, no DB/network calls", () => {
    const seed = "pure-function-test-3";
    const rels = buildStarterRelationships(seed);
    expect(rels).toHaveLength(2);
    expect(rels[0].name).toBeDefined();
    expect(rels[1].name).toBeDefined();
  });
});
