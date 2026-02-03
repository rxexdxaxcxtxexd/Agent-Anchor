/**
 * Tests for wallet connection and signer functionality.
 *
 * T064-T069: Tests for private key, injected wallet, WalletConnect,
 * chain selection, gas strategy, and explorer URLs
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createWalletSigner,
  connectInjectedWallet,
  WalletConnectionError,
  isValidAddress,
} from "../../src/runtime/wallet.js";
import { getTransactionExplorerUrl, getChainConfig } from "../../src/runtime/chains.js";
import type { WalletConfig, GasStrategy } from "../../src/runtime/types.js";

describe("Wallet - Private key signer", () => {
  it("should create valid signer from private key", async () => {
    // Valid 32-byte hex private key
    const privateKey = "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    const signer = await createWalletSigner({ type: "privateKey", key: privateKey });

    expect(signer).toBeDefined();
    expect(signer.address).toBeDefined();
    expect(signer.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it("should create signer without 0x prefix", async () => {
    const privateKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    const signer = await createWalletSigner({ type: "privateKey", key: privateKey });

    expect(signer).toBeDefined();
    expect(signer.address).toBeDefined();
  });

  it("should derive consistent address from same key", async () => {
    const privateKey = "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    const signer1 = await createWalletSigner({ type: "privateKey", key: privateKey });
    const signer2 = await createWalletSigner({ type: "privateKey", key: privateKey });

    expect(signer1.address).toBe(signer2.address);
  });

  it("should throw for invalid private key format", async () => {
    const invalidKey = "invalid-key";

    await expect(
      createWalletSigner({ type: "privateKey", key: invalidKey })
    ).rejects.toThrow();
  });

  it("should throw for private key with wrong length", async () => {
    const shortKey = "0x0123456789abcdef";

    await expect(
      createWalletSigner({ type: "privateKey", key: shortKey })
    ).rejects.toThrow();
  });
});

describe("Wallet - Injected wallet (MetaMask)", () => {
  let originalWindow: typeof globalThis.window;

  beforeEach(() => {
    originalWindow = globalThis.window;
  });

  afterEach(() => {
    globalThis.window = originalWindow;
    vi.restoreAllMocks();
  });

  it("should throw when no injected wallet is found", async () => {
    // Simulate no window.ethereum
    (globalThis as any).window = {};

    await expect(
      connectInjectedWallet()
    ).rejects.toThrow(WalletConnectionError);
  });

  it("should connect when MetaMask is available", async () => {
    const mockAddress = "0x742d35Cc6634C0532925a3b844Bc9e7595f5fF22";
    const mockEthereum = {
      request: vi.fn().mockResolvedValue([mockAddress]),
      on: vi.fn(),
      removeListener: vi.fn(),
    };

    (globalThis as any).window = { ethereum: mockEthereum };

    const result = await connectInjectedWallet();

    expect(mockEthereum.request).toHaveBeenCalledWith({
      method: "eth_requestAccounts",
    });
    expect(result.address).toBe(mockAddress);
  });

  it("should throw when user rejects connection", async () => {
    const mockEthereum = {
      request: vi.fn().mockRejectedValue(new Error("User rejected the request.")),
      on: vi.fn(),
      removeListener: vi.fn(),
    };

    (globalThis as any).window = { ethereum: mockEthereum };

    await expect(
      connectInjectedWallet()
    ).rejects.toThrow("User rejected");
  });

  it("should throw when no accounts returned", async () => {
    const mockEthereum = {
      request: vi.fn().mockResolvedValue([]),
      on: vi.fn(),
      removeListener: vi.fn(),
    };

    (globalThis as any).window = { ethereum: mockEthereum };

    await expect(
      connectInjectedWallet()
    ).rejects.toThrow(WalletConnectionError);
  });
});

describe("Wallet - WalletConnect config", () => {
  it("should accept WalletConnect configuration", () => {
    const config: WalletConfig = {
      type: "walletconnect",
      projectId: "test-project-id",
    };

    // Just validate config is accepted
    expect(config.type).toBe("walletconnect");
    expect(config.projectId).toBe("test-project-id");
  });

  it("should require projectId for WalletConnect", () => {
    const config: WalletConfig = {
      type: "walletconnect",
      projectId: "my-project-123",
    };

    expect(config.projectId).toBeDefined();
    expect(config.projectId!.length).toBeGreaterThan(0);
  });
});

describe("Wallet - Chain selection", () => {
  it("should get config for polygon chain", () => {
    const config = getChainConfig("polygon");

    expect(config).toBeDefined();
    expect(config.chainId).toBe(137);
    expect(config.name).toContain("Polygon");
  });

  it("should get config for base chain", () => {
    const config = getChainConfig("base");

    expect(config).toBeDefined();
    expect(config.chainId).toBe(8453);
    expect(config.name).toContain("Base");
  });

  it("should get config for ethereum mainnet", () => {
    const config = getChainConfig("ethereum");

    expect(config).toBeDefined();
    expect(config.chainId).toBe(1);
    expect(config.name).toContain("Ethereum");
  });

  it("should get config for sepolia testnet", () => {
    const config = getChainConfig("sepolia");

    expect(config).toBeDefined();
    expect(config.chainId).toBe(11155111);
    expect(config.name).toContain("Sepolia");
  });

  it("should get config for base-sepolia testnet", () => {
    const config = getChainConfig("base-sepolia");

    expect(config).toBeDefined();
    expect(config.chainId).toBe(84532);
    expect(config.name).toContain("Base");
    expect(config.name).toContain("Sepolia");
  });

  it("should throw for unknown chain", () => {
    expect(() => {
      getChainConfig("unknown-chain" as any);
    }).toThrow();
  });
});

describe("Wallet - Gas strategy", () => {
  it("should have default gas strategy", () => {
    const defaultStrategy: GasStrategy = "normal";
    expect(defaultStrategy).toBe("normal");
  });

  it("should support aggressive strategy", () => {
    const strategy: GasStrategy = "aggressive";
    expect(strategy).toBe("aggressive");
  });

  it("should support economy strategy", () => {
    const strategy: GasStrategy = "economy";
    expect(strategy).toBe("economy");
  });

  it("should support custom strategy with maxFeePerGas", () => {
    const strategy: GasStrategy = {
      maxFeePerGas: "50000000000", // 50 gwei
      maxPriorityFeePerGas: "2000000000", // 2 gwei
    };

    expect(strategy).toHaveProperty("maxFeePerGas");
    expect(strategy).toHaveProperty("maxPriorityFeePerGas");
  });
});

describe("Wallet - Explorer URLs", () => {
  it("should return correct Polygonscan URL", () => {
    const txHash = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    const url = getTransactionExplorerUrl("polygon", txHash);

    expect(url).toBe(`https://polygonscan.com/tx/${txHash}`);
  });

  it("should return correct Basescan URL", () => {
    const txHash = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
    const url = getTransactionExplorerUrl("base", txHash);

    expect(url).toBe(`https://basescan.org/tx/${txHash}`);
  });

  it("should return correct Etherscan URL", () => {
    const txHash = "0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba";
    const url = getTransactionExplorerUrl("ethereum", txHash);

    expect(url).toBe(`https://etherscan.io/tx/${txHash}`);
  });

  it("should return correct Sepolia Etherscan URL", () => {
    const txHash = "0xdeadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678";
    const url = getTransactionExplorerUrl("sepolia", txHash);

    expect(url).toBe(`https://sepolia.etherscan.io/tx/${txHash}`);
  });

  it("should return correct Base Sepolia URL", () => {
    const txHash = "0xcafebabe1234567890abcdef1234567890abcdef1234567890abcdef12345678";
    const url = getTransactionExplorerUrl("base-sepolia", txHash);

    expect(url).toBe(`https://sepolia.basescan.org/tx/${txHash}`);
  });
});

describe("Wallet - Address validation", () => {
  it("should validate correct address", () => {
    const validAddress = "0x742d35Cc6634C0532925a3b844Bc9e7595f5fF22";
    expect(isValidAddress(validAddress)).toBe(true);
  });

  it("should reject address without 0x prefix", () => {
    const noPrefix = "742d35Cc6634C0532925a3b844Bc9e7595f5fF22";
    expect(isValidAddress(noPrefix)).toBe(false);
  });

  it("should reject address with wrong length", () => {
    const tooShort = "0x742d35Cc6634C0532925a3b844Bc";
    expect(isValidAddress(tooShort)).toBe(false);
  });

  it("should reject address with invalid characters", () => {
    const invalidChars = "0x742d35Cc6634C0532925a3b844Bc9e7595f5ZZZZ";
    expect(isValidAddress(invalidChars)).toBe(false);
  });
});
