/**
 * Contribution utilities for tracking human vs AI contribution ratios
 */

import type { ContributionRatio } from "./types.js";

/**
 * Calculation methods for contribution ratios
 */
export type CalculationMethod = "manual" | "line-count" | "commit-analysis" | "time-tracking" | "estimate";

/**
 * Validate contribution percentages
 *
 * @param humanPercent - Human contribution percentage
 * @param aiPercent - AI contribution percentage
 * @returns Validation result
 */
export function validateContribution(
  humanPercent: number,
  aiPercent: number
): { valid: boolean; error?: string } {
  if (!Number.isInteger(humanPercent) || !Number.isInteger(aiPercent)) {
    return { valid: false, error: "Percentages must be integers" };
  }

  if (humanPercent < 0 || humanPercent > 100) {
    return { valid: false, error: "Human percentage must be between 0 and 100" };
  }

  if (aiPercent < 0 || aiPercent > 100) {
    return { valid: false, error: "AI percentage must be between 0 and 100" };
  }

  if (humanPercent + aiPercent !== 100) {
    return { valid: false, error: "Percentages must sum to 100" };
  }

  return { valid: true };
}

/**
 * Create a contribution ratio object
 *
 * @param humanPercent - Human contribution percentage (0-100)
 * @param aiPercent - AI contribution percentage (0-100)
 * @param notes - Optional notes explaining the calculation
 * @param calculationMethod - How the ratio was determined
 * @returns ContributionRatio object
 * @throws Error if percentages don't sum to 100
 */
export function createContributionRatio(
  humanPercent: number,
  aiPercent: number,
  notes?: string,
  calculationMethod?: CalculationMethod
): ContributionRatio {
  const validation = validateContribution(humanPercent, aiPercent);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  return {
    humanPercent,
    aiPercent,
    notes,
    calculationMethod,
  };
}

/**
 * Calculate contribution from the AI percentage
 *
 * @param aiPercent - AI contribution percentage
 * @returns ContributionRatio with human percentage calculated
 */
export function fromAiPercent(
  aiPercent: number,
  notes?: string,
  calculationMethod?: CalculationMethod
): ContributionRatio {
  return createContributionRatio(100 - aiPercent, aiPercent, notes, calculationMethod);
}

/**
 * Calculate contribution from the human percentage
 *
 * @param humanPercent - Human contribution percentage
 * @returns ContributionRatio with AI percentage calculated
 */
export function fromHumanPercent(
  humanPercent: number,
  notes?: string,
  calculationMethod?: CalculationMethod
): ContributionRatio {
  return createContributionRatio(humanPercent, 100 - humanPercent, notes, calculationMethod);
}

/**
 * Format contribution ratio for display
 *
 * @param ratio - The contribution ratio to format
 * @returns Human-readable string
 */
export function formatContribution(ratio: ContributionRatio): string {
  let result = `Human: ${ratio.humanPercent}%, AI: ${ratio.aiPercent}%`;

  if (ratio.notes) {
    result += ` (${ratio.notes})`;
  }

  return result;
}

/**
 * Get a description of the contribution level
 *
 * @param humanPercent - Human contribution percentage
 * @returns Description of the contribution level
 */
export function getContributionDescription(humanPercent: number): string {
  if (humanPercent === 100) {
    return "Fully human-written code";
  } else if (humanPercent >= 80) {
    return "Primarily human-written with AI assistance";
  } else if (humanPercent >= 50) {
    return "Collaborative human-AI development";
  } else if (humanPercent >= 20) {
    return "Primarily AI-generated with human oversight";
  } else if (humanPercent > 0) {
    return "AI-generated with minimal human input";
  } else {
    return "Fully AI-generated code";
  }
}

/**
 * Parse contribution from a string like "70/30" or "70-30"
 *
 * @param value - String representation of contribution (e.g., "70/30", "70-30")
 * @returns Parsed contribution ratio
 */
export function parseContribution(value: string): ContributionRatio {
  const match = value.match(/^(\d+)[/-](\d+)$/);
  if (!match || !match[1] || !match[2]) {
    throw new Error(`Invalid contribution format: ${value}. Use format like "70/30" or "70-30"`);
  }

  const humanPercent = parseInt(match[1], 10);
  const aiPercent = parseInt(match[2], 10);

  return createContributionRatio(humanPercent, aiPercent);
}

/**
 * Common contribution presets
 */
export const CONTRIBUTION_PRESETS = {
  /** Fully human-written */
  HUMAN_ONLY: createContributionRatio(100, 0, "Fully human-written"),
  /** Human-primary with AI assistance */
  HUMAN_PRIMARY: createContributionRatio(80, 20, "Human-primary development"),
  /** Equal collaboration */
  COLLABORATIVE: createContributionRatio(50, 50, "Collaborative development"),
  /** AI-primary with human oversight */
  AI_PRIMARY: createContributionRatio(20, 80, "AI-primary with human oversight"),
  /** Fully AI-generated */
  AI_ONLY: createContributionRatio(0, 100, "Fully AI-generated"),
} as const;
