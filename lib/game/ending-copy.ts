export function sanitizeResultText(value: unknown) {
  if (typeof value !== "string") return null;
  return value
    .replace(/배드엔딩/g, "중도 결과")
    .replace(/일반엔딩/g, "선택의 결과")
    .replace(/AI엔딩/g, "선택의 결과")
    .replace(/엔딩/g, "결과")
    .replace(/\d+\s*개의?\s*사건(?:과|을|를)?\s*(?:마지막\s*관문(?:을|까지)?\s*)?(?:지나|거쳐)/g, "지금까지의 선택을 지나")
    .replace(/(학점|학업|지식|실무|실무력|건강|멘탈|정신|자산|돈|평판|명성|매력|네트워크|관계|academic|practical|health|mental|wealth|reputation|charm|network)\s*(?:수치|점수|스탯|stat)?\s*(?:은|는|이|가|의)?\s*[:：]?\s*(?:10|[0-9])\b/gi, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function buildLongFallbackEnding(
  name: string,
  major: string,
  careerPath: string,
  stats: Record<string, number>,
  finalChoiceSummary: string,
  relationshipState: string,
  eventHistory: { event: { title: string }; summary: string }[] = [],
) {
  const publicStrength = stats.academic >= stats.practical
    ? "당신은 책상 앞에서 오래 버티는 법을 알았다"
    : "당신은 현장에서 몸으로 익히는 속도가 빨랐다";
  const rememberedEvents = eventHistory
    .slice(-4)
    .map((history) => `${history.event.title}에서 ${history.summary}`)
    .join(" ");
  const memoryLine = rememberedEvents || "몇 개의 선택은 기록보다 오래 몸에 남았다.";
  const reversal = stats.reputation < 5
    ? "그러나 평판은 이상한 방식으로 뒤따라왔다. 한때 사소하게 넘겼던 말과 관계의 균열은, 가장 중요한 추천과 면접의 계절에 다시 고개를 들었다"
    : stats.health < 5
      ? "그러나 몸은 뒤늦게 청구서를 내밀었다. 커리어가 막 속도를 내기 시작할 때마다 당신은 쉬어야 했고, 쉬는 동안 다른 사람들은 한 발씩 앞서 나갔다"
      : stats.mental < 5
        ? "그러나 마음은 쉽게 회복되지 않았다. 남들이 보기에는 멀쩡한 성취도 당신에게는 늘 다음 실패를 미루는 임시방편처럼 느껴졌다"
        : "그러나 삶은 단순한 보상처럼 흘러가지 않았다. 잘한 선택도 대가를 남겼고, 피한 선택도 언젠가는 다른 얼굴로 돌아왔다";

  const seed = [...`${name}:${careerPath}:${eventHistory.map((history) => history.event.title).join("|")}`]
    .reduce((hash, character) => (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0, 2166136261);
  const openings = [
    `${name}의 졸업 이후는 ${major}의 강의실에서 예상한 모습과 달랐다. ${careerPath}의 첫날, 당신은 익숙한 장점보다 아직 모르는 규칙이 더 많다는 사실부터 배웠다.`,
    `마지막 선택 다음 날에도 세상은 평소처럼 움직였다. 다만 ${name}에게는 ${careerPath}라는 낯선 생활이 시작되었고, 사소했던 대학 시절의 선택들이 뜻밖의 순서로 쓸모를 드러냈다.`,
    `${name}은 거창한 확신보다 작은 결정을 따라 ${careerPath}에 도착했다. 처음 마주한 것은 성공의 표지판이 아니라, 누구에게 도움을 청하고 무엇을 포기할지 정해야 하는 현실적인 하루였다.`,
    `${major} 전공이 정해준 길만 따라가지는 않았지만, 그 시절 익힌 관찰과 버티는 방식은 ${careerPath}에서도 남았다. 당신은 예상보다 조용하게 새로운 생활의 문을 열었다.`,
  ];
  const middles = [
    `${memoryLine} ${publicStrength}. ${finalChoiceSummary} 그 선택은 시간이 흐른 뒤 중요한 제안 앞에서 다시 떠오르는 기준이 되었다.`,
    `${finalChoiceSummary} 당시에는 작은 결정처럼 보였지만, 이후 ${memoryLine}이라는 기억과 연결되며 사람을 고르고 일을 받아들이는 방식까지 바꾸었다. ${publicStrength}.`,
    `${publicStrength}. 특히 ${memoryLine} 그 경험은 이력서 한 줄보다 오래 남아, 뜻밖의 실패 뒤에 다시 움직일 이유가 되었다.`,
    `${memoryLine} 당신은 그때 얻은 것뿐 아니라 놓친 것도 기억했다. ${finalChoiceSummary} 그래서 다음 기회에서는 이전과 다른 대답을 내놓을 수 있었다.`,
  ];
  const closings = [
    `몇 년 뒤, 당신은 ${relationshipState}이라는 생활 속에서 퇴근길의 불빛을 바라보았다. 처음 원했던 삶과 완전히 같지는 않았지만, 오늘의 문을 어느 쪽으로 열지는 스스로 정할 수 있었다.`,
    `시간이 지난 뒤에도 모든 문제가 해결된 것은 아니었다. 그래도 ${relationshipState}의 관계와 생활 속에서, 당신은 다음 아침에 돌아갈 자리와 떠날 수 있는 용기를 함께 갖게 되었다.`,
    `당신은 결국 하나의 직함으로 설명되지 않는 사람이 되었다. ${relationshipState}의 삶을 지키며 책상 한쪽에 오래된 기록을 놓아두었고, 가끔 그 첫 문장을 다시 읽었다.`,
    `어느 늦은 저녁, 당신은 예전의 자신이라면 피했을 전화를 차분히 받았다. ${relationshipState}이라는 현재는 완벽하지 않았지만, 이제 선택의 대가와 가능성을 모두 자신의 것으로 말할 수 있었다.`,
  ];

  return `${openings[seed % openings.length]} ${middles[(seed >>> 3) % middles.length]}

${reversal}. 잘한 선택도 비용을 남겼고, 피한 선택도 다른 얼굴로 돌아왔다. 그 과정에서 관계는 기회가 되기도 하고 경계선이 되기도 했으며, 당신은 무엇을 오래 지킬 사람인지 조금씩 분명해졌다.

${closings[(seed >>> 7) % closings.length]}`;
}
