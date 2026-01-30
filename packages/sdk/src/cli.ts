#!/usr/bin/env node
/**
 * Agent Anchor CLI
 *
 * Command-line interface for anchoring and verifying AI agent traces.
 */

import { Command } from "commander";
import { readFileSync, existsSync } from "fs";
import { AgentAnchorClient } from "./client.js";
import { validateTrace, hashTrace, getGranularityLabel } from "./utils.js";
import type { Network, AgentTrace, Granularity } from "./types.js";

const program = new Command();

// Output formatting helpers
function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

function formatHuman(label: string, value: string | number | boolean): void {
  console.log(`  ${label}: ${value}`);
}

program
  .name("agent-anchor")
  .description("CLI for anchoring and verifying AI agent traces on-chain")
  .version("0.1.0")
  .option("-j, --json", "Output as JSON")
  .option("-q, --quiet", "Suppress non-essential output");

// Anchor command
program
  .command("anchor <trace-file>")
  .description("Anchor a trace file to IPFS and blockchain")
  .option("-n, --network <network>", "Target network", "base-testnet")
  .option("-g, --granularity <level>", "Trace granularity (session|task|step)", "session")
  .option("-a, --agent-id <id>", "Override agent identifier from trace")
  .option("--ipfs-uri <uri>", "Use existing IPFS URI instead of uploading")
  .option("--dry-run", "Simulate without submitting transaction")
  .option("--private-key <key>", "Private key for signing (or use PRIVATE_KEY env)")
  .option("--ipfs-token <token>", "IPFS API token (or use WEB3_STORAGE_TOKEN env)")
  .action(async (traceFile: string, options) => {
    try {
      // Read and parse trace file
      if (!existsSync(traceFile)) {
        console.error(`Error: Trace file not found: ${traceFile}`);
        process.exit(1);
      }

      const traceContent = readFileSync(traceFile, "utf-8");
      let trace: AgentTrace;

      try {
        trace = JSON.parse(traceContent);
      } catch {
        console.error("Error: Invalid JSON in trace file");
        process.exit(1);
      }

      // Apply CLI overrides
      if (options.agentId) {
        trace.agentId = options.agentId;
      }

      if (options.granularity) {
        const granMap: Record<string, Granularity> = {
          session: 0,
          task: 1,
          step: 2,
        };
        trace.granularity = granMap[options.granularity.toLowerCase()] ?? 0;
      }

      // Validate trace
      const validation = validateTrace(trace);
      if (!validation.valid) {
        console.error(`Error: Invalid trace - ${validation.error}`);
        process.exit(1);
      }

      // Get credentials
      const privateKey = options.privateKey || process.env.PRIVATE_KEY;
      if (!privateKey) {
        console.error("Error: Private key required. Use --private-key or set PRIVATE_KEY env");
        process.exit(1);
      }

      const ipfsToken = options.ipfsToken || process.env.WEB3_STORAGE_TOKEN;
      if (!ipfsToken && !options.ipfsUri && !options.dryRun) {
        console.error(
          "Error: IPFS token required for upload. Use --ipfs-token, --ipfs-uri, or set WEB3_STORAGE_TOKEN env"
        );
        process.exit(1);
      }

      // Create client
      const client = new AgentAnchorClient({
        network: options.network as Network,
        privateKey,
        ipfsApiToken: ipfsToken,
        mockIpfs: options.dryRun && !options.ipfsUri,
      });

      // Show pre-anchor info
      if (!program.opts().quiet) {
        console.log("\nAnchoring trace...");
        formatHuman("Network", options.network);
        formatHuman("Trace Hash", hashTrace(trace));
        formatHuman("Agent ID", trace.agentId);
        formatHuman("Granularity", getGranularityLabel(trace.granularity));
        if (options.dryRun) {
          console.log("  Mode: DRY RUN (no transaction will be submitted)");
        }
        console.log("");
      }

      // Anchor the trace
      const result = await client.anchorTrace(trace, {
        ipfsUri: options.ipfsUri,
        dryRun: options.dryRun,
      });

      // Output result
      if (program.opts().json) {
        console.log(formatJson(result));
      } else {
        console.log("Anchor successful!");
        formatHuman("Transaction", result.transactionHash);
        formatHuman("Block", result.blockNumber);
        formatHuman("Trace Hash", result.traceHash);
        formatHuman("IPFS URI", result.ipfsUri);
        formatHuman("Gas Used", result.gasUsed.toString());
      }
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : error}`);
      process.exit(1);
    }
  });

// Verify command
program
  .command("verify <trace-hash>")
  .description("Verify a trace anchor on-chain")
  .option("-n, --network <network>", "Target network", "base-testnet")
  .option("--full", "Fetch and verify full IPFS content")
  .option("--rpc-url <url>", "Custom RPC URL")
  .option("--contract <address>", "Custom contract address")
  .action(async (traceHash: string, options) => {
    try {
      const client = new AgentAnchorClient({
        network: options.network as Network,
        rpcUrl: options.rpcUrl,
        contractAddress: options.contract,
      });

      if (!program.opts().quiet) {
        console.log("\nVerifying trace...");
        formatHuman("Network", options.network);
        formatHuman("Trace Hash", traceHash);
        console.log("");
      }

      const result = await client.verifyTrace(traceHash, {
        full: options.full,
      });

      if (program.opts().json) {
        console.log(formatJson(result));
      } else {
        if (result.exists) {
          console.log("Anchor FOUND");
          formatHuman("IPFS URI", result.anchor!.ipfsUri);
          formatHuman("Creator", result.anchor!.creator);
          formatHuman("Timestamp", new Date(result.anchor!.timestamp * 1000).toISOString());

          if (options.full) {
            formatHuman("Hash Matches", result.hashMatches ? "YES" : "NO");
            if (result.error) {
              formatHuman("Warning", result.error);
            }
          }
        } else {
          console.log("Anchor NOT FOUND");
          console.log("  This trace hash has not been anchored on-chain.");
        }
      }
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : error}`);
      process.exit(1);
    }
  });

