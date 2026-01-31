/**
 * Git metadata utilities for extracting and formatting git information
 */

import { keccak256, toUtf8Bytes } from "ethers";
import type { GitMetadata } from "./types.js";

/**
 * Result from extracting git metadata
 */
export interface ExtractedGitMetadata {
  /** Git commit SHA as bytes32 hex */
  commitSha: string;
  /** Branch name */
  branch: string;
  /** Repository identifier */
  repository: string;
  /** Whether git info was successfully extracted */
  success: boolean;
  /** Error message if extraction failed */
  error?: string;
}

/**
 * Options for git metadata extraction
 */
export interface ExtractGitOptions {
  /** Working directory to extract git info from */
  cwd?: string;
  /** Use simple-git if available */
  useSimpleGit?: boolean;
}

/**
 * Convert a git commit SHA (40 hex chars) to bytes32 format
 *
 * @param sha - The 40-character git commit SHA
 * @returns The SHA as a bytes32 hex string (0x + 64 chars)
 *
 * @example
 * ```typescript
 * const bytes32 = commitShaToBytes32("abc123def456789...");
 * ```
 */
export function commitShaToBytes32(sha: string): string {
  // Remove any 0x prefix if present
  const cleanSha = sha.replace(/^0x/, "");

  // Git SHAs are 40 hex characters
  if (cleanSha.length === 40 && /^[a-fA-F0-9]+$/.test(cleanSha)) {
    // Pad to 64 characters (32 bytes)
    return "0x" + cleanSha.padStart(64, "0");
  }

  // If not a valid SHA, hash it
  return keccak256(toUtf8Bytes(sha));
}

/**
 * Convert bytes32 back to git SHA format (if possible)
 *
 * @param bytes32 - The bytes32 hex string
 * @returns The git SHA (40 chars) or the original if not a padded SHA
 */
export function bytes32ToCommitSha(bytes32: string): string {
  const clean = bytes32.replace(/^0x/, "");

  // Check if it's a padded 40-char SHA (24 leading zeros + 40 chars)
  if (clean.startsWith("000000000000000000000000") && clean.length === 64) {
    return clean.slice(24);
  }

  // Return as-is if not a padded SHA
  return bytes32;
}

/**
 * Extract git metadata from the current working directory
 *
 * This function attempts to extract git information using available methods:
 * 1. simple-git package (if available and useSimpleGit=true)
 * 2. Environment variables (CI/CD systems often set these)
 * 3. Returns empty/default values if not in a git repo
 *
 * @param options - Extraction options
 * @returns Extracted git metadata
 *
 * @example
 * ```typescript
 * const gitInfo = await extractGitMetadata();
 * if (gitInfo.success) {
 *   console.log(`Commit: ${gitInfo.commitSha}`);
 *   console.log(`Branch: ${gitInfo.branch}`);
 * }
 * ```
 */
export async function extractGitMetadata(
  options: ExtractGitOptions = {}
): Promise<ExtractedGitMetadata> {
  // Try environment variables first (common in CI/CD)
  const envCommit =
    process.env.GITHUB_SHA ||
    process.env.CI_COMMIT_SHA ||
    process.env.GIT_COMMIT ||
    process.env.COMMIT_SHA;

  const envBranch =
    process.env.GITHUB_REF_NAME ||
    process.env.CI_COMMIT_BRANCH ||
    process.env.GIT_BRANCH ||
    process.env.BRANCH_NAME;

  const envRepo =
    process.env.GITHUB_REPOSITORY ||
    process.env.CI_PROJECT_URL ||
    process.env.GIT_URL;

  if (envCommit) {
    return {
      commitSha: commitShaToBytes32(envCommit),
      branch: envBranch || "",
      repository: envRepo || "",
      success: true,
    };
  }

  // Try simple-git if requested
  if (options.useSimpleGit) {
    try {
      // Dynamic import to avoid requiring simple-git as a hard dependency
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const simpleGitModule = await import("simple-git" as any).catch(() => null);
      if (!simpleGitModule) {
        return {
          commitSha: "",
          branch: "",
          repository: "",
          success: false,
          error: "simple-git module not installed. Run: npm install simple-git",
        };
      }

      const simpleGit = simpleGitModule.default || simpleGitModule.simpleGit;
      const git = simpleGit(options.cwd || process.cwd());

      const [log, branch, remotes] = await Promise.all([
        git.log({ maxCount: 1 }),
        git.branch(),
        git.getRemotes(true),
      ]);

      const commitSha = log.latest?.hash || "";
      const branchName = branch.current || "";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const remote = remotes.find((r: any) => r.name === "origin");
      const repository = remote?.refs?.fetch || remote?.refs?.push || "";

      if (commitSha) {
        return {
          commitSha: commitShaToBytes32(commitSha),
          branch: branchName,
          repository,
          success: true,
        };
      }
    } catch (error) {
      // simple-git not available or not in a git repo
      return {
        commitSha: "",
        branch: "",
        repository: "",
        success: false,
        error: `Failed to extract git info: ${error}`,
      };
    }
  }

  // No git info available
  return {
    commitSha: "",
    branch: "",
    repository: "",
    success: false,
    error: "No git information available. Set useSimpleGit=true or run in a CI environment.",
  };
}

/**
 * Create GitMetadata object from raw values
 *
 * @param commitSha - Git commit SHA (40 chars or bytes32)
 * @param branch - Branch name
 * @param repository - Repository identifier
 * @returns Formatted GitMetadata object
 */
export function createGitMetadata(
  commitSha: string,
  branch?: string,
  repository?: string
): GitMetadata {
  return {
    commitSha: commitShaToBytes32(commitSha),
    branch: branch || undefined,
    repository: repository || undefined,
  };
}

/**
 * Validate that a string is a valid git commit SHA
 *
 * @param sha - The string to validate
 * @returns true if valid git SHA format
 */
export function isValidGitSha(sha: string): boolean {
  const clean = sha.replace(/^0x/, "");
  // Full SHA is 40 chars, short SHA is typically 7-12 chars
  return /^[a-fA-F0-9]{7,40}$/.test(clean);
}
