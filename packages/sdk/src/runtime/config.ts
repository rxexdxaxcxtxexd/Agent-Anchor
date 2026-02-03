/**
 * Runtime configuration validation and defaults.
 */

import type { RuntimeConfig, ConsistencyMode, ChainId, GasStrategy } from "./types.js";
import { DEFAULT_CONFIG } from "./types.js";

/**
 * Valid consistency modes.
 */
const VALID_CONSISTENCY_MODES: ConsistencyMode[] = [
  "sync",
  "async",
  "cache",
  "two-phase",
];

/**
 * Valid chain IDs.
 */
const VALID_CHAINS: ChainId[] = [
  "polygon",
  "base",
  "ethereum",
  "sepolia",
  "base-sepolia",
];

/**
 * Valid gas strategy string literals.
 */
const VALID_GAS_STRATEGY_STRINGS = ["normal", "standard", "aggressive", "economy"] as const;

/**
 * Configuration validation error.
 */
export class ConfigValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
    public readonly value: unknown
  ) {
    super(`Invalid configuration: ${message}`);
    this.name = "ConfigValidationError";
  }
}

/**
 * Validate a RuntimeConfig object.
 *
 * @param config - Configuration to validate
 * @throws ConfigValidationError if configuration is invalid
 */
export function validateConfig(config: RuntimeConfig): void {
  // Must have either wallet or privateKey
  if (!config.wallet && !config.privateKey) {
    throw new ConfigValidationError(
      "Either 'wallet' or 'privateKey' must be provided",
      "wallet/privateKey",
      undefined
    );
  }

  // Cannot have both wallet and privateKey
  if (config.wallet && config.privateKey) {
    throw new ConfigValidationError(
      "Cannot specify both 'wallet' and 'privateKey'",
      "wallet/privateKey",
      { wallet: config.wallet, privateKey: "[redacted]" }
    );
  }

  // Validate privateKey format if provided
  if (config.privateKey) {
    const key = config.privateKey.startsWith("0x")
      ? config.privateKey.slice(2)
      : config.privateKey;
    if (!/^[0-9a-fA-F]{64}$/.test(key)) {
      throw new ConfigValidationError(
        "privateKey must be a 64-character hex string (with optional 0x prefix)",
        "privateKey",
        "[redacted]"
      );
    }
  }

  // Validate wallet config if provided
  if (config.wallet) {
    if (config.wallet.type === "privateKey") {
      const key = config.wallet.key.startsWith("0x")
        ? config.wallet.key.slice(2)
        : config.wallet.key;
      if (!/^[0-9a-fA-F]{64}$/.test(key)) {
        throw new ConfigValidationError(
          "wallet.key must be a 64-character hex string (with optional 0x prefix)",
          "wallet.key",
          "[redacted]"
        );
      }
    } else if (config.wallet.type === "walletconnect") {
      if (!config.wallet.projectId || config.wallet.projectId.trim() === "") {
        throw new ConfigValidationError(
          "WalletConnect requires a projectId",
          "wallet.projectId",
          config.wallet.projectId
        );
      }
    }
    // 'injected' type has no additional validation
  }

  // Validate consistencyMode
  if (
    config.consistencyMode &&
    !VALID_CONSISTENCY_MODES.includes(config.consistencyMode)
  ) {
    throw new ConfigValidationError(
      `consistencyMode must be one of: ${VALID_CONSISTENCY_MODES.join(", ")}`,
      "consistencyMode",
      config.consistencyMode
    );
  }

  // Validate chain
  if (config.chain && !VALID_CHAINS.includes(config.chain)) {
    throw new ConfigValidationError(
      `chain must be one of: ${VALID_CHAINS.join(", ")}`,
      "chain",
      config.chain
    );
  }

  // Validate gasStrategy
  if (config.gasStrategy) {
    const isValidString =
      typeof config.gasStrategy === "string" &&
      VALID_GAS_STRATEGY_STRINGS.includes(config.gasStrategy as typeof VALID_GAS_STRATEGY_STRINGS[number]);
    const isValidCustomObject =
      typeof config.gasStrategy === "object" &&
      config.gasStrategy !== null &&
      "maxFeePerGas" in config.gasStrategy &&
      "maxPriorityFeePerGas" in config.gasStrategy;

    if (!isValidString && !isValidCustomObject) {
      throw new ConfigValidationError(
        `gasStrategy must be one of: ${VALID_GAS_STRATEGY_STRINGS.join(", ")}, or a custom gas object`,
        "gasStrategy",
        config.gasStrategy
      );
    }
  }

  // Validate cacheFlushInterval
  if (config.cacheFlushInterval !== undefined) {
    if (
      typeof config.cacheFlushInterval !== "number" ||
      config.cacheFlushInterval < 1000
    ) {
      throw new ConfigValidationError(
        "cacheFlushInterval must be a number >= 1000 (1 second minimum)",
        "cacheFlushInterval",
        config.cacheFlushInterval
      );
    }
  }

  // Validate maxRetries
  if (config.maxRetries !== undefined) {
    if (
      typeof config.maxRetries !== "number" ||
      config.maxRetries < 0 ||
      !Number.isInteger(config.maxRetries)
    ) {
      throw new ConfigValidationError(
        "maxRetries must be a non-negative integer",
        "maxRetries",
        config.maxRetries
      );
    }
  }

  // Validate localCacheLimit
  if (config.localCacheLimit !== undefined) {
    if (
      typeof config.localCacheLimit !== "number" ||
      config.localCacheLimit < 100 ||
      !Number.isInteger(config.localCacheLimit)
    ) {
      throw new ConfigValidationError(
        "localCacheLimit must be an integer >= 100",
        "localCacheLimit",
        config.localCacheLimit
      );
    }
  }

  // Validate redaction config
  if (config.redaction) {
    if (
      config.redaction.patterns &&
      !Array.isArray(config.redaction.patterns)
    ) {
      throw new ConfigValidationError(
        "redaction.patterns must be an array",
        "redaction.patterns",
        config.redaction.patterns
      );
    }

    if (config.redaction.patterns) {
      for (let i = 0; i < config.redaction.patterns.length; i++) {
        const pattern = config.redaction.patterns[i];
        if (!pattern) {
          throw new ConfigValidationError(
            `redaction.patterns[${i}] is undefined`,
            `redaction.patterns[${i}]`,
            undefined
          );
        }
        if (!pattern.name || typeof pattern.name !== "string") {
          throw new ConfigValidationError(
            `redaction.patterns[${i}].name must be a non-empty string`,
            `redaction.patterns[${i}].name`,
            pattern.name
          );
        }
        if (!(pattern.pattern instanceof RegExp)) {
          throw new ConfigValidationError(
            `redaction.patterns[${i}].pattern must be a RegExp`,
            `redaction.patterns[${i}].pattern`,
            pattern.pattern
          );
        }
      }
    }
  }
}

