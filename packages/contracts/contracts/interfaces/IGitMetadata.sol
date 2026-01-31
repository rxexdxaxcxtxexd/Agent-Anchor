// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IGitMetadata
 * @author Agent Anchor Team
 * @notice Interface for linking traces to git commits
 * @dev Enables verifiable connection between AI traces and code changes
 */
interface IGitMetadata {
    // ============ Events ============

    /**
     * @notice Emitted when git metadata is set for a trace
     * @param traceHash The trace this metadata is for
     * @param commitSha The git commit SHA
     * @param branch The branch name
     * @param repository The repository identifier
     */
    event GitMetadataSet(
        bytes32 indexed traceHash,
        bytes32 indexed commitSha,
        string branch,
        string repository
    );

    /**
     * @notice Emitted with extended git data for audit trail
     * @param traceHash The trace this metadata is for
     * @param commitSha The git commit SHA
     * @param branch The branch name
     * @param repository The repository identifier
     * @param gpgSignature Optional GPG signature
     * @param commitTimestamp The git commit timestamp
     */
    event GitMetadataExtended(
        bytes32 indexed traceHash,
        bytes32 indexed commitSha,
        string branch,
        string repository,
        bytes gpgSignature,
        uint256 commitTimestamp
    );

    // ============ Errors ============
    // Note: TraceNotFound and NotTraceCreator are defined in OwnershipTypes.sol

    /// @notice Thrown when commit SHA is zero
    error InvalidCommitSha();

    // ============ Functions ============

    /**
     * @notice Set git metadata for a trace
     * @param traceHash The trace hash to link
     * @param commitSha The git commit SHA (bytes32)
     * @param branch The branch name
     * @param repository The repository identifier
     * @return success True if setting succeeded
     */
    function setGitMetadata(
        bytes32 traceHash,
        bytes32 commitSha,
        string calldata branch,
        string calldata repository
    ) external returns (bool success);

    /**
     * @notice Get git metadata for a trace
     * @param traceHash The trace hash to query
     * @return commitSha The git commit SHA
     * @return hasMetadata Whether metadata exists
     */
    function getGitMetadata(
        bytes32 traceHash
    ) external view returns (bytes32 commitSha, bool hasMetadata);
}
