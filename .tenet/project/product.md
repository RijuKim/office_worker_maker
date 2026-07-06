# Project Product

## Core Experience

The player grows a college student through a text-adventure simulation. The game must not feel like a fixed turn loop with separate buttons for study, clubs, part-time work, romance, and networking. Instead, choices, stats, relationships, hidden states, and event flags should produce connected narrative events.

Example intended behavior: a club activity can build trust with a senior, which later unlocks a hidden internship offer. Accepting it may trigger leave-of-absence, workplace events, new relationships, and different career branches.

## Player Data

Accounts use email/password authentication. Each account can own multiple character runs. Character names are entered by the user during character creation; the system must not randomly assign the protagonist's name. Character creation should also let the user choose initial grade/year, age, and major/department. Saved data includes character state, academic/life status, public stats, hidden state, relationships, flags, active event context, career/company applications, employment history, and `커리어와 엔딩 기록`.

Public stats:
- 학업
- 실무
- 커뮤니케이션
- 창의성
- 체력
- 멘탈
- 인맥
- 자산
- 평판
- 매력

Hidden state includes 전공 적합도, 번아웃 위험, relationship trust values, romance state, family/friend relationship state, career interests, company/job-role preferences, image fit, self-care/condition, and event flags.

Progression can change academic and life status through events and choices, including leave of absence, part-time jobs, major transfer, dropout, internships, exam preparation, entrepreneurship preparation, and other path-changing variables.

Not every transition is player-selected. Threshold-based forced events can occur when state crosses defined limits, such as burnout triggering an automatic crisis/recovery event. Forced events must still be server-validated and persisted, and should return agency through the next situation or recovery choices.

`매력` is a broad stat covering attitude, presence, style, self-expression, and perceived charm. It must not be implemented as a narrow physical appearance score or as a simple success shortcut.

## Careers And Records

Career destinations include parody companies, public-sector jobs, licensed professions, entrepreneurship, and self-employment. Destination data includes job roles, salary bands, industry/category, scale, culture tags, hiring difficulty, preferred stats, and event tone.

Job roles include marketing, HR, finance/accounting, engineering, sales, planning, design, operations, and other office or career categories.

The collection feature is called `커리어와 엔딩 기록`. A saved record represents the career starting point and surrounding work/life situation reached by a playthrough, not a final judgment of the character's whole life. Records store title, summary, long narrative, job/profession/company/path, starting salary or salary band, workplace-life tone, stat snapshot, key people/relationships, 3-7 major college-era events, satisfaction, growth potential, work-life balance, health, relationship state, acquired timestamp, and tags.

The same job or company can appear in multiple records if the story, relationships, stats, or work-life result meaningfully differ. Near duplicates should be grouped when job/company/path and core tags overlap by roughly 80% or more.

## AI Events

OpenRouter is used for AI-assisted event and ending narrative generation. AI may generate event text, choices, and result descriptions. Server rules own canonical state changes. AI output must use structured JSON where possible and must be validated before any state change is committed.

OpenRouter calls are reserved for key moments such as generating a new event or a final ending narrative. The game should not call AI for every player choice. AI response timeout is 10 seconds. Failures, timeouts, rate limits, invalid data, or safety violations must use static fallback content.

## Safety Rules

Playable companies are fictional parody entities. Do not store or display exact real company names. Parody names should alter at least 1-2 characters or clearly twist sound/spelling. Do not use real CEOs, real incidents, real controversies, or real criminal allegations.

Negative workplace descriptions must be fictional culture tags, not claims about real companies. The UI should display a notice that companies, people, and events are fictional and parody-based.
