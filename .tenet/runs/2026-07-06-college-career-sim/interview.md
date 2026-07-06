# Interview: College Career Sim

Date: 2026-07-06
Mode: Full
Rounds: 2

## Mode Selection
- Prompt shown: Recommended Full because this is a greenfield game with product, data, simulation, UX, and company-list scope decisions that need upfront clarity.
- User response: Full로 진행해줘
- Selected mode: full
- Selection basis: explicit_user_choice

## Clarity Score
- Goal: 0.85 (weight 0.4)
- Constraints: 0.85 (weight 0.3)
- Success criteria: 0.8 (weight 0.3)
- **Total: 0.835 / 0.8 required**
- Validation result: passed.

## Round 1

### Questions Asked
1. 이 게임에서 플레이어가 "재미있다"고 느껴야 하는 핵심 루프는 무엇에 가깝나요?
   > 스탯/선택지와 랜덤 이벤트 및 선택 결과를 보는 인생 시뮬레이션에 가까워. 엔딩 수집 요소도 있으면 좋고. 진로 탐색 도구 용도는 아닌데 대학생, 직장인, 취준생들이 실제 기업 이름으로 재미를 느낄 수도 있을듯. 한국 기업 뿐만 아니라 외국 기업도! 근데 이름을 그대로 쓰면 나중에 명예훼손 등이 있을 수 있어서 좀 바꿔야할 것 같긴해. 예를 들면 케이티 -> 케이띠 구글 -> 규글 등으로

2. 첫 버전의 형태는 무엇으로 만들까요? 웹 앱이면 되는지, 모바일 대응이 필요한지, 서버/로그인 없이 로컬 저장만 해도 되는지 확인했습니다.
   > 먼저 브라우저에서 실행할 거고, 추후 확장으로 모바일도 고려 중이야. 데스크톱 우선이지만 모바일 화면도 잘 맞아야해. 서버/로그인 있어야해. 왜냐면 엔딩 수집이 있다고 했잖아. 그런 게 저장되어야해.

3. 첫 playable 버전에서 플레이어가 한 캐릭터를 어느 기간까지 키우는지, 학기 단위 턴제 흐름이 맞는지 확인했습니다.
   > 턴제는 내가 원한게 아니야. 뭔가 공부 동아리 알바 연애/인맥 등이 따로가 아니라 유기적으로 연결되면 좋겠어. 그리고 ai을 통해 랜덤 이벤트 생성해도 재밌을 것 같고. 예를 들면 동아리 활동을 했는데 거기서 선배가 인턴을 제안한거야. 숨겨진 이벤트처럼. 그렇게 되면 학교 생활 중에 휴학 후 인턴이 시작되는 거지. 기존에 없던 게임이야.

4. AI 이벤트 생성은 어디까지 허용할지 확인했습니다. 제안한 기본값은 AI가 이벤트 문장, 선택지, 결과 설명을 생성하고, 게임 규칙은 서버가 검증하며, 수동 이벤트 풀과 안전 차단을 두는 방식입니다.
   > 그 정도 맞아.

5. 로그인/저장은 어떤 수준이면 첫 버전에 충분할지 확인했습니다. 제안한 기본값은 이메일/비밀번호 로그인, 계정별 여러 캐릭터 저장, 캐릭터 상태/관계/플래그/진행 이벤트/엔딩/기업 기록 저장, 계정 단위 엔딩 도감 누적, 관리자 기능 제외입니다.
   > 그 범위로 가자.

6. 첫 버전 기업 풀과 표현 안전 범위를 확인했습니다. 제안한 기본값은 실제 기업을 직접 저장하지 않고 패러디 기업 데이터만 저장하며, 업종/규모/문화 태그/채용 난이도/선호 스탯/이벤트 톤을 데이터화하고, 40-60개 패러디 기업으로 시작하는 방식입니다.
   > 좋아 그정도로 거기에 추가로 연봉과 직종(마케팅, 인사, 등등 포함) 공무원과 전문직, 창업, 자영업 등도 포함이어야해. 거기에는 회사생활 뿐만 아니라 스탯에 따른 전반적인 엔딩을 포함하려고 해 ex. 회계사가 되었지만 낮은 체력과 좁은 인맥으로 큰 돈을 벌지는 못했으나 사랑하는 사람과 만나 행복하게 살았다 등등 (축약한거고 좀 더 길고 자세하게)

