import { describe, expect, it } from "vitest";

import { NPC_POOL, selectStarterCandidates, selectStarterNpcs, selectStarterPair } from "@/lib/game/npcs";
import { buildInitialHiddenState, buildStarterRelationships, buildFirstEvent } from "@/lib/game/character-foundation";

describe("NPC start diversity acceptance", () => {
  const seeds = Array.from({ length: 100 }, (_, index) => `character-seed-${index}`);

  it("distributes two unique safe starters without a dominant default", () => {
    const appearances = new Map<string, number>();
    const reached = new Set<string>();

    for (const seed of seeds) {
      const starters = selectStarterNpcs(seed, 2);
      expect(starters).toHaveLength(2);
      expect(new Set(starters.map((npc) => npc.name)).size).toBe(2);
      expect(starters.every((npc) => npc.dangerLevel === 0)).toBe(true);
      for (const npc of starters) {
        reached.add(npc.name);
        appearances.set(npc.name, (appearances.get(npc.name) ?? 0) + 1);
      }
    }

    expect(reached.size).toBeGreaterThanOrEqual(8);
    expect(Math.max(...appearances.values())).toBeLessThan(50);
  });

  it("is deterministic for a run seed", () => {
    expect(selectStarterNpcs("same-character-id", 2)).toEqual(selectStarterNpcs("same-character-id", 2));
  });

  it("keeps danger NPCs out of ordinary initialization", () => {
    const dangerNames = new Set(NPC_POOL.filter((npc) => npc.dangerLevel >= 2).map((npc) => npc.name));
    for (const seed of seeds) {
      expect(selectStarterNpcs(seed, 2).some((npc) => dangerNames.has(npc.name))).toBe(false);
    }
  });

  it("builds the initial open thread from a selected starter", () => {
    const seed = "foundation-character-id";
    const selectedNames = selectStarterNpcs(seed, 2).map((npc) => npc.name);
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

  it("uses CharacterRun UUID as seed, not protagonist name", () => {
    const uuid1 = "aaaaaaaa-1111-1111-1111-111111111111";
    const uuid2 = "bbbbbbbb-2222-2222-2222-222222222222";
    const sameName = "한서윤";

    // Two different UUIDs with the same name must yield different starters
    const starters1 = selectStarterNpcs(uuid1, 2);
    const starters2 = selectStarterNpcs(uuid2, 2);
    expect(starters1.map((n) => n.name)).not.toEqual(starters2.map((n) => n.name));
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
    // Trust values must be fixed, not random
    expect(rels1[0].trust).toBe(46);
    expect(rels1[1].trust).toBe(52);
  });

  it("selectStarterPair returns role-compatible senior and peer", () => {
    const seed = "role-compatibility-seed";
    const [senior, peer] = selectStarterPair(seed);
    // Senior should have a senior/mentor role keyword
    const seniorKeywords = ["선배", "교수", "부장", "점장", "리더", "할아버지"];
    const peerKeywords = ["동료", "친구", "동기", "후배", "원", "트레이너"];
    expect(seniorKeywords.some((kw) => senior.role.includes(kw))).toBe(true);
    expect(peerKeywords.some((kw) => peer.role.includes(kw))).toBe(true);
    expect(senior.name).not.toBe(peer.name);
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
    // No danger NPCs in candidates
    const dangerNames = new Set(NPC_POOL.filter((npc) => npc.dangerLevel >= 2).map((npc) => npc.name));
    for (const c of candidates) {
      expect(dangerNames.has(c.name)).toBe(false);
    }
  });

  it("buildFirstEvent uses role-compatible starter pair", () => {
    const seed = "first-event-role-seed";
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
    // At least one starter name appears in the first event's relationship deltas
    expect(usedNames.has(senior.name) || usedNames.has(peer.name)).toBe(true);
  });
});