// List command
program
  .command("list")
  .description("List traces by agent or creator")
  .option("-n, --network <network>", "Target network", "base-testnet")
  .option("--agent <agent-id>", "Filter by agent ID")
  .option("--creator <address>", "Filter by creator address")
  .option("--rpc-url <url>", "Custom RPC URL")
  .option("--contract <address>", "Custom contract address")
  .action(async (options) => {
    try {
      if (!options.agent && !options.creator) {
        console.error("Error: Must specify --agent or --creator");
        process.exit(1);
      }

      const client = new AgentAnchorClient({
        network: options.network as Network,
        rpcUrl: options.rpcUrl,
        contractAddress: options.contract,
      });

      let traces: string[] = [];
      let label = "";

      if (options.agent) {
        traces = await client.getTracesByAgent(options.agent);
        label = `Agent: ${options.agent}`;
      }
      // Note: getTracesByCreator would need to be added to client

      if (program.opts().json) {
        console.log(formatJson({ traces, count: traces.length }));
      } else {
        console.log(`\nTraces for ${label}`);
        console.log(`Found ${traces.length} trace(s)\n`);

        if (traces.length === 0) {
          console.log("  No traces found.");
        } else {
          traces.forEach((hash, i) => {
            console.log(`  ${i + 1}. ${hash}`);
          });
        }
      }
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : error}`);
      process.exit(1);
    }
  });

// Hash command (utility)
program
  .command("hash <trace-file>")
  .description("Compute the hash of a trace file without anchoring")
  .action((traceFile: string) => {
    try {
      if (!existsSync(traceFile)) {
        console.error(`Error: Trace file not found: ${traceFile}`);
        process.exit(1);
      }

      const traceContent = readFileSync(traceFile, "utf-8");
      const trace = JSON.parse(traceContent);
      const hash = hashTrace(trace);

      if (program.opts().json) {
        console.log(formatJson({ hash }));
      } else {
        console.log(`Trace Hash: ${hash}`);
      }
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : error}`);
      process.exit(1);
    }
  });

// Validate command (utility)
program
  .command("validate <trace-file>")
  .description("Validate a trace file structure")
  .action((traceFile: string) => {
    try {
      if (!existsSync(traceFile)) {
        console.error(`Error: Trace file not found: ${traceFile}`);
        process.exit(1);
      }

      const traceContent = readFileSync(traceFile, "utf-8");
      let trace;

      try {
        trace = JSON.parse(traceContent);
      } catch {
        console.error("Error: Invalid JSON");
        process.exit(1);
      }

      const result = validateTrace(trace);

      if (program.opts().json) {
        console.log(formatJson(result));
      } else {
        if (result.valid) {
          console.log("Trace is VALID");
          formatHuman("Version", trace.version);
          formatHuman("Trace ID", trace.traceId);
          formatHuman("Agent ID", trace.agentId);
          formatHuman("Granularity", getGranularityLabel(trace.granularity));
        } else {
          console.log("Trace is INVALID");
          formatHuman("Error", result.error || "Unknown error");
          process.exit(1);
        }
      }
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : error}`);
      process.exit(1);
    }
  });

program.parse();