7. 공개/숨은 스탯 모델에 외적 요소를 어떻게 포함할지 확인했습니다. 제안한 방향은 외모를 직접 등급화하지 않고, 공개 스탯은 복합적인 매력으로 두며 숨은 상태로 스타일, 자기관리, 컨디션, 이미지 적합도, 자신감 등을 다루는 방식입니다.
   > 숨은 스탯 좋고 공개 스탯은 매력이라고 하자.

8. UI/플레이 방식은 텍스트 어드벤처와 캐릭터/카드 중심 시뮬레이션 중 어느 쪽에 가까운지 확인했습니다. 캐릭터/카드 중심 UI를 설명한 뒤, 메인 플레이는 텍스트 어드벤처이고 상태/인물/엔딩은 카드로 보조하는 하이브리드를 추천했습니다.
   > 그렇게 가자.

9. 기술 스택과 Unity 등 게임 엔진 전환 가능성을 확인했습니다. 제안한 방향은 초반에는 Next.js 웹 게임으로 빠르게 만들되, 게임 상태/이벤트 판정/엔딩 판정은 서버 API 중심에 두어 나중에 Unity 또는 모바일 클라이언트를 붙일 수 있게 설계하는 방식입니다.
   > 그래. 나중에 애니메이션이랑 그림들도 넣으려고 하긴해.

10. AI 제공자와 서버 호출/검증 방향을 확인했습니다. 제안한 방향은 서버에서만 AI를 호출하고, 사용자 직접 프롬프트 입력은 막고, 캐릭터 상태/최근 사건/후보 태그를 입력으로 제한하며, JSON 출력 검증과 정적 이벤트 fallback을 두는 방식입니다.
   > openrouter api로 사용하려고.

11. 첫 playable MVP 완성 기준을 확인했습니다. 제안한 기준은 회원가입/로그인, 캐릭터 생성, 공개/숨은 상태, 텍스트 어드벤처 사건 선택, 상태/관계/플래그 반영, OpenRouter AI 이벤트, 정적 fallback, 40개 이상 진로/기업 데이터, 엔딩 도감 저장, 반응형 UI입니다. 처음에는 최소 20개 이상의 수집 가능한 엔딩을 제안했습니다.
   > 좋아. 근데 엔딩의 경우는 갯수로 정해지지는 않고, 무수한 스탯이랑 진행해왔던 이벤트/인물 관계등 유기적으로 얽혀서 하나의 정해진 엔딩은 거의 없을듯. 근데 도감에는 저장될거고. 대신 가는 기업이나 직업 직종은 겹칠 수도 있지. 그건 좀 차이점이야.

### Decisions Made
- Core loop combines stat/choice management with random life events and visible consequences.
- The game is an entertainment-first life simulation, not a career exploration tool.
- Ending collection should be part of replay value.
- Company names should be fictionalized/parody-style rather than exact real names, while remaining recognizable enough for humor.
- The company pool may include both Korean and foreign companies.
- First version should run in the browser as a web app.
- The UI is desktop-first but must remain usable and well-fitted on mobile screens for future expansion.
- Server-side login and account-based persistence are required because ending collection must be saved.
- The game should not feel like a fixed turn-based schedule with isolated actions.
- Activities such as study, clubs, part-time work, relationships, networking, internships, leave of absence, job search, and work should be organically connected by state, relationships, and emergent event chains.
- Hidden or unexpected events are core to the concept, such as a club relationship leading to an internship offer and a leave-of-absence path.
- AI-generated random events are a desired direction and should be explored as part of the product/technical design.
- AI should generate event text, choices, and result descriptions, while server-owned game rules validate state changes.
- The system should keep a manual/static event pool as fallback for cost, outage, and quality control.
- AI output must be constrained to the game state schema and filtered to avoid real-company defamation, targeted insults, or unsafe content.
- First version should use email/password authentication.
- Each account can have multiple saved characters/runs.
- Saved data includes character state, relationships, flags, active event context, collected endings, and parody-company application/employment history.
- Ending gallery is accumulated at the account level.
- Social login and admin/content management tools are out of scope for the first version.
- The career destination data should include salary bands and job roles such as marketing, HR, finance/accounting, engineering, sales, planning, design, operations, and other office roles.
- Career outcomes must include not only parody companies but also public-sector jobs, licensed professions, entrepreneurship, and self-employment.
- Endings should combine career path, stats, relationships, health, network, wealth, and personal-life outcomes into longer narrative endings.
- A player may achieve a prestigious or stable job but still receive a mixed life outcome based on weak supporting stats, such as low health or narrow relationships.
- Ending writing should be detailed and story-like, not just a short result label.
- Public stats should include `매력` as a broad stat covering attitude, presence, style, self-expression, and perceived charm rather than a narrow physical appearance score.
- Appearance-related factors should mainly live in hidden or derived state such as style fit, self-care, condition, confidence, and first-impression modifiers.
- These factors may influence romance, interviews, networking, sales/marketing/service-like roles, and social events, but should avoid a simplistic "better looks equals success" rule.
- The primary play surface should be text-adventure style: the player reads the current situation and chooses from contextual actions/dialogue options.
- Supporting UI should use cards for character state, relationships, notable memories/flags, career/company records, saves, and ending collection.
- Progression should be story-node and event-chain driven rather than a visible day/semester turn loop.
- First implementation should be a Next.js-based browser game.
- The architecture should keep game state, event selection/validation, and ending judgment on the server/API side so future Unity, mobile, animation, or illustration-heavy clients can reuse the core backend.
- The initial UI may be mostly text and cards, but should leave room for later character art, event illustrations, and animation.
- AI event generation should use OpenRouter API.
- OpenRouter calls should happen only on the server, with server-side environment variables for credentials.
- AI output should use structured JSON where possible and must be validated before changing canonical game state.
- MVP completion includes signup/login, character creation, public stats and hidden state, text-adventure events and choices, state/relationship/flag updates, at least one OpenRouter-generated event path, static fallback events, 40+ career/company destination records, account-saved ending records, and responsive desktop/mobile UI.
- Endings should not be a fixed finite list with a target count. They should be generated or assembled from accumulated stats, event history, relationships, career destination, job role, wealth, health, reputation, and personal-life outcomes.
- The ending gallery should store the player's acquired life-result records. Multiple endings may share the same company, profession, or role while differing in narrative outcome because the path and life-state context differ.
- Career destinations and role categories can be reusable anchors, while ending narratives are highly combinatorial and personalized.

