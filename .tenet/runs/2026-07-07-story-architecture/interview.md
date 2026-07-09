# Interview: Story Architecture Overhaul (Collegiate Career Sim / 취준생 게임)

Date: 2026-07-07
Mode: Full
Rounds: 1

## Mode Selection
- Prompt shown: "Tenet 실행 모드를 선택해주세요. 권장: Full — 이유: story architecture 전면 개편으로 여러 모듈에 걸친 대규모 리팩터입니다."
- User response: Full
- Selected mode: full
- Selection basis: explicit_user_choice

## Clarity Score
- Goal: 0.9 (weight 0.4)
- Constraints: 0.9 (weight 0.3)
- Success criteria: 0.85 (weight 0.3)
- **Total: 0.885 / 0.8 required**

## Round 1

### Questions Asked
1. **스토리 개편 핵심 목표는?**
   > 강한 인과 관계 — 각 선택이 명확히 다음 사건으로 이어지고, 플레이어가 인과 관계를 느낄 수 있도록

2. **이벤트 등급 시스템 도입?**
   > 2단계 분리 (MAJOR_EVENTS / MINOR_EVENTS) — MAJOR만 coreEventCount 증가

3. **DB 스키마 변경 가능?**
   > DB 변경 가능 — causal chain 추적을 위한 Prisma 스키마 변경 허용

4. **Delivery mode?**
   > Autonomous — 한 번에 end-to-end 실행

5. **Model tier?**
   > Frontier — 강력한 모델이 실행

6. **인과 관계 표현 방식?**
   > 텍스트에 자연스럽게 녹이기 — UI 시각화는 포함하지 않음

7. **스코프 범위?**
   > 백엔드/로직만 — 프론트엔드 UI 변경 없음

### Decisions Made
- 이벤트 등급: MAJOR_EVENTS / MINOR_EVENTS 2단계 분리
- DB 변경: Prisma 스키마 변경 허용 (EventHistory에 causal chain 필드 추가)
- 인과 관계: 텍스트 기반 표현, UI 시각화 없음
- 스코프: 백엔드(game logic, event engine, AI prompt, DB)만. 프론트엔드 제외
- AI 프롬프트: 구조화된 causal data 주입으로 개선

### Remaining Ambiguities
- MAJOR 이벤트 간 정확한 간격 (매 N번째 MINOR마다 MAJOR 1개?)
- 기존 STATIC_EVENTS 중 MAJOR/MINOR 분류 기준
- 기존 플레이 저장 데이터와의 호환성 처리

## Delivery Mode Decision
- Prompt shown: "실행 방식을 선택해주세요. Autonomous: 한 번에 끝까지 실행 / Agile: 단계별로 확인하면서 진행"
- User response: Autonomous
- Selected delivery_mode: autonomous
- Selection basis: explicit_user_choice

## Model Tier Decision
- Prompt shown: "실행 잡을 수행할 모델 티어를 선택해주세요."
- User response: Frontier
- Selected model_tier: frontier
- Selection basis: explicit_user_choice

## Summary
2026-07-07부터 시작하는 취준생 게임 스토리 구조 전면 개편. 핵심은 강한 인과 관계 구축으로, Prisma 스키마 변경을 포함한 백엔드/로직 수준의 리팩터. 이벤트 등급(MAJOR/MINOR) 분리, causal chain 추적, 동적 복선/오픈스레드 생성, AI 프롬프트 고도화가 범위. 프론트엔드는 포함하지 않음.
