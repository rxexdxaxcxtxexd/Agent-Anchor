/**
 * Authorship utilities for declaration types and claims
 */

import { DeclarationType, type AuthorshipClaim } from "./types.js";

/**
 * Get human-readable label for a declaration type
 *
 * @param type - The declaration type
 * @returns Human-readable label
 */
export function getDeclarationTypeLabel(type: DeclarationType): string {
  switch (type) {
    case DeclarationType.Individual:
      return "Individual";
    case DeclarationType.Organization:
      return "Organization";
    case DeclarationType.WorkForHire:
      return "Work for Hire";
    default:
      return "Unknown";
  }
}

/**
 * Get description for a declaration type
 *
 * @param type - The declaration type
 * @returns Description of what the type means
 */
export function getDeclarationTypeDescription(type: DeclarationType): string {
  switch (type) {
    case DeclarationType.Individual:
      return "Personal claim - you are the individual author of this code";
    case DeclarationType.Organization:
      return "Organization claim - a company or team owns this code";
    case DeclarationType.WorkForHire:
      return "Work for hire - your employer owns this code per employment agreement";
    default:
      return "Unknown declaration type";
  }
}

/**
 * Parse declaration type from string
 *
 * @param value - String value ("individual", "organization", "work-for-hire")
 * @returns Parsed declaration type
 */
export function parseDeclarationType(value: string): DeclarationType {
  const normalized = value.toLowerCase().replace(/[_\s-]/g, "");

  switch (normalized) {
    case "individual":
    case "personal":
      return DeclarationType.Individual;
    case "organization":
    case "org":
    case "company":
    case "team":
      return DeclarationType.Organization;
    case "workforhire":
    case "wfh":
    case "employer":
      return DeclarationType.WorkForHire;
    default:
      throw new Error(`Invalid declaration type: ${value}`);
  }
}

/**
 * Validate an authorship claim
 *
 * @param claim - The claim to validate
 * @returns Validation result
 */
export function validateAuthorshipClaim(claim: Partial<AuthorshipClaim>): {
  valid: boolean;
  error?: string;
} {
  if (!claim.claimant || claim.claimant === "0x0000000000000000000000000000000000000000") {
    return { valid: false, error: "Claimant address is required" };
  }

  if (claim.declarationType === undefined || claim.declarationType < 0 || claim.declarationType > 2) {
    return { valid: false, error: "Invalid declaration type (must be 0, 1, or 2)" };
  }

  return { valid: true };
}

/**
 * Create an authorship claim object
 *
 * @param claimant - The address making the claim
 * @param declarationType - The type of declaration
 * @param claimTimestamp - Optional timestamp (defaults to now)
 * @param organizationId - Optional organization identifier
 * @returns AuthorshipClaim object
 */
export function createAuthorshipClaim(
  claimant: string,
  declarationType: DeclarationType,
  claimTimestamp?: number,
  organizationId?: string
): AuthorshipClaim {
  return {
    claimant,
    declarationType,
    claimTimestamp: claimTimestamp || Math.floor(Date.now() / 1000),
    organizationId,
  };
}

/**
 * Format authorship claim for display
 *
 * @param claim - The claim to format
 * @returns Formatted string
 */
export function formatAuthorshipClaim(claim: AuthorshipClaim): string {
  const typeLabel = getDeclarationTypeLabel(claim.declarationType);
  const date = new Date(claim.claimTimestamp * 1000).toISOString();

  let result = `${typeLabel} claim by ${claim.claimant} at ${date}`;

  if (claim.organizationId) {
    result += ` (Org: ${claim.organizationId})`;
  }

  return result;
}

/**
 * Check if an address can claim authorship based on typical rules
 *
 * @param creatorAddress - The trace creator's address
 * @param claimantAddress - The address attempting to claim
 * @returns Whether the claim would be allowed
 */
export function canClaimAuthorship(creatorAddress: string, claimantAddress: string): boolean {
  // Only trace creator can claim authorship (in the current implementation)
  return creatorAddress.toLowerCase() === claimantAddress.toLowerCase();
}