/**
 * Apply default values to a configuration object.
 *
 * @param config - Partial configuration
 * @returns Configuration with defaults applied
 */
export function applyDefaults(config: RuntimeConfig): Required<RuntimeConfig> {
  return {
    consistencyMode: config.consistencyMode ?? DEFAULT_CONFIG.consistencyMode,
    wallet: config.wallet ?? undefined!,
    privateKey: config.privateKey ?? undefined!,
    chain: config.chain ?? DEFAULT_CONFIG.chain,
    gasStrategy: config.gasStrategy ?? DEFAULT_CONFIG.gasStrategy,
    customGas: config.customGas ?? undefined!,
    redaction: {
      enabled: config.redaction?.enabled ?? DEFAULT_CONFIG.redaction.enabled,
      builtins: config.redaction?.builtins ?? DEFAULT_CONFIG.redaction.builtins,
      patterns: config.redaction?.patterns ?? [],
      replacement:
        config.redaction?.replacement ?? DEFAULT_CONFIG.redaction.replacement,
    },
    callbacks: config.callbacks ?? {},
    cacheFlushInterval:
      config.cacheFlushInterval ?? DEFAULT_CONFIG.cacheFlushInterval,
    maxRetries: config.maxRetries ?? DEFAULT_CONFIG.maxRetries,
    localCacheLimit: config.localCacheLimit ?? DEFAULT_CONFIG.localCacheLimit,
  } as Required<RuntimeConfig>;
}

/**
 * Get the private key from config in normalized format (no 0x prefix).
 *
 * @param config - Runtime configuration
 * @returns Private key as hex string without 0x prefix
 */
export function getPrivateKey(config: RuntimeConfig): string {
  let key: string;

  if (config.privateKey) {
    key = config.privateKey;
  } else if (config.wallet?.type === "privateKey") {
    key = config.wallet.key;
  } else {
    throw new Error(
      "Cannot get private key: wallet type requires interactive signing"
    );
  }

  return key.startsWith("0x") ? key.slice(2) : key;
}
