/**
 * Local cryptographic signing for tamper-evident records.
 *
 * Implements secp256k1 signing using @noble/secp256k1 for local operations
 * and ethers.js for Ethereum-compatible signatures.
 */

import { ethers } from "ethers";
import type {
  TraceEntry,
  SignedRecord,
  AnchorStatus,
  CallbackConfig,
} from "./types.js";
import { GENESIS_HASH } from "./types.js";

/**
 * Serialize a TraceEntry to a canonical JSON string for hashing.
 *
 * Fields are explicitly ordered to ensure consistent hashing.
 */
export function serializeTraceEntry(entry: TraceEntry): string {
  return JSON.stringify({
    id: entry.id,
    method: entry.method,
    args: entry.args,
    result: entry.result,
    error: entry.error,
    timestamp: entry.timestamp,
    duration: entry.duration,
    parentId: entry.parentId,
  });
}

/**
 * Compute keccak256 hash of a TraceEntry.
 *
 * @param entry - The trace entry to hash
 * @returns 66-character hex string (0x + 64 chars)
 */
export function hashTraceEntry(entry: TraceEntry): string {
  const serialized = serializeTraceEntry(entry);
  return ethers.keccak256(ethers.toUtf8Bytes(serialized));
}

/**
 * Create the message to sign for a record.
 *
 * Combines entry hash, previous hash, and timestamp for signature.
 */
export function createSigningMessage(
  entryHash: string,
  previousHash: string,
  timestamp: number
): Uint8Array {
  const packedHash = ethers.solidityPackedKeccak256(
    ["bytes32", "bytes32", "uint256"],
    [entryHash, previousHash, timestamp]
  );
  return ethers.getBytes(packedHash);
}

/**
 * Sign a trace entry to create a SignedRecord.
 *
 * @param entry - The trace entry to sign
 * @param privateKey - Private key (hex string, with or without 0x prefix)
 * @param previousHash - Hash of the previous record (or GENESIS_HASH for first)
 * @returns SignedRecord with cryptographic signature
 */
export async function signTraceEntry(
  entry: TraceEntry,
  privateKey: string,
  previousHash: string = GENESIS_HASH
): Promise<SignedRecord> {
  // Normalize private key
  const normalizedKey = privateKey.startsWith("0x")
    ? privateKey
    : `0x${privateKey}`;

  // Create wallet for signing
  const wallet = new ethers.Wallet(normalizedKey);

  // Compute entry hash
  const entryHash = hashTraceEntry(entry);

  // Create message to sign
  const message = createSigningMessage(entryHash, previousHash, entry.timestamp);

  // Sign the message
  const signature = await wallet.signMessage(message);

  return {
    traceEntry: entry,
    hash: entryHash,
    signature,
    previousHash,
    signerAddress: wallet.address,
    createdAt: Date.now(),
    anchorStatus: {
      status: "pending",
      retryCount: 0,
    },
  };
}

/**
 * Verify a signed record's signature.
 *
 * @param record - The signed record to verify
 * @returns true if signature is valid and matches signer address
 */
export function verifySignature(record: SignedRecord): boolean {
  try {
    // Verify the hash matches the trace entry
    const computedHash = hashTraceEntry(record.traceEntry);
    if (computedHash !== record.hash) {
      return false;
    }

    // Create the message that was signed
    const message = createSigningMessage(
      record.hash,
      record.previousHash,
      record.traceEntry.timestamp
    );

    // Recover the signer address from signature
    const recoveredAddress = ethers.verifyMessage(message, record.signature);

    // Compare with stored signer address (case-insensitive)
    return (
      recoveredAddress.toLowerCase() === record.signerAddress.toLowerCase()
    );
  } catch {
    return false;
  }
}

/**
 * Verify the integrity of a chain of signed records.
 *
 * Checks that:
 * 1. First record has GENESIS_HASH as previousHash
 * 2. Each subsequent record's previousHash matches prior record's hash
 * 3. All signatures are valid
 *
 * @param records - Array of signed records in chronological order
 * @returns true if chain integrity is intact
 */
