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

test("Toss dawn art has area-weighted approved color regions and no cross above the structurally located computer", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "one Chromium run provides standards-based SVG geometry");
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
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto("http://127.0.0.1:5173/");

    const inspection = await page.evaluate(async () => {
      type Point = { x: number; y: number };
      type Box = { left: number; right: number; top: number; bottom: number; width: number; height: number };
      type Shape = { element: SVGGeometryElement; box: Box; points: Point[]; fill: [number, number, number, number] };
      const svg = document.querySelector<SVGSVGElement>('[data-testid="intro-scene-svg"]')!;
      const primitiveSelector = "rect,circle,ellipse,line,path,polygon,polyline";
      const elements = [...svg.querySelectorAll<SVGGeometryElement>(primitiveSelector)];
      const transform = (point: DOMPoint, matrix: DOMMatrix) => point.matrixTransform(matrix);
      const color = (element: Element): [number, number, number, number] => {
        const match = getComputedStyle(element).fill.match(/[\d.]+/g)?.map(Number) ?? [];
        return [match[0] ?? 0, match[1] ?? 0, match[2] ?? 0, match[3] ?? 1];
      };
      const shapes: Shape[] = elements.map((element) => {
        const bbox = element.getBBox();
        const matrix = element.getCTM();
        if (!matrix) throw new Error("SVG primitive has no CTM");
        const stroke = Number.parseFloat(getComputedStyle(element).strokeWidth) || 0;
        const corners = [
          new DOMPoint(bbox.x - stroke / 2, bbox.y - stroke / 2),
          new DOMPoint(bbox.x + bbox.width + stroke / 2, bbox.y - stroke / 2),
          new DOMPoint(bbox.x + bbox.width + stroke / 2, bbox.y + bbox.height + stroke / 2),
          new DOMPoint(bbox.x - stroke / 2, bbox.y + bbox.height + stroke / 2),
        ].map((point) => transform(point, matrix));
        const totalLength = element.getTotalLength();
        const samples = Math.max(2, Math.ceil(totalLength / 2));
        const points = Array.from({ length: samples + 1 }, (_, index) => {
          const point = element.getPointAtLength(totalLength * index / samples);
          const transformed = transform(new DOMPoint(point.x, point.y), matrix);
          return { x: transformed.x, y: transformed.y };
        });
        const xs = corners.map(({ x }) => x); const ys = corners.map(({ y }) => y);
        const box = { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
        if (![...xs, ...ys, ...points.flatMap(({ x, y }) => [x, y])].every(Number.isFinite)) throw new Error("non-finite SVG geometry");
        return { element, box, points, fill: color(element) };
      });
      const contains = (outer: Box, inner: Box, margin = 0) => outer.left <= inner.left + margin && outer.right >= inner.right - margin && outer.top <= inner.top + margin && outer.bottom >= inner.bottom - margin;
      const luminance = ([red, green, blue]: number[]) => {
        const values = [red, green, blue].map((channel) => { const value = channel / 255; return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4; });
        return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
      };
      const hue = ([redByte, greenByte, blueByte]: number[]) => {
        const [red, green, blue] = [redByte, greenByte, blueByte].map((channel) => channel / 255);
        const max = Math.max(red, green, blue), min = Math.min(red, green, blue), delta = max - min;
        if (!delta) return 0;
        const sector = max === red ? ((green - blue) / delta) % 6 : max === green ? (blue - red) / delta + 2 : (red - green) / delta + 4;
        return (sector * 60 + 360) % 360;
      };
      const saturation = ([red, green, blue]: number[]) => (Math.max(red, green, blue) - Math.min(red, green, blue)) / 255;

      const svgBox = shapes.reduce<Box>((box, shape) => ({
        left: Math.min(box.left, shape.box.left), right: Math.max(box.right, shape.box.right),
        top: Math.min(box.top, shape.box.top), bottom: Math.max(box.bottom, shape.box.bottom),
        width: 0, height: 0,
      }), { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity, width: 0, height: 0 });
      svgBox.width = svgBox.right - svgBox.left; svgBox.height = svgBox.bottom - svgBox.top;

      const screenCandidates = shapes.filter((screen) => {
        const center = (screen.box.left + screen.box.right) / 2;
        if (center <= (svgBox.left + svgBox.right) / 2 || luminance(screen.fill) < 0.55 || screen.box.width <= screen.box.height) return false;
        return shapes.some((detail) => detail !== screen && contains(screen.box, detail.box) && detail.box.width < screen.box.width && detail.box.height < screen.box.height)
          && shapes.some((frame) => frame !== screen && luminance(frame.fill) < 0.12 && contains(frame.box, screen.box) && frame.box.width > screen.box.width && frame.box.height > screen.box.height)
          && shapes.some((desk) => luminance(desk.fill) < 0.12 && desk.box.width > screen.box.width && desk.box.top >= screen.box.bottom && desk.box.left < center && desk.box.right > center);
      });
      if (screenCandidates.length !== 1) throw new Error(`expected one structurally identifiable computer screen, got ${screenCandidates.length}`);
      const screen = screenCandidates[0];
      const frame = shapes.filter((candidate) => luminance(candidate.fill) < 0.12 && contains(candidate.box, screen.box) && candidate.box.width > screen.box.width).sort((a, b) => a.box.width * a.box.height - b.box.width * b.box.height)[0];

      const windowFrame = shapes.filter((candidate) => luminance(candidate.fill) > 0.55 && candidate.box.width > candidate.box.height)
        .map((candidate) => ({ candidate, children: shapes.filter((child) => child !== candidate && contains(candidate.box, child.box) && saturation(child.fill) > 0.15) }))
        .filter(({ children }) => children.length >= 2)
        .sort((a, b) => b.candidate.box.width * b.candidate.box.height - a.candidate.box.width * a.candidate.box.height)[0];
      if (!windowFrame) throw new Error("no geometrically nested dawn window found");
      const dawnBox = windowFrame.children.reduce<Box>((box, child) => ({
        left: Math.min(box.left, child.box.left), right: Math.max(box.right, child.box.right),
        top: Math.min(box.top, child.box.top), bottom: Math.max(box.bottom, child.box.bottom), width: 0, height: 0,
      }), { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity, width: 0, height: 0 });
      dawnBox.width = dawnBox.right - dawnBox.left; dawnBox.height = dawnBox.bottom - dawnBox.top;

      const source = new XMLSerializer().serializeToString(svg);
      const image = new Image();
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(svgBox.width); canvas.height = Math.ceil(svgBox.height);
      const context = canvas.getContext("2d", { willReadFrequently: true })!;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const coverage = (region: Box) => {
        const counts = { total: 0, blueLilac: 0, apricot: 0, bright: 0 };
        for (let y = Math.max(0, Math.floor(region.top)); y < Math.min(canvas.height, Math.ceil(region.bottom)); y += 1) {
          for (let x = Math.max(0, Math.floor(region.left)); x < Math.min(canvas.width, Math.ceil(region.right)); x += 1) {
            const offset = (y * canvas.width + x) * 4; const pixel = [pixels[offset], pixels[offset + 1], pixels[offset + 2]];
            if (pixels[offset + 3] === 0) continue;
            const pixelHue = hue(pixel), pixelSaturation = saturation(pixel), pixelLuminance = luminance(pixel);
            counts.total += 1;
            if (pixelHue >= 205 && pixelHue <= 285 && pixelSaturation >= 0.12) counts.blueLilac += 1;
            if (pixelHue >= 15 && pixelHue <= 50 && pixelSaturation >= 0.25) counts.apricot += 1;
            if (pixelLuminance >= 0.35) counts.bright += 1;
          }
        }
        return { blueLilac: counts.blueLilac / counts.total, apricot: counts.apricot / counts.total, bright: counts.bright / counts.total };
      };

      const thinAxes = shapes.flatMap((shape) => {
        const { box } = shape; const major = Math.max(box.width, box.height), minor = Math.min(box.width, box.height);
        if (major < 4 || major < minor * 3) return [];
        const center = { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 };
        const first = shape.points[0];
        const farthest = shape.points.reduce((best, point) => Math.hypot(point.x - first.x, point.y - first.y) > Math.hypot(best.x - first.x, best.y - first.y) ? point : best, first);
        const dx = farthest.x - first.x, dy = farthest.y - first.y, length = Math.hypot(dx, dy) || 1;
        return [{ a: { x: center.x - dx / length * major / 2, y: center.y - dy / length * major / 2 }, b: { x: center.x + dx / length * major / 2, y: center.y + dy / length * major / 2 } }];
      }).filter(({ a, b }) => Math.max(a.y, b.y) < frame.box.top && Math.max(a.x, b.x) > frame.box.left && Math.min(a.x, b.x) < frame.box.right);
      const intersects = (one: { a: Point; b: Point }, two: { a: Point; b: Point }) => {
        const cross = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
        const intersectsSegments = cross(one.a, one.b, two.a) * cross(one.a, one.b, two.b) <= 0 && cross(two.a, two.b, one.a) * cross(two.a, two.b, one.b) <= 0;
        const oneVector = { x: one.b.x - one.a.x, y: one.b.y - one.a.y }; const twoVector = { x: two.b.x - two.a.x, y: two.b.y - two.a.y };
        const perpendicular = Math.abs(oneVector.x * twoVector.x + oneVector.y * twoVector.y) / (Math.hypot(oneVector.x, oneVector.y) * Math.hypot(twoVector.x, twoVector.y)) < 0.2;
        return intersectsSegments && perpendicular;
      };
      const hasCross = thinAxes.some((first, index) => thinAxes.slice(index + 1).some((second) => intersects(first, second)));
      return { primitiveCount: elements.length, geometryCount: shapes.length, dawn: coverage(dawnBox), room: coverage(svgBox), hasCross };
    });

    expect(inspection.geometryCount).toBe(inspection.primitiveCount);
    expect(inspection.primitiveCount).toBeGreaterThan(10);
    expect(inspection.dawn.apricot).toBeGreaterThan(0.35);
    expect(inspection.dawn.bright).toBeGreaterThan(0.45);
    expect(inspection.room.blueLilac).toBeGreaterThan(0.2);
    expect(inspection.room.apricot).toBeGreaterThan(0.18);
    expect(inspection.room.bright).toBeGreaterThan(0.28);
    expect(inspection.hasCross).toBe(false);
  } finally {
    if (server?.pid) process.kill(-server.pid, "SIGTERM");
  }
});
