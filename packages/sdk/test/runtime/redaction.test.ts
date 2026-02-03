/**
 * Tests for sensitive data redaction.
 *
 * T052-T058: Tests for SSN, CC, API keys, email, custom patterns
 */

import { describe, it, expect } from "vitest";
import {
  redactString,
  redactValue,
  createRedactor,
  createRedactionContext,
  containsSensitiveData,
  getBuiltinPatterns,
  BUILTIN_PATTERNS,
  DEFAULT_REPLACEMENT,
} from "../../src/runtime/redaction.js";
import type { RedactionConfig, RedactionRule } from "../../src/runtime/types.js";

describe("Redaction - SSN pattern", () => {
  it("should redact SSN format XXX-XX-XXXX", () => {
    const input = "My SSN is 123-45-6789";
    const result = redactString(input, [BUILTIN_PATTERNS.ssn]);

    expect(result).toBe("My SSN is [REDACTED]");
    expect(result).not.toContain("123-45-6789");
  });

  it("should redact multiple SSNs", () => {
    const input = "SSN1: 111-22-3333, SSN2: 444-55-6666";
    const result = redactString(input, [BUILTIN_PATTERNS.ssn]);

    expect(result).toBe("SSN1: [REDACTED], SSN2: [REDACTED]");
  });

  it("should not redact non-SSN numbers", () => {
    const input = "Phone: 123-456-7890";
    const result = redactString(input, [BUILTIN_PATTERNS.ssn]);

    expect(result).toBe("Phone: 123-456-7890");
  });
});

describe("Redaction - Credit Card pattern", () => {
  it("should redact credit card with spaces", () => {
    const input = "Card: 4111 1111 1111 1111";
    const result = redactString(input, [BUILTIN_PATTERNS.creditCard]);

    expect(result).toBe("Card: [REDACTED]");
  });

  it("should redact credit card with dashes", () => {
    const input = "Card: 4111-1111-1111-1111";
    const result = redactString(input, [BUILTIN_PATTERNS.creditCard]);

    expect(result).toBe("Card: [REDACTED]");
  });

  it("should redact credit card without separators", () => {
    const input = "Card: 4111111111111111";
    const result = redactString(input, [BUILTIN_PATTERNS.creditCard]);

    expect(result).toBe("Card: [REDACTED]");
  });
});

describe("Redaction - API Key patterns", () => {
  it("should redact payment processor key", () => {
    // Test pattern for payment service keys (generic format)
    const input = "key: payment_live_x1x2x3x4x5x6x7x8x9x0";
    const result = redactString(input, [BUILTIN_PATTERNS.apiKey]);

    expect(result).toBe("key: [REDACTED]");
    expect(result).not.toContain("payment_live");
  });

  it("should redact payment processor test key", () => {
    // Test pattern for payment service keys (generic format)
    const input = "key: payment_test_x1x2x3x4x5x6x7x8x9x0";
    const result = redactString(input, [BUILTIN_PATTERNS.apiKey]);

    expect(result).toBe("key: [REDACTED]");
  });

  it("should redact api_key format", () => {
    const input = "apikey: api_key_1234567890abcdefghij";
    const result = redactString(input, [BUILTIN_PATTERNS.apiKey]);

    expect(result).toBe("apikey: [REDACTED]");
  });

  it("should redact AWS access key", () => {
    const input = "AWS key: AKIAIOSFODNN7EXAMPLE";
    const result = redactString(input, [BUILTIN_PATTERNS.awsKey]);

    expect(result).toBe("AWS key: [REDACTED]");
  });
});

describe("Redaction - Email pattern", () => {
  it("should redact email addresses", () => {
    const input = "Contact: user@example.com";
    const result = redactString(input, [BUILTIN_PATTERNS.email]);

    expect(result).toBe("Contact: [REDACTED]");
  });

  it("should redact multiple emails", () => {
    const input = "From: a@b.com To: c@d.org";
    const result = redactString(input, [BUILTIN_PATTERNS.email]);

    expect(result).toBe("From: [REDACTED] To: [REDACTED]");
  });

  it("should handle complex email formats", () => {
    const input = "Email: test.user+tag@sub.example.co.uk";
    const result = redactString(input, [BUILTIN_PATTERNS.email]);

    expect(result).toBe("Email: [REDACTED]");
  });
});

