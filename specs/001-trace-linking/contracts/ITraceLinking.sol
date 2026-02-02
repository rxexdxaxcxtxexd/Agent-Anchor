// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ITraceLinking
 * @notice Interface for trace parent-child linking functionality
 * @dev Implement this interface to add trace linking to AgentAnchor contracts
 */
interface ITraceLinking {
    // ============ Errors ============

    /// @notice Thrown when parent trace does not exist
    error ParentTraceNotFound(bytes32 parentTraceHash);

    /// @notice Thrown when trace references itself as parent
    error SelfReferenceNotAllowed(bytes32 traceHash);

    // ============ Events ============

    /**
     * @notice Emitted when a trace is linked to a parent
     * @param childTraceHash The child trace hash
     * @param parentTraceHash The parent trace hash
     * @param timestamp When the link was created
     */
    event TraceLinked(
        bytes32 indexed childTraceHash,
        bytes32 indexed parentTraceHash,
        uint256 timestamp
    );

    // ============ View Functions ============

    /**
     * @notice Get the parent trace hash for a given trace
     * @param traceHash The trace to query
     * @return parentHash The parent trace hash (0x0 if root)
     * @return hasParent True if trace has a parent
     */
    function getParentTrace(bytes32 traceHash)
        external
        view
        returns (bytes32 parentHash, bool hasParent);

    /**
     * @notice Get all child traces for a given parent
     * @param parentTraceHash The parent trace to query
     * @return childHashes Array of child trace hashes
     * @dev DEPRECATED: Use getChildTracesPaginated for large datasets
     */
    function getChildTraces(bytes32 parentTraceHash)
        external
        view
        returns (bytes32[] memory childHashes);

    /**
     * @notice Get paginated child traces for a given parent
     * @param parentTraceHash The parent trace to query
     * @param offset Starting index
     * @param limit Maximum results to return
     * @return childHashes Array of child trace hashes
     * @return total Total number of children
     */
    function getChildTracesPaginated(
        bytes32 parentTraceHash,
        uint256 offset,
        uint256 limit
    ) external view returns (bytes32[] memory childHashes, uint256 total);

    /**
     * @notice Get the count of child traces
     * @param parentTraceHash The parent trace to query
     * @return count Number of children
     */
    function getChildTraceCount(bytes32 parentTraceHash)
        external
        view
        returns (uint256 count);

    /**
     * @notice Check if a trace is a root trace (no parent)
     * @param traceHash The trace to check
     * @return isRoot True if trace has no parent
     */
    function isRootTrace(bytes32 traceHash)
        external
        view
        returns (bool isRoot);
}
