# Toss Miniapp

Apps in Toss 제출을 목표로 분리한 CSR 전용 프론트입니다.

제출 포지셔닝: `일어나보니 대한민국 취준생` / `취준 생활 시뮬레이션`

짧은 설명: `스펙, 멘탈, 통장잔고까지 관리해야 하는 가상 취준 생활을 직접 굴려보세요.`

- 개발: `npm run toss:dev`
- 빌드: `npm run toss:build`
- 프로덕션 API 빌드: `npm run toss:build:production`
- 결과물: `dist/toss-miniapp`
- 앱인토스 제출 패키지: `npm run ait:build`

Node.js 24 이상이 필요합니다. 앱 ID는 `sano-officeworker`이며, 앱인토스 콘솔에 등록한 `appName`과 반드시 같아야 합니다.

기본 개발 서버는 `/api` 요청을 `http://localhost:3000`으로 프록시합니다. 배포 환경에서는 `VITE_API_BASE_URL=https://sano-officeworker.vercel.app`처럼 현재 Next/Vercel API 서버 주소를 지정합니다.
