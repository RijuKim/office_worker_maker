import type { ReactElement } from "react";

export type SceneArtType =
  | "campus"
  | "study"
  | "project"
  | "interview"
  | "social"
  | "money"
  | "burnout"
  | "intro"
  | "ending"
  | "spec"
  | "job"
  | "career"
  | "default";

export function SceneArt({ type }: { type: SceneArtType }): ReactElement {
  const art = SCENE_ARTS[type] ?? SCENE_ARTS.default;

  return (
    <svg
      aria-hidden="true"
      className="scene-art-svg"
      viewBox="0 0 220 260"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
      style={{ imageRendering: "pixelated", width: "100%", height: "100%", display: "block" }}
    >
      <rect fill="#8bc0d6" height="260" width="220" />
      {art}
    </svg>
  );
}

const PX = (x: number, y: number, w = 4, h = 4) => ({ x, y, width: w, height: h });

type PixelRectSpec = ReturnType<typeof PX>;
type PixelGroupChild = PixelRectSpec | PixelRectSpec[] | PixelRectSpec[][];

function PixelRect({ fill, x, y, width: w, height: h }: { fill: string; x: number; y: number; width: number; height: number }) {
  return <rect fill={fill} height={h} width={w} x={x} y={y} />;
}

function PixelGroup({ children, fill }: { children: PixelGroupChild; fill: string }) {
  const flat = (Array.isArray(children) ? children.flat(2) : [children]) as PixelRectSpec[];
  return (
    <g>
      {flat.map((p, i) => (
        <PixelRect fill={fill} key={i} x={p.x} y={p.y} width={p.width} height={p.height} />
      ))}
    </g>
  );
}

