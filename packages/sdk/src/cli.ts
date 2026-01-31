#!/usr/bin/env node
/**
 * Agent Anchor CLI
 *
 * Command-line interface for anchoring and verifying AI agent traces.
 * Supports V1 and V2 (ownership layer) operations.
 */

import { Command } from "commander";
import { readFileSync, existsSync } from "fs";
import { AgentAnchorClient } from "./client.js";
import { AgentAnchorClientV2 } from "./clientV2.js";
import { validateTrace, hashTrace, getGranularityLabel } from "./utils.js";
import { commitShaToBytes32, extractGitMetadata } from "./git.js";
import { getDeclarationTypeLabel, parseDeclarationType } from "./authorship.js";
import { getContributionDescription } from "./contribution.js";
import type { Network, AgentTrace, Granularity, DeclarationType } from "./types.js";

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
      } else if (options.creator) {
        traces = await client.getTracesByCreator(options.creator);
        label = `Creator: ${options.creator}`;
      }

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

// ============ V2 Commands (Ownership Layer) ============

// Anchor V2 command with ownership options
program
  .command("anchor-v2 <trace-file>")
  .description("Anchor a trace with V2 ownership layer features")
  .option("-n, --network <network>", "Target network", "base-testnet")
  .option("-g, --granularity <level>", "Trace granularity (session|task|step)", "session")
  .option("-a, --agent-id <id>", "Override agent identifier from trace")
  .option("--ipfs-uri <uri>", "Use existing IPFS URI instead of uploading")
  .option("--dry-run", "Simulate without submitting transaction")
  .option("--private-key <key>", "Private key for signing (or use PRIVATE_KEY env)")
  .option("--ipfs-token <token>", "IPFS API token (or use WEB3_STORAGE_TOKEN env)")
  .option("--identity", "Bind identity with EIP-712 signature after anchoring")
  .option("--git", "Auto-detect and set git metadata from current repository")
  .option("--git-commit <sha>", "Manual git commit SHA (40 hex chars)")
  .option("--git-branch <branch>", "Git branch name")
  .option("--git-repo <repo>", "Git repository (e.g., org/repo)")
  .option("--authorship <type>", "Declare authorship (sole|joint|co)")
  .option("--contribution <ratio>", "Set contribution ratio (e.g., 70/30 for 70% human, 30% AI)")
  .option("--contribution-notes <notes>", "Notes for contribution calculation")
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

      // Create V2 client
      const client = new AgentAnchorClientV2({
        network: options.network as Network,
        privateKey,
        ipfsApiToken: ipfsToken,
        mockIpfs: options.dryRun && !options.ipfsUri,
      });

      // Show pre-anchor info
      if (!program.opts().quiet) {
        console.log("\nAnchoring trace (V2)...");
        formatHuman("Network", options.network);
        formatHuman("Trace Hash", hashTrace(trace));
        formatHuman("Agent ID", trace.agentId);
        formatHuman("Granularity", getGranularityLabel(trace.granularity));
        if (options.identity) formatHuman("Identity Binding", "Enabled");
        if (options.git || options.gitCommit) formatHuman("Git Metadata", "Enabled");
        if (options.authorship) formatHuman("Authorship", options.authorship);
        if (options.contribution) formatHuman("Contribution", options.contribution);
        if (options.dryRun) {
          console.log("  Mode: DRY RUN (no transaction will be submitted)");
        }
        console.log("");
      }

      // Step 1: Anchor the trace
      const result = await client.anchorTrace(trace, {
        ipfsUri: options.ipfsUri,
        dryRun: options.dryRun,
      });

      if (!program.opts().quiet) {
        console.log("Anchor successful!");
        formatHuman("Transaction", result.transactionHash);
        formatHuman("Block", result.blockNumber);
        formatHuman("Trace Hash", result.traceHash);
        formatHuman("IPFS URI", result.ipfsUri);
      }

      // Step 2: Bind identity if requested
      if (options.identity && !options.dryRun) {
        if (!program.opts().quiet) console.log("\nBinding identity...");
        const identityResult = await client.bindIdentity(result.traceHash);
        if (!program.opts().quiet) {
          console.log("Identity bound!");
          formatHuman("Signer", identityResult.signer);
        }
      }

      // Step 3: Set git metadata if requested
      if ((options.git || options.gitCommit) && !options.dryRun) {
        if (!program.opts().quiet) console.log("\nSetting git metadata...");

        let commitSha: string;
        let branch = options.gitBranch || "";
        let repo = options.gitRepo || "";

        if (options.git) {
          // Auto-detect git info
          try {
            const gitInfo = await extractGitMetadata();
            commitSha = commitShaToBytes32(gitInfo.commitSha);
            branch = gitInfo.branch || branch;
            repo = gitInfo.repository || repo;
          } catch (e) {
            console.error("Warning: Could not auto-detect git info, using manual values");
            if (!options.gitCommit) {
              console.error("Error: Git commit SHA required when auto-detect fails");
              process.exit(1);
            }
            commitSha = commitShaToBytes32(options.gitCommit);
          }
        } else {
          commitSha = commitShaToBytes32(options.gitCommit);
        }

        const gitResult = await client.setGitMetadata(result.traceHash, commitSha, branch, repo);
        if (!program.opts().quiet) {
          console.log("Git metadata set!");
          formatHuman("Commit SHA", gitResult.commitSha);
          if (branch) formatHuman("Branch", branch);
          if (repo) formatHuman("Repository", repo);
        }
      }

      // Step 4: Declare authorship if requested
      if (options.authorship && !options.dryRun) {
        if (!program.opts().quiet) console.log("\nDeclaring authorship...");
        const declType = parseDeclarationType(options.authorship);
        const authResult = await client.declareAuthorship(result.traceHash, declType);
        if (!program.opts().quiet) {
          console.log("Authorship declared!");
          formatHuman("Type", getDeclarationTypeLabel(authResult.declarationType));
          formatHuman("Claimant", authResult.claimant);
        }
      }

      // Step 5: Set contribution if requested
      if (options.contribution && !options.dryRun) {
        if (!program.opts().quiet) console.log("\nSetting contribution ratio...");
        const [humanStr, aiStr] = options.contribution.split(/[/-]/);
        const humanPercent = parseInt(humanStr, 10);
        const aiPercent = parseInt(aiStr, 10);

        if (isNaN(humanPercent) || isNaN(aiPercent) || humanPercent + aiPercent !== 100) {
          console.error("Error: Invalid contribution format. Use format like 70/30 or 70-30");
          process.exit(1);
        }

        const contribResult = await client.setContribution(
          result.traceHash,
          humanPercent,
          aiPercent,
          options.contributionNotes || ""
        );
        if (!program.opts().quiet) {
          console.log("Contribution set!");
          formatHuman("Human", `${contribResult.humanPercent}%`);
          formatHuman("AI", `${contribResult.aiPercent}%`);
        }
      }

      // Final JSON output if requested
      if (program.opts().json) {
        console.log(formatJson(result));
      } else if (!program.opts().quiet) {
        console.log("\nV2 anchoring complete!");
      }
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : error}`);
      process.exit(1);
    }
  });

// Verify V2 command with ownership info
program
  .command("verify-v2 <trace-hash>")
  .description("Verify a trace anchor and show V2 ownership information")
  .option("-n, --network <network>", "Target network", "base-testnet")
  .option("--rpc-url <url>", "Custom RPC URL")
  .option("--contract <address>", "Custom contract address")
  .action(async (traceHash: string, options) => {
    try {
      const client = new AgentAnchorClientV2({
        network: options.network as Network,
        rpcUrl: options.rpcUrl,
        contractAddress: options.contract,
      });

      if (!program.opts().quiet) {
        console.log("\nVerifying trace (V2)...");
        formatHuman("Network", options.network);
        formatHuman("Trace Hash", traceHash);
        console.log("");
      }

      // Get complete ownership record
      const record = await client.getOwnershipRecord(traceHash);

      if (program.opts().json) {
        console.log(formatJson(record));
      } else {
        if (record.anchorTimestamp === 0) {
          console.log("Anchor NOT FOUND");
          console.log("  This trace hash has not been anchored on-chain.");
        } else {
          console.log("Anchor FOUND");
          console.log("\n--- Basic Info ---");
          formatHuman("Creator", record.creator);
          formatHuman("Timestamp", new Date(record.anchorTimestamp * 1000).toISOString());

          console.log("\n--- Identity Binding ---");
          if (record.hasIdentity) {
            formatHuman("Status", "Verified");
            formatHuman("Signer", record.identitySigner);
          } else {
            formatHuman("Status", "Not bound");
          }

          console.log("\n--- Git Metadata ---");
          if (record.hasGitMetadata) {
            formatHuman("Status", "Set");
            formatHuman("Commit SHA", record.commitSha);
          } else {
            formatHuman("Status", "Not set");
          }

          console.log("\n--- Authorship ---");
          if (record.hasOwnership) {
            formatHuman("Status", "Claimed");
            formatHuman("Claimant", record.claimant);
            formatHuman("Type", getDeclarationTypeLabel(record.declarationType));
          } else {
            formatHuman("Status", "Not claimed");
          }

          console.log("\n--- Contribution ---");
          if (record.humanPercent > 0 || record.aiPercent > 0) {
            formatHuman("Human", `${record.humanPercent}%`);
            formatHuman("AI", `${record.aiPercent}%`);
            formatHuman("Description", getContributionDescription(record.humanPercent));
          } else {
            formatHuman("Status", "Not set");
          }
        }
      }
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : error}`);
      process.exit(1);
    }
  });

