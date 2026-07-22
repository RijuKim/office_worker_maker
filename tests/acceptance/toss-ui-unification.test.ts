import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Toss UI unification acceptance contracts", () => {
  it("uses one shared game UI from both host entries", () => {
    expect(existsSync(resolve(root, "lib/game-ui/App.tsx"))).toBe(true);
    expect(read("app/page.tsx")).toMatch(/game-ui\/App/);
    expect(read("apps/toss-miniapp/src/App.tsx")).toMatch(/game-ui\/App/);
  });

  it("keeps host SDKs out of the shared presentation layer", () => {
    const shared = read("lib/game-ui/App.tsx");
    expect(shared).not.toMatch(/next-auth|apps-in-toss|@prisma|server\//);
  });

  it("replaces the legacy Toss styles with the production shared style source", () => {
    expect(existsSync(resolve(root, "lib/game-ui/styles.css"))).toBe(true);
    expect(read("apps/toss-miniapp/src/main.tsx")).toMatch(/game-ui\/styles\.css/);
    expect(read("apps/toss-miniapp/src/main.tsx")).not.toMatch(/\.\/styles\.css/);
  });

  it("pins the console appName and production icon", () => {
    const config = read("granite.config.ts");
    expect(config).toContain('appName: "sano-job-seeker"');
    expect(config).toContain("https://sano-officeworker.vercel.app/toss-app-icon.png");
  });

  it("defines typed web and Toss host adapters without a Toss guest fallback", () => {
    expect(existsSync(resolve(root, "lib/game-ui/host.ts"))).toBe(true);
    expect(existsSync(resolve(root, "apps/toss-miniapp/src/toss-host.ts"))).toBe(true);
    const tossHost = read("apps/toss-miniapp/src/toss-host.ts");
    expect(tossHost).toMatch(/getAnonymousKey/);
    expect(tossHost).toMatch(/SafeAreaInsets/);
    expect(tossHost).not.toMatch(/guest|GUEST_USER_COOKIE/i);
  });

  it("uses a single SSE generation request and bounded committed-event recovery", () => {
    const transport = read("lib/game-ui/event-stream.ts");
    expect(transport).toMatch(/600/);
    expect(transport).toMatch(/12_000|12000/);
    expect(transport).toContain("text/event-stream");
    expect(transport).toMatch(/다음 사건이 아직 확정되지 않았습니다/);
  });

  it("shows the approved loading copy as an accessible live state", () => {
    const shared = read("lib/game-ui/App.tsx");
    expect(shared).toContain("당신이 모르는 곳에서,");
    expect(shared).toContain("다음 일이 시작되고 있습니다");
    expect(shared).toMatch(/aria-live=["']polite["']/);
    expect(shared).toMatch(/aria-busy/);
  });

  it("keeps the shared records actions on copy and image only", () => {
    const shared = read("lib/game-ui/App.tsx");
    expect(shared).toContain("RecordShareActions");
    expect(shared).toContain("링크 복사");
    expect(shared).toContain("이미지 저장");
    expect(shared).not.toMatch(/twitter|kakaotalk|카톡 공유|X 공유/i);
  });

  it("creates a Toss share link for the exact ending and never falls back to Vercel", () => {
    const tossHost = read("apps/toss-miniapp/src/toss-host.ts");
    expect(tossHost).toMatch(/getTossShareLink/);
    expect(tossHost).toContain("intoss://sano-job-seeker/share/");
    expect(tossHost).toContain("링크를 만들지 못했습니다. 다시 시도해 주세요.");
    expect(tossHost).not.toMatch(/\/share\/.*window\.location\.origin/);
  });

  it("exposes an allowlisted public ending DTO and a non-sensitive missing state", () => {
    const route = read("app/api/share/[id]/route.ts");
    expect(route).toContain("기록을 찾을 수 없습니다");
    expect(route).not.toMatch(/\.\.\.record/);
    expect(route).not.toMatch(/userId\s*[:,]|characterRunId\s*[:,]|hiddenState/);
  });

  it("keeps the authoritative event tests focused on ACTIVE convergence", () => {
    const authority = read("tests/unit/api/event-authority-stateful-routes.test.ts");
    expect(authority).toContain("ACTIVE");
  });

  it("builds only the correctly named AIT artifact", () => {
    expect(existsSync(resolve(root, "sano-job-seeker.ait"))).toBe(true);
    expect(existsSync(resolve(root, "sano-officeworker.ait"))).toBe(false);
  });
});
