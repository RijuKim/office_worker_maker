import { type Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { loadPublicEnding } from "@/lib/game-ui/public-ending";

interface Props {
  params: Promise<{ id: string }>;
}

async function resolveBaseUrl() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const proto = requestHeaders.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");

  if (!host) {
    return "http://localhost:3000";
  }

  return `${proto}://${host}`;
}

async function loadEnding(id: string) {
  const baseUrl = await resolveBaseUrl();
  return loadPublicEnding(id, { baseUrl });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const ending = await loadEnding(id);

  if (!ending) {
    return { title: "기록을 찾을 수 없음" };
  }

  const title = `${ending.title} - 선택의 결과`;
  const description = ending.summary || `${ending.careerPath} · 만족도 ${ending.satisfaction}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      siteName: "대학생 커리어 시뮬레이터",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

function StatLabels({ statSnapshot }: { statSnapshot: Record<string, number> }) {
  const statLabels: Record<string, string> = {
    academic: "학업",
    practical: "실무",
    health: "건강",
    mental: "멘탈",
    wealth: "자산",
    charm: "매력",
    reputation: "평판",
    communication: "커뮤니케이션",
    creativity: "창의성",
    network: "인맥",
  };

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {Object.entries(statLabels).map(([key, label]) => {
        const val = statSnapshot[key];
        if (val === undefined) return null;
        return (
          <div className="rounded border-2 border-[#ded9ce] bg-[#f2efe7] px-3 py-2 text-center" key={key}>
            <span className="text-xs text-[#706b62]">{label}</span>
            <span className="ml-2 text-lg font-bold">{Math.max(1, Math.min(10, Math.round(val)))}</span>
          </div>
        );
      })}
    </div>
  );
}

function PublicEndingDetail({ ending }: { ending: Awaited<ReturnType<typeof loadEnding>> }) {
  if (!ending) {
    notFound();
  }

  const tags = ending.tags ?? [];
  const statSnapshot = ending.statSnapshot ?? {};
  const keyRelationships = ending.keyRelationships ?? [];
  const majorEvents = ending.majorEvents ?? [];

  return (
    <main className="min-h-screen bg-[#f7efe2] p-4 pt-8 text-[#2a241e]">
      <div className="mx-auto max-w-2xl">
        <div className="pixel-panel overflow-hidden">
          <div className="border-b-4 border-[#2a2018] bg-[#fffaf0] p-6">
            <p className="mb-1 text-xs font-black text-[#8a4f2d]">선택의 결과</p>
            <h1 className="text-2xl font-black leading-tight">{ending.title}</h1>
            <p className="mt-2 text-sm text-[#706b62]">{ending.summary}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="border-2 border-[#ded9ce] bg-[#f2efe7] px-2.5 py-1 text-xs font-bold">{ending.careerPath}</span>
              {ending.destinationName && (
                <span className="border-2 border-[#ded9ce] bg-[#f2efe7] px-2.5 py-1 text-xs">{ending.destinationName}</span>
              )}
              {ending.jobRole && (
                <span className="border-2 border-[#ded9ce] bg-[#f2efe7] px-2.5 py-1 text-xs">{ending.jobRole}</span>
              )}
            </div>
          </div>

          <div className="p-6">
            <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed">
              {ending.longNarrative}
            </div>

            <div className="mt-6">
              <h2 className="mb-3 text-sm font-black text-[#8a4f2d]">최종 능력치</h2>
              <StatLabels statSnapshot={statSnapshot} />
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3 border-t-2 border-[#f2efe7] pt-4 text-center text-sm">
              <div>
                <span className="block text-xs text-[#706b62]">만족도</span>
                <span className="text-lg font-bold">{ending.satisfaction}</span>
              </div>
              <div>
                <span className="block text-xs text-[#706b62]">성장 가능성</span>
                <span className="text-lg font-bold">{ending.growthPotential}</span>
              </div>
              <div>
                <span className="block text-xs text-[#706b62]">워라밸</span>
                <span className="text-lg font-bold">{ending.workLifeBalance}</span>
              </div>
            </div>

            {keyRelationships.length > 0 && (
              <div className="mt-6">
                <h2 className="mb-2 text-sm font-black text-[#8a4f2d]">관계</h2>
                <div className="flex flex-wrap gap-2">
                  {keyRelationships.map((rel) => (
                    <span className="rounded border-2 border-[#ded9ce] bg-[#f2efe7] px-2.5 py-1 text-xs" key={rel.name}>
                      {rel.name} · {rel.role}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {majorEvents.length > 0 && (
              <div className="mt-6">
                <h2 className="mb-2 text-sm font-black text-[#8a4f2d]">주요 사건</h2>
                <ul className="space-y-1">
                  {majorEvents.slice(0, 5).map((event, index) => (
                    <li className="text-xs text-[#706b62]" key={index}>· {event.summary}</li>
                  ))}
                </ul>
              </div>
            )}

            {tags.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-1">
                {tags.map((tag) => (
                  <span className="rounded-full bg-[#efe5d7] px-2 py-1 text-xs text-[#68412b]" key={tag}>{tag}</span>
                ))}
              </div>
            )}

            <div className="mt-8 border-t-2 border-[#f2efe7] pt-4 text-center">
              <p className="text-xs text-[#a9967d]">대학생 커리어 시뮬레이터 · 모든 기업, 인물, 사건은 허구 및 패러디입니다.</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default async function SharePage({ params }: Props) {
  const { id } = await params;
  const ending = await loadEnding(id);

  return <PublicEndingDetail ending={ending} />;
}
