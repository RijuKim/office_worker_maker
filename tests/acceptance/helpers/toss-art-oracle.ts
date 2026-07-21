export type TossArtMutation =
  | "none" | "cross-rect" | "cross-line" | "cross-path" | "cross-polygon" | "cross-polyline"
  | "cross-rotated" | "cross-stroked-endpoint" | "negative-parallel" | "negative-separated" | "negative-tiny"
  | "palette-tiny-room" | "palette-tiny-dawn" | "palette-tiny-blue";

type Point = { x: number; y: number };
type Box = { left: number; right: number; top: number; bottom: number; width: number; height: number };

export async function inspectTossArt(mutation: TossArtMutation) {
  const original = document.querySelector<SVGSVGElement>('[data-testid="intro-scene-svg"]')!;
  const svg = original.cloneNode(true) as SVGSVGElement;
  svg.style.position = "fixed";
  svg.style.left = "-10000px";
  svg.style.width = "320px";
  svg.style.height = "180px";
  document.body.append(svg);
  const ns = "http://www.w3.org/2000/svg";
  const add = (tag: string, attributes: Record<string, string>) => {
    const node = document.createElementNS(ns, tag);
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
    svg.append(node);
  };
  const common = { fill: "#211b22", stroke: "#211b22" };
  if (mutation === "cross-rect") {
    add("rect", { x: "220", y: "42", width: "36", height: "4", ...common }); add("rect", { x: "236", y: "26", width: "4", height: "36", ...common });
  } else if (mutation === "cross-line" || mutation === "cross-stroked-endpoint") {
    const endpoint = mutation === "cross-stroked-endpoint";
    add("line", { x1: endpoint ? "218" : "220", y1: "44", x2: endpoint ? "238" : "256", y2: "44", "stroke-width": endpoint ? "6" : "3", ...common });
    add("line", { x1: "238", y1: endpoint ? "44" : "26", x2: "238", y2: "62", "stroke-width": endpoint ? "6" : "3", ...common });
  } else if (mutation === "cross-path") {
    add("path", { d: "M220 44 H256", "stroke-width": "4", ...common, fill: "none" }); add("path", { d: "M238 26 V62", "stroke-width": "4", ...common, fill: "none" });
  } else if (mutation === "cross-polygon") {
    add("polygon", { points: "220,42 256,42 256,46 220,46", ...common }); add("polygon", { points: "236,26 240,26 240,62 236,62", ...common });
  } else if (mutation === "cross-polyline") {
    add("polyline", { points: "220,44 256,44", "stroke-width": "4", ...common, fill: "none" }); add("polyline", { points: "238,26 238,62", "stroke-width": "4", ...common, fill: "none" });
  } else if (mutation === "cross-rotated") {
    add("rect", { x: "220", y: "42", width: "36", height: "4", transform: "rotate(31 238 44)", ...common });
    add("rect", { x: "236", y: "26", width: "4", height: "36", transform: "rotate(31 238 44)", ...common });
  } else if (mutation === "negative-parallel") {
    add("line", { x1: "220", y1: "35", x2: "256", y2: "35", "stroke-width": "4", ...common }); add("line", { x1: "220", y1: "50", x2: "256", y2: "50", "stroke-width": "4", ...common });
  } else if (mutation === "negative-separated") {
    add("line", { x1: "218", y1: "35", x2: "232", y2: "35", "stroke-width": "4", ...common }); add("line", { x1: "244", y1: "42", x2: "244", y2: "58", "stroke-width": "4", ...common });
  } else if (mutation === "negative-tiny") {
    add("rect", { x: "237", y: "42", width: "2", height: "1", ...common }); add("rect", { x: "237.5", y: "41.5", width: "1", height: "2", ...common });
  }
  if (mutation === "palette-tiny-room" || mutation === "palette-tiny-dawn") {
    for (const node of svg.querySelectorAll<SVGElement>('[data-part="room-blue"],[data-part="lilac-wall"],[data-part="apricot-dawn"],[data-part="room-shadow"],[data-part="window-blue"],[data-part="window-apricot"],[data-part="window-cream-light"],[data-part="bed"],[data-part="phone"],[data-part="floor"]')) node.setAttribute("fill", "#4a4a4a");
    const scope = mutation === "palette-tiny-dawn" ? { x: 30, y: 30 } : { x: 300, y: 145 };
    add("rect", { x: String(scope.x), y: String(scope.y), width: "2", height: "2", fill: "#718fbb" });
    add("rect", { x: String(scope.x + 3), y: String(scope.y), width: "2", height: "2", fill: "#f0a06f" });
  } else if (mutation === "palette-tiny-blue") {
    for (const node of svg.querySelectorAll<SVGElement>('[data-part="room-blue"],[data-part="window-blue"]')) node.setAttribute("fill", "#4a4a4a");
    add("rect", { x: "30", y: "30", width: "2", height: "2", fill: "#718fbb" });
  }

  const selector = "rect,circle,ellipse,line,path,polygon,polyline";
  const elements = [...svg.querySelectorAll<SVGGeometryElement>(selector)];
  const luminance = ([r, g, b]: number[]) => {
    const values = [r, g, b].map((byte) => { const v = byte / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
    return .2126 * values[0] + .7152 * values[1] + .0722 * values[2];
  };
  const rgba = (element: Element): [number, number, number, number] => {
    const values = getComputedStyle(element).fill.match(/[\d.]+/g)?.map(Number) ?? [];
    return [values[0] ?? 0, values[1] ?? 0, values[2] ?? 0, values[3] ?? 1];
  };
  const rootScreenMatrix = svg.getScreenCTM();
  if (!rootScreenMatrix) throw new Error("root SVG has no screen transform");
  const screenToViewBox = rootScreenMatrix.inverse();
  const shapes = elements.map((element) => {
    const elementScreenMatrix = element.getScreenCTM();
    if (!elementScreenMatrix) throw new Error("SVG primitive has no screen transform");
    // getScreenCTM includes the clone's off-screen CSS translation. Remove the
    // root transform so geometry and the 320x180 raster share viewBox space.
    const matrix = screenToViewBox.multiply(elementScreenMatrix); const bbox = element.getBBox();
    const scale = Math.max(Math.hypot(matrix.a, matrix.b), Math.hypot(matrix.c, matrix.d));
    const radius = (Number.parseFloat(getComputedStyle(element).strokeWidth) || 0) * scale / 2;
    const length = element.getTotalLength(); const sampleCount = Math.max(8, Math.ceil(length / 2));
    const points = Array.from({ length: sampleCount + 1 }, (_, i) => {
      const local = element.getPointAtLength(length * i / sampleCount); const point = new DOMPoint(local.x, local.y).matrixTransform(matrix);
      return { x: point.x, y: point.y };
    });
    const corners = [[bbox.x, bbox.y], [bbox.x + bbox.width, bbox.y], [bbox.x + bbox.width, bbox.y + bbox.height], [bbox.x, bbox.y + bbox.height]].map(([x, y]) => {
      const point = new DOMPoint(x, y).matrixTransform(matrix); return { x: point.x, y: point.y };
    });
    const xs = corners.map((p) => p.x), ys = corners.map((p) => p.y);
    const box = { left: Math.min(...xs) - radius, right: Math.max(...xs) + radius, top: Math.min(...ys) - radius, bottom: Math.max(...ys) + radius } as Box;
    box.width = box.right - box.left; box.height = box.bottom - box.top;
    if (![box.left, box.right, box.top, box.bottom, ...points.flatMap(({ x, y }) => [x, y])].every(Number.isFinite)) throw new Error("non-finite SVG geometry");
    return { element, points, radius, box, fill: rgba(element) };
  });
  const contains = (outer: Box, inner: Box) => outer.left <= inner.left && outer.right >= inner.right && outer.top <= inner.top && outer.bottom >= inner.bottom;
  const bounds = shapes.reduce((box, shape) => ({ left: Math.min(box.left, shape.box.left), right: Math.max(box.right, shape.box.right), top: Math.min(box.top, shape.box.top), bottom: Math.max(box.bottom, shape.box.bottom), width: 0, height: 0 }), { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity, width: 0, height: 0 });
  bounds.width = bounds.right - bounds.left; bounds.height = bounds.bottom - bounds.top;
  const screens = shapes.filter((screen) => {
    const center = (screen.box.left + screen.box.right) / 2;
    return center > (bounds.left + bounds.right) / 2 && luminance(screen.fill) >= .55 && screen.box.width > screen.box.height
      && shapes.some((detail) => detail !== screen && contains(screen.box, detail.box) && detail.box.width < screen.box.width)
      && shapes.some((frame) => frame !== screen && luminance(frame.fill) < .12 && contains(frame.box, screen.box) && frame.box.width > screen.box.width)
      && shapes.some((desk) => luminance(desk.fill) < .12 && desk.box.width > screen.box.width && desk.box.top >= screen.box.bottom && desk.box.left < center && desk.box.right > center);
  });
  if (screens.length !== 1) throw new Error(`expected one screen, got ${screens.length}`);
  const screen = screens[0];
  const frame = shapes.filter((shape) => luminance(shape.fill) < .12 && contains(shape.box, screen.box) && shape.box.width > screen.box.width).sort((a, b) => a.box.width * a.box.height - b.box.width * b.box.height)[0];

  const axes = shapes.flatMap((shape) => {
    const points = shape.points; const mean = points.reduce((sum, p) => ({ x: sum.x + p.x / points.length, y: sum.y + p.y / points.length }), { x: 0, y: 0 });
    let xx = 0, xy = 0, yy = 0;
    for (const p of points) { const dx = p.x - mean.x, dy = p.y - mean.y; xx += dx * dx; xy += dx * dy; yy += dy * dy; }
    const angle = .5 * Math.atan2(2 * xy, xx - yy); const unit = { x: Math.cos(angle), y: Math.sin(angle) }; const normal = { x: -unit.y, y: unit.x };
    const majorProjection = points.map((p) => p.x * unit.x + p.y * unit.y); const minorProjection = points.map((p) => p.x * normal.x + p.y * normal.y);
    const major = Math.max(...majorProjection) - Math.min(...majorProjection) + shape.radius * 2;
    const minor = Math.max(...minorProjection) - Math.min(...minorProjection) + shape.radius * 2;
    if (major < 4 || major < minor * 3) return [];
    const centerProjection = mean.x * unit.x + mean.y * unit.y;
    const half = (Math.max(...majorProjection) - Math.min(...majorProjection)) / 2;
    const center = { x: mean.x + unit.x * ((Math.min(...majorProjection) + Math.max(...majorProjection)) / 2 - centerProjection), y: mean.y + unit.y * ((Math.min(...majorProjection) + Math.max(...majorProjection)) / 2 - centerProjection) };
    return [{ a: { x: center.x - unit.x * half, y: center.y - unit.y * half }, b: { x: center.x + unit.x * half, y: center.y + unit.y * half }, radius: Math.max(shape.radius, minor / 2), unit }];
  }).filter((axis) => Math.max(axis.a.y, axis.b.y) + axis.radius <= frame.box.top && Math.max(axis.a.x, axis.b.x) + axis.radius >= frame.box.left && Math.min(axis.a.x, axis.b.x) - axis.radius <= frame.box.right);
  const pointSegmentDistance = (point: Point, a: Point, b: Point) => { const dx = b.x - a.x, dy = b.y - a.y; const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy)); };
  const segmentDistance = (one: typeof axes[number], two: typeof axes[number]) => {
    const cross = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    const intersects = cross(one.a, one.b, two.a) * cross(one.a, one.b, two.b) <= 0 && cross(two.a, two.b, one.a) * cross(two.a, two.b, one.b) <= 0;
    return intersects ? 0 : Math.min(pointSegmentDistance(one.a, two.a, two.b), pointSegmentDistance(one.b, two.a, two.b), pointSegmentDistance(two.a, one.a, one.b), pointSegmentDistance(two.b, one.a, one.b));
  };
  const hasCross = axes.some((one, index) => axes.slice(index + 1).some((two) => Math.abs(one.unit.x * two.unit.x + one.unit.y * two.unit.y) < .25 && segmentDistance(one, two) <= one.radius + two.radius));

  const windowFrame = shapes.filter((shape) => luminance(shape.fill) > .55 && shape.box.width > shape.box.height).map((candidate) => ({ candidate, children: shapes.filter((child) => child !== candidate && contains(candidate.box, child.box)) })).filter(({ children }) => children.length >= 3).sort((a, b) => b.candidate.box.width * b.candidate.box.height - a.candidate.box.width * a.candidate.box.height)[0];
  if (!windowFrame) throw new Error("no dawn window");
  const dawn = windowFrame.children.reduce((box, child) => ({ left: Math.min(box.left, child.box.left), right: Math.max(box.right, child.box.right), top: Math.min(box.top, child.box.top), bottom: Math.max(box.bottom, child.box.bottom), width: 0, height: 0 }), { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity, width: 0, height: 0 });
  dawn.width = dawn.right - dawn.left; dawn.height = dawn.bottom - dawn.top;
  const rasterSvg = svg.cloneNode(true) as SVGSVGElement;
  rasterSvg.removeAttribute("style");
  rasterSvg.setAttribute("width", "320"); rasterSvg.setAttribute("height", "180");
  const image = new Image(); image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(rasterSvg))}`; await image.decode();
  const canvas = document.createElement("canvas"); canvas.width = 320; canvas.height = 180; const context = canvas.getContext("2d", { willReadFrequently: true })!; context.drawImage(image, 0, 0, 320, 180); const pixels = context.getImageData(0, 0, 320, 180).data;
  const hue = ([r0, g0, b0]: number[]) => { const [r, g, b] = [r0, g0, b0].map((v) => v / 255), max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min; if (!delta) return 0; return (((max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4) * 60) + 360) % 360; };
  const coverage = (region: Box) => { let total = 0, blueLilac = 0, apricot = 0, bright = 0; for (let y = Math.max(0, Math.floor(region.top)); y < Math.min(180, Math.ceil(region.bottom)); y++) for (let x = Math.max(0, Math.floor(region.left)); x < Math.min(320, Math.ceil(region.right)); x++) { const i = (y * 320 + x) * 4; if (!pixels[i + 3]) continue; const rgb = [pixels[i], pixels[i + 1], pixels[i + 2]], h = hue(rgb), saturation = (Math.max(...rgb) - Math.min(...rgb)) / 255, light = luminance(rgb); total++; if (h >= 205 && h <= 285 && saturation >= .12) blueLilac++; if (h >= 15 && h <= 50 && saturation >= .25) apricot++; if (light >= .35) bright++; } if (total === 0) throw new Error(`coverage region has no raster samples: ${JSON.stringify(region)}`); return { blueLilac: blueLilac / total, apricot: apricot / total, bright: bright / total }; };
  const result = { primitiveCount: elements.length, geometryCount: shapes.length, dawn: coverage(dawn), room: coverage(bounds), hasCross };
  svg.remove();
  return result;
}
