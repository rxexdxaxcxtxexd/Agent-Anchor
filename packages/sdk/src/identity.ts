/**
 * Identity binding utilities for EIP-712 signature creation and verification
 */

import { type Signer, verifyTypedData } from "ethers";
import { EIP712_DOMAIN, EIP712_TYPES, type IdentityPurpose } from "./constantsV2.js";

/**
 * Parameters for creating an identity signature
 */
export interface IdentitySignatureParams {
  /** The trace hash to bind identity to */
  traceHash: string;
  /** The anchor timestamp (when the trace was anchored) */
  anchorTimestamp: number | bigint;
  /** Purpose of the identity binding */
  purpose?: IdentityPurpose;
  /** Chain ID for the signature domain */
  chainId: number | bigint;
  /** Contract address for the signature domain */
  contractAddress: string;
}

/**
 * Result from creating an identity signature
 */
export interface IdentitySignatureResult {
  /** The EIP-712 signature */
  signature: string;
  /** The signer's address */
  signer: string;
  /** The signed data for reference */
  signedData: {
    traceHash: string;
    initiator: string;
    timestamp: bigint;
    purpose: string;
  };
}

/**
 * Create an EIP-712 signature for identity binding
 *
 * @param signer - The ethers.js signer to create the signature
 * @param params - Parameters for the signature
 * @returns The signature and related data
 *
 * @example
 * ```typescript
 * const result = await createIdentitySignature(signer, {
 *   traceHash: "0x123...",
 *   anchorTimestamp: 1706000000,
 *   chainId: 84532,
 *   contractAddress: "0xabc..."
 * });
 * console.log(result.signature);
 * ```
 */
export async function createIdentitySignature(
  signer: Signer,
  params: IdentitySignatureParams
): Promise<IdentitySignatureResult> {
  const signerAddress = await signer.getAddress();
  const purpose = params.purpose || "code-authorship";
  const timestamp = BigInt(params.anchorTimestamp);

  const domain = {
    name: EIP712_DOMAIN.name,
    version: EIP712_DOMAIN.version,
    chainId: BigInt(params.chainId),
    verifyingContract: params.contractAddress,
  };

  const types = {
    TraceIdentity: EIP712_TYPES.TraceIdentity,
  };

  const value = {
    traceHash: params.traceHash,
    initiator: signerAddress,
    timestamp: timestamp,
    purpose: purpose,
  };

  const signature = await signer.signTypedData(domain, types, value);

  return {
    signature,
    signer: signerAddress,
    signedData: value,
  };
}

/**
 * Verify an EIP-712 identity signature and recover the signer address
 *
 * @param signature - The EIP-712 signature to verify
 * @param params - The parameters used to create the signature
 * @returns The recovered signer address
 *
 * @example
 * ```typescript
 * const recoveredAddress = verifyIdentitySignature(signature, {
 *   traceHash: "0x123...",
 *   initiator: "0xabc...",
 *   timestamp: 1706000000,
 *   purpose: "code-authorship",
 *   chainId: 84532,
 *   contractAddress: "0xdef..."
 * });
 * ```
 */
export function verifyIdentitySignature(
  signature: string,
  params: {
    traceHash: string;
    initiator: string;
    timestamp: number | bigint;
    purpose?: IdentityPurpose;
    chainId: number | bigint;
    contractAddress: string;
  }
): string {
  const domain = {
    name: EIP712_DOMAIN.name,
    version: EIP712_DOMAIN.version,
    chainId: BigInt(params.chainId),
    verifyingContract: params.contractAddress,
  };

  const types = {
    TraceIdentity: EIP712_TYPES.TraceIdentity,
  };

  const value = {
    traceHash: params.traceHash,
    initiator: params.initiator,
    timestamp: BigInt(params.timestamp),
    purpose: params.purpose || "code-authorship",
  };

  return verifyTypedData(domain, types, value, signature);
}

/**
 * Check if a signature is valid for the given parameters
 *
 * @param signature - The signature to check
 * @param expectedSigner - The expected signer address
 * @param params - The signature parameters
 * @returns true if the signature is valid and from the expected signer
 */
export function isValidIdentitySignature(
  signature: string,
  expectedSigner: string,
  params: {
    traceHash: string;
    initiator: string;
    timestamp: number | bigint;
    purpose?: IdentityPurpose;
    chainId: number | bigint;
    contractAddress: string;
  }
): boolean {
  try {
    const recoveredAddress = verifyIdentitySignature(signature, params);
    return recoveredAddress.toLowerCase() === expectedSigner.toLowerCase();
  } catch {
    return false;
  }
}