### Remaining Ambiguities
- Exact database, auth library, deployment target, OpenRouter model choice, and AI cost/rate limits are not confirmed.
- Exact gameplay timeline, full public-stat list, hidden-state schema, event generation model, ending record schema, and win/fail conditions are not confirmed.
- Exact database technology and ending gallery UI behavior are not confirmed.
- Safety boundaries for parody company naming and negative claims are not confirmed.
- AI provider, concrete cost/rate limits, moderation implementation, and event quality controls are not confirmed.
- Visual tone, illustration strategy, animation strategy, and detailed layout are not confirmed.

## Round 2

### Questions Asked
1. 기술 스택 세부 기본값을 확정해도 되는지 확인했습니다. 제안한 기본값은 Next.js 최신 안정 버전 + TypeScript, PostgreSQL, Prisma, Auth.js/NextAuth 계열 이메일/비밀번호 인증, Tailwind CSS, OpenRouter API, 로컬 개발은 Docker PostgreSQL 또는 로컬 Postgres, 배포는 Vercel + 외부 Postgres 염두, 첫 구현에서 결제/관리자/소셜 로그인 제외입니다.
   > 응

2. AI 호출 기준 기본값을 확정해도 되는지 확인했습니다. 제안한 기본값은 새 사건 생성 또는 엔딩 서사 생성 같은 핵심 순간에만 OpenRouter를 사용하고, 모든 선택마다 호출하지 않으며, 계정당 일일 제한, 10초 응답 목표, 실패 시 정적 이벤트 대체, 서버 후보 태그 관리, 서버 환경변수 API 키, 민감 개인정보 미전송입니다.
   > 그래

3. 엔딩 도감 저장 방식과 용어를 확인했습니다. 처음에는 "인생 결과 기록"으로 제안했으나, 사용자는 대학생 때 인생 전체가 결정되는 것은 아니라며 회사 생활과 엔딩 느낌이 더 맞다고 정정했습니다. "커리어 엔딩 기록"은 커리어가 끝난 느낌이라 부적절하다고 보고, 최종 용어는 "커리어와 엔딩 기록"으로 정했습니다.
   > 그래 좋다. 커리어와 엔딩 기록으로 가자. 커리어 엔딩은 뭔가 커리어가 끝났다는 느낌이라.

4. 패러디 기업 안전 규칙을 확인했습니다. 제안한 기준은 실제 회사명을 그대로 쓰지 않고, 패러디명은 1-2글자 이상 바꾸거나 음운/철자를 비틀며, 실제 CEO/사건/논란/범죄 의혹을 사용하지 않고, 부정적 묘사는 가상 문화 태그로만 표현하며, AI도 패러디 세계관의 가상 회사로만 묘사하도록 제한하고, 실제 회사 직접 참조 필드를 두지 않으며, 허구/패러디 안내를 표시하는 방식입니다.
   > 응응

