// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AgentAnchor
 * @author Agent Anchor Team
 * @notice On-chain trace anchoring for AI agent verification
 * @dev Stores trace hashes and IPFS URIs for verifiable AI agent actions
 */
contract AgentAnchor is Ownable {
    // ============ Enums ============

    /**
     * @notice Granularity level for trace anchoring
     * @dev Session = entire session, Task = single task, Step = individual step
     */
    enum Granularity {
        Session,
        Task,
        Step
    }

    // ============ Structs ============

    /**
     * @notice On-chain anchor data structure
     * @param traceHash Keccak256 hash of the trace content
     * @param ipfsUri IPFS URI where full trace is stored
     * @param agentId Identifier of the agent that created the trace
     * @param granularity Level of granularity for this anchor
     * @param creator Address that anchored this trace
     * @param timestamp Block timestamp when anchored
     * @param blockNumber Block number when anchored
     */
    struct Anchor {
        bytes32 traceHash;
        string ipfsUri;
        bytes32 agentId;
        Granularity granularity;
        address creator;
        uint256 timestamp;
        uint256 blockNumber;
    }

    // ============ State Variables ============

    /// @notice Mapping from trace hash to anchor data
    mapping(bytes32 => Anchor) public anchors;

    /// @notice Mapping from agent ID to array of trace hashes
    mapping(bytes32 => bytes32[]) public agentAnchors;

    /// @notice Mapping from creator address to array of trace hashes
    mapping(address => bytes32[]) public creatorAnchors;

    /// @notice Total number of anchors created
    uint256 public totalAnchors;

    /// @notice Maximum length for IPFS URI (256 bytes)
    uint256 public constant MAX_IPFS_URI_LENGTH = 256;

    /// @notice Whether anchoring is permissionless (default: true)
    bool public permissionless = true;

    /// @notice Allowlist for restricted mode
    mapping(address => bool) public allowlist;

    // ============ Events ============

    /**
     * @notice Emitted when a trace is anchored
     * @param traceHash The hash of the anchored trace
     * @param agentId The agent identifier
     * @param creator The address that created the anchor
     * @param ipfsUri The IPFS URI of the full trace
     * @param granularity The granularity level
     * @param timestamp The block timestamp
     */
    event TraceAnchored(
        bytes32 indexed traceHash,
        bytes32 indexed agentId,
        address indexed creator,
        string ipfsUri,
        Granularity granularity,
        uint256 timestamp
    );

    /// @notice Emitted when permissionless mode is changed
    event PermissionlessChanged(bool newValue);

    /// @notice Emitted when an address is added/removed from allowlist
    event AllowlistUpdated(address indexed account, bool allowed);

    // ============ Errors ============

    /// @notice Thrown when trace hash is zero
    error InvalidTraceHash();

    /// @notice Thrown when IPFS URI is empty
    error InvalidIpfsUri();

    /// @notice Thrown when agent ID is zero
    error InvalidAgentId();

    /// @notice Thrown when anchor already exists
    error AnchorAlreadyExists(bytes32 traceHash);

    /// @notice Thrown when anchor does not exist
    error AnchorNotFound(bytes32 traceHash);

    /// @notice Thrown when IPFS URI exceeds maximum length
    error IpfsUriTooLong(uint256 length, uint256 maxLength);

    /// @notice Thrown when caller is not allowed in restricted mode
    error NotAllowed(address caller);

    // ============ Constructor ============

    constructor() Ownable(msg.sender) {}

    // ============ External Functions ============

    /**
     * @notice Anchor a trace to the blockchain
     * @dev SECURITY CONSIDERATIONS (SEC-003):
     *
     * This function is permissionless by default, meaning anyone can anchor traces.
     * This design choice enables:
     * - Decentralized trace submission without gatekeepers
     * - Lower barrier to entry for agent developers
     * - Censorship-resistant trace recording
     *
     * IMPORTANT: Permissionless anchoring means:
     * - Anyone can anchor traces claiming any agentId (no on-chain verification of agent identity)
     * - The creator address only proves WHO submitted the trace, not that they control the agent
     * - Off-chain verification is required to validate trace authenticity
     * - Consider using V2 identity binding (EIP-712 signatures) for stronger attribution
     *
     * For restricted deployments, the owner can:
     * - Call setPermissionless(false) to enable allowlist mode
     * - Use setAllowlist() to control who can anchor traces
     *
     * Gas optimization: ~85,000 gas for first anchor per agent/creator, ~65,000 for subsequent
     *
     * @param traceHash Keccak256 hash of the trace content
     * @param ipfsUri IPFS URI where full trace is stored (max 256 bytes, SEC-001)
     * @param agentId Identifier of the agent
     * @param granularity Granularity level of the trace
     * @return success True if anchoring succeeded
     */
    function anchorTrace(
        bytes32 traceHash,
        string calldata ipfsUri,
        bytes32 agentId,
        Granularity granularity
    ) external returns (bool success) {
        // Access control check (SEC-003)
        if (!permissionless && !allowlist[msg.sender]) {
            revert NotAllowed(msg.sender);
        }

        // Input validation
        if (traceHash == bytes32(0)) revert InvalidTraceHash();
        if (bytes(ipfsUri).length == 0) revert InvalidIpfsUri();
        if (bytes(ipfsUri).length > MAX_IPFS_URI_LENGTH) {
            revert IpfsUriTooLong(bytes(ipfsUri).length, MAX_IPFS_URI_LENGTH);
        }
        if (agentId == bytes32(0)) revert InvalidAgentId();

        // Check for duplicate
        if (anchors[traceHash].timestamp != 0) {
            revert AnchorAlreadyExists(traceHash);
        }

        // Store anchor
        anchors[traceHash] = Anchor({
            traceHash: traceHash,
            ipfsUri: ipfsUri,
            agentId: agentId,
            granularity: granularity,
            creator: msg.sender,
            timestamp: block.timestamp,
            blockNumber: block.number
        });

        // Update indexes
        agentAnchors[agentId].push(traceHash);
        creatorAnchors[msg.sender].push(traceHash);
        totalAnchors++;

        // Emit event
        emit TraceAnchored(
            traceHash,
            agentId,
            msg.sender,
            ipfsUri,
            granularity,
            block.timestamp
        );

        return true;
    }

    /**
     * @notice Verify if a trace anchor exists
     * @param traceHash The trace hash to verify
     * @return exists Whether the anchor exists
     * @return ipfsUri The IPFS URI (empty if not found)
     * @return creator The creator address (zero if not found)
     * @return timestamp The anchor timestamp (0 if not found)
     */
    function verifyTrace(bytes32 traceHash)
        external
        view
        returns (
            bool exists,
            string memory ipfsUri,
            address creator,
            uint256 timestamp
        )
    {
        Anchor storage anchor = anchors[traceHash];

        if (anchor.timestamp == 0) {
            return (false, "", address(0), 0);
        }

        return (true, anchor.ipfsUri, anchor.creator, anchor.timestamp);
    }

    /**
     * @notice Check if an anchor exists
     * @param traceHash The trace hash to check
     * @return exists True if anchor exists
     */
    function anchorExists(bytes32 traceHash) external view returns (bool exists) {
        return anchors[traceHash].timestamp != 0;
    }

    /**
     * @notice Get full anchor data
     * @param traceHash The trace hash to query
     * @return anchor The full anchor struct
     */
    function getAnchor(bytes32 traceHash) external view returns (Anchor memory anchor) {
        if (anchors[traceHash].timestamp == 0) {
            revert AnchorNotFound(traceHash);
        }
        return anchors[traceHash];
    }

    /**
     * @notice Get all trace hashes for an agent
     * @param agentId The agent identifier
     * @return hashes Array of trace hashes
     * @dev DEPRECATED: Use getTracesByAgentPaginated for large datasets
     */
    function getTracesByAgent(bytes32 agentId) external view returns (bytes32[] memory hashes) {
        return agentAnchors[agentId];
    }

    /**
     * @notice Get all trace hashes for a creator
     * @param creator The creator address
     * @return hashes Array of trace hashes
     * @dev DEPRECATED: Use getTracesByCreatorPaginated for large datasets
     */
    function getTracesByCreator(address creator) external view returns (bytes32[] memory hashes) {
        return creatorAnchors[creator];
    }

    /**
     * @notice Get paginated trace hashes for an agent
     * @param agentId The agent identifier
     * @param offset Starting index in the array
     * @param limit Maximum number of items to return
     * @return traces Array of trace hashes for the requested page
     * @return total Total number of traces for this agent
     */
    function getTracesByAgentPaginated(
        bytes32 agentId,
        uint256 offset,
        uint256 limit
    ) external view returns (bytes32[] memory traces, uint256 total) {
        bytes32[] storage allTraces = agentAnchors[agentId];
        total = allTraces.length;

        if (offset >= total) {
            return (new bytes32[](0), total);
        }

        uint256 end = offset + limit;
        if (end > total) end = total;
        uint256 resultLength = end - offset;

        traces = new bytes32[](resultLength);
        for (uint256 i = 0; i < resultLength; i++) {
            traces[i] = allTraces[offset + i];
        }
    }

    /**
     * @notice Get paginated trace hashes for a creator
     * @param creator The creator address
     * @param offset Starting index in the array
     * @param limit Maximum number of items to return
     * @return traces Array of trace hashes for the requested page
     * @return total Total number of traces for this creator
     */
    function getTracesByCreatorPaginated(
        address creator,
        uint256 offset,
        uint256 limit
    ) external view returns (bytes32[] memory traces, uint256 total) {
        bytes32[] storage allTraces = creatorAnchors[creator];
        total = allTraces.length;

        if (offset >= total) {
            return (new bytes32[](0), total);
        }

        uint256 end = offset + limit;
        if (end > total) end = total;
        uint256 resultLength = end - offset;

        traces = new bytes32[](resultLength);
        for (uint256 i = 0; i < resultLength; i++) {
            traces[i] = allTraces[offset + i];
        }
    }

    /**
     * @notice Get count of traces for an agent
     * @param agentId The agent identifier
     * @return count Number of traces
     */
    function getAgentTraceCount(bytes32 agentId) external view returns (uint256 count) {
        return agentAnchors[agentId].length;
    }

    /**
     * @notice Get count of traces for a creator
     * @param creator The creator address
     * @return count Number of traces
     */
    function getCreatorTraceCount(address creator) external view returns (uint256 count) {
        return creatorAnchors[creator].length;
    }

    // ============ Admin Functions ============

    /**
     * @notice Set permissionless mode
     * @param _permissionless Whether anchoring is open to all (true) or restricted (false)
     */
    function setPermissionless(bool _permissionless) external onlyOwner {
        permissionless = _permissionless;
        emit PermissionlessChanged(_permissionless);
    }

    /**
     * @notice Add or remove an address from the allowlist
     * @param account The address to update
     * @param allowed Whether the address is allowed
     */
    function setAllowlist(address account, bool allowed) external onlyOwner {
        allowlist[account] = allowed;
        emit AllowlistUpdated(account, allowed);
    }

    /**
     * @notice Batch update allowlist
     * @param accounts Array of addresses to update
     * @param allowed Whether the addresses are allowed
     */
    function setAllowlistBatch(address[] calldata accounts, bool allowed) external onlyOwner {
        for (uint256 i = 0; i < accounts.length; i++) {
            allowlist[accounts[i]] = allowed;
            emit AllowlistUpdated(accounts[i], allowed);
        }
    }
}
