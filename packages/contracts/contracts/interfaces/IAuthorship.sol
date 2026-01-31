// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../libraries/OwnershipTypes.sol";

/**
 * @title IAuthorship
 * @author Agent Anchor Team
 * @notice Interface for declaring authorship of AI-assisted code
 * @dev Enables legal provenance claims for code ownership
 */
interface IAuthorship {
    // ============ Events ============

    /**
     * @notice Emitted when authorship is claimed for a trace
     * @param traceHash The trace this claim is for
     * @param claimant The address making the claim
     * @param declarationType The type of declaration
     * @param timestamp When the claim was made
     */
    event AuthorshipClaimed(
        bytes32 indexed traceHash,
        address indexed claimant,
        DeclarationType declarationType,
        uint256 timestamp
    );

    // ============ Errors ============
    // Note: TraceNotFound is defined in OwnershipTypes.sol

    /// @notice Thrown when authorship is already claimed for this trace
    error AuthorshipAlreadyClaimed(bytes32 traceHash);

    /// @notice Thrown when caller is not authorized to claim
    error UnauthorizedClaimant(bytes32 traceHash, address caller);

    /// @notice Thrown when declaration type is invalid
    error InvalidDeclarationType(uint8 declarationType);

    // ============ Functions ============

    /**
     * @notice Declare authorship of a trace
     * @param traceHash The trace hash to claim
     * @param declarationType The type of declaration (Individual, Organization, WorkForHire)
     * @return success True if claim succeeded
     */
    function declareAuthorship(
        bytes32 traceHash,
        DeclarationType declarationType
    ) external returns (bool success);

    /**
     * @notice Get authorship claim for a trace
     * @param traceHash The trace hash to query
     * @return claimant The claiming address
     * @return declarationType The type of declaration
     * @return claimTimestamp When the claim was made
     * @return hasClaim Whether a claim exists
     */
    function getAuthorship(
        bytes32 traceHash
    ) external view returns (
        address claimant,
        DeclarationType declarationType,
        uint256 claimTimestamp,
        bool hasClaim
    );
}
