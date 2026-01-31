/**
 * SDK Authorship Tests
 *
 * Tests for authorship utilities
 */

import { describe, it, expect } from "vitest";
import {
  getDeclarationTypeLabel,
  getDeclarationTypeDescription,
  parseDeclarationType,
  validateAuthorshipClaim,
  createAuthorshipClaim,
  formatAuthorshipClaim,
  canClaimAuthorship,
} from "../src/authorship.js";
import { DeclarationType } from "../src/types.js";

describe("Authorship Module", () => {
  describe("getDeclarationTypeLabel", () => {
    it("should return Individual for type 0", () => {
      expect(getDeclarationTypeLabel(DeclarationType.Individual)).toBe("Individual");
    });

    it("should return Organization for type 1", () => {
      expect(getDeclarationTypeLabel(DeclarationType.Organization)).toBe("Organization");
    });

    it("should return Work for Hire for type 2", () => {
      expect(getDeclarationTypeLabel(DeclarationType.WorkForHire)).toBe("Work for Hire");
    });

    it("should return Unknown for invalid type", () => {
      expect(getDeclarationTypeLabel(99 as DeclarationType)).toBe("Unknown");
    });
  });

  describe("getDeclarationTypeDescription", () => {
    it("should describe Individual type", () => {
      const desc = getDeclarationTypeDescription(DeclarationType.Individual);
      expect(desc).toContain("Personal");
      expect(desc).toContain("individual author");
    });

    it("should describe Organization type", () => {
      const desc = getDeclarationTypeDescription(DeclarationType.Organization);
      expect(desc).toContain("Organization");
      expect(desc).toContain("company or team");
    });

    it("should describe WorkForHire type", () => {
      const desc = getDeclarationTypeDescription(DeclarationType.WorkForHire);
      expect(desc).toContain("employer");
    });
  });

  describe("parseDeclarationType", () => {
    it("should parse individual", () => {
      expect(parseDeclarationType("individual")).toBe(DeclarationType.Individual);
      expect(parseDeclarationType("Individual")).toBe(DeclarationType.Individual);
      expect(parseDeclarationType("INDIVIDUAL")).toBe(DeclarationType.Individual);
      expect(parseDeclarationType("personal")).toBe(DeclarationType.Individual);
    });

    it("should parse organization", () => {
      expect(parseDeclarationType("organization")).toBe(DeclarationType.Organization);
      expect(parseDeclarationType("org")).toBe(DeclarationType.Organization);
      expect(parseDeclarationType("company")).toBe(DeclarationType.Organization);
      expect(parseDeclarationType("team")).toBe(DeclarationType.Organization);
    });

    it("should parse work-for-hire", () => {
      expect(parseDeclarationType("work-for-hire")).toBe(DeclarationType.WorkForHire);
      expect(parseDeclarationType("workforhire")).toBe(DeclarationType.WorkForHire);
      expect(parseDeclarationType("wfh")).toBe(DeclarationType.WorkForHire);
      expect(parseDeclarationType("employer")).toBe(DeclarationType.WorkForHire);
    });

    it("should throw for invalid type", () => {
      expect(() => parseDeclarationType("invalid")).toThrow("Invalid declaration type");
    });
  });

  describe("T039: validateAuthorshipClaim", () => {
    it("should validate correct claim", () => {
      const result = validateAuthorshipClaim({
        claimant: "0x1234567890123456789012345678901234567890",
        declarationType: DeclarationType.Individual,
      });

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should reject missing claimant", () => {
      const result = validateAuthorshipClaim({
        declarationType: DeclarationType.Individual,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Claimant");
    });

    it("should reject zero address claimant", () => {
      const result = validateAuthorshipClaim({
        claimant: "0x0000000000000000000000000000000000000000",
        declarationType: DeclarationType.Individual,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Claimant");
    });

    it("should reject invalid declaration type", () => {
      const result = validateAuthorshipClaim({
        claimant: "0x1234567890123456789012345678901234567890",
        declarationType: 5 as DeclarationType,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("declaration type");
    });

    it("should accept all valid declaration types", () => {
      for (const type of [0, 1, 2]) {
        const result = validateAuthorshipClaim({
          claimant: "0x1234567890123456789012345678901234567890",
          declarationType: type as DeclarationType,
        });
        expect(result.valid).toBe(true);
      }
    });
  });

  describe("T040: createAuthorshipClaim", () => {
    it("should create claim with required fields", () => {
      const claim = createAuthorshipClaim(
        "0x1234567890123456789012345678901234567890",
        DeclarationType.Individual
      );

      expect(claim.claimant).toBe("0x1234567890123456789012345678901234567890");
      expect(claim.declarationType).toBe(DeclarationType.Individual);
      expect(claim.claimTimestamp).toBeGreaterThan(0);
    });

    it("should use provided timestamp", () => {
      const timestamp = 1706000000;
      const claim = createAuthorshipClaim(
        "0x1234567890123456789012345678901234567890",
        DeclarationType.Organization,
        timestamp
      );

      expect(claim.claimTimestamp).toBe(timestamp);
    });

    it("should include organization ID when provided", () => {
      const claim = createAuthorshipClaim(
        "0x1234567890123456789012345678901234567890",
        DeclarationType.Organization,
        undefined,
        "Anthropic Inc."
      );

      expect(claim.organizationId).toBe("Anthropic Inc.");
    });
  });

  describe("formatAuthorshipClaim", () => {
    it("should format claim for display", () => {
      const claim = createAuthorshipClaim(
        "0x1234567890123456789012345678901234567890",
        DeclarationType.Individual,
        1706000000
      );

      const formatted = formatAuthorshipClaim(claim);

      expect(formatted).toContain("Individual");
      expect(formatted).toContain("0x1234567890123456789012345678901234567890");
      expect(formatted).toContain("2024"); // Year from timestamp
    });

    it("should include organization ID in format", () => {
      const claim = createAuthorshipClaim(
        "0x1234567890123456789012345678901234567890",
        DeclarationType.Organization,
        1706000000,
        "Acme Corp"
      );

      const formatted = formatAuthorshipClaim(claim);

      expect(formatted).toContain("Organization");
      expect(formatted).toContain("Acme Corp");
    });
  });

  describe("canClaimAuthorship", () => {
    it("should allow creator to claim", () => {
      const creator = "0x1234567890123456789012345678901234567890";
      expect(canClaimAuthorship(creator, creator)).toBe(true);
    });

    it("should be case-insensitive", () => {
      const creator = "0xAbCd567890123456789012345678901234567890";
      const claimant = "0xabcd567890123456789012345678901234567890";
      expect(canClaimAuthorship(creator, claimant)).toBe(true);
    });

    it("should reject different addresses", () => {
      const creator = "0x1234567890123456789012345678901234567890";
      const other = "0xABCD567890123456789012345678901234567890";
      expect(canClaimAuthorship(creator, other)).toBe(false);
    });
  });
});
