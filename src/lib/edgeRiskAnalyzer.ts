export type RiskLevel = "low" | "medium" | "high" | "critical";

const CRITICAL_PATTERNS = [
  /kill me|want to die|suicid|end my life|murder|weapon|gun|knife|bleeding|strangl|kidnap|locked in/i,
  /he is here now|she is here now|in immediate danger|coming after me|outside my door/i,
];

const HIGH_PATTERNS = [
  /threat|threaten|beat|beating|assault|rape|sexual assault|forced|violent|violence|abuse|abusive/i,
  /cannot leave|won't let me leave|stalking|tracking me|following me|harassing me/i,
];

const MEDIUM_PATTERNS = [
  /afraid|scared|unsafe|fear|control|controlling|shouting|insult|humiliat|coerc|pressur/i,
  /need help|need support|where can i go|shelter|counsel|legal help|protect/i,
];

function scoreText(text: string): number {
  const normalizedText = text.trim().toLowerCase();
  if (!normalizedText) {
    return 0;
  }

  let score = 0;

  CRITICAL_PATTERNS.forEach((pattern) => {
    if (pattern.test(normalizedText)) {
      score += 4;
    }
  });

  HIGH_PATTERNS.forEach((pattern) => {
    if (pattern.test(normalizedText)) {
      score += 2;
    }
  });

  MEDIUM_PATTERNS.forEach((pattern) => {
    if (pattern.test(normalizedText)) {
      score += 1;
    }
  });

  if (normalizedText.length > 280) {
    score += 1;
  }

  return score;
}

export const analyzeRiskOnEdge = async (text: string): Promise<RiskLevel> => {
  const score = scoreText(text);

  if (score >= 4) {
    return "critical";
  }

  if (score >= 2) {
    return "high";
  }

  if (score >= 1) {
    return "medium";
  }

  return "low";
};
