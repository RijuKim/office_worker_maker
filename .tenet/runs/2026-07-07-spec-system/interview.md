# Interview: 스펙 시스템 (Credential/Spec System)

Date: 2026-07-07
Mode: Full
Rounds: 1

## Mode Selection
- Prompt shown: Full mode recommended - this is a major new game system (스펙/취준) that touches Prisma schema, event engine, game rules, UI, and career paths. Multiple modules involved, significant scope.
- User response: confirmed (계속 진행해줘)
- Selected mode: full
- Selection basis: explicit_user_choice

## Round 1

### Questions Asked
1. 스펙 시스템의 적용 시점은 언제인가요?
   > 3~4학년부터

2. 취준 프로세스를 어느 정도로 현실적으로 구현할까요?
   > 상세 구현 (서류→인적성→코테→1차면접→2차면접→최종합격, 회사 유형별 다른 전형)

3. 4학년 큰 사건들은 기존 DestinationCandidate 시스템과 어떻게 연결되나요?
   > 진로 트랙으로 연결 (워홀, 임용, 회계사, 로스쿨, 변리사, 메디컬 편입 등)

4. 데이터 저장 방식은?
   > 새 Prisma 모델 (마이그레이션 필요)

5. 전형 단계 세분화?
   > 6단계 상세 (서류→인적성→코테→1차면접→2차면접→최종합격)

6. 스펙 이벤트 시퀀스?
   > 2단계 이벤트 시퀀스 (접수/선택 → 다음 이벤트에 결과가 자연스럽게 녹아들음)

7. 선택 결과 전달 방식?
   > 선택 결과가 별도로 나오는 게 아니라 다음 이벤트 서두에 자연스럽게 녹아들어야 함 (이것은 기존 모든 이벤트 시스템에도 동일 적용)

8. 취준 비판 요소?
   > 모두 포함 (스펙 초월 합격, 블라인드 채용, 우울증/번아웃, 피로도, 자산 부담)

### Decisions Made
- 스펙 시스템은 3~4학년부터 본격적으로 활성화
- 취준 전형은 6단계 상세 구현, 회사 유형별 차별화
- 4학년 큰 사건은 진로 트랙으로 연결
- 새 Prisma 모델 추가 (Spec, SpecType, CareerPath 등)
- 스펙 이벤트는 2단계 시퀀스 (접수/선택 → 결과 반영)
- 선택 결과는 다음 이벤트 서두에 자연스럽게 녹아들도록 변경 (전체 이벤트 시스템에 적용)
- 한국 취준생 현실 비판 요소 모두 포함

### Remaining Ambiguities
- Prisma 모델의 구체적인 스키마 구조 (Spec, CareerPath 테이블 상세)
- 기존 이벤트 시스템 변경 범위 (선택 결과를 다음 이벤트에 녹이는 방식)
- 4학년 큰 사건들의 구체적인 게임플레이 루프

## Delivery Mode Decision
- Prompt shown: autonomous (one end-to-end run) vs agile (sliced delivery with checkpoints)
- User response: 계속 진행해줘 (implicitly confirmed autonomous)
- Selected delivery_mode: autonomous
- Selection basis: defaulted_after_explicit_choice_prompt

## Model Tier Decision
- Prompt shown: frontier (strong model, fewer larger jobs) vs local (finer-grained DAG)
- User response: 계속 진행해줘 (implicitly confirmed frontier)
- Selected model_tier: frontier
- Selection basis: defaulted_after_uncertainty_prompt

## Summary
대학생활 시뮬레이션 게임에 스펙(인턴, 어학점수, 포트폴리오) 시스템과 현실적인 취준 프로세스(서류→인적성→코테→면접→최종)를 추가한다. 3~4학년부터 본격적으로 활성화되며, 4학년에는 워홀/임용/회계사/로스쿨/변리사/메디컬편입 등 진로 트랙이 열린다. 새 Prisma 모델을 추가하며, 선택 결과는 다음 이벤트 서두에 자연스럽게 녹아들도록 전체 이벤트 시스템을 개선한다. 한국 취준생의 현실(스펙 초월 합격, 블라인드 채용, 번아웃, 피로도, 자산 부담)을 비판적으로 반영한다.
