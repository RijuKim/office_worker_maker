import type { Prisma } from "@prisma/client";

type CareerSeed = Omit<Prisma.CareerDestinationCreateInput, "id">;

const REAL_COMPANY_PATTERNS = [
  /삼성|samsung/i, /현대|hyundai/i,
  /엘지|lg(?!\w)/i, /sk(?!(?!\w))/i,
  /네이버|naver/i, /카카오|kakao/i,
  /쿠팡|coupang/i, /배달의민족|baedal/i,
  /토스|toss/i,
  /구글|google\b/i, /애플|apple\s/i,
  /메타|meta\b|facebook/i, /아마존|amazon/i,
  /마이크로소프트|microsoft/i, /테슬라|tesla/i,
  /인텔|intel/i, /도요타|toyota/i,
  /코카콜라|coca.cola/i, /맥도날드|mcdonald/i,
  /나이키|nike\b/i,
  /에스케이|sk\s/i, /롯데|lotte/i,
  /신한|shinhan/i, /우리은행|woori/i,
  /비엠더블유|bmw\b/i, /엔비디아|nvidia/i,
];

const CONTROVERSY_PATTERNS = [
  /실제.*논란/i, /실제.*의혹/i, /실제.*사건/i, /진짜.*회사/i, /실제.*인물/i,
  /inspiredBy/i,
];

export function validateCareerDestination(seed: CareerSeed): string[] {
  const errors: string[] = [];

  for (const pattern of REAL_COMPANY_PATTERNS) {
    if (pattern.test(seed.displayName)) {
      errors.push(`displayName "${seed.displayName}" still matches real company: ${pattern}`);
    }
  }

  const tags = (seed.cultureTags as string[]) ?? [];
  const allText = [seed.displayName, seed.industry, ...tags].join(" ");
  for (const pattern of CONTROVERSY_PATTERNS) {
    if (pattern.test(allText)) {
      errors.push(`Contains real-reference pattern: ${pattern}`);
    }
  }

  const allowedTypes = [
    "PARODY_COMPANY", "PUBLIC_SECTOR", "LICENSED_PROFESSION",
    "ENTREPRENEURSHIP", "SELF_EMPLOYMENT", "UNEMPLOYED", "INHERITANCE",
  ] as const;
  if (!allowedTypes.includes(seed.destinationType as typeof allowedTypes[number])) {
    errors.push(`Invalid destinationType: ${seed.destinationType}`);
  }

  if (seed.hiringDifficulty < 1 || seed.hiringDifficulty > 5) {
    errors.push("hiringDifficulty must be 1-5");
  }

  return errors;
}

