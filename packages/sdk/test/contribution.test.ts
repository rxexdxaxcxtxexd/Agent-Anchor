/**
 * SDK Contribution Tests
 *
 * Tests for contribution ratio utilities
 */

import { describe, it, expect } from "vitest";
import {
  validateContribution,
  createContributionRatio,
  fromAiPercent,
  fromHumanPercent,
  formatContribution,
  getContributionDescription,
  parseContribution,
  CONTRIBUTION_PRESETS,
} from "../src/contribution.js";

describe("Contribution Module", () => {
  describe("T051: validateContribution", () => {
    it("should validate correct percentages", () => {
      expect(validateContribution(70, 30)).toEqual({ valid: true });
      expect(validateContribution(0, 100)).toEqual({ valid: true });
      expect(validateContribution(100, 0)).toEqual({ valid: true });
      expect(validateContribution(50, 50)).toEqual({ valid: true });
    });

    it("should reject percentages not summing to 100", () => {
      const result = validateContribution(30, 30);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("sum to 100");
    });

    it("should reject negative percentages", () => {
      const result = validateContribution(-10, 110);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("between 0 and 100");
    });

    it("should reject percentages over 100", () => {
      const result = validateContribution(101, -1);
      expect(result.valid).toBe(false);
    });

    it("should reject non-integer percentages", () => {
      const result = validateContribution(70.5, 29.5);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("integers");
    });
  });

  describe("T052: createContributionRatio", () => {
    it("should create ratio with required fields", () => {
      const ratio = createContributionRatio(70, 30);

      expect(ratio.humanPercent).toBe(70);
      expect(ratio.aiPercent).toBe(30);
    });

    it("should include optional notes", () => {
      const ratio = createContributionRatio(60, 40, "Based on commit analysis");

      expect(ratio.notes).toBe("Based on commit analysis");
    });

    it("should include calculation method", () => {
      const ratio = createContributionRatio(50, 50, "Equal collaboration", "manual");

      expect(ratio.calculationMethod).toBe("manual");
    });

    it("should throw for invalid percentages", () => {
      expect(() => createContributionRatio(60, 60)).toThrow("sum to 100");
    });
  });

  describe("fromAiPercent", () => {
    it("should calculate human percentage from AI", () => {
      const ratio = fromAiPercent(30);

      expect(ratio.humanPercent).toBe(70);
      expect(ratio.aiPercent).toBe(30);
    });

    it("should include optional parameters", () => {
      const ratio = fromAiPercent(25, "AI assisted", "estimate");

      expect(ratio.humanPercent).toBe(75);
      expect(ratio.aiPercent).toBe(25);
      expect(ratio.notes).toBe("AI assisted");
      expect(ratio.calculationMethod).toBe("estimate");
    });
  });

  describe("fromHumanPercent", () => {
    it("should calculate AI percentage from human", () => {
      const ratio = fromHumanPercent(80);

      expect(ratio.humanPercent).toBe(80);
      expect(ratio.aiPercent).toBe(20);
    });
  });

  describe("formatContribution", () => {
    it("should format ratio for display", () => {
      const ratio = createContributionRatio(70, 30);
      const formatted = formatContribution(ratio);

      expect(formatted).toContain("Human: 70%");
      expect(formatted).toContain("AI: 30%");
    });

    it("should include notes when present", () => {
      const ratio = createContributionRatio(60, 40, "Mostly coding assistance");
      const formatted = formatContribution(ratio);

      expect(formatted).toContain("Mostly coding assistance");
    });
  });

  describe("getContributionDescription", () => {
    it("should describe 100% human", () => {
      const desc = getContributionDescription(100);
      expect(desc.toLowerCase()).toContain("fully human");
    });

    it("should describe 80%+ human", () => {
      const desc = getContributionDescription(85);
      expect(desc.toLowerCase()).toContain("primarily human");
    });

    it("should describe 50-79% human", () => {
      const desc = getContributionDescription(60);
      expect(desc.toLowerCase()).toContain("collaborative");
    });

    it("should describe 20-49% human", () => {
      const desc = getContributionDescription(30);
      expect(desc.toLowerCase()).toContain("primarily ai");
    });

    it("should describe 1-19% human", () => {
      const desc = getContributionDescription(10);
      expect(desc.toLowerCase()).toContain("ai-generated");
      expect(desc.toLowerCase()).toContain("minimal");
    });

    it("should describe 0% human", () => {
      const desc = getContributionDescription(0);
      expect(desc.toLowerCase()).toContain("fully ai");
    });
  });

  describe("parseContribution", () => {
    it("should parse slash format", () => {
      const ratio = parseContribution("70/30");

      expect(ratio.humanPercent).toBe(70);
      expect(ratio.aiPercent).toBe(30);
    });

    it("should parse dash format", () => {
      const ratio = parseContribution("60-40");

      expect(ratio.humanPercent).toBe(60);
      expect(ratio.aiPercent).toBe(40);
    });

    it("should reject invalid format", () => {
      expect(() => parseContribution("70:30")).toThrow("Invalid contribution format");
      expect(() => parseContribution("70")).toThrow("Invalid contribution format");
    });

    it("should reject invalid percentages in valid format", () => {
      expect(() => parseContribution("70/50")).toThrow("sum to 100");
    });
  });

  describe("CONTRIBUTION_PRESETS", () => {
    it("should have HUMAN_ONLY preset", () => {
      expect(CONTRIBUTION_PRESETS.HUMAN_ONLY.humanPercent).toBe(100);
      expect(CONTRIBUTION_PRESETS.HUMAN_ONLY.aiPercent).toBe(0);
    });

    it("should have HUMAN_PRIMARY preset", () => {
      expect(CONTRIBUTION_PRESETS.HUMAN_PRIMARY.humanPercent).toBe(80);
      expect(CONTRIBUTION_PRESETS.HUMAN_PRIMARY.aiPercent).toBe(20);
    });

    it("should have COLLABORATIVE preset", () => {
      expect(CONTRIBUTION_PRESETS.COLLABORATIVE.humanPercent).toBe(50);
      expect(CONTRIBUTION_PRESETS.COLLABORATIVE.aiPercent).toBe(50);
    });

    it("should have AI_PRIMARY preset", () => {
      expect(CONTRIBUTION_PRESETS.AI_PRIMARY.humanPercent).toBe(20);
      expect(CONTRIBUTION_PRESETS.AI_PRIMARY.aiPercent).toBe(80);
    });

    it("should have AI_ONLY preset", () => {
      expect(CONTRIBUTION_PRESETS.AI_ONLY.humanPercent).toBe(0);
      expect(CONTRIBUTION_PRESETS.AI_ONLY.aiPercent).toBe(100);
    });

    it("should all have valid notes", () => {
      for (const preset of Object.values(CONTRIBUTION_PRESETS)) {
        expect(preset.notes).toBeDefined();
        expect(preset.notes!.length).toBeGreaterThan(0);
      }
    });
  });
});
