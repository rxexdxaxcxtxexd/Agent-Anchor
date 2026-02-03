# Agent-Anchor-main Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-01-31

## Active Technologies
- TypeScript 5.x (targeting ES2022+, Node.js 18+) + ethers.js v6 (existing), @noble/secp256k1 (signing), idb (IndexedDB wrapper) (002-runtime-wrapper)
- IndexedDB (browser), filesystem JSON (Node.js) for signed records cache (002-runtime-wrapper)

- Solidity ^0.8.20 (contracts), TypeScript 5.x (SDK) + OpenZeppelin Contracts, ethers.js v6, Hardhat, Vitest (001-trace-linking)

## Project Structure

```text
src/
tests/
```

## Commands

npm test; npm run lint

## Code Style

Solidity ^0.8.20 (contracts), TypeScript 5.x (SDK): Follow standard conventions

## Recent Changes
- 002-runtime-wrapper: Added TypeScript 5.x (targeting ES2022+, Node.js 18+) + ethers.js v6 (existing), @noble/secp256k1 (signing), idb (IndexedDB wrapper)

- 001-trace-linking: Added Solidity ^0.8.20 (contracts), TypeScript 5.x (SDK) + OpenZeppelin Contracts, ethers.js v6, Hardhat, Vitest

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