const SCENE_ARTS: Record<SceneArtType, ReactElement> = {
  campus: (
    <g>
      <PixelGroup fill="#8bc0d6">
        {Array.from({ length: 143 }, (_, i) => PX((i % 11) * 20, Math.floor(i / 11) * 20, 20, 20))}
      </PixelGroup>
      <PixelGroup fill="#f2b84b">
        {[PX(160, 40, 24, 24)]}
      </PixelGroup>
      <PixelGroup fill="#305d73">
        {[PX(20, 100, 60, 120), PX(140, 120, 60, 100)]}
      </PixelGroup>
      <PixelGroup fill="#f7d08b">
        {[PX(32, 116, 12, 16), PX(56, 116, 12, 16), PX(32, 144, 12, 16), PX(56, 144, 12, 16), PX(32, 172, 12, 16), PX(56, 172, 12, 16), PX(152, 136, 12, 16), PX(176, 136, 12, 16), PX(152, 164, 12, 16), PX(176, 164, 12, 16)]}
      </PixelGroup>
      <PixelGroup fill="#6f7f52">
        {Array.from({ length: 11 }, (_, i) => PX(i * 20, 220, 20, 40))}
        {[PX(80, 180, 20, 40), PX(120, 190, 20, 30)]}
      </PixelGroup>
      <PixelGroup fill="#c87838">
        {[PX(90, 220, 40, 40)]}
      </PixelGroup>
      <PixelGroup fill="#f4c28b">
        {[PX(100, 190, 12, 12)]}
      </PixelGroup>
      <PixelGroup fill="#d85f87">
        {[PX(96, 202, 20, 28)]}
      </PixelGroup>
    </g>
  ),
  study: (
    <g>
      <PixelGroup fill="#24384f">
        {Array.from({ length: 143 }, (_, i) => PX((i % 11) * 20, Math.floor(i / 11) * 20, 20, 20))}
      </PixelGroup>
      <PixelGroup fill="#35261c">
        {[PX(20, 40, 180, 12), PX(20, 80, 180, 12), PX(20, 120, 180, 12)]}
      </PixelGroup>
      <PixelGroup fill="#c87838">
        {[PX(24, 48, 16, 24), PX(44, 48, 12, 24), PX(80, 48, 16, 24), PX(120, 48, 12, 24), PX(160, 48, 20, 24), PX(24, 88, 12, 24), PX(60, 88, 16, 24), PX(100, 88, 16, 24), PX(140, 88, 12, 24), PX(170, 88, 16, 24)]}
      </PixelGroup>
      <PixelGroup fill="#305d73">
        {[PX(60, 48, 16, 24), PX(100, 48, 16, 24), PX(140, 48, 16, 24), PX(40, 88, 16, 24), PX(80, 88, 16, 24), PX(120, 88, 16, 24), PX(160, 88, 8, 24)]}
      </PixelGroup>
      <PixelGroup fill="#f2b84b">
        {[PX(160, 160, 16, 12), PX(166, 172, 4, 20)]}
      </PixelGroup>
      <PixelGroup fill="#f4c28b">
        {[PX(100, 150, 16, 16)]}
      </PixelGroup>
      <PixelGroup fill="#d85f87">
        {[PX(92, 166, 32, 24)]}
      </PixelGroup>
      <PixelGroup fill="#c87838">
        {[PX(20, 190, 180, 16), PX(30, 206, 12, 54), PX(178, 206, 12, 54)]}
      </PixelGroup>
      <PixelGroup fill="#fffaf0">
        {[PX(80, 182, 24, 8), PX(110, 180, 20, 10)]}
      </PixelGroup>
    </g>
  ),
  project: (
    <g>
      <PixelGroup fill="#4a6a7a">
        {Array.from({ length: 143 }, (_, i) => PX((i % 11) * 20, Math.floor(i / 11) * 20, 20, 20))}
      </PixelGroup>
      <PixelGroup fill="#8bc0d6">
        {[PX(40, 40, 60, 60), PX(120, 40, 60, 60)]}
      </PixelGroup>
      <PixelGroup fill="#f7d08b">
        {[PX(44, 44, 52, 52), PX(124, 44, 52, 52)]}
      </PixelGroup>
      <PixelGroup fill="#c87838">
        {[PX(20, 180, 180, 16), PX(40, 196, 16, 64), PX(164, 196, 16, 64)]}
      </PixelGroup>
      <PixelGroup fill="#fffaf0">
        {[PX(130, 174, 30, 6)]}
      </PixelGroup>
      <PixelGroup fill="#16130f">
        {[PX(50, 140, 50, 40), PX(46, 180, 58, 4)]}
      </PixelGroup>
      <PixelGroup fill="#305d73">
        {[PX(54, 144, 42, 32)]}
      </PixelGroup>
      <PixelGroup fill="#d85f87">
        {[PX(150, 164, 12, 16)]}
      </PixelGroup>
      <PixelGroup fill="#f4c28b">
        {[PX(100, 120, 16, 16)]}
      </PixelGroup>
      <PixelGroup fill="#b3423c">
        {[PX(92, 136, 32, 44)]}
      </PixelGroup>
    </g>
  ),
  interview: (
    <g>
      <PixelGroup fill="#24384f">
        {Array.from({ length: 143 }, (_, i) => PX((i % 11) * 20, Math.floor(i / 11) * 20, 20, 20))}
      </PixelGroup>
      <PixelGroup fill="#305d73">
        {[PX(40, 40, 140, 120)]}
      </PixelGroup>
      <PixelGroup fill="#f7d08b">
        {[PX(50, 50, 120, 100)]}
      </PixelGroup>
      <PixelGroup fill="#c87838">
        {[PX(40, 180, 140, 16), PX(50, 196, 12, 64), PX(158, 196, 12, 64)]}
      </PixelGroup>
      <PixelGroup fill="#f4c28b">
        {[PX(60, 110, 16, 16), PX(144, 110, 16, 16)]}
      </PixelGroup>
      <PixelGroup fill="#24384f">
        {[PX(56, 126, 24, 54), PX(140, 126, 24, 54)]}
      </PixelGroup>
      <PixelGroup fill="#fffaf0">
        {[PX(100, 174, 20, 6)]}
      </PixelGroup>
    </g>
  ),
  social: (
    <g>
      <PixelGroup fill="#f3abc4">
        {Array.from({ length: 143 }, (_, i) => PX((i % 11) * 20, Math.floor(i / 11) * 20, 20, 20))}
      </PixelGroup>
      <PixelGroup fill="#d85f87">
        {[PX(40, 30, 12, 12), PX(80, 50, 12, 12), PX(120, 20, 12, 12), PX(160, 40, 12, 12)]}
      </PixelGroup>
      <PixelGroup fill="#b3423c">
        {[PX(42, 32, 8, 8), PX(82, 52, 8, 8), PX(122, 22, 8, 8), PX(162, 42, 8, 8)]}
      </PixelGroup>
      <PixelGroup fill="#f2b84b">
        {[PX(0, 0, 220, 20)]}
      </PixelGroup>
      <PixelGroup fill="#f4c28b">
        {[PX(60, 120, 16, 16), PX(100, 140, 16, 16), PX(144, 130, 16, 16)]}
      </PixelGroup>
      <PixelGroup fill="#305d73">
        {[PX(52, 136, 32, 60)]}
      </PixelGroup>
      <PixelGroup fill="#c87838">
        {[PX(92, 156, 32, 60)]}
      </PixelGroup>
      <PixelGroup fill="#6f7f52">
        {[PX(136, 146, 32, 60)]}
      </PixelGroup>
      <PixelGroup fill="#35261c">
        {[PX(0, 210, 220, 50)]}
      </PixelGroup>
    </g>
  ),
  money: (
    <g>
      <PixelGroup fill="#b8d7a3">
        {Array.from({ length: 143 }, (_, i) => PX((i % 11) * 20, Math.floor(i / 11) * 20, 20, 20))}
      </PixelGroup>
      <PixelGroup fill="#305d73">
        {[PX(20, 40, 80, 120), PX(120, 40, 80, 120)]}
      </PixelGroup>
      <PixelGroup fill="#f7d08b">
        {[PX(28, 56, 64, 12), PX(28, 84, 64, 12), PX(28, 112, 64, 12), PX(28, 140, 64, 12), PX(128, 56, 64, 12), PX(128, 84, 64, 12), PX(128, 112, 64, 12), PX(128, 140, 64, 12)]}
      </PixelGroup>
      <PixelGroup fill="#c87838">
        {[PX(0, 180, 220, 30)]}
      </PixelGroup>
      <PixelGroup fill="#f2b84b">
        {[PX(90, 150, 40, 30)]}
      </PixelGroup>
      <PixelGroup fill="#16130f">
        {[PX(94, 154, 32, 16)]}
      </PixelGroup>
      <PixelGroup fill="#f4c28b">
        {[PX(40, 140, 16, 16)]}
      </PixelGroup>
      <PixelGroup fill="#b3423c">
        {[PX(36, 156, 24, 24)]}
      </PixelGroup>
      <PixelGroup fill="#35261c">
        {[PX(0, 210, 220, 50)]}
      </PixelGroup>
    </g>
  ),
  burnout: (
    <g>
      <PixelGroup fill="#16130f">
        {Array.from({ length: 143 }, (_, i) => PX((i % 11) * 20, Math.floor(i / 11) * 20, 20, 20))}
      </PixelGroup>
      <PixelGroup fill="#24384f">
        {[PX(20, 20, 40, 40), PX(160, 40, 40, 40), PX(40, 120, 40, 40), PX(140, 140, 40, 40)]}
      </PixelGroup>
      <PixelGroup fill="#35261c">
        {[PX(0, 220, 220, 40)]}
      </PixelGroup>
      <PixelGroup fill="#f4c28b">
        {[PX(100, 160, 20, 20)]}
      </PixelGroup>
      <PixelGroup fill="#8d8797">
        {[PX(80, 180, 60, 40)]}
      </PixelGroup>
      <PixelGroup fill="#b3423c">
        {[PX(110, 80, 16, 16), PX(100, 96, 36, 16), PX(90, 112, 56, 16), PX(100, 128, 36, 16), PX(110, 144, 16, 16)]}
      </PixelGroup>
    </g>
  ),
  intro: (
    <g>
      <PixelGroup fill="#f3abc4">
        {[PX(0, 0, 220, 60)]}
      </PixelGroup>
      <PixelGroup fill="#f7d08b">
        {[PX(0, 60, 220, 60)]}
      </PixelGroup>
      <PixelGroup fill="#8bc0d6">
        {[PX(0, 120, 220, 60)]}
      </PixelGroup>
      <PixelGroup fill="#6f7f52">
        {[PX(0, 180, 220, 80)]}
      </PixelGroup>
      <PixelGroup fill="#c87838">
        {[PX(90, 180, 40, 80)]}
      </PixelGroup>
      <PixelGroup fill="#f2b84b">
        {[PX(100, 100, 40, 40)]}
      </PixelGroup>
      <PixelGroup fill="#f4c28b">
        {[PX(100, 140, 12, 12)]}
      </PixelGroup>
      <PixelGroup fill="#305d73">
        {[PX(96, 152, 20, 28)]}
      </PixelGroup>
      <PixelGroup fill="#fffaf0">
        {[PX(20, 30, 8, 8), PX(60, 80, 8, 8), PX(180, 40, 8, 8), PX(160, 100, 8, 8)]}
      </PixelGroup>
    </g>
  ),
  ending: (
    <g>
      <PixelGroup fill="#b3423c">
        {[PX(0, 0, 220, 60)]}
      </PixelGroup>
      <PixelGroup fill="#d85f87">
        {[PX(0, 60, 220, 60)]}
      </PixelGroup>
      <PixelGroup fill="#c87838">
        {[PX(0, 120, 220, 60)]}
      </PixelGroup>
      <PixelGroup fill="#35261c">
        {[PX(0, 180, 220, 80)]}
      </PixelGroup>
      <PixelGroup fill="#f2b84b">
        {[PX(90, 150, 40, 40)]}
      </PixelGroup>
      <PixelGroup fill="#8d8797">
        {[PX(90, 180, 40, 80)]}
      </PixelGroup>
      <PixelGroup fill="#f4c28b">
        {[PX(104, 160, 8, 8)]}
      </PixelGroup>
      <PixelGroup fill="#24384f">
        {[PX(100, 168, 16, 20)]}
      </PixelGroup>
    </g>
  ),
  spec: (
    <g>
      <PixelGroup fill="#4a6a7a">
        {Array.from({ length: 143 }, (_, i) => PX((i % 11) * 20, Math.floor(i / 11) * 20, 20, 20))}
      </PixelGroup>
      <PixelGroup fill="#c87838">
        {[PX(20, 160, 180, 20), PX(40, 180, 16, 80), PX(164, 180, 16, 80)]}
      </PixelGroup>
      <PixelGroup fill="#fffaf0">
        {[PX(40, 140, 40, 20), PX(90, 120, 60, 40), PX(160, 140, 40, 20)]}
      </PixelGroup>
      <PixelGroup fill="#d85f87">
        {[PX(44, 144, 32, 12), PX(164, 144, 32, 12)]}
      </PixelGroup>
      <PixelGroup fill="#f2b84b">
        {[PX(100, 130, 40, 20), PX(110, 140, 20, 30)]}
      </PixelGroup>
      <PixelGroup fill="#305d73">
        {[PX(50, 40, 120, 16)]}
      </PixelGroup>
      <PixelGroup fill="#8bc0d6">
        {[PX(60, 40, 16, 16), PX(90, 40, 16, 16), PX(120, 40, 16, 16)]}
      </PixelGroup>
    </g>
  ),
  job: (
    <g>
      <PixelGroup fill="#8bc0d6">
        {Array.from({ length: 143 }, (_, i) => PX((i % 11) * 20, Math.floor(i / 11) * 20, 20, 20))}
      </PixelGroup>
      <PixelGroup fill="#305d73">
        {[PX(20, 20, 80, 180), PX(120, 40, 80, 160)]}
      </PixelGroup>
      <PixelGroup fill="#f7d08b">
        {[PX(30, 30, 60, 20), PX(30, 60, 60, 20), PX(30, 90, 60, 20), PX(30, 120, 60, 20), PX(30, 150, 60, 20), PX(130, 50, 60, 20), PX(130, 80, 60, 20), PX(130, 110, 60, 20), PX(130, 140, 60, 20), PX(130, 170, 60, 20)]}
      </PixelGroup>
      <PixelGroup fill="#6f7f52">
        {[PX(0, 200, 220, 60)]}
      </PixelGroup>
      <PixelGroup fill="#f4c28b">
        {[PX(100, 160, 16, 16)]}
      </PixelGroup>
      <PixelGroup fill="#24384f">
        {[PX(92, 176, 32, 44)]}
      </PixelGroup>
      <PixelGroup fill="#16130f">
        {[PX(112, 186, 20, 16)]}
      </PixelGroup>
    </g>
  ),
  career: (
    <g>
      <PixelGroup fill="#8bc0d6">
        {Array.from({ length: 143 }, (_, i) => PX((i % 11) * 20, Math.floor(i / 11) * 20, 20, 20))}
      </PixelGroup>
      <PixelGroup fill="#6f7f52">
        {[PX(0, 140, 220, 120)]}
      </PixelGroup>
      <PixelGroup fill="#c87838">
        {[PX(80, 200, 60, 60), PX(0, 140, 80, 60), PX(140, 140, 80, 60)]}
      </PixelGroup>
      <PixelGroup fill="#35261c">
        {[PX(100, 100, 8, 80)]}
      </PixelGroup>
      <PixelGroup fill="#f7d08b">
        {[PX(60, 110, 40, 20), PX(108, 120, 40, 20)]}
      </PixelGroup>
      <PixelGroup fill="#d85f87">
        {[PX(70, 116, 20, 8), PX(118, 126, 20, 8)]}
      </PixelGroup>
      <PixelGroup fill="#f4c28b">
        {[PX(100, 170, 16, 16)]}
      </PixelGroup>
      <PixelGroup fill="#305d73">
        {[PX(96, 186, 24, 30)]}
      </PixelGroup>
    </g>
  ),
  default: (
    <g>
      <PixelGroup fill="#24384f">
        {Array.from({ length: 143 }, (_, i) => PX((i % 11) * 20, Math.floor(i / 11) * 20, 20, 20))}
      </PixelGroup>
      <PixelGroup fill="#f2b84b">
        {[PX(90, 80, 40, 40)]}
      </PixelGroup>
      <PixelGroup fill="#f7d08b">
        {[PX(20, 40, 8, 8), PX(180, 60, 8, 8), PX(40, 140, 8, 8), PX(160, 180, 8, 8)]}
      </PixelGroup>
      <PixelGroup fill="#c87838">
        {[PX(80, 220, 60, 40)]}
      </PixelGroup>
    </g>
  ),
};