5. 공개 스탯, 숨은 상태, 이벤트 검증 규칙을 확인했습니다. 제안한 공개 스탯은 학업, 실무, 커뮤니케이션, 창의성, 체력, 멘탈, 인맥, 자산, 평판, 매력입니다. 숨은 상태는 전공 적합도, 번아웃 위험, 관계 신뢰도, 연애 상태, 가족/친구 관계, 커리어 관심사, 회사/직종 선호도, 이미지 적합도, 자기관리/컨디션, 사건 플래그입니다. 이벤트 검증은 AI가 서사와 선택지를 제안하고 서버만 스탯/관계/플래그 변경을 확정하며, 변경 폭 제한, 필수 필드/안전 검증, fallback, 선택지 2-4개 제한을 적용하는 방식입니다.
   > 좋아.

6. MVP 구현 기준 숫자를 확정했습니다. 제안한 기준은 패키지 버전은 lockfile로 고정, OpenRouter 모델은 `OPENROUTER_MODEL` 환경변수로 설정, AI 제한은 계정당 하루 30회, AI 응답 제한은 10초, 플레이 1회 길이는 25-40개 주요 사건, 엔딩 도달은 커리어 분기점 도달 및 핵심 사건 15개 이상 누적, MVP 부하는 동시 사용자 20명/계정 1,000개/캐릭터 5,000개/기록 10,000개, 768px 이하 단일 컬럼, 유사 기록은 직업/기업/핵심 태그 80% 이상 중복 시 묶기, 로그인 실패/저장 충돌/invalid state/AI 실패는 안내와 재시도/대체 흐름 제공입니다.
   > 그래. 추가로 openrouter api key가 준비됐어.

7. 캐릭터 이름 입력 방식을 정정했습니다. 주인공 이름은 임의 생성하지 않고 사용자가 캐릭터 생성 단계에서 입력합니다.
   > 잠깐만. 주인공 이름은 임의로 생성하는게 아니라 사용자가 입력하는거야.

8. 캐릭터 시작 정보와 진행 중 학적/생활 변수도 사용자 선택 및 이벤트 결과로 다뤄야 한다고 정정했습니다. 최초 학년, 나이, 과를 사용자가 선택할 수 있고, 진행 중 휴학, 알바, 전과, 자퇴 등이 변수로 발생할 수 있습니다.
   > 그리고 사용자의 최초 학년이랑 나이, 과 등도 사용자가 선택하게 할 수 있어. 중간중간에 휴학이나 알바, 전과, 자퇴 등 변수도 있을 수 있고.

9. 특정 상태 임계치에 따라 선택지 없이 자동 사건으로 전환될 수 있다고 정정했습니다. 예를 들어 번아웃이 오면 선택지 없이 자동으로 관련 이벤트가 발생할 수 있습니다.
   > 근데 캐릭터가 번아웃이 오면 선택지 없이 자동으로 그런 이벤트로 넘어가게 할 수도 있어.

