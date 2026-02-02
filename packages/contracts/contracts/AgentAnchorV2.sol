// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "./libraries/OwnershipTypes.sol";
import "./interfaces/IIdentityBinding.sol";
import "./interfaces/IGitMetadata.sol";
import "./interfaces/IAuthorship.sol";
import "./interfaces/IContribution.sol";

/**
 * @title AgentAnchorV2
 * @author Agent Anchor Team
 * @notice Extended trace anchoring with ownership layer features
 * @dev Adds identity binding, git linking, authorship, and contribution tracking
 */
contract AgentAnchorV2 is Ownable, IIdentityBinding, IGitMetadata, IAuthorship, IContribution {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ============ Enums ============

    /**
     * @notice Granularity level for trace anchoring
     */
    enum Granularity {
        Session,
        Task,
        Step
    }

    // ============ Structs ============

    /**
     * @notice On-chain anchor data structure (same as V1)
     */
    struct Anchor {
        bytes32 traceHash;
        string ipfsUri;
        bytes32 agentId;
        Granularity granularity;
        address creator;
        uint256 timestamp;
        uint256 blockNumber;
        bytes32 parentTraceHash;  // Parent trace hash (0x0 = root)
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

    /// @notice Maximum length for IPFS URI
    uint256 public constant MAX_IPFS_URI_LENGTH = 256;

    /// @notice Whether anchoring is permissionless
    bool public permissionless = true;

    /// @notice Allowlist for restricted mode
    mapping(address => bool) public allowlist;

    // V2 State Variables
    /// @notice Identity bindings for traces
    mapping(bytes32 => IdentityBinding) public identityBindings;

    /// @notice Packed ownership records
    mapping(bytes32 => PackedOwnership) public ownershipRecords;

    /// @notice Whether identity binding is required for new anchors
    bool public identityRequired;

    /// @notice Mapping from parent trace hash to array of child trace hashes
    mapping(bytes32 => bytes32[]) public childTraces;

    /// @notice EIP-712 domain separator (immutable after deployment)
    bytes32 public immutable DOMAIN_SEPARATOR;

    /// @notice EIP-712 type hash for TraceIdentity
    bytes32 public constant TRACE_IDENTITY_TYPEHASH = keccak256(
        "TraceIdentity(bytes32 traceHash,address initiator,uint256 timestamp,string purpose)"
    );

    // ============ Events (from V1) ============

    event TraceAnchored(
        bytes32 indexed traceHash,
        bytes32 indexed agentId,
        address indexed creator,
        string ipfsUri,
        Granularity granularity,
        uint256 timestamp
    );

    event PermissionlessChanged(bool newValue);
    event AllowlistUpdated(address indexed account, bool allowed);
    event IdentityRequiredChanged(bool newValue);

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

    // ============ Errors (from V1) ============

    error InvalidTraceHash();
    error InvalidIpfsUri();
    error InvalidAgentId();
    error AnchorAlreadyExists(bytes32 traceHash);
    error AnchorNotFound(bytes32 traceHash);
    error IpfsUriTooLong(uint256 length, uint256 maxLength);
    error NotAllowed(address caller);
    error IdentityRequired();
    error ParentTraceNotFound(bytes32 parentTraceHash);
    error SelfReferenceNotAllowed(bytes32 traceHash);

    // ============ Constructor ============

    constructor() Ownable(msg.sender) {
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("AgentAnchor")),
                keccak256(bytes("2")),
                block.chainid,
                address(this)
            )
        );
    }

    // ============ Modifiers ============

    modifier onlyTraceCreator(bytes32 traceHash) {
        if (anchors[traceHash].timestamp == 0) {
            revert TraceNotFound(traceHash);
        }
        if (anchors[traceHash].creator != msg.sender) {
            revert NotTraceCreator(traceHash, msg.sender);
        }
        _;
    }

    modifier traceExists(bytes32 traceHash) {
        if (anchors[traceHash].timestamp == 0) {
            revert TraceNotFound(traceHash);
        }
        _;
    }

    // ============ V1 Compatible Functions ============

    /**
     * @notice Anchor a trace to the blockchain
     * @param traceHash Keccak256 hash of the trace content
     * @param ipfsUri IPFS URI where full trace is stored
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
        if (!permissionless && !allowlist[msg.sender]) {
            revert NotAllowed(msg.sender);
        }

        if (traceHash == bytes32(0)) revert InvalidTraceHash();
        if (bytes(ipfsUri).length == 0) revert InvalidIpfsUri();
        if (bytes(ipfsUri).length > MAX_IPFS_URI_LENGTH) {
            revert IpfsUriTooLong(bytes(ipfsUri).length, MAX_IPFS_URI_LENGTH);
        }
        if (agentId == bytes32(0)) revert InvalidAgentId();

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
            blockNumber: block.number,
            parentTraceHash: bytes32(0)
        });

        agentAnchors[agentId].push(traceHash);
        creatorAnchors[msg.sender].push(traceHash);
        totalAnchors++;

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
     * @notice Anchor a trace with optional parent linking
     * @param traceHash Keccak256 hash of the trace content
     * @param ipfsUri IPFS URI where full trace is stored
     * @param agentId Identifier of the agent
     * @param granularity Granularity level of the trace
     * @param parentTraceHash Parent trace hash (0x0 for root trace)
     * @return success True if anchoring succeeded
     */
    function anchorTrace(
        bytes32 traceHash,
        string calldata ipfsUri,
        bytes32 agentId,
        Granularity granularity,
        bytes32 parentTraceHash
    ) external returns (bool success) {
        if (!permissionless && !allowlist[msg.sender]) {
            revert NotAllowed(msg.sender);
        }

        if (traceHash == bytes32(0)) revert InvalidTraceHash();
        if (bytes(ipfsUri).length == 0) revert InvalidIpfsUri();
        if (bytes(ipfsUri).length > MAX_IPFS_URI_LENGTH) {
            revert IpfsUriTooLong(bytes(ipfsUri).length, MAX_IPFS_URI_LENGTH);
        }
        if (agentId == bytes32(0)) revert InvalidAgentId();

        if (anchors[traceHash].timestamp != 0) {
            revert AnchorAlreadyExists(traceHash);
        }

        // Parent validation
        if (parentTraceHash != bytes32(0)) {
            if (parentTraceHash == traceHash) {
                revert SelfReferenceNotAllowed(traceHash);
            }
            if (anchors[parentTraceHash].timestamp == 0) {
                revert ParentTraceNotFound(parentTraceHash);
            }
        }

        // Store anchor with parent reference
        anchors[traceHash] = Anchor({
            traceHash: traceHash,
            ipfsUri: ipfsUri,
            agentId: agentId,
            granularity: granularity,
            creator: msg.sender,
            timestamp: block.timestamp,
            blockNumber: block.number,
            parentTraceHash: parentTraceHash
        });

        agentAnchors[agentId].push(traceHash);
        creatorAnchors[msg.sender].push(traceHash);
        totalAnchors++;

        // Update child index if parent specified
        if (parentTraceHash != bytes32(0)) {
            childTraces[parentTraceHash].push(traceHash);
            emit TraceLinked(traceHash, parentTraceHash, block.timestamp);
        }

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
     */
    function anchorExists(bytes32 traceHash) external view returns (bool exists) {
        return anchors[traceHash].timestamp != 0;
    }

    /**
     * @notice Get full anchor data
     */
    function getAnchor(bytes32 traceHash) external view returns (Anchor memory anchor) {
        if (anchors[traceHash].timestamp == 0) {
            revert AnchorNotFound(traceHash);
        }
        return anchors[traceHash];
    }

    // ============ IIdentityBinding Implementation ============

    /**
     * @notice Bind identity to a trace using EIP-712 signature
     * @dev The signature must be created with the exact parameters provided
     */
    function bindIdentity(
        bytes32 traceHash,
        bytes calldata signature
    ) external override traceExists(traceHash) returns (bool success) {
        if (identityBindings[traceHash].verified) {
            revert IdentityAlreadyBound(traceHash);
        }

        // Recover signer from signature
        // The signature contains: traceHash, initiator (msg.sender), timestamp, purpose
        // We use the anchor's timestamp as the reference point
        Anchor storage anchor = anchors[traceHash];

        // Build the struct hash using anchor timestamp
        bytes32 structHash = keccak256(
            abi.encode(
                TRACE_IDENTITY_TYPEHASH,
                traceHash,
                msg.sender,
                anchor.timestamp,
                keccak256(bytes("code-authorship"))
            )
        );

        // Build the digest
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash)
        );

        // Recover signer
        address recoveredSigner = ECDSA.recover(digest, signature);

        if (recoveredSigner == address(0) || recoveredSigner != msg.sender) {
            revert InvalidSignature();
        }

        // Store binding
        identityBindings[traceHash] = IdentityBinding({
            signer: recoveredSigner,
            bindingTimestamp: uint40(block.timestamp),
            signatureType: 0, // EIP-712
            verified: true
        });

        emit IdentityBound(traceHash, recoveredSigner, block.timestamp);
        emit IdentityBoundWithSignature(
            traceHash,
            recoveredSigner,
            signature,
            "code-authorship",
            block.timestamp
        );

        return true;
    }

    /**
     * @notice Verify identity binding for a trace
     */
    function verifyIdentity(
        bytes32 traceHash
    ) external view override returns (bool verified, address signer) {
        IdentityBinding storage binding = identityBindings[traceHash];
        return (binding.verified, binding.signer);
    }

    /**
     * @notice Get full identity binding data
     */
    function getIdentityBinding(
        bytes32 traceHash
    ) external view override returns (IdentityBinding memory binding) {
        return identityBindings[traceHash];
    }

    // ============ IGitMetadata Implementation ============

    /**
     * @notice Set git metadata for a trace
     */
    function setGitMetadata(
        bytes32 traceHash,
        bytes32 commitSha,
        string calldata branch,
        string calldata repository
    ) external override onlyTraceCreator(traceHash) returns (bool success) {
        if (commitSha == bytes32(0)) {
            revert InvalidCommitSha();
        }

        // Store only commitSha on-chain (gas efficient)
        ownershipRecords[traceHash].commitSha = commitSha;

        emit GitMetadataSet(traceHash, commitSha, branch, repository);

        return true;
    }

    /**
     * @notice Get git metadata for a trace
     */
    function getGitMetadata(
        bytes32 traceHash
    ) external view override returns (bytes32 commitSha, bool hasMetadata) {
        bytes32 storedSha = ownershipRecords[traceHash].commitSha;
        return (storedSha, storedSha != bytes32(0));
    }

    // ============ IAuthorship Implementation ============

    /**
     * @notice Declare authorship of a trace
     */
    function declareAuthorship(
        bytes32 traceHash,
        DeclarationType declarationType
    ) external override onlyTraceCreator(traceHash) returns (bool success) {
        PackedOwnership storage ownership = ownershipRecords[traceHash];

        if (ownership.claimant != address(0)) {
            revert AuthorshipAlreadyClaimed(traceHash);
        }

        if (uint8(declarationType) > 2) {
            revert InvalidDeclarationType(uint8(declarationType));
        }

        ownership.claimant = msg.sender;
        ownership.declarationType = uint8(declarationType);
        ownership.claimTimestamp = uint40(block.timestamp);

        emit AuthorshipClaimed(traceHash, msg.sender, declarationType, block.timestamp);

        return true;
    }

    /**
     * @notice Get authorship claim for a trace
     */
    function getAuthorship(
        bytes32 traceHash
    ) external view override returns (
        address claimant,
        DeclarationType declarationType,
        uint256 claimTimestamp,
        bool hasClaim
    ) {
        PackedOwnership storage ownership = ownershipRecords[traceHash];
        return (
            ownership.claimant,
            DeclarationType(ownership.declarationType),
            ownership.claimTimestamp,
            ownership.claimant != address(0)
        );
    }

    // ============ IContribution Implementation ============

    /**
     * @notice Set contribution ratio for a trace
     */
    function setContribution(
        bytes32 traceHash,
        uint8 humanPercent,
        uint8 aiPercent,
        string calldata notes
    ) external override onlyTraceCreator(traceHash) returns (bool success) {
        if (humanPercent > 100) {
            revert InvalidContributionRatio(humanPercent);
        }
        if (aiPercent > 100) {
            revert InvalidContributionRatio(aiPercent);
        }
        if (humanPercent + aiPercent != 100) {
            revert ContributionMustSumTo100(humanPercent, aiPercent);
        }

        PackedOwnership storage ownership = ownershipRecords[traceHash];
        ownership.humanPercent = humanPercent;
        ownership.aiPercent = aiPercent;

        emit ContributionSet(traceHash, humanPercent, aiPercent, notes);

        return true;
    }

    /**
     * @notice Get contribution ratio for a trace
     */
    function getContribution(
        bytes32 traceHash
    ) external view override returns (
        uint8 humanPercent,
        uint8 aiPercent,
        bool hasContribution
    ) {
        PackedOwnership storage ownership = ownershipRecords[traceHash];
        // Check if contribution has been set (at least one percent is non-zero or explicitly set)
        bool hasData = ownership.humanPercent > 0 || ownership.aiPercent > 0;
        return (ownership.humanPercent, ownership.aiPercent, hasData);
    }

    // ============ Combined V2 Functions ============

    /**
     * @notice Get complete ownership record for a trace
     */
    function getOwnershipRecord(
        bytes32 traceHash
    ) external view returns (OwnershipRecord memory record) {
        Anchor storage anchor = anchors[traceHash];
        IdentityBinding storage identity = identityBindings[traceHash];
        PackedOwnership storage ownership = ownershipRecords[traceHash];

        return OwnershipRecord({
            traceHash: traceHash,
            creator: anchor.creator,
            anchorTimestamp: anchor.timestamp,
            identitySigner: identity.signer,
            identityVerified: identity.verified,
            claimant: ownership.claimant,
            declarationType: DeclarationType(ownership.declarationType),
            humanPercent: ownership.humanPercent,
            aiPercent: ownership.aiPercent,
            commitSha: ownership.commitSha,
            hasIdentity: identity.verified,
            hasOwnership: ownership.claimant != address(0),
            hasGitMetadata: ownership.commitSha != bytes32(0)
        });
    }

    // ============ Query Functions (V1 compatible) ============

    function getTracesByAgent(bytes32 agentId) external view returns (bytes32[] memory) {
        return agentAnchors[agentId];
    }

    function getTracesByCreator(address creator) external view returns (bytes32[] memory) {
        return creatorAnchors[creator];
    }

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

    function getAgentTraceCount(bytes32 agentId) external view returns (uint256) {
        return agentAnchors[agentId].length;
    }

    function getCreatorTraceCount(address creator) external view returns (uint256) {
        return creatorAnchors[creator].length;
    }

    // ============ Trace Linking View Functions ============

    /**
     * @notice Get the parent trace hash for a given trace
     * @param traceHash The trace to query
     * @return parentHash The parent trace hash (0x0 if root)
     * @return hasParent True if trace has a parent
     */
    function getParentTrace(bytes32 traceHash) external view returns (bytes32 parentHash, bool hasParent) {
        if (anchors[traceHash].timestamp == 0) {
            revert AnchorNotFound(traceHash);
        }
        bytes32 parent = anchors[traceHash].parentTraceHash;
        return (parent, parent != bytes32(0));
    }

    /**
     * @notice Get all child traces for a given parent
     * @param parentTraceHash The parent trace to query
     * @return childHashes Array of child trace hashes
     * @dev DEPRECATED: Use getChildTracesPaginated for large datasets
     */
    function getChildTraces(bytes32 parentTraceHash) external view returns (bytes32[] memory childHashes) {
        return childTraces[parentTraceHash];
    }

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
    ) external view returns (bytes32[] memory childHashes, uint256 total) {
        bytes32[] storage allChildren = childTraces[parentTraceHash];
        total = allChildren.length;

        if (offset >= total) {
            return (new bytes32[](0), total);
        }

        uint256 end = offset + limit;
        if (end > total) end = total;
        uint256 resultLength = end - offset;

        childHashes = new bytes32[](resultLength);
        for (uint256 i = 0; i < resultLength; i++) {
            childHashes[i] = allChildren[offset + i];
        }
    }

    /**
     * @notice Get the count of child traces
     * @param parentTraceHash The parent trace to query
     * @return count Number of children
     */
    function getChildTraceCount(bytes32 parentTraceHash) external view returns (uint256 count) {
        return childTraces[parentTraceHash].length;
    }

    /**
     * @notice Check if a trace is a root trace (no parent)
     * @param traceHash The trace to check
     * @return isRoot True if trace has no parent
     */
    function isRootTrace(bytes32 traceHash) external view returns (bool isRoot) {
        if (anchors[traceHash].timestamp == 0) {
            revert AnchorNotFound(traceHash);
        }
        return anchors[traceHash].parentTraceHash == bytes32(0);
    }

    // ============ Admin Functions ============

    function setPermissionless(bool _permissionless) external onlyOwner {
        permissionless = _permissionless;
        emit PermissionlessChanged(_permissionless);
    }

    function setAllowlist(address account, bool allowed) external onlyOwner {
        allowlist[account] = allowed;
        emit AllowlistUpdated(account, allowed);
    }

    function setAllowlistBatch(address[] calldata accounts, bool allowed) external onlyOwner {
        for (uint256 i = 0; i < accounts.length; i++) {
            allowlist[accounts[i]] = allowed;
            emit AllowlistUpdated(accounts[i], allowed);
        }
    }

    function setIdentityRequired(bool _required) external onlyOwner {
        identityRequired = _required;
        emit IdentityRequiredChanged(_required);
    }
}