export function seedCareerDestinations(): CareerSeed[] {
  return [
    // ===== 한국 IT/테크 (패러디) =====
    {
      displayName: "삼슨전자",
      destinationType: "PARODY_COMPANY",
      industry: "전자/IT",
      roles: ["연구개발", "마케팅", "해외영업", "재무관리"],
      salaryBand: "4500~7000만원",
      cultureTags: ["체계적 교육", "야근 있음", "성과급", "대규모 조직"],
      hiringDifficulty: 4,
      preferredStats: { academic: 65, practical: 55 },
      eventTone: ["전문적", "조직적"],
    },
    {
      displayName: "현댜모터스",
      destinationType: "PARODY_COMPANY",
      industry: "자동차/제조",
      roles: ["생산 관리", "품질 검사", "연구 개발", "글로벌 영업"],
      salaryBand: "4000~6500만원",
      cultureTags: ["위계적", "안정적", "복지 좋음", "단체 워크숍"],
      hiringDifficulty: 4,
      preferredStats: { practical: 60, health: 50 },
      eventTone: ["체계적", "전통적"],
    },
    {
      displayName: "엘쥐전자",
      destinationType: "PARODY_COMPANY",
      industry: "가전/IT",
      roles: ["마케팅", "제품 기획", "해외 법인", "디자인"],
      salaryBand: "3800~6000만원",
      cultureTags: ["글로벌", "혁신 중시", "워라밸 준수"],
      hiringDifficulty: 3,
      preferredStats: { practical: 55, creativity: 50 },
      eventTone: ["혁신적", "도전적"],
    },
    {
      displayName: "케이띠",
      destinationType: "PARODY_COMPANY",
      industry: "통신/IT",
      roles: ["네트워크 엔지니어", "서비스 기획", "고객 관리", "데이터 분석"],
      salaryBand: "3500~5500만원",
      cultureTags: ["안정적", "관료적", "대규모"],
      hiringDifficulty: 3,
      preferredStats: { practical: 50, academic: 50 },
      eventTone: ["안정적", "보수적"],
    },
    {
      displayName: "에스끼리텔",
      destinationType: "PARODY_COMPANY",
      industry: "통신/에너지",
      roles: ["경영 지원", "연구소", "마케팅", "IT 개발"],
      salaryBand: "3600~5800만원",
      cultureTags: ["수평적", "복지 좋음", "계열사 다양"],
      hiringDifficulty: 3,
      preferredStats: { academic: 55, communication: 50 },
      eventTone: ["다양한", "안정적"],
    },
    {
      displayName: "네이봐",
      destinationType: "PARODY_COMPANY",
      industry: "IT/포털",
      roles: ["프론트엔드", "백엔드", "데이터 엔지니어", "서비스 기획"],
      salaryBand: "4000~7000만원",
      cultureTags: ["수평적", "자율 출퇴근", "스톡옵션", "개발 문화"],
      hiringDifficulty: 5,
      preferredStats: { practical: 70, creativity: 60 },
      eventTone: ["자유로운", "혁신적"],
    },
    {
      displayName: "카캉오",
      destinationType: "PARODY_COMPANY",
      industry: "IT/모바일",
      roles: ["모바일 개발", "서비스 기획", "데이터 분석", "UI/UX 디자인"],
      salaryBand: "3800~6500만원",
      cultureTags: ["자율적", "스타트업 문화", "자유로운"],
      hiringDifficulty: 4,
      preferredStats: { creativity: 55, practical: 60 },
      eventTone: ["창의적", "자유분방"],
    },
    {
      displayName: "배달이민족",
      destinationType: "PARODY_COMPANY",
      industry: "배달/이커머스",
      roles: ["물류 기획", "서비스 기획", "데이터 분석", "영업"],
      salaryBand: "3500~5500만원",
      cultureTags: ["빠른 템포", "성과 중시", "야근 많음"],
      hiringDifficulty: 3,
      preferredStats: { practical: 55, health: 50 },
      eventTone: ["역동적", "도전적"],
    },
    {
      displayName: "쿠판이마트",
      destinationType: "PARODY_COMPANY",
      industry: "이커머스/물류",
      roles: ["물류 관리", "MD", "마케팅", "데이터 분석"],
      salaryBand: "3200~5000만원",
      cultureTags: ["빠른 성장", "로켓 배송", "체력 중요"],
      hiringDifficulty: 3,
      preferredStats: { practical: 50, health: 55 },
      eventTone: ["속도감", "도전적"],
    },
    {
      displayName: "티오에스뱅크",
      destinationType: "PARODY_COMPANY",
      industry: "핀테크",
      roles: ["모바일 개발", "서비스 기획", "데이터 분석", "금융 상품"],
      salaryBand: "3800~6500만원",
      cultureTags: ["수평적", "스타트업", "혁신적"],
      hiringDifficulty: 4,
      preferredStats: { practical: 60, creativity: 50 },
      eventTone: ["혁신적", "도전적"],
    },

    // ===== 외국계 IT/테크 (패러디) =====
    {
      displayName: "규글코리아",
      destinationType: "PARODY_COMPANY",
      industry: "IT/검색",
      roles: ["소프트웨어 엔지니어", "프로덕트 매니저", "데이터 사이언티스트", "UX 리서처"],
      salaryBand: "6000~12000만원",
      cultureTags: ["수평적", "자율 근무", "복지 최고", "글로벌 환경"],
      hiringDifficulty: 5,
      preferredStats: { practical: 75, creativity: 65, academic: 60 },
      eventTone: ["혁신적", "자유로운"],
    },
    {
      displayName: "에플코리아",
      destinationType: "PARODY_COMPANY",
      industry: "IT/하드웨어",
      roles: ["마케팅", "영업", "고객 경험", "개발"],
      salaryBand: "5500~11000만원",
      cultureTags: ["프리미엄", "비밀주의", "디자인 중시", "완벽주의"],
      hiringDifficulty: 5,
      preferredStats: { creativity: 70, charm: 60, practical: 55 },
      eventTone: ["완벽주의", "프리미엄"],
    },
    {
      displayName: "네타코리아",
      destinationType: "PARODY_COMPANY",
      industry: "SNS/플랫폼",
      roles: ["콘텐츠 매니저", "데이터 분석", "광고 기획", "커뮤니티 관리"],
      salaryBand: "4500~8500만원",
      cultureTags: ["혁신적", "빠른 변화", "글로벌", "수평적"],
      hiringDifficulty: 4,
      preferredStats: { communication: 65, creativity: 55 },
      eventTone: ["역동적", "글로벌"],
    },
    {
      displayName: "아마손코리아",
      destinationType: "PARODY_COMPANY",
      industry: "이커머스/클라우드",
      roles: ["물류 관리", "AWS 엔지니어", "마케팅", "프로덕트"],
      salaryBand: "5000~10000만원",
      cultureTags: ["고강도", "데이터 중심", "소유욕 강한", "야근 있음"],
      hiringDifficulty: 5,
      preferredStats: { practical: 65, academic: 55, health: 50 },
      eventTone: ["강도 높은", "도전적"],
    },
    {
      displayName: "마소코리아",
      destinationType: "PARODY_COMPANY",
      industry: "IT/소프트웨어",
      roles: ["클라우드 엔지니어", "영업", "컨설턴트", "개발자"],
      salaryBand: "5000~9500만원",
      cultureTags: ["안정적", "글로벌", "복지 좋음", "유연 근무"],
      hiringDifficulty: 4,
      preferredStats: { practical: 60, academic: 55 },
      eventTone: ["전문적", "안정적"],
    },
    {
      displayName: "테스라모터스",
      destinationType: "PARODY_COMPANY",
      industry: "전기차/에너지",
      roles: ["배터리 연구", "소프트웨어", "생산 관리", "충전 인프라"],
      salaryBand: "4500~9000만원",
      cultureTags: ["혁신적", "고강도", "미래 지향", "스타트업 문화"],
      hiringDifficulty: 5,
      preferredStats: { practical: 65, creativity: 60, health: 55 },
      eventTone: ["혁신적", "미래 지향"],
    },
    {
      displayName: "인텝코리아",
      destinationType: "PARODY_COMPANY",
      industry: "반도체",
      roles: ["반도체 설계", "공정 엔지니어", "데이터 분석", "영업"],
      salaryBand: "4500~8000만원",
      cultureTags: ["기술 중심", "안정적", "연구 중시"],
      hiringDifficulty: 4,
      preferredStats: { academic: 70, practical: 55 },
      eventTone: ["기술적", "정밀함"],
    },
    {
      displayName: "엔비댜코리아",
      destinationType: "PARODY_COMPANY",
      industry: "반도체/AI",
      roles: ["AI 엔지니어", "GPU 개발", "데이터 사이언티스트", "연구"],
      salaryBand: "5500~11000만원",
      cultureTags: ["최첨단", "고성능", "글로벌", "개발자 중심"],
      hiringDifficulty: 5,
      preferredStats: { practical: 75, academic: 70, creativity: 60 },
      eventTone: ["최첨단", "열정적"],
    },

    // ===== 한국 전통/오프라인 (패러디) =====
    {
      displayName: "롯대백화점",
      destinationType: "PARODY_COMPANY",
      industry: "유통/백화점",
      roles: ["MD", "매장 관리", "마케팅", "바이어"],
      salaryBand: "3000~4500만원",
      cultureTags: ["전통적", "서비스 중시", "단체 워크숍"],
      hiringDifficulty: 2,
      preferredStats: { communication: 50, charm: 45 },
      eventTone: ["전통적", "서비스"],
    },
    {
      displayName: "신판은행",
      destinationType: "PARODY_COMPANY",
      industry: "금융/은행",
      roles: ["창구 업무", "대출 심사", "WM", "디지털 기획"],
      salaryBand: "3200~5000만원",
      cultureTags: ["안정적", "정년 보장", "상여금", "관료적"],
      hiringDifficulty: 3,
      preferredStats: { academic: 55, communication: 50 },
      eventTone: ["안정적", "보수적"],
    },
    {
      displayName: "우리에은행",
      destinationType: "PARODY_COMPANY",
      industry: "금융/은행",
      roles: ["디지털 금융", "리스크 관리", "마케팅", "IT 개발"],
      salaryBand: "3000~4800만원",
      cultureTags: ["디지털 전환", "안정적", "조직적"],
      hiringDifficulty: 3,
      preferredStats: { academic: 50, practical: 45 },
      eventTone: ["안정적", "체계적"],
    },
    {
      displayName: "두솔중공업",
      destinationType: "PARODY_COMPANY",
      industry: "중공업/건설",
      roles: ["현장 관리", "설계", "안전 관리", "해외 플랜트"],
      salaryBand: "3500~6000만원",
      cultureTags: ["현장 중심", "체력 중요", "장기 근속"],
      hiringDifficulty: 3,
      preferredStats: { practical: 55, health: 60 },
      eventTone: ["현장감", "도전적"],
    },
    {
      displayName: "씨제이이엔엠",
      destinationType: "PARODY_COMPANY",
      industry: "미디어/엔터",
      roles: ["콘텐츠 기획", "마케팅", "PD", "방송 작가"],
      salaryBand: "3000~5500만원",
      cultureTags: ["창의성 중시", "야근 있음", "네트워크 중요"],
      hiringDifficulty: 4,
      preferredStats: { creativity: 65, communication: 60 },
      eventTone: ["창의적", "열정적"],
    },

    // ===== 외국계 소비재/서비스 (패러디) =====
    {
      displayName: "나이끼코리아",
      destinationType: "PARODY_COMPANY",
      industry: "스포츠/의류",
      roles: ["마케팅", "브랜드 매니저", "영업", "디자인"],
      salaryBand: "3500~6000만원",
      cultureTags: ["스포츠 감성", "글로벌", "역동적", "자율적"],
      hiringDifficulty: 3,
      preferredStats: { health: 60, communication: 55 },
      eventTone: ["역동적", "열정적"],
    },
    {
      displayName: "코카코라코리아",
      destinationType: "PARODY_COMPANY",
      industry: "음료/식품",
      roles: ["마케팅", "영업", "브랜드 매니저", "공급망"],
      salaryBand: "3500~5500만원",
      cultureTags: ["글로벌 브랜드", "워라밸 좋음", "복지 좋음"],
      hiringDifficulty: 3,
      preferredStats: { communication: 55, creativity: 45 },
      eventTone: ["밝은", "친근한"],
    },
    {
      displayName: "맥두날드코리아",
      destinationType: "PARODY_COMPANY",
      industry: "패스트푸드/프랜차이즈",
      roles: ["매장 관리", "마케팅", "공급망", "교육"],
      salaryBand: "2500~4000만원",
      cultureTags: ["체계적 교육", "교대 근무", "빠른 템포"],
      hiringDifficulty: 2,
      preferredStats: { health: 50, practical: 45 },
      eventTone: ["바쁜", "체계적"],
    },
    {
      displayName: "스타벅수커피",
      destinationType: "PARODY_COMPANY",
      industry: "카페/프랜차이즈",
      roles: ["바리스타", "매장 매니저", "MD", "로스팅"],
      salaryBand: "2400~3800만원",
      cultureTags: ["서비스 중심", "감성", "브랜드 충성도"],
      hiringDifficulty: 2,
      preferredStats: { charm: 55, communication: 50 },
      eventTone: ["친절한", "감성적"],
    },
    {
      displayName: "비엠뷁코리아",
      destinationType: "PARODY_COMPANY",
      industry: "자동차/럭셔리",
      roles: ["마케팅", "딜러 관리", "고객 경험", "서비스 엔지니어"],
      salaryBand: "4500~7500만원",
      cultureTags: ["프리미엄", "독일식", "철저한"],
      hiringDifficulty: 4,
      preferredStats: { charm: 60, practical: 55, reputation: 55 },
      eventTone: ["프리미엄", "전문적"],
    },
    {
      displayName: "토요타모터스",
      destinationType: "PARODY_COMPANY",
      industry: "자동차/제조",
      roles: ["생산 관리", "품질", "연구 개발", "부품 조달"],
      salaryBand: "3800~6000만원",
      cultureTags: ["안정적", "장기 근속", "해외 근무", "카이젠"],
      hiringDifficulty: 3,
      preferredStats: { practical: 55, health: 50 },
      eventTone: ["안정적", "정밀함"],
    },

    // ===== 공공/전문직 =====
    {
      displayName: "서울시청(가상)",
      destinationType: "PUBLIC_SECTOR",
      industry: "공공행정",
      roles: ["행정직", "민원 대응", "정책 보조", "정보화"],
      salaryBand: "2700~4000만원",
      cultureTags: ["안정적", "정년 보장", "워라밸 우수"],
      hiringDifficulty: 4,
      preferredStats: { academic: 55, communication: 45 },
      eventTone: ["안정적", "공공성"],
    },
    {
      displayName: "가칭교육부",
      destinationType: "PUBLIC_SECTOR",
      industry: "공공교육",
      roles: ["교육 행정", "정책 기획", "연구사"],
      salaryBand: "2800~4200만원",
      cultureTags: ["안정적", "공공성", "성장 가능성"],
      hiringDifficulty: 4,
      preferredStats: { academic: 60, communication: 50 },
      eventTone: ["안정적", "공익적"],
    },
    {
      displayName: "햇빛복지재단",
      destinationType: "PUBLIC_SECTOR",
      industry: "사회복지",
      roles: ["사회복지사", "프로그램 기획", "사례 관리"],
      salaryBand: "2500~3500만원",
      cultureTags: ["사명감", "보람", "열악한 처우"],
      hiringDifficulty: 3,
      preferredStats: { mental: 60, communication: 55 },
      eventTone: ["사명감", "따뜻함"],
    },
    {
      displayName: "변호사(가상 로펌)",
      destinationType: "LICENSED_PROFESSION",
      industry: "법률",
      roles: ["변호사", "법률 연구원", "소송 사무"],
      salaryBand: "5000~15000만원",
      cultureTags: ["전문직", "고압적", "고소득"],
      hiringDifficulty: 5,
      preferredStats: { academic: 80, communication: 65, mental: 60 },
      eventTone: ["전문적", "도전적"],
    },
    {
      displayName: "의사(가상병원)",
      destinationType: "LICENSED_PROFESSION",
      industry: "의료",
      roles: ["전문의", "인턴", "의료 연구"],
      salaryBand: "6000~20000만원",
      cultureTags: ["고강도", "사회 기여", "높은 전문성"],
      hiringDifficulty: 5,
      preferredStats: { academic: 85, health: 65, mental: 60 },
      eventTone: ["책임감", "긴박감"],
    },
    {
      displayName: "공인회계사(가상 회계법인)",
      destinationType: "LICENSED_PROFESSION",
      industry: "회계/감사",
      roles: ["회계사", "감사", "세무사"],
      salaryBand: "4000~10000만원",
      cultureTags: ["전문직", "정확성 중시", "시즌 집중"],
      hiringDifficulty: 5,
      preferredStats: { academic: 70, practical: 60 },
      eventTone: ["정밀함", "체계적"],
    },
    {
      displayName: "약사(가상약국)",
      destinationType: "LICENSED_PROFESSION",
      industry: "제약/헬스케어",
      roles: ["약사", "의약품 관리", "건강 상담"],
      salaryBand: "4500~8000만원",
      cultureTags: ["전문직", "지역 사회", "안정적"],
      hiringDifficulty: 5,
      preferredStats: { academic: 70, communication: 55 },
      eventTone: ["전문적", "안정적"],
    },

    // ===== 창업/자영업 =====
    {
      displayName: "IT 스타트업 창업",
      destinationType: "ENTREPRENEURSHIP",
      industry: "IT/SaaS",
      roles: ["창업자", "CTO", "서비스 기획"],
      salaryBand: "가변적 (0~무제한)",
      cultureTags: ["리스크 높음", "자유도", "스톡옵션", "철야"],
      hiringDifficulty: 1,
      preferredStats: { practical: 65, creativity: 65, mental: 70 },
      eventTone: ["도전적", "독립적"],
    },
    {
      displayName: "오프라인 창업(상권 분석 중)",
      destinationType: "ENTREPRENEURSHIP",
      industry: "소매/외식",
      roles: ["사장", "운영 관리"],
      salaryBand: "가변적 (1500~8000만원)",
      cultureTags: ["주도적", "리스크 있음", "자유도"],
      hiringDifficulty: 2,
      preferredStats: { practical: 55, wealth: 30 },
      eventTone: ["도전적", "독립적"],
    },
    {
      displayName: "프리랜서 개발자",
      destinationType: "SELF_EMPLOYMENT",
      industry: "IT/프리랜서",
      roles: ["프론트엔드", "백엔드", "풀스택", "1인 기업"],
      salaryBand: "가변적 (3000~10000만원)",
      cultureTags: ["자유로운", "고소득 가능", "불안정"],
      hiringDifficulty: 2,
      preferredStats: { practical: 75, creativity: 55 },
      eventTone: ["자유분방", "도전적"],
    },
    {
      displayName: "번역 프리랜서",
      destinationType: "SELF_EMPLOYMENT",
      industry: "언어/번역",
      roles: ["번역가", "교정 교열", "로컬라이제이션"],
      salaryBand: "가변적 (2000~5000만원)",
      cultureTags: ["자유로운", "재택 근무", "불규칙"],
      hiringDifficulty: 2,
      preferredStats: { academic: 55, communication: 60 },
      eventTone: ["조용한", "개인적"],
    },
    {
      displayName: "영상 크리에이터",
      destinationType: "SELF_EMPLOYMENT",
      industry: "콘텐츠/유튜브",
      roles: ["크리에이터", "편집자", "채널 운영"],
      salaryBand: "가변적 (0~무제한)",
      cultureTags: ["창의적", "자유로운", "불안정"],
      hiringDifficulty: 1,
      preferredStats: { creativity: 70, communication: 55 },
      eventTone: ["창의적", "자유분방"],
    },

    // ===== 스페셜 엔딩: 백수/건물주 =====
    {
      displayName: "백수 (장기 취업 준비)",
      destinationType: "UNEMPLOYED",
      industry: "무직",
      roles: ["취업 준비생", "재수생", "방 구하기"],
      salaryBand: "0원 (용돈: 20~50만원)",
      cultureTags: ["방구석", "불안정", "자존감 하락", "시간은 많음"],
      hiringDifficulty: 1,
      preferredStats: { mental: 20, wealth: 10 },
      eventTone: ["우울한", "막막한"],
    },
    {
      displayName: "건물주 (임대 수입)",
      destinationType: "INHERITANCE",
      industry: "부동산/임대",
      roles: ["건물 관리", "임대인", "월세 수집가"],
      salaryBand: "연 5000만원~3억원 (임대 수입)",
      cultureTags: ["안정적", "자유로운", "경제적 여유", "사회적 시기"],
      hiringDifficulty: 1,
      preferredStats: { wealth: 90, network: 60, mental: 50 },
      eventTone: ["여유로운", "고립된"],
    },
  ];
}

export function findBestMatchingDestination(
  stats: Record<string, number>,
  allDestinations: CareerSeed[],
): CareerSeed {
  let bestDest = allDestinations[0];
  let bestScore = -Infinity;

  for (const dest of allDestinations) {
    const prefStats = dest.preferredStats as Record<string, unknown>;
    let score = 0;
    let count = 0;

    for (const [stat, weight] of Object.entries(prefStats)) {
      const statValue = stats[stat] ?? 50;
      const statWeight = weight as number;
      score -= Math.abs(statValue - statWeight) * (statWeight > 50 ? 2 : 1);
      count++;
    }

    if (count > 0) {
      const avgScore = score / count;
      if (avgScore > bestScore) {
        bestScore = avgScore;
        bestDest = dest;
      }
    }
  }

  return bestDest;
}