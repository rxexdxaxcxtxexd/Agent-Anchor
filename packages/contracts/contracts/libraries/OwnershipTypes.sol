// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title OwnershipTypes
 * @author Agent Anchor Team
 * @notice Shared types and errors for the ownership layer
 * @dev Gas-optimized structs using packing
 */

// ============ Shared Errors ============

/// @notice Thrown when trace doesn't exist
error TraceNotFound(bytes32 traceHash);

/// @notice Thrown when caller is not the trace creator
error NotTraceCreator(bytes32 traceHash, address caller);

// ============ Enums ============

/**
 * @notice Declaration type for authorship claims
 */
enum DeclarationType {
    Individual,      // 0: Personal claim
    Organization,    // 1: Company/team claim
    WorkForHire      // 2: Employer owns the work
}

/**
 * @notice Packed ownership data - fits in 2 storage slots
 * @dev Optimized for gas efficiency
 */
struct PackedOwnership {
    // Slot 1 (32 bytes)
    address claimant;           // 20 bytes - who made the claim
    uint8 declarationType;      // 1 byte - DeclarationType enum
    uint8 humanPercent;         // 1 byte - 0-100
    uint8 aiPercent;            // 1 byte - 0-100 (must sum to 100 with humanPercent)
    uint40 claimTimestamp;      // 5 bytes - seconds since epoch (good until year 36812)
    uint32 _reserved;           // 4 bytes - future use

    // Slot 2 (32 bytes)
    bytes32 commitSha;          // 32 bytes - git commit hash
}

/**
 * @notice Identity binding data
 * @dev Stored separately to allow identity without full ownership
 */
struct IdentityBinding {
    address signer;             // 20 bytes - verified signer address
    uint40 bindingTimestamp;    // 5 bytes - when identity was bound
    uint8 signatureType;        // 1 byte - 0=EIP712, 1=EIP191, 2=future
    bool verified;              // 1 byte - has signature been verified
    // remaining 5 bytes unused (packed into single slot with above)
}

/**
 * @notice Extended git metadata (stored in events, not state)
 * @dev Only commitSha is stored on-chain for gas efficiency
 */
struct GitMetadata {
    bytes32 commitSha;          // 32 bytes - commit hash
    string branch;              // variable - branch name
    string repository;          // variable - repo URL/identifier
    bytes gpgSignature;         // variable - optional GPG signature
    uint256 commitTimestamp;    // 8 bytes - git commit time
}

/**
 * @notice Full ownership record (view struct, not storage)
 * @dev Returned by getter functions, combines multiple sources
 */
struct OwnershipRecord {
    // From anchor
    bytes32 traceHash;
    address creator;
    uint256 anchorTimestamp;

    // From identity binding
    address identitySigner;
    bool identityVerified;

    // From ownership claim
    address claimant;
    DeclarationType declarationType;
    uint8 humanPercent;
    uint8 aiPercent;

    // From git metadata
    bytes32 commitSha;

    // Status
    bool hasIdentity;
    bool hasOwnership;
    bool hasGitMetadata;
}