export function verifyChainIntegrity(records: SignedRecord[]): boolean {
  if (records.length === 0) {
    return true;
  }

  // First record must have genesis hash
  const firstRecord = records[0];
  if (!firstRecord || firstRecord.previousHash !== GENESIS_HASH) {
    return false;
  }

  // Verify first record's signature
  if (!verifySignature(firstRecord)) {
    return false;
  }

  // Verify chain links and signatures for remaining records
  for (let i = 1; i < records.length; i++) {
    const currentRecord = records[i];
    const previousRecord = records[i - 1];
    if (!currentRecord || !previousRecord) {
      return false;
    }

    // Previous hash must match prior record's hash
    if (currentRecord.previousHash !== previousRecord.hash) {
      return false;
    }

    // Signature must be valid
    if (!verifySignature(currentRecord)) {
      return false;
    }
  }

  return true;
}

/**
 * Signing context for maintaining chain state.
 */
export class SigningContext {
  private previousHash: string = GENESIS_HASH;
  private privateKey: string;
  private signerAddress: string;
  private callbacks?: CallbackConfig;

  constructor(privateKey: string, callbacks?: CallbackConfig) {
    // Normalize and store private key
    this.privateKey = privateKey.startsWith("0x")
      ? privateKey
      : `0x${privateKey}`;

    // Derive signer address
    const wallet = new ethers.Wallet(this.privateKey);
    this.signerAddress = wallet.address;
    this.callbacks = callbacks;
  }

  /**
   * Get the signer's Ethereum address.
   */
  getSignerAddress(): string {
    return this.signerAddress;
  }

  /**
   * Get the current previous hash (for chaining).
   */
  getPreviousHash(): string {
    return this.previousHash;
  }

  /**
   * Sign a trace entry and update chain state.
   *
   * @param entry - The trace entry to sign
   * @returns Signed record
   */
  async sign(entry: TraceEntry): Promise<SignedRecord> {
    const record = await signTraceEntry(entry, this.privateKey, this.previousHash);

    // Update chain state
    this.previousHash = record.hash;

    // Fire callback if configured
    if (this.callbacks?.onRecordSigned) {
      try {
        this.callbacks.onRecordSigned(record);
      } catch {
        // Ignore callback errors
      }
    }

    return record;
  }

  /**
   * Reset the chain state (start new chain).
   */
  reset(): void {
    this.previousHash = GENESIS_HASH;
  }

  /**
   * Set the previous hash explicitly (for resuming a chain).
   */
  setPreviousHash(hash: string): void {
    this.previousHash = hash;
  }
}

/**
 * Create a signing context from a private key.
 *
 * @param privateKey - Private key (hex string, with or without 0x prefix)
 * @param callbacks - Optional lifecycle callbacks
 * @returns Configured signing context
 */
export function createSigningContext(
  privateKey: string,
  callbacks?: CallbackConfig
): SigningContext {
  return new SigningContext(privateKey, callbacks);
}

/**
 * Derive Ethereum address from a private key.
 *
 * @param privateKey - Private key (hex string, with or without 0x prefix)
 * @returns Checksummed Ethereum address
 */
export function deriveAddress(privateKey: string): string {
  const normalizedKey = privateKey.startsWith("0x")
    ? privateKey
    : `0x${privateKey}`;
  const wallet = new ethers.Wallet(normalizedKey);
  return wallet.address;
}

/**
 * Validate a private key format.
 *
 * @param privateKey - Private key to validate
 * @returns true if valid 32-byte hex string
 */
export function isValidPrivateKey(privateKey: string): boolean {
  const key = privateKey.startsWith("0x") ? privateKey.slice(2) : privateKey;
  return /^[0-9a-fA-F]{64}$/.test(key);
}
