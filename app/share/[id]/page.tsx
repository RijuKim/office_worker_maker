import { Metadata } from "next";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/server/prisma";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const record = await prisma.careerEndingRecord.findUnique({ where: { id } });
  if (!record) return { title: "기록을 찾을 수 없음" };

  const title = `${record.title} - 선택의 결과`;
  const description = record.summary || `${record.careerPath} · 만족도 ${record.satisfaction}`;

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

export default async function SharePage({ params }: Props) {
  const { id } = await params;
  const record = await prisma.careerEndingRecord.findUnique({
    where: { id },
    include: {
      characterRun: {
        select: { name: true, major: true },
      },
    },
  });

  if (!record) notFound();

  const tags = (record.tags as string[]) ?? [];
  const statSnapshot = record.statSnapshot as Record<string, number> | null;
  const keyRelationships = record.keyRelationships as Array<{ name: string; role: string; trust: number }> | null;
  const majorEvents = record.majorEvents as Array<{ summary: string }> | null;

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
    <main className="min-h-screen bg-[#f7efe2] p-4 pt-8 text-[#2a241e]">
      <div className="mx-auto max-w-2xl">
        <div className="pixel-panel overflow-hidden">
          <div className="border-b-4 border-[#2a2018] bg-[#fffaf0] p-6">
            <p className="mb-1 text-xs font-black text-[#8a4f2d]">선택의 결과</p>
            <h1 className="text-2xl font-black leading-tight">{record.title}</h1>
            <p className="mt-2 text-sm text-[#706b62]">{record.summary}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="border-2 border-[#ded9ce] bg-[#f2efe7] px-2.5 py-1 text-xs font-bold">{record.careerPath}</span>
              {record.destinationName && (
                <span className="border-2 border-[#ded9ce] bg-[#f2efe7] px-2.5 py-1 text-xs">{record.destinationName}</span>
              )}
              {record.jobRole && (
                <span className="border-2 border-[#ded9ce] bg-[#f2efe7] px-2.5 py-1 text-xs">{record.jobRole}</span>
              )}
            </div>
          </div>

          <div className="p-6">
            <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed">
              {record.longNarrative}
            </div>

            {statSnapshot && (
              <div className="mt-6">
                <h2 className="mb-3 text-sm font-black text-[#8a4f2d]">최종 능력치</h2>
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
              </div>
            )}

            <div className="mt-6 grid grid-cols-3 gap-3 border-t-2 border-[#f2efe7] pt-4 text-center text-sm">
              <div>
                <span className="block text-xs text-[#706b62]">만족도</span>
                <span className="text-lg font-bold">{record.satisfaction}</span>
              </div>
              <div>
                <span className="block text-xs text-[#706b62]">성장 가능성</span>
                <span className="text-lg font-bold">{record.growthPotential}</span>
              </div>
              <div>
                <span className="block text-xs text-[#706b62]">워라밸</span>
                <span className="text-lg font-bold">{record.workLifeBalance}</span>
              </div>
            </div>

            {keyRelationships && keyRelationships.length > 0 && (
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

            {majorEvents && majorEvents.length > 0 && (
              <div className="mt-6">
                <h2 className="mb-2 text-sm font-black text-[#8a4f2d]">주요 사건</h2>
                <ul className="space-y-1">
                  {majorEvents.slice(0, 5).map((ev, i) => (
                    <li className="text-xs text-[#706b62]" key={i}>· {ev.summary}</li>
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
