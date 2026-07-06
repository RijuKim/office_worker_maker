const stats = [
  ["학업", 63],
  ["실무", 41],
  ["커뮤니케이션", 72],
  ["창의성", 57],
  ["건강", 66],
  ["멘탈", 54],
  ["네트워크", 48],
  ["자산", 35],
  ["평판", 61],
  ["매력", 68],
] as const;

const choices = [
  "인턴 이야기를 더 물어본다. 관계 신뢰도가 일정 이상이면 제안이 구체화된다.",
  "지금은 축제 준비에 집중한다. 동아리 평판과 커뮤니케이션이 오른다.",
  "혼자 남아 예산표를 다시 검토한다. 실무와 번아웃 위험이 함께 움직인다.",
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#fbfaf6] text-[#232323]">
      <div className="grid min-h-screen grid-cols-[260px_minmax(0,1fr)_300px] max-[900px]:block">
        <aside className="border-r border-[#ded9ce] bg-[#f2efe7] p-[22px] max-[900px]:border-0 max-[900px]:p-[18px]">
          <h1 className="m-0 text-[22px] font-bold leading-tight">한서윤</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-[#706b62]">
            사용자가 입력한 이름. 사회학과 2학년. 동아리 회계 담당. 최근 컨디션은 애매하지만 사람을
            관찰하는 감각이 좋다.
          </p>
          <nav className="mt-[22px] grid gap-2" aria-label="주요 메뉴">
            <a className="rounded-lg border border-[#ded9ce] bg-white px-2.5 py-2 text-sm" href="/">
              진행
            </a>
            <a className="rounded-lg px-2.5 py-2 text-sm" href="/">
              캐릭터
            </a>
            <a className="rounded-lg px-2.5 py-2 text-sm" href="/">
              관계
            </a>
            <a className="rounded-lg px-2.5 py-2 text-sm" href="/">
              커리어와 엔딩 기록
            </a>
          </nav>
          <section className="mt-3.5 rounded-lg border border-[#ded9ce] bg-white p-3.5" aria-labelledby="stats-title">
            <h2 id="stats-title" className="text-base font-bold">
              공개 스탯
            </h2>
            <dl className="mt-2">
              {stats.map(([label, value]) => (
                <div
                  className="flex justify-between gap-2 border-b border-[#eee8dd] py-[7px] text-[13px] last:border-b-0"
                  key={label}
                >
                  <dt>{label}</dt>
                  <dd className="font-bold">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </aside>

        <section className="px-11 py-[34px] max-[900px]:px-[18px] max-[900px]:py-[22px]" aria-labelledby="scene-title">
          <div className="mx-auto max-w-[760px]">
            <p className="mb-4 text-[13px] font-bold text-[#8a4f2d]">봄 축제 준비 회의 · 숨은 사건 후보</p>
            <h2 id="scene-title" className="sr-only">
              현재 사건
            </h2>
            <p className="text-xl leading-[1.82] tracking-normal max-[900px]:text-[17px] max-[900px]:leading-[1.72]">
              동아리방 창문이 덜컹거릴 때마다 회의록 위에 놓인 영수증이 조금씩 밀렸다. 선배 지민은
              예산표를 보다가 네가 정리한 지출 내역에서 멈칫했다. &quot;이 정도로 정리할 줄 알면, 우리
              회사 인턴 업무도 버틸 것 같은데.&quot;
            </p>
            <p className="mt-5 text-xl leading-[1.82] tracking-normal max-[900px]:text-[17px] max-[900px]:leading-[1.72]">
              농담처럼 말했지만, 그의 표정은 가볍지 않았다. 휴학을 고민하던 마음 한구석이 조용히
              반응했다.
            </p>
            <div className="mt-7 grid gap-2.5">
              {choices.map((choice) => (
                <button
                  className="min-h-12 rounded-lg border border-[#cbbfae] bg-white px-4 py-3.5 text-left text-[15px] text-[#2f2b26] hover:border-[#8a4f2d] hover:bg-[#fff9f2]"
                  key={choice}
                  type="button"
                >
                  {choice}
                </button>
              ))}
            </div>
          </div>
        </section>

        <aside className="border-l border-[#ded9ce] p-[22px] max-[900px]:border-0 max-[900px]:p-[18px]">
          <h2 className="m-0 text-[22px] font-bold leading-tight">기억과 관계</h2>
          <section className="mt-3.5 rounded-lg border border-[#ded9ce] bg-white p-3.5">
            <h3 className="font-bold">주요 인물</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-[#706b62]">
              지민 선배 · 신뢰 높음 · 인턴 제안 플래그 후보
            </p>
          </section>
          <section className="mt-3.5 rounded-lg border border-[#ded9ce] bg-white p-3.5">
            <h3 className="font-bold">최근 기억</h3>
            <div className="mt-2 flex flex-wrap gap-1">
              {["축제 예산 정리", "동아리 회계", "휴학 고민"].map((tag) => (
                <span className="rounded-full bg-[#efe5d7] px-2 py-1 text-xs text-[#68412b]" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
          </section>
          <section className="mt-3.5 rounded-lg border border-[#ded9ce] bg-white p-3.5">
            <h3 className="font-bold">패러디 안내</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-[#706b62]">
              이 게임의 기업, 인물, 사건은 허구 및 패러디입니다.
            </p>
          </section>
        </aside>
      </div>
    </main>
  );
}