describe("Redaction - Custom patterns", () => {
  it("should apply custom regex patterns", () => {
    const customRule: RedactionRule = {
      name: "internal-id",
      pattern: /INTERNAL_\w+/g,
    };

    const input = "ID: INTERNAL_SECRET_123";
    const result = redactString(input, [customRule]);

    expect(result).toBe("ID: [REDACTED]");
  });

  it("should use custom replacement text", () => {
    const customRule: RedactionRule = {
      name: "custom",
      pattern: /SECRET/g,
      replacement: "***HIDDEN***",
    };

    const input = "The SECRET is hidden";
    const result = redactString(input, [customRule]);

    expect(result).toBe("The ***HIDDEN*** is hidden");
  });

  it("should combine built-in and custom patterns", () => {
    const customRule: RedactionRule = {
      name: "project-id",
      pattern: /PRJ-\d+/g,
    };

    const patterns = [BUILTIN_PATTERNS.email, customRule];
    const input = "User test@example.com on PRJ-12345";
    const result = redactString(input, patterns);

    expect(result).toBe("User [REDACTED] on [REDACTED]");
  });
});

describe("Redaction - Before signing", () => {
  it("should redact args before they could be signed", () => {
    const args = [
      "normal arg",
      { ssn: "123-45-6789", name: "John" },
      "card: 4111111111111111",
    ];

    const patterns = getBuiltinPatterns();
    const redacted = redactValue(args, patterns);

    expect(redacted[0]).toBe("normal arg");
    expect((redacted[1] as any).ssn).toBe("[REDACTED]");
    expect((redacted[1] as any).name).toBe("John");
    expect(redacted[2]).toBe("card: [REDACTED]");
  });

  it("should redact results before they could be signed", () => {
    const result = {
      user: {
        email: "user@example.com",
        id: 123,
      },
      token: "payment_live_x1x2x3x4x5x6x7x8x9x0",
    };

    const patterns = getBuiltinPatterns();
    const redacted = redactValue(result, patterns);

    expect((redacted as any).user.email).toBe("[REDACTED]");
    expect((redacted as any).user.id).toBe(123);
    expect((redacted as any).token).toBe("[REDACTED]");
  });

  it("should never persist original sensitive data", () => {
    const sensitiveData = {
      ssn: "123-45-6789",
      card: "4111111111111111",
      email: "secret@company.com",
    };

    const context = createRedactionContext({ enabled: true, builtins: true });
    const redacted = context.redact(sensitiveData);

    // Original data should not appear in redacted version
    const redactedString = JSON.stringify(redacted);
    expect(redactedString).not.toContain("123-45-6789");
    expect(redactedString).not.toContain("4111111111111111");
    expect(redactedString).not.toContain("secret@company.com");
  });
});

describe("Redaction - Disabled", () => {
  it("should not redact when disabled", () => {
    const config: RedactionConfig = {
      enabled: false,
      builtins: true,
    };

    const redactor = createRedactor(config);
    const input = "SSN: 123-45-6789";
    const result = redactor(input);

    expect(result).toBe(input);
  });

  it("should return input unchanged when disabled", () => {
    const context = createRedactionContext({ enabled: false });
    const sensitive = { ssn: "123-45-6789" };

    const result = context.redact(sensitive);

    expect(result).toEqual(sensitive);
  });
});

describe("Redaction - Deep traversal", () => {
  it("should redact nested objects", () => {
    const data = {
      level1: {
        level2: {
          level3: {
            ssn: "123-45-6789",
          },
        },
      },
    };

    const result = redactValue(data, getBuiltinPatterns());

    expect((result as any).level1.level2.level3.ssn).toBe("[REDACTED]");
  });

  it("should redact arrays within objects", () => {
    const data = {
      users: [
        { email: "a@b.com" },
        { email: "c@d.com" },
      ],
    };

    const result = redactValue(data, getBuiltinPatterns());

    expect((result as any).users[0].email).toBe("[REDACTED]");
    expect((result as any).users[1].email).toBe("[REDACTED]");
  });

  it("should handle null and undefined", () => {
    const data = {
      value: null,
      other: undefined,
      ssn: "123-45-6789",
    };

    const result = redactValue(data, getBuiltinPatterns());

    expect((result as any).value).toBeNull();
    expect((result as any).other).toBeUndefined();
    expect((result as any).ssn).toBe("[REDACTED]");
  });
});

describe("Redaction - containsSensitiveData", () => {
  it("should detect SSN in string", () => {
    expect(containsSensitiveData("SSN: 123-45-6789")).toBe(true);
  });

  it("should detect email in object", () => {
    expect(containsSensitiveData({ email: "test@example.com" })).toBe(true);
  });

  it("should detect sensitive data in nested structure", () => {
    const data = {
      user: {
        details: {
          card: "4111111111111111",
        },
      },
    };
    expect(containsSensitiveData(data)).toBe(true);
  });

  it("should return false for clean data", () => {
    expect(containsSensitiveData({ name: "John", age: 30 })).toBe(false);
  });
});
