import type { ReactElement } from "react";

export type EndingArtType =
  | "company"
  | "professional"
  | "public_safety"
  | "startup"
  | "self_employment"
  | "graduate_school"
  | "marriage"
  | "parenting"
  | "solitude"
  | "overseas"
  | "dropout"
  | "burnout"
  | "default";

export function getEndingArtType(careerPath: string, tags: string[]): EndingArtType {
  const lower = `${careerPath} ${tags.join(" ")}`.toLowerCase();

  if (lower.includes("전문직") || lower.includes("변호사") || lower.includes("의사") || lower.includes("회계")) return "professional";
  if (lower.includes("공공") || lower.includes("공무원") || lower.includes("안전") || lower.includes("경찰")) return "public_safety";
  if (lower.includes("창업") || lower.includes("스타트업") || lower.includes("사업")) return "startup";
  if (lower.includes("자영") || lower.includes("프리랜서") || lower.includes("크리에이터")) return "self_employment";
  if (lower.includes("대학원") || lower.includes("연구") || lower.includes("석사") || lower.includes("박사")) return "graduate_school";
  if (lower.includes("결혼") || lower.includes("가정") || lower.includes("부부")) return "marriage";
  if (lower.includes("아이") || lower.includes("자녀") || lower.includes("육아") || lower.includes("가족")) return "parenting";
  if (lower.includes("혼자") || lower.includes("고립") || lower.includes("조용")) return "solitude";
  if (lower.includes("해외") || lower.includes("워홀") || lower.includes("유학")) return "overseas";
  if (lower.includes("자퇴") || lower.includes("중도") || lower.includes("이탈")) return "dropout";
  if (lower.includes("붕괴") || lower.includes("건강") || lower.includes("멘탈")) return "burnout";
  if (lower.includes("기업") || lower.includes("취업") || lower.includes("회사") || lower.includes("면접")) return "company";

  return "default";
}

export function EndingArt({
  type,
  size = 200,
  locked = false,
}: {
  type: EndingArtType;
  size?: number;
  locked?: boolean;
}): ReactElement {
  const s = size;
  const half = s / 2;

  const art = ENDING_ARTS[type] ?? ENDING_ARTS.default;

  return (
    <svg
      aria-hidden={locked ? undefined : "true"}
      aria-label={locked ? "잠긴 항목" : undefined}
      className="ending-art"
      height={s}
      viewBox={`0 0 ${s} ${s}`}
      role={locked ? "img" : undefined}
      width={s}
      xmlns="http://www.w3.org/2000/svg"
      style={{
        imageRendering: "pixelated",
        ...(locked ? { filter: "grayscale(1) brightness(0.3) contrast(1.2)" } : {}),
      }}
    >
      <rect fill="#16130f" height={s} width={s} />
      {art}
    </svg>
  );
}

const PX = (x: number, y: number, w = 4, h = 4) => ({ x, y, width: w, height: h });

function PixelRect({ fill, x, y, width: w, height: h }: { fill: string; x: number; y: number; width: number; height: number }) {
  return <rect fill={fill} height={h} width={w} x={x} y={y} />;
}

function PixelGroup({ children, fill }: { children: { x: number; y: number; w?: number; h?: number }[]; fill: string }) {
  return (
    <g>
      {children.map((p, i) => (
        <PixelRect fill={fill} key={i} x={p.x} y={p.y} width={p.w ?? 4} height={p.h ?? 4} />
      ))}
    </g>
  );
}

