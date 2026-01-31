/**
 * SDK Git Metadata Tests
 *
 * Tests for git metadata extraction and formatting
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  commitShaToBytes32,
  bytes32ToCommitSha,
  extractGitMetadata,
  createGitMetadata,
  isValidGitSha,
} from "../src/git.js";

describe("Git Module", () => {
  describe("commitShaToBytes32", () => {
    it("should convert 40-char git SHA to bytes32", () => {
      const sha = "abc123def456789012345678901234567890abcd";
      const result = commitShaToBytes32(sha);

      // Should be 0x + 64 hex chars
      expect(result).toMatch(/^0x[a-fA-F0-9]{64}$/);
      // Should contain the original SHA (padded with zeros)
      expect(result.endsWith(sha)).toBe(true);
    });

    it("should handle SHA with 0x prefix", () => {
      const sha = "0xabc123def456789012345678901234567890abcd";
      const result = commitShaToBytes32(sha);

      expect(result).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    it("should hash non-standard strings", () => {
      const nonSha = "not-a-valid-sha";
      const result = commitShaToBytes32(nonSha);

      // Should still produce valid bytes32
      expect(result).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    it("should produce consistent results", () => {
      const sha = "abc123def456789012345678901234567890abcd";
      const result1 = commitShaToBytes32(sha);
      const result2 = commitShaToBytes32(sha);

      expect(result1).toBe(result2);
    });
  });

  describe("bytes32ToCommitSha", () => {
    it("should extract 40-char SHA from padded bytes32", () => {
      const sha = "abc123def456789012345678901234567890abcd";
      const bytes32 = "0x" + "0".repeat(24) + sha;

      const result = bytes32ToCommitSha(bytes32);
      expect(result).toBe(sha);
    });

    it("should return original if not a padded SHA", () => {
      // This is a keccak256 hash, not a padded SHA
      const hash = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
      const result = bytes32ToCommitSha(hash);

      expect(result).toBe(hash);
    });

    it("should handle without 0x prefix", () => {
      const sha = "abc123def456789012345678901234567890abcd";
      const bytes32 = "0".repeat(24) + sha;

      const result = bytes32ToCommitSha(bytes32);
      expect(result).toBe(sha);
    });
  });

  describe("T027: extractGitMetadata", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      // Reset env before each test
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("should extract from GITHUB_SHA environment variable", async () => {
      process.env.GITHUB_SHA = "abc123def456789012345678901234567890abcd";
      process.env.GITHUB_REF_NAME = "main";
      process.env.GITHUB_REPOSITORY = "org/repo";

      const result = await extractGitMetadata();

      expect(result.success).toBe(true);
      expect(result.commitSha).toMatch(/^0x[a-fA-F0-9]{64}$/);
      expect(result.branch).toBe("main");
      expect(result.repository).toBe("org/repo");
    });

    it("should extract from CI_COMMIT_SHA environment variable", async () => {
      process.env.CI_COMMIT_SHA = "def456789012345678901234567890abcdef12";
      process.env.CI_COMMIT_BRANCH = "develop";

      const result = await extractGitMetadata();

      expect(result.success).toBe(true);
      expect(result.commitSha).toMatch(/^0x[a-fA-F0-9]{64}$/);
      expect(result.branch).toBe("develop");
    });

    it("should return failure when no git info available", async () => {
      // Clear all git-related env vars
      delete process.env.GITHUB_SHA;
      delete process.env.CI_COMMIT_SHA;
      delete process.env.GIT_COMMIT;
      delete process.env.COMMIT_SHA;

      const result = await extractGitMetadata();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should prioritize GITHUB_SHA over other env vars", async () => {
      // Use valid hex SHAs (40 hex characters)
      const githubSha = "aaaa23def456789012345678901234567890aaaa";
      const gitlabSha = "bbbb23def456789012345678901234567890bbbb";
      process.env.GITHUB_SHA = githubSha;
      process.env.CI_COMMIT_SHA = gitlabSha;

      const result = await extractGitMetadata();

      expect(result.success).toBe(true);
      // The bytes32 should contain the github SHA (padded with leading zeros)
      expect(result.commitSha.toLowerCase().endsWith(githubSha.toLowerCase())).toBe(true);
      // Should NOT contain the gitlab SHA
      expect(result.commitSha.toLowerCase()).not.toContain(gitlabSha.toLowerCase());
    });
  });

  describe("T028: createGitMetadata", () => {
    it("should create GitMetadata object with all fields", () => {
      const result = createGitMetadata(
        "abc123def456789012345678901234567890abcd",
        "main",
        "github.com/org/repo"
      );

      expect(result.commitSha).toMatch(/^0x[a-fA-F0-9]{64}$/);
      expect(result.branch).toBe("main");
      expect(result.repository).toBe("github.com/org/repo");
    });

    it("should handle optional fields", () => {
      const result = createGitMetadata("abc123def456789012345678901234567890abcd");

      expect(result.commitSha).toMatch(/^0x[a-fA-F0-9]{64}$/);
      expect(result.branch).toBeUndefined();
      expect(result.repository).toBeUndefined();
    });

    it("should convert empty strings to undefined", () => {
      const result = createGitMetadata(
        "abc123def456789012345678901234567890abcd",
        "",
        ""
      );

      expect(result.branch).toBeUndefined();
      expect(result.repository).toBeUndefined();
    });
  });

  describe("isValidGitSha", () => {
    it("should validate full 40-char SHA", () => {
      expect(isValidGitSha("abc123def456789012345678901234567890abcd")).toBe(true);
    });

    it("should validate short SHA (7 chars)", () => {
      expect(isValidGitSha("abc123d")).toBe(true);
    });

    it("should validate short SHA (12 chars)", () => {
      expect(isValidGitSha("abc123def456")).toBe(true);
    });

    it("should reject too short strings", () => {
      expect(isValidGitSha("abc123")).toBe(false);
    });

    it("should reject non-hex characters", () => {
      expect(isValidGitSha("xyz123def456789012345678901234567890abcd")).toBe(false);
    });

    it("should handle 0x prefix", () => {
      expect(isValidGitSha("0xabc123def456789012345678901234567890abcd")).toBe(true);
    });

    it("should reject empty string", () => {
      expect(isValidGitSha("")).toBe(false);
    });
  });

  describe("Round-trip conversion", () => {
    it("should preserve SHA through bytes32 conversion", () => {
      const originalSha = "abc123def456789012345678901234567890abcd";
      const bytes32 = commitShaToBytes32(originalSha);
      const recovered = bytes32ToCommitSha(bytes32);

      expect(recovered).toBe(originalSha);
    });
  });
});
