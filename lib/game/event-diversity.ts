const DEFAULT_REPEAT_THRESHOLD = 2;

/** Categories seen once stay eligible; only repeats are broadly avoided. */
export function buildDiversityCategoryGuidance(
  recentCategories: string[],
  allCategories: string[],
  repeatThreshold = DEFAULT_REPEAT_THRESHOLD,
) {
  const counts = recentCategories.reduce<Record<string, number>>((result, category) => {
    result[category] = (result[category] ?? 0) + 1;
    return result;
  }, {});
  const immediateCategories = [...new Set(recentCategories.slice(0, 2))];
  const repeatedCategories = Object.entries(counts)
    .filter(([, count]) => count >= repeatThreshold)
    .map(([category]) => category);

  return {
    avoidCategories: [...new Set([...immediateCategories, ...repeatedCategories])],
    preferCategories: allCategories.filter((category) => !counts[category]).slice(0, 4),
  };
}