### Decisions Made
- Use Next.js latest stable with TypeScript for the first web implementation.
- Use PostgreSQL with Prisma for persistence.
- Use an Auth.js/NextAuth-style email/password authentication approach.
- Use Tailwind CSS for styling.
- Use OpenRouter API for AI event generation.
- Local development may use Docker PostgreSQL or local Postgres.
- Deployment should be compatible with Vercel plus an external managed PostgreSQL provider.
- Payments, admin tools, and social login remain out of scope for MVP.
- OpenRouter calls should be reserved for key moments such as generating a new event or a final ending narrative; not every player choice should call AI.
- Add account-level daily AI generation limits.
- Target AI response time is 10 seconds or less.
- If OpenRouter fails, times out, rate-limits, or returns invalid data, the game should continue using static/fallback events.
- Server-managed candidate tags should preserve event relevance when retrying or falling back.
- OpenRouter API keys must remain server-only environment variables.
- Do not send unnecessary sensitive personal data to OpenRouter.
- The collection feature should be called `커리어와 엔딩 기록`.
- A saved ending record represents the career starting point and surrounding life/work situation reached by that playthrough, not a final judgment of the character's entire life.
- Each record should store title, summary, long ending narrative, job/profession/company/path, starting salary or salary band, workplace-life tone, stat snapshot, key people/relationships, 3-7 major college-era events, satisfaction, growth potential, work-life balance, health, relationship state, acquired timestamp, and tags.
- The same job/company can appear in multiple records if the narrative, relationships, stats, or workplace-life outcome meaningfully differ.
- Near-duplicate records should be grouped or de-duplicated rather than cluttering the collection.
- AI may draft the ending narrative, but the server must validate required fields and safety constraints before saving.
- Do not store or display exact real company names as playable destinations.
- Parody company names should alter at least 1-2 characters or clearly twist the sound/spelling.
- Do not use real CEOs, real incidents, real controversies, or real criminal allegations.
- Negative workplace descriptions must be framed as fictional culture tags, not claims about a real company.
- Allowed company culture tags include values such as horizontal culture, hierarchical culture, frequent overtime, performance pressure, strong benefits, slow decision-making, growth-focused, stable, chaotic, conservative, experimental, and similar fictional descriptors.
- AI prompts must require companies to be described only as fictional parody-world entities, not evaluations of real companies.
- Company data should not include an `inspiredBy` field or other direct reference to a real company.
- The UI should display a notice that companies, people, and events are fictional and parody-based.
- Public stats are 학업, 실무, 커뮤니케이션, 창의성, 체력, 멘탈, 인맥, 자산, 평판, and 매력.
- Hidden state includes 전공 적합도, 번아웃 위험, relationship trust values, romance state, family/friend relationship state, career interests, company/job-role preferences, image fit, self-care/condition, and event flags.
- AI proposes narrative text and choices, but only server rules can commit stat, relationship, and flag changes.
- Event state changes must stay within allowed bounds.
- Events with missing required fields or safety violations are discarded and replaced with fallback content.
- Each event should present at least 2 and at most 4 choices.
- Package versions should be pinned through the generated package manager lockfile.
- The OpenRouter model should be configured through `OPENROUTER_MODEL`, with a low-cost general-purpose model as the default.
- The OpenRouter API key is ready, but must never be committed or stored in project docs; it should be supplied through server-only environment variables such as `OPENROUTER_API_KEY`.
- Limit AI generation to 30 calls per account per day for MVP.
- AI response timeout is 10 seconds.
- A playthrough should generally reach a recordable outcome after 25-40 major events.
- A run can generate a `커리어와 엔딩 기록` when the character reaches a career branch point such as graduation, dropout, extended leave, employment, entrepreneurship, exam success, licensed-profession entry, public-sector entry, or comparable path, and has accumulated at least 15 core events.
- MVP load target is 20 concurrent users, 1,000 accounts, 5,000 characters, and 10,000 saved records.
- At 768px and below, the UI should switch to a single-column mobile layout.
- Similar records should be grouped when job/company/path and core tags overlap by roughly 80% or more.
- Auth failures, save conflicts, invalid character state, AI failures, and invalid AI output should show concise user-facing guidance and provide retry or fallback paths.
- Character names must be entered by the user during character creation, not randomly generated by the system.
- Character creation should allow the user to choose initial grade/year, age, and major/department.
- Progression must allow academic and life-status changes such as leave of absence, part-time jobs, major transfer, dropout, internships, and other path-changing variables.
- Not every transition requires player choice. Some threshold-based forced events, such as burnout, can automatically trigger when hidden or public state crosses defined limits.
- Forced events should still be server-validated and persisted, and the player should regain agency through the next situation or recovery choices.

### Remaining Ambiguities
- Win/fail conditions are not framed as a single game-over state; the MVP should focus on reaching and recording varied career-and-ending outcomes after defined progression thresholds.

## Summary
The project is a greenfield entertainment game about raising a college student through organic choices, stats, relationships, emergent random events, job applications, workplace outcomes, and collectible endings. The design should avoid a simple fixed turn loop; instead, player decisions and accumulated context should unlock hidden event chains such as internships, leave of absence, relationship changes, and alternative career paths. It should use fictionalized company names inspired by real Korean and foreign companies for humor while avoiding direct real-world claims.

## Delivery Mode Decision
- Prompt shown: autonomous는 스펙/DAG를 만든 뒤 실행 전 한 번 확인받고 끝까지 진행합니다. agile은 큰 계획을 먼저 확인받고, 기능 조각마다 구현 후 사용 체크포인트를 둡니다. 어느 쪽으로 갈까요?
- User response: 1번으로 가자.
- Selected delivery_mode: autonomous
- Selection basis: explicit_user_choice

## Model Tier Decision
- Prompt shown: Tenet 작업을 어떤 실행 모델 기준으로 나눌까요? frontier는 강한 모델 기준으로 비교적 큰 목표 단위, local은 작은/로컬 모델 기준으로 더 잘게 나눕니다. 추천은 frontier입니다.
- User response: frontier로 가자.
- Selected model_tier: frontier
- Selection basis: explicit_user_choice