// Set identity command
program
  .command("set-identity <trace-hash>")
  .description("Bind identity to an existing trace with EIP-712 signature")
  .option("-n, --network <network>", "Target network", "base-testnet")
  .option("--private-key <key>", "Private key for signing (or use PRIVATE_KEY env)")
  .option("--contract <address>", "Custom contract address")
  .action(async (traceHash: string, options) => {
    try {
      const privateKey = options.privateKey || process.env.PRIVATE_KEY;
      if (!privateKey) {
        console.error("Error: Private key required");
        process.exit(1);
      }

      const client = new AgentAnchorClientV2({
        network: options.network as Network,
        privateKey,
        contractAddress: options.contract,
      });

      if (!program.opts().quiet) {
        console.log("\nBinding identity...");
      }

      const result = await client.bindIdentity(traceHash);

      if (program.opts().json) {
        console.log(formatJson(result));
      } else {
        console.log("Identity bound successfully!");
        formatHuman("Transaction", result.transactionHash);
        formatHuman("Signer", result.signer);
      }
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : error}`);
      process.exit(1);
    }
  });

// Set git metadata command
program
  .command("set-git <trace-hash>")
  .description("Set git metadata for an existing trace")
  .option("-n, --network <network>", "Target network", "base-testnet")
  .option("--private-key <key>", "Private key for signing (or use PRIVATE_KEY env)")
  .option("--contract <address>", "Custom contract address")
  .option("--auto", "Auto-detect git info from current repository")
  .option("--commit <sha>", "Git commit SHA (40 hex chars)")
  .option("--branch <branch>", "Git branch name")
  .option("--repo <repo>", "Git repository (e.g., org/repo)")
  .action(async (traceHash: string, options) => {
    try {
      const privateKey = options.privateKey || process.env.PRIVATE_KEY;
      if (!privateKey) {
        console.error("Error: Private key required");
        process.exit(1);
      }

      if (!options.auto && !options.commit) {
        console.error("Error: Must specify --auto or --commit");
        process.exit(1);
      }

      const client = new AgentAnchorClientV2({
        network: options.network as Network,
        privateKey,
        contractAddress: options.contract,
      });

      let commitSha: string;
      let branch = options.branch || "";
      let repo = options.repo || "";

      if (options.auto) {
        const gitInfo = await extractGitMetadata();
        commitSha = commitShaToBytes32(gitInfo.commitSha);
        branch = gitInfo.branch || branch;
        repo = gitInfo.repository || repo;
      } else {
        commitSha = commitShaToBytes32(options.commit);
      }

      if (!program.opts().quiet) {
        console.log("\nSetting git metadata...");
      }

      const result = await client.setGitMetadata(traceHash, commitSha, branch, repo);

      if (program.opts().json) {
        console.log(formatJson(result));
      } else {
        console.log("Git metadata set successfully!");
        formatHuman("Transaction", result.transactionHash);
        formatHuman("Commit SHA", result.commitSha);
        if (branch) formatHuman("Branch", branch);
        if (repo) formatHuman("Repository", repo);
      }
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : error}`);
      process.exit(1);
    }
  });

