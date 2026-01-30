/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  env: {
    es2020: true,
    node: true,
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "prettier",
  ],
  rules: {
    // TypeScript strict rules
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/no-misused-promises": "error",
    "@typescript-eslint/await-thenable": "error",

    // General rules
    "no-console": ["warn", { allow: ["warn", "error"] }],
    "prefer-const": "error",
    "no-var": "error",
    eqeqeq: ["error", "always"],
  },
  overrides: [
    {
      files: ["**/*.test.ts", "**/*.spec.ts"],
      env: {
        mocha: true,
      },
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
        "no-console": "off",
      },
    },
    {
      files: ["hardhat.config.ts", "scripts/**/*.ts"],
      rules: {
        "no-console": "off",
      },
    },
  ],
  ignorePatterns: [
    "node_modules",
    "dist",
    "coverage",
    "artifacts",
    "cache",
    "typechain-types",
    "*.js",
    "*.cjs",
    "*.mjs",
  ],
};
