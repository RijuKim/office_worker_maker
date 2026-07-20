import { spawn, type ChildProcess } from "node:child_process";
import { expect, test } from "@playwright/test";

async function waitForToss() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch("http://127.0.0.1:5173/");
      if (response.ok) return;
    } catch { /* server is still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Toss Vite server did not become ready");
}

test("Toss menu has real responsive geometry and usable computed targets", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "one Chromium run covers all explicit viewport widths");
  let server: ChildProcess | undefined;
  try {
    let alreadyRunning = false;
    try { alreadyRunning = (await fetch("http://127.0.0.1:5173/")).ok; } catch { /* start it below */ }
    if (!alreadyRunning) {
      server = spawn("npm", ["run", "toss:dev", "--", "--host", "127.0.0.1", "--port", "5173"], {
        cwd: process.cwd(), stdio: "ignore", detached: true,
      });
      await waitForToss();
    }

    for (const width of [390, 720, 721, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("http://127.0.0.1:5173/");
      await page.getByRole("button", { name: "메뉴", exact: true }).click();
      const layout = await page.evaluate(() => {
        const root = document.documentElement;
        const row = document.querySelector(".title-row")!.getBoundingClientRect();
        const menu = document.querySelector(".menu-popover")!.getBoundingClientRect();
        const items = [...document.querySelectorAll<HTMLElement>(".menu-popover > button, .menu-popover > .menu-row")];
        return {
          clientWidth: root.clientWidth, scrollWidth: root.scrollWidth,
          row: { left: row.left, right: row.right, width: row.width },
          menu: { left: menu.left, right: menu.right, width: menu.width },
          items: items.map((item) => {
            const style = getComputedStyle(item);
            return { fontSize: style.fontSize, fontWeight: style.fontWeight, height: item.getBoundingClientRect().height };
          }),
        };
      });
      expect(layout.scrollWidth).toBe(layout.clientWidth);
      expect(layout.items.length).toBeGreaterThanOrEqual(5);
      expect(layout.items.every((item) => item.fontSize === "14px" && item.fontWeight === "800" && item.height >= 44)).toBe(true);
      if (width <= 720) {
        expect(Math.abs(layout.menu.left - layout.row.left)).toBeLessThanOrEqual(1);
        expect(Math.abs(layout.menu.width - layout.row.width)).toBeLessThanOrEqual(1);
      } else {
        expect(Math.abs(layout.menu.right - layout.row.right)).toBeLessThanOrEqual(1);
        expect(layout.menu.width).toBeLessThan(layout.row.width);
      }
    }
  } finally {
    if (server?.pid) process.kill(-server.pid, "SIGTERM");
  }
});