// Declare authorship command
program
  .command("declare-authorship <trace-hash> <type>")
  .description("Declare authorship of a trace (type: sole, joint, or co)")
  .option("-n, --network <network>", "Target network", "base-testnet")
  .option("--private-key <key>", "Private key for signing (or use PRIVATE_KEY env)")
  .option("--contract <address>", "Custom contract address")
  .action(async (traceHash: string, type: string, options) => {
    try {
      const privateKey = options.privateKey || process.env.PRIVATE_KEY;
      if (!privateKey) {
        console.error("Error: Private key required");
        process.exit(1);
      }

      const declType = parseDeclarationType(type);

      const client = new AgentAnchorClientV2({
        network: options.network as Network,
        privateKey,
        contractAddress: options.contract,
      });

      if (!program.opts().quiet) {
        console.log("\nDeclaring authorship...");
      }

      const result = await client.declareAuthorship(traceHash, declType);

      if (program.opts().json) {
        console.log(formatJson(result));
      } else {
        console.log("Authorship declared successfully!");
        formatHuman("Transaction", result.transactionHash);
        formatHuman("Type", getDeclarationTypeLabel(result.declarationType));
        formatHuman("Claimant", result.claimant);
      }
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : error}`);
      process.exit(1);
    }
  });

// Set contribution command
program
  .command("set-contribution <trace-hash> <human> <ai>")
  .description("Set contribution ratio (human and ai percentages must sum to 100)")
  .option("-n, --network <network>", "Target network", "base-testnet")
  .option("--private-key <key>", "Private key for signing (or use PRIVATE_KEY env)")
  .option("--contract <address>", "Custom contract address")
  .option("--notes <notes>", "Notes explaining the contribution calculation")
  .action(async (traceHash: string, humanStr: string, aiStr: string, options) => {
    try {
      const privateKey = options.privateKey || process.env.PRIVATE_KEY;
      if (!privateKey) {
        console.error("Error: Private key required");
        process.exit(1);
      }

      const humanPercent = parseInt(humanStr, 10);
      const aiPercent = parseInt(aiStr, 10);

      if (isNaN(humanPercent) || isNaN(aiPercent)) {
        console.error("Error: Percentages must be numbers");
        process.exit(1);
      }

      if (humanPercent + aiPercent !== 100) {
        console.error("Error: Percentages must sum to 100");
        process.exit(1);
      }

      const client = new AgentAnchorClientV2({
        network: options.network as Network,
        privateKey,
        contractAddress: options.contract,
      });

      if (!program.opts().quiet) {
        console.log("\nSetting contribution ratio...");
      }

      const result = await client.setContribution(
        traceHash,
        humanPercent,
        aiPercent,
        options.notes || ""
      );

      if (program.opts().json) {
        console.log(formatJson(result));
      } else {
        console.log("Contribution set successfully!");
        formatHuman("Transaction", result.transactionHash);
        formatHuman("Human", `${result.humanPercent}%`);
        formatHuman("AI", `${result.aiPercent}%`);
        formatHuman("Description", getContributionDescription(result.humanPercent));
      }
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : error}`);
      process.exit(1);
    }
  });

program.parse();