const ENDING_ARTS: Record<EndingArtType, ReactElement> = {
  company: (
    <g>
      {/* Sky */}
      <PixelGroup fill="#8bc0d6">
        {Array.from({ length: 50 }, (_, i) => PX((i % 10) * 20, Math.floor(i / 10) * 20, 20, 20))}
      </PixelGroup>
      {/* Building */}
      <PixelGroup fill="#305d73">
        {[PX(40, 40, 120, 20), PX(40, 60, 120, 20), PX(40, 80, 120, 20), PX(40, 100, 120, 20), PX(40, 120, 120, 20)]}
      </PixelGroup>
      {/* Windows */}
      <PixelGroup fill="#f7d08b">
        {[PX(52, 48, 12, 12), PX(76, 48, 12, 12), PX(100, 48, 12, 12), PX(124, 48, 12, 12),
          PX(52, 68, 12, 12), PX(76, 68, 12, 12), PX(100, 68, 12, 12), PX(124, 68, 12, 12),
          PX(52, 88, 12, 12), PX(76, 88, 12, 12), PX(100, 88, 12, 12), PX(124, 88, 12, 12)]}
      </PixelGroup>
      {/* Door */}
      <PixelGroup fill="#35261c">
        {[PX(88, 120, 24, 20), PX(88, 140, 24, 20)]}
      </PixelGroup>
      {/* Ground */}
      <PixelGroup fill="#6f7f52">
        {Array.from({ length: 10 }, (_, i) => PX(i * 20, 160, 20, 40))}
      </PixelGroup>
      {/* Person */}
      <PixelGroup fill="#f4c28b">
        {[PX(60, 130, 8, 8), PX(68, 130, 8, 8)]}
      </PixelGroup>
      <PixelGroup fill="#d85f87">
        {[PX(60, 138, 16, 20)]}
      </PixelGroup>
      {/* Sun */}
      <PixelGroup fill="#f2b84b">
        {[PX(140, 20, 20, 20)]}
      </PixelGroup>
    </g>
  ),

  professional: (
    <g>
      <PixelGroup fill="#24384f">
        {Array.from({ length: 50 }, (_, i) => PX((i % 10) * 20, Math.floor(i / 10) * 20, 20, 20))}
      </PixelGroup>
      {/* Bookshelf */}
      <PixelGroup fill="#35261c">
        {[PX(20, 40, 160, 8), PX(20, 60, 160, 8), PX(20, 80, 160, 8), PX(20, 100, 160, 8)]}
      </PixelGroup>
      {/* Books */}
      <PixelGroup fill="#c87838">
        {[PX(24, 48, 12, 12), PX(44, 48, 8, 12), PX(60, 48, 12, 12), PX(80, 48, 8, 12),
          PX(24, 68, 8, 12), PX(40, 68, 12, 12), PX(60, 68, 8, 12), PX(76, 68, 12, 12),
          PX(24, 88, 12, 12), PX(44, 88, 8, 12), PX(60, 88, 12, 12)]}
      </PixelGroup>
      <PixelGroup fill="#305d73">
        {[PX(100, 48, 12, 12), PX(120, 48, 8, 12), PX(100, 68, 8, 12), PX(120, 68, 12, 12),
          PX(100, 88, 12, 12), PX(120, 88, 8, 12)]}
      </PixelGroup>
      {/* Desk */}
      <PixelGroup fill="#c87838">
        {[PX(40, 120, 120, 8), PX(40, 128, 120, 8)]}
      </PixelGroup>
      {/* Person sitting */}
      <PixelGroup fill="#f4c28b">
        {[PX(80, 100, 12, 8), PX(92, 100, 12, 8)]}
      </PixelGroup>
      <PixelGroup fill="#d85f87">
        {[PX(80, 108, 24, 12)]}
      </PixelGroup>
      {/* Lamp */}
      <PixelGroup fill="#f2b84b">
        {[PX(140, 100, 8, 8), PX(140, 108, 4, 12)]}
      </PixelGroup>
      <PixelGroup fill="#35261c">
        {[PX(136, 120, 12, 4)]}
      </PixelGroup>
      <PixelGroup fill="#6f7f52">
        {Array.from({ length: 10 }, (_, i) => PX(i * 20, 160, 20, 40))}
      </PixelGroup>
    </g>
  ),

  public_safety: (
    <g>
      <PixelGroup fill="#4a6a7a">
        {Array.from({ length: 50 }, (_, i) => PX((i % 10) * 20, Math.floor(i / 10) * 20, 20, 20))}
      </PixelGroup>
      {/* Badge */}
      <PixelGroup fill="#f2b84b">
        {[PX(80, 20, 40, 8), PX(76, 28, 48, 8), PX(72, 36, 56, 8), PX(76, 44, 48, 8), PX(80, 52, 40, 8)]}
      </PixelGroup>
      <PixelGroup fill="#305d73">
        {[PX(88, 28, 24, 24)]}
      </PixelGroup>
      {/* Building */}
      <PixelGroup fill="#24384f">
        {[PX(40, 60, 120, 100)]}
      </PixelGroup>
      <PixelGroup fill="#f7d08b">
        {[PX(52, 68, 16, 12), PX(80, 68, 16, 12), PX(108, 68, 16, 12), PX(136, 68, 16, 12),
          PX(52, 88, 16, 12), PX(80, 88, 16, 12), PX(108, 88, 16, 12), PX(136, 88, 16, 12)]}
      </PixelGroup>
      {/* Door */}
      <PixelGroup fill="#35261c">
        {[PX(80, 120, 40, 40)]}
      </PixelGroup>
      <PixelGroup fill="#6f7f52">
        {Array.from({ length: 10 }, (_, i) => PX(i * 20, 160, 20, 40))}
      </PixelGroup>
      {/* Person */}
      <PixelGroup fill="#f4c28b">
        {[PX(40, 130, 8, 8), PX(48, 130, 8, 8)]}
      </PixelGroup>
      <PixelGroup fill="#305d73">
        {[PX(40, 138, 16, 20)]}
      </PixelGroup>
    </g>
  ),

  startup: (
    <g>
      <PixelGroup fill="#b8d7a3">
        {Array.from({ length: 50 }, (_, i) => PX((i % 10) * 20, Math.floor(i / 10) * 20, 20, 20))}
      </PixelGroup>
      {/* Rocket */}
      <PixelGroup fill="#d85f87">
        {[PX(88, 20, 24, 8), PX(84, 28, 32, 8), PX(80, 36, 40, 8), PX(80, 44, 40, 8), PX(80, 52, 40, 8)]}
      </PixelGroup>
      <PixelGroup fill="#f7d08b">
        {[PX(88, 36, 24, 16)]}
      </PixelGroup>
      {/* Window */}
      <PixelGroup fill="#8bc0d6">
        {[PX(92, 40, 16, 8)]}
      </PixelGroup>
      {/* Flame */}
      <PixelGroup fill="#f2b84b">
        {[PX(88, 60, 24, 8), PX(92, 68, 16, 8)]}
      </PixelGroup>
      <PixelGroup fill="#b3423c">
        {[PX(96, 60, 8, 8)]}
      </PixelGroup>
      {/* Ground */}
      <PixelGroup fill="#6f7f52">
        {Array.from({ length: 10 }, (_, i) => PX(i * 20, 160, 20, 40))}
      </PixelGroup>
      {/* Stars */}
      <PixelGroup fill="#f2b84b">
        {[PX(20, 20, 4, 4), PX(40, 40, 4, 4), PX(160, 30, 4, 4), PX(140, 60, 4, 4), PX(30, 80, 4, 4)]}
      </PixelGroup>
    </g>
  ),

  self_employment: (
    <g>
      <PixelGroup fill="#f3abc4">
        {Array.from({ length: 50 }, (_, i) => PX((i % 10) * 20, Math.floor(i / 10) * 20, 20, 20))}
      </PixelGroup>
      {/* Shop */}
      <PixelGroup fill="#c87838">
        {[PX(40, 40, 120, 120)]}
      </PixelGroup>
      {/* Awning */}
      <PixelGroup fill="#d85f87">
        {[PX(36, 36, 128, 8), PX(36, 44, 128, 4)]}
      </PixelGroup>
      {/* Window */}
      <PixelGroup fill="#8bc0d6">
        {[PX(48, 56, 40, 40), PX(112, 56, 40, 40)]}
      </PixelGroup>
      {/* Door */}
      <PixelGroup fill="#35261c">
        {[PX(76, 100, 48, 60)]}
      </PixelGroup>
      {/* Sign */}
      <PixelGroup fill="#f7d08b">
        {[PX(60, 48, 80, 8)]}
      </PixelGroup>
      <PixelGroup fill="#6f7f52">
        {Array.from({ length: 10 }, (_, i) => PX(i * 20, 160, 20, 40))}
      </PixelGroup>
      {/* Person */}
      <PixelGroup fill="#f4c28b">
        {[PX(60, 120, 8, 8), PX(68, 120, 8, 8)]}
      </PixelGroup>
      <PixelGroup fill="#305d73">
        {[PX(60, 128, 16, 20)]}
      </PixelGroup>
    </g>
  ),

  graduate_school: (
    <g>
      <PixelGroup fill="#d8c8b4">
        {Array.from({ length: 50 }, (_, i) => PX((i % 10) * 20, Math.floor(i / 10) * 20, 20, 20))}
      </PixelGroup>
      {/* Graduation cap */}
      <PixelGroup fill="#24384f">
        {[PX(72, 20, 56, 8), PX(68, 28, 64, 8), PX(64, 36, 72, 8)]}
      </PixelGroup>
      <PixelGroup fill="#f2b84b">
        {[PX(64, 36, 8, 8)]}
      </PixelGroup>
      {/* Tassel */}
      <PixelGroup fill="#b3423c">
        {[PX(132, 28, 4, 16)]}
      </PixelGroup>
      {/* Building */}
      <PixelGroup fill="#305d73">
        {[PX(40, 60, 120, 100)]}
      </PixelGroup>
      <PixelGroup fill="#f7d08b">
        {[PX(52, 68, 16, 12), PX(80, 68, 16, 12), PX(108, 68, 16, 12), PX(136, 68, 16, 12),
          PX(52, 88, 16, 12), PX(80, 88, 16, 12), PX(108, 88, 16, 12), PX(136, 88, 16, 12)]}
      </PixelGroup>
      {/* Columns */}
      <PixelGroup fill="#d8c8b4">
        {[PX(40, 60, 8, 100), PX(152, 60, 8, 100)]}
      </PixelGroup>
      <PixelGroup fill="#6f7f52">
        {Array.from({ length: 10 }, (_, i) => PX(i * 20, 160, 20, 40))}
      </PixelGroup>
    </g>
  ),

  marriage: (
    <g>
      <PixelGroup fill="#f3abc4">
        {Array.from({ length: 50 }, (_, i) => PX((i % 10) * 20, Math.floor(i / 10) * 20, 20, 20))}
      </PixelGroup>
      {/* Two people */}
      <PixelGroup fill="#f4c28b">
        {[PX(60, 100, 8, 8), PX(68, 100, 8, 8), PX(120, 100, 8, 8), PX(128, 100, 8, 8)]}
      </PixelGroup>
      <PixelGroup fill="#d85f87">
        {[PX(60, 108, 16, 20), PX(120, 108, 16, 20)]}
      </PixelGroup>
      {/* Hearts */}
      <PixelGroup fill="#b3423c">
        {[PX(88, 60, 8, 8), PX(96, 56, 8, 8), PX(104, 60, 8, 8), PX(92, 64, 8, 8), PX(100, 64, 8, 8)]}
      </PixelGroup>
      {/* Ground */}
      <PixelGroup fill="#6f7f52">
        {Array.from({ length: 10 }, (_, i) => PX(i * 20, 140, 20, 60))}
      </PixelGroup>
      {/* Flowers */}
      <PixelGroup fill="#d85f87">
        {[PX(40, 130, 8, 8), PX(152, 130, 8, 8)]}
      </PixelGroup>
      <PixelGroup fill="#6f7f52">
        {[PX(40, 138, 8, 4), PX(152, 138, 8, 4)]}
      </PixelGroup>
      {/* Sun */}
      <PixelGroup fill="#f2b84b">
        {[PX(20, 20, 20, 20)]}
      </PixelGroup>
    </g>
  ),

  parenting: (
    <g>
      <PixelGroup fill="#b8d7a3">
        {Array.from({ length: 50 }, (_, i) => PX((i % 10) * 20, Math.floor(i / 10) * 20, 20, 20))}
      </PixelGroup>
      {/* House */}
      <PixelGroup fill="#c87838">
        {[PX(40, 60, 120, 100)]}
      </PixelGroup>
      {/* Roof */}
      <PixelGroup fill="#b3423c">
        {[PX(36, 56, 128, 8), PX(40, 48, 120, 8), PX(48, 40, 104, 8), PX(60, 32, 80, 8), PX(76, 24, 48, 8)]}
      </PixelGroup>
      {/* Window */}
      <PixelGroup fill="#8bc0d6">
        {[PX(52, 72, 32, 32), PX(116, 72, 32, 32)]}
      </PixelGroup>
      {/* Door */}
      <PixelGroup fill="#35261c">
        {[PX(88, 100, 24, 60)]}
      </PixelGroup>
      {/* Adult */}
      <PixelGroup fill="#f4c28b">
        {[PX(60, 100, 8, 8), PX(68, 100, 8, 8)]}
      </PixelGroup>
      <PixelGroup fill="#305d73">
        {[PX(60, 108, 16, 20)]}
      </PixelGroup>
      {/* Child */}
      <PixelGroup fill="#f4c28b">
        {[PX(120, 110, 6, 6), PX(126, 110, 6, 6)]}
      </PixelGroup>
      <PixelGroup fill="#d85f87">
        {[PX(120, 116, 12, 12)]}
      </PixelGroup>
      <PixelGroup fill="#6f7f52">
        {Array.from({ length: 10 }, (_, i) => PX(i * 20, 160, 20, 40))}
      </PixelGroup>
    </g>
  ),

  solitude: (
    <g>
      <PixelGroup fill="#24384f">
        {Array.from({ length: 50 }, (_, i) => PX((i % 10) * 20, Math.floor(i / 10) * 20, 20, 20))}
      </PixelGroup>
      {/* Moon */}
      <PixelGroup fill="#f7d08b">
        {[PX(140, 20, 20, 20)]}
      </PixelGroup>
      {/* Stars */}
      <PixelGroup fill="#f7d08b">
        {[PX(20, 20, 4, 4), PX(40, 40, 4, 4), PX(60, 20, 4, 4), PX(100, 40, 4, 4), PX(30, 60, 4, 4)]}
      </PixelGroup>
      {/* Window */}
      <PixelGroup fill="#305d73">
        {[PX(60, 60, 80, 80)]}
      </PixelGroup>
      <PixelGroup fill="#f7d08b">
        {[PX(64, 64, 16, 16), PX(88, 64, 16, 16), PX(112, 64, 16, 16),
          PX(64, 88, 16, 16), PX(88, 88, 16, 16), PX(112, 88, 16, 16)]}
      </PixelGroup>
      {/* Window frame */}
      <PixelGroup fill="#35261c">
        {[PX(98, 60, 4, 80), PX(60, 98, 80, 4)]}
      </PixelGroup>
      {/* Person inside window */}
      <PixelGroup fill="#f4c28b">
        {[PX(88, 72, 8, 8), PX(96, 72, 8, 8)]}
      </PixelGroup>
      <PixelGroup fill="#d85f87">
        {[PX(88, 80, 16, 12)]}
      </PixelGroup>
      {/* Building wall */}
      <PixelGroup fill="#35261c">
        {[PX(40, 60, 20, 100), PX(140, 60, 20, 100)]}
      </PixelGroup>
      <PixelGroup fill="#6f7f52">
        {Array.from({ length: 10 }, (_, i) => PX(i * 20, 160, 20, 40))}
      </PixelGroup>
    </g>
  ),

  overseas: (
    <g>
      <PixelGroup fill="#8bc0d6">
        {Array.from({ length: 50 }, (_, i) => PX((i % 10) * 20, Math.floor(i / 10) * 20, 20, 20))}
      </PixelGroup>
      {/* Ocean */}
      <PixelGroup fill="#305d73">
        {[PX(0, 100, 200, 8), PX(0, 108, 200, 8), PX(0, 116, 200, 8), PX(0, 124, 200, 8)]}
      </PixelGroup>
      <PixelGroup fill="#24384f">
        {[PX(0, 132, 200, 8), PX(0, 140, 200, 8), PX(0, 148, 200, 8), PX(0, 156, 200, 8)]}
      </PixelGroup>
      {/* Plane */}
      <PixelGroup fill="#f7d08b">
        {[PX(60, 40, 80, 8), PX(56, 48, 88, 8), PX(52, 56, 96, 8), PX(60, 64, 80, 8)]}
      </PixelGroup>
      <PixelGroup fill="#d85f87">
        {[PX(52, 56, 8, 8), PX(140, 56, 8, 8)]}
      </PixelGroup>
      {/* Windows */}
      <PixelGroup fill="#8bc0d6">
        {[PX(72, 48, 8, 8), PX(88, 48, 8, 8), PX(104, 48, 8, 8), PX(120, 48, 8, 8)]}
      </PixelGroup>
      {/* Sun */}
      <PixelGroup fill="#f2b84b">
        {[PX(20, 20, 20, 20)]}
      </PixelGroup>
      {/* Clouds */}
      <PixelGroup fill="#fffaf0">
        {[PX(120, 20, 40, 8), PX(124, 12, 32, 8)]}
      </PixelGroup>
    </g>
  ),

  dropout: (
    <g>
      <PixelGroup fill="#8d8797">
        {Array.from({ length: 50 }, (_, i) => PX((i % 10) * 20, Math.floor(i / 10) * 20, 20, 20))}
      </PixelGroup>
      {/* Broken building */}
      <PixelGroup fill="#24384f">
        {[PX(40, 40, 120, 120)]}
      </PixelGroup>
      {/* Crack */}
      <PixelGroup fill="#8d8797">
        {[PX(96, 40, 8, 8), PX(92, 48, 16, 8), PX(88, 56, 24, 8), PX(84, 64, 32, 8),
          PX(80, 72, 40, 8), PX(84, 80, 32, 8), PX(88, 88, 24, 8), PX(92, 96, 16, 8)]}
      </PixelGroup>
      {/* Fallen person */}
      <PixelGroup fill="#f4c28b">
        {[PX(60, 120, 8, 8), PX(68, 120, 8, 8)]}
      </PixelGroup>
      <PixelGroup fill="#35261c">
        {[PX(60, 128, 16, 8)]}
      </PixelGroup>
      {/* Ground */}
      <PixelGroup fill="#35261c">
        {Array.from({ length: 10 }, (_, i) => PX(i * 20, 160, 20, 40))}
      </PixelGroup>
      {/* Rain */}
      <PixelGroup fill="#8bc0d6">
        {[PX(30, 30, 4, 12), PX(60, 20, 4, 12), PX(100, 30, 4, 12), PX(140, 20, 4, 12),
          PX(170, 40, 4, 12), PX(50, 60, 4, 12), PX(150, 50, 4, 12)]}
      </PixelGroup>
    </g>
  ),

  burnout: (
    <g>
      <PixelGroup fill="#8d8797">
        {Array.from({ length: 50 }, (_, i) => PX((i % 10) * 20, Math.floor(i / 10) * 20, 20, 20))}
      </PixelGroup>
      {/* Person curled up */}
      <PixelGroup fill="#f4c28b">
        {[PX(88, 100, 8, 8), PX(96, 100, 8, 8)]}
      </PixelGroup>
      <PixelGroup fill="#35261c">
        {[PX(88, 108, 16, 8)]}
      </PixelGroup>
      {/* Spiral above head */}
      <PixelGroup fill="#b3423c">
        {[PX(92, 60, 8, 8), PX(88, 68, 16, 8), PX(84, 76, 24, 8), PX(88, 84, 16, 8), PX(92, 92, 8, 8)]}
      </PixelGroup>
      {/* Ground */}
      <PixelGroup fill="#35261c">
        {Array.from({ length: 10 }, (_, i) => PX(i * 20, 140, 20, 60))}
      </PixelGroup>
      {/* Dark clouds */}
      <PixelGroup fill="#24384f">
        {[PX(20, 20, 60, 12), PX(24, 12, 52, 8), PX(120, 20, 60, 12), PX(124, 12, 52, 8)]}
      </PixelGroup>
    </g>
  ),

  default: (
    <g>
      <PixelGroup fill="#24384f">
        {Array.from({ length: 50 }, (_, i) => PX((i % 10) * 20, Math.floor(i / 10) * 20, 20, 20))}
      </PixelGroup>
      {/* Compass */}
      <PixelGroup fill="#f2b84b">
        {[PX(88, 40, 24, 8), PX(84, 48, 32, 8), PX(80, 56, 40, 8), PX(80, 64, 40, 8),
          PX(84, 72, 32, 8), PX(88, 80, 24, 8)]}
      </PixelGroup>
      <PixelGroup fill="#d85f87">
        {[PX(96, 48, 8, 8), PX(92, 56, 16, 8), PX(88, 64, 24, 8), PX(92, 72, 16, 8), PX(96, 80, 8, 8)]}
      </PixelGroup>
      {/* Needle */}
      <PixelGroup fill="#b3423c">
        {[PX(96, 36, 8, 8), PX(96, 44, 8, 4), PX(96, 84, 8, 4), PX(96, 88, 8, 8)]}
      </PixelGroup>
      {/* Ground */}
      <PixelGroup fill="#6f7f52">
        {Array.from({ length: 10 }, (_, i) => PX(i * 20, 120, 20, 80))}
      </PixelGroup>
      {/* Path */}
      <PixelGroup fill="#c87838">
        {[PX(80, 120, 40, 8), PX(84, 128, 32, 8), PX(88, 136, 24, 8), PX(92, 144, 16, 8)]}
      </PixelGroup>
      {/* Stars */}
      <PixelGroup fill="#f7d08b">
        {[PX(20, 20, 4, 4), PX(160, 30, 4, 4), PX(40, 60, 4, 4), PX(160, 80, 4, 4)]}
      </PixelGroup>
    </g>
  ),
};
