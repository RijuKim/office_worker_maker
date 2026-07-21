/** Reviewed from git objects fa4a24e^ and fa4a24e, independent of the working tree. */
export const preRefreshOracle = {
  structures: {
    gameplay: ["section.screen-stack", "div.stats-grid", "article.event-panel", "div.choice-stack"],
    feedback: ["section.screen-stack", "div.stats-grid", "div.feedback-panel", "article.event-panel", "div.choice-stack"],
    emptyEvent: ["section.screen-stack", "div.list-panel", "p.muted", "button.primary-button"],
    records: ["section.screen-stack", "div.action-grid", "article.record-panel", "strong", "p", "span"],
  },
  tokens: {
    shellBackground: "rgb(23, 19, 15)",
    panelBackground: "rgb(33, 26, 20)",
    controlBackground: "rgb(48, 38, 29)",
    text: "rgb(247, 239, 226)",
    muted: "rgb(217, 201, 181)",
    border: "rgb(77, 61, 47)",
    radius: "8px",
    panelPadding: "14px",
    stackGap: "12px",
    choiceHeight: 48,
  },
} as const;

export const forbiddenProvenance = /(?:^|\s)AI(?:\s|$)|AI 사건|FALLBACK|provider|source/i;
