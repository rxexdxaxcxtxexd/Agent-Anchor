// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../libraries/OwnershipTypes.sol";

/**
 * @title IIdentityBinding
 * @author Agent Anchor Team
 * @notice Interface for cryptographic identity binding using EIP-712 signatures
 * @dev Enables proving who initiated a coding session
 */
interface IIdentityBinding {
    // ============ Events ============

    /**
     * @notice Emitted when identity is bound to a trace
     * @param traceHash The trace this identity is bound to
     * @param signer The verified signer address
     * @param timestamp When the binding occurred
     */
    event IdentityBound(
        bytes32 indexed traceHash,
        address indexed signer,
        uint256 timestamp
    );

    /**
     * @notice Emitted with full signature data for audit trail
     * @param traceHash The trace this identity is bound to
     * @param signer The verified signer address
     * @param signature The full EIP-712 signature
     * @param purpose The purpose of the signature
     * @param timestamp When the binding occurred
     */
    event IdentityBoundWithSignature(
        bytes32 indexed traceHash,
        address indexed signer,
        bytes signature,
        string purpose,
        uint256 timestamp
    );

    // ============ Errors ============
    // Note: TraceNotFound is defined in OwnershipTypes.sol

    /// @notice Thrown when signature is invalid or doesn't recover to expected address
    error InvalidSignature();

    /// @notice Thrown when identity is already bound for this trace
    error IdentityAlreadyBound(bytes32 traceHash);

    // ============ Functions ============

    /**
     * @notice Bind an identity to a trace using EIP-712 signature
     * @param traceHash The trace hash to bind identity to
     * @param signature The EIP-712 signature proving identity
     * @return success True if binding succeeded
     */
    function bindIdentity(
        bytes32 traceHash,
        bytes calldata signature
    ) external returns (bool success);

    /**
     * @notice Verify if identity is bound to a trace
     * @param traceHash The trace hash to check
     * @return verified Whether identity is verified
     * @return signer The bound signer address (zero if not bound)
     */
    function verifyIdentity(
        bytes32 traceHash
    ) external view returns (bool verified, address signer);

    /**
     * @notice Get full identity binding data
     * @param traceHash The trace hash to query
     * @return binding The identity binding struct
     */
    function getIdentityBinding(
        bytes32 traceHash
    ) external view returns (IdentityBinding memory binding);
}
