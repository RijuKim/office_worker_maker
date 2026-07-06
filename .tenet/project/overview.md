# Project Overview

This project is a greenfield browser game about raising a college student into an early-career worker through organic choices, stats, relationships, hidden events, AI-assisted event generation, job paths, and collectible records.

The game is entertainment-first. It is not a career guidance or real-company evaluation tool. Players should feel that college activities, relationships, internships, leave of absence, job search, public-sector paths, licensed professions, entrepreneurship, and self-employment are connected through emergent event chains rather than isolated turn actions.

The first implementation is a desktop-first responsive web app. Mobile layouts must be usable from the start, with a single-column layout at 768px and below. The initial UI is primarily text-adventure style with card-based support surfaces for character state, relationships, memories, career/company records, saves, and collection views.

Success for the MVP means a user can create an account, create multiple character runs, experience 25-40 major events per run, make choices that update server-owned state, receive at least one OpenRouter-assisted event path with static fallback, reach a career branch point after at least 15 core events, and save a `커리어와 엔딩 기록` to the account collection.

The company and career data uses fictional parody entities only. It can be inspired by recognizable Korean and foreign company categories, but must not store or display exact real company names, real executives, real incidents, controversies, or allegations.

Target MVP scale is 20 concurrent users, 1,000 accounts, 5,000 characters, and 10,000 saved records. AI generation is limited to 30 calls per account per day and must fail open to static/fallback events so game progress is not blocked by provider outages or cost controls.
