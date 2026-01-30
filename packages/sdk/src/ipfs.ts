/**
 * IPFS utilities for Agent Anchor SDK
 *
 * Provides upload and fetch functionality for trace data storage.
 * Uses web3.storage or compatible IPFS pinning services.
 */

import { DEFAULT_IPFS_GATEWAY } from "./constants.js";
import { retryWithBackoff } from "./utils.js";

/**
 * IPFS client configuration
 */
export interface IpfsConfig {
  /** API token for web3.storage or similar service */
  apiToken?: string;
  /** Custom gateway URL for fetching */
  gateway?: string;
  /** Upload endpoint URL */
  uploadEndpoint?: string;
}

/**
 * Result of IPFS upload
 */
export interface IpfsUploadResult {
  /** IPFS CID */
  cid: string;
  /** Full IPFS URI (ipfs://...) */
  uri: string;
  /** Size in bytes */
  size: number;
}

/**
 * IPFS client for uploading and fetching trace data
 */
export class IpfsClient {
  private readonly apiToken?: string;
  private readonly gateway: string;
  private readonly uploadEndpoint: string;

  constructor(config: IpfsConfig = {}) {
    this.apiToken = config.apiToken || process.env.WEB3_STORAGE_TOKEN;
    this.gateway = config.gateway || DEFAULT_IPFS_GATEWAY;
    this.uploadEndpoint = config.uploadEndpoint || "https://api.web3.storage/upload";
  }

  /**
   * Upload JSON data to IPFS
   * @param data - Data to upload (will be JSON stringified)
   * @returns Upload result with CID and URI
   */
  async upload(data: unknown): Promise<IpfsUploadResult> {
    if (!this.apiToken) {
      throw new Error(
        "IPFS API token required. Set WEB3_STORAGE_TOKEN env var or pass apiToken in config."
      );
    }

    const jsonData = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonData], { type: "application/json" });

    const response = await retryWithBackoff(async () => {
      const res = await fetch(this.uploadEndpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          "X-Name": "agent-anchor-trace.json",
        },
        body: blob,
      });

      if (!res.ok) {
        const error = await res.text();
        throw new Error(`IPFS upload failed: ${res.status} ${error}`);
      }

      return res.json() as Promise<{ cid: string }>;
    });

    const cid = response.cid;

    return {
      cid,
      uri: `ipfs://${cid}`,
      size: jsonData.length,
    };
  }

  /**
   * Upload raw bytes to IPFS
   * @param data - Raw data buffer
   * @param filename - Optional filename
   * @returns Upload result with CID and URI
   */
  async uploadRaw(data: Uint8Array, filename?: string): Promise<IpfsUploadResult> {
    if (!this.apiToken) {
      throw new Error(
        "IPFS API token required. Set WEB3_STORAGE_TOKEN env var or pass apiToken in config."
      );
    }

    const blob = new Blob([data]);

    const response = await retryWithBackoff(async () => {
      const res = await fetch(this.uploadEndpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          ...(filename && { "X-Name": filename }),
        },
        body: blob,
      });

      if (!res.ok) {
        const error = await res.text();
        throw new Error(`IPFS upload failed: ${res.status} ${error}`);
      }

      return res.json() as Promise<{ cid: string }>;
    });

    const cid = response.cid;

    return {
      cid,
      uri: `ipfs://${cid}`,
      size: data.length,
    };
  }

  /**
   * Fetch data from IPFS
   * @param cidOrUri - IPFS CID or URI
   * @returns Fetched data as JSON
   */
  async fetch<T = unknown>(cidOrUri: string): Promise<T> {
    const cid = this.parseCid(cidOrUri);
    const url = `${this.gateway}${cid}`;

    const response = await retryWithBackoff(async () => {
      const res = await fetch(url);

      if (!res.ok) {
        throw new Error(`IPFS fetch failed: ${res.status}`);
      }

      return res.json();
    });

    return response as T;
  }

  /**
   * Fetch raw data from IPFS
   * @param cidOrUri - IPFS CID or URI
   * @returns Fetched data as ArrayBuffer
   */
  async fetchRaw(cidOrUri: string): Promise<ArrayBuffer> {
    const cid = this.parseCid(cidOrUri);
    const url = `${this.gateway}${cid}`;

    const response = await retryWithBackoff(async () => {
      const res = await fetch(url);

      if (!res.ok) {
        throw new Error(`IPFS fetch failed: ${res.status}`);
      }

      return res.arrayBuffer();
    });

    return response;
  }

  /**
   * Check if content exists on IPFS
   * @param cidOrUri - IPFS CID or URI
   * @returns True if content exists and is accessible
   */
  async exists(cidOrUri: string): Promise<boolean> {
    try {
      const cid = this.parseCid(cidOrUri);
      const url = `${this.gateway}${cid}`;

      const res = await fetch(url, { method: "HEAD" });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get gateway URL for a CID
   * @param cidOrUri - IPFS CID or URI
   * @returns Full gateway URL
   */
  getGatewayUrl(cidOrUri: string): string {
    const cid = this.parseCid(cidOrUri);
    return `${this.gateway}${cid}`;
  }

  /**
   * Parse CID from URI or return as-is
   */
  private parseCid(cidOrUri: string): string {
    if (cidOrUri.startsWith("ipfs://")) {
      return cidOrUri.slice(7);
    }
    // Handle gateway URLs
    const match = cidOrUri.match(/\/ipfs\/([a-zA-Z0-9]+)/);
    if (match && match[1]) {
      return match[1];
    }
    // Assume it's a raw CID
    return cidOrUri;
  }
}

/**
 * Mock IPFS client for testing (no actual uploads)
 */
export class MockIpfsClient extends IpfsClient {
  constructor() {
    super({ apiToken: "mock-token" });
  }

  override async upload(data: unknown): Promise<IpfsUploadResult> {
    const jsonData = JSON.stringify(data);
    // Generate deterministic mock CID based on content
    const mockCid = `Qm${Buffer.from(jsonData).toString("base64").slice(0, 44).replace(/[+/=]/g, "x")}`;
    return {
      cid: mockCid,
      uri: `ipfs://${mockCid}`,
      size: jsonData.length,
    };
  }

  override async uploadRaw(data: Uint8Array): Promise<IpfsUploadResult> {
    const mockCid = `Qm${Buffer.from(data).toString("base64").slice(0, 44).replace(/[+/=]/g, "x")}`;
    return {
      cid: mockCid,
      uri: `ipfs://${mockCid}`,
      size: data.length,
    };
  }

  override async fetch<T>(): Promise<T> {
    throw new Error("Mock IPFS client cannot fetch");
  }

  override async fetchRaw(): Promise<ArrayBuffer> {
    throw new Error("Mock IPFS client cannot fetch");
  }

  override async exists(): Promise<boolean> {
    return true;
  }
}

/**
 * Create a mock IPFS client for testing (no actual uploads)
 */
export function createMockIpfsClient(): IpfsClient {
  return new MockIpfsClient();
}

// Default export for convenience
export const ipfs = new IpfsClient();
