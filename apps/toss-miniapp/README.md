# Toss Miniapp

Apps in Toss 제출을 목표로 분리한 CSR 전용 프론트입니다.

- 개발: `npm run toss:dev`
- 빌드: `npm run toss:build`
- 결과물: `dist/toss-miniapp`

기본 개발 서버는 `/api` 요청을 `http://localhost:3000`으로 프록시합니다. 배포 환경에서는 `VITE_API_BASE_URL=https://sano-officeworker.vercel.app`처럼 현재 Next/Vercel API 서버 주소를 지정합니다.
