/**
 * Sensitive data redaction for traces.
 *
 * Provides built-in and custom pattern matching to scrub PII,
 * credentials, and other sensitive data before signing/anchoring.
 */

import type { RedactionConfig, RedactionRule } from "./types.js";

/**
 * Built-in redaction patterns for common sensitive data.
 */
export const BUILTIN_PATTERNS: Record<string, RedactionRule> = {
  // Social Security Numbers (US)
  ssn: {
    name: "ssn",
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
  },

  // Credit Card Numbers (major formats)
  creditCard: {
    name: "creditCard",
    pattern: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g,
  },

  // API Keys (common prefixes including payment processors)
  apiKey: {
    name: "apiKey",
    pattern: /\b(payment_live_|payment_test_|api[_-]?key[_-]?)[a-zA-Z0-9]{10,}\b/gi,
  },

  // AWS Access Keys
  awsKey: {
    name: "awsKey",
    pattern: /\b(AKIA|ABIA|ACCA|ASIA)[A-Z0-9]{16}\b/g,
  },

  // AWS Secret Keys (40 char base64)
  awsSecret: {
    name: "awsSecret",
    pattern: /\b[A-Za-z0-9/+=]{40}\b/g,
  },

  // Email Addresses
  email: {
    name: "email",
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  },

  // Phone Numbers (international and US formats)
  phone: {
    name: "phone",
    pattern: /\b(\+\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}\b/g,
  },

  // JWT Tokens
  jwt: {
    name: "jwt",
    pattern: /\beyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\b/g,
  },

  // Bearer Tokens
  bearer: {
    name: "bearer",
    pattern: /\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b/gi,
  },

  // Private Keys (PEM format start)
  privateKey: {
    name: "privateKey",
    pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(RSA\s+)?PRIVATE\s+KEY-----/g,
  },

  // Passwords in common formats
  password: {
    name: "password",
    pattern: /\b(password|passwd|pwd|secret)[=:]\s*["']?[^\s"']+["']?\b/gi,
  },

  // IP Addresses (IPv4)
  ipv4: {
    name: "ipv4",
    pattern: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
  },

  // Ethereum Private Keys (64 hex chars)
  ethPrivateKey: {
    name: "ethPrivateKey",
    pattern: /\b(0x)?[0-9a-fA-F]{64}\b/g,
  },
};

/**
 * Default replacement string.
 */
export const DEFAULT_REPLACEMENT = "[REDACTED]";

/**
 * Get all built-in patterns as an array.
 */
export function getBuiltinPatterns(): RedactionRule[] {
  return Object.values(BUILTIN_PATTERNS);
}

/**
 * Redact sensitive data from a string.
 *
 * @param value - The string to redact
 * @param patterns - Patterns to match
 * @param replacement - Replacement string
 * @returns Redacted string
 */
export function redactString(
  value: string,
  patterns: RedactionRule[],
  replacement: string = DEFAULT_REPLACEMENT
): string {
  let result = value;

  for (const rule of patterns) {
    // Reset lastIndex for global patterns
    if (rule.pattern.global) {
      rule.pattern.lastIndex = 0;
    }

    // Create a new RegExp to avoid state issues
    const pattern = new RegExp(rule.pattern.source, rule.pattern.flags);
    result = result.replace(pattern, rule.replacement ?? replacement);
  }

  return result;
}

/**
 * Redact sensitive data from any value (deep traversal).
 *
 * Handles strings, arrays, and objects recursively.
 *
 * @param value - The value to redact
 * @param patterns - Patterns to match
 * @param replacement - Replacement string
 * @returns Redacted value (same type as input)
 */
export function redactValue<T>(
  value: T,
  patterns: RedactionRule[],
  replacement: string = DEFAULT_REPLACEMENT
): T {
  if (value === null || value === undefined) {
    return value;
  }

  // Handle strings
  if (typeof value === "string") {
    return redactString(value, patterns, replacement) as T;
  }

  // Handle arrays
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, patterns, replacement)) as T;
  }

  // Handle objects
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = redactValue(val, patterns, replacement);
    }

    return result as T;
  }

  // Primitives (numbers, booleans) pass through
  return value;
}

/**
 * Create a redaction function from configuration.
 *
 * @param config - Redaction configuration
 * @returns Function to redact values
 */
export function createRedactor(
  config: RedactionConfig
): <T>(value: T) => T {
  if (!config.enabled) {
    // Return identity function if disabled
    return <T>(value: T) => value;
  }

  // Collect patterns
  const patterns: RedactionRule[] = [];

  // Add built-in patterns if enabled
  if (config.builtins !== false) {
    patterns.push(...getBuiltinPatterns());
  }

  // Add custom patterns
  if (config.patterns) {
    patterns.push(...config.patterns);
  }

  const replacement = config.replacement ?? DEFAULT_REPLACEMENT;

  // Return redaction function
  return <T>(value: T): T => redactValue(value, patterns, replacement);
}

/**
 * Redaction context for use in the wrapper.
 */
export class RedactionContext {
  private redactor: <T>(value: T) => T;
  private enabled: boolean;

  constructor(config?: RedactionConfig) {
    const effectiveConfig: RedactionConfig = {
      enabled: config?.enabled ?? true,
      builtins: config?.builtins ?? true,
      patterns: config?.patterns ?? [],
      replacement: config?.replacement ?? DEFAULT_REPLACEMENT,
    };

    this.enabled = effectiveConfig.enabled ?? true;
    this.redactor = createRedactor(effectiveConfig);
  }

  /**
   * Check if redaction is enabled.
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Redact a value.
   */
  redact<T>(value: T): T {
    return this.redactor(value);
  }

  /**
   * Redact arguments array.
   */
  redactArgs(args: unknown[]): unknown[] {
    return this.redactor(args);
  }

  /**
   * Redact a result value.
   */
  redactResult<T>(result: T): T {
    return this.redactor(result);
  }

  /**
   * Redact an error message.
   */
  redactError(message: string): string {
    return this.redactor(message);
  }
}

/**
 * Create a redaction context from configuration.
 */
export function createRedactionContext(
  config?: RedactionConfig
): RedactionContext {
  return new RedactionContext(config);
}

/**
 * Test if a value contains sensitive data.
 *
 * Useful for validation/testing purposes.
 *
 * @param value - Value to check
 * @param patterns - Patterns to test against (defaults to built-ins)
 * @returns true if sensitive data is detected
 */
export function containsSensitiveData(
  value: unknown,
  patterns: RedactionRule[] = getBuiltinPatterns()
): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "string") {
    for (const rule of patterns) {
      // Reset lastIndex for global patterns
      const pattern = new RegExp(rule.pattern.source, rule.pattern.flags);
      if (pattern.test(value)) {
        return true;
      }
    }
    return false;
  }

  if (Array.isArray(value)) {
    return value.some((item) => containsSensitiveData(item, patterns));
  }

  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((val) =>
      containsSensitiveData(val, patterns)
    );
  }

  return false;
}
