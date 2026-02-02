/**
 * Trace Linking Helper Module
 *
 * Provides utility functions for traversing trace lineage (ancestry)
 * from child traces up to root traces.
 */

import type { TraceLineage, GetLineageOptions, GetTreeOptions, TraceTreeNode, Anchor } from "./types.js";

/**
 * Default maximum depth for lineage traversal
 */
export const DEFAULT_MAX_DEPTH = 100;

/**
 * Default maximum depth for tree traversal
 */
export const DEFAULT_TREE_MAX_DEPTH = 10;

/**
 * Default maximum nodes for tree traversal
 */
export const DEFAULT_TREE_MAX_NODES = 1000;

/**
 * Interface for clients that support trace queries
 */
export interface TraceQueryClient {
  /**
   * Get the parent trace hash for a given trace
   * @param traceHash - The trace hash to query
   * @returns Parent trace info with parentHash and hasParent flag
   */
  getParentTrace(traceHash: string): Promise<{ parentHash: string; hasParent: boolean }>;

  /**
   * Get anchor data for a trace (optional, used for enriched lineage)
   * @param traceHash - The trace hash to query
   * @returns Anchor data
   */
  getAnchor?(traceHash: string): Promise<Anchor>;
}

/**
 * Interface for clients that support tree queries (extends TraceQueryClient)
 */
export interface TreeQueryClient extends TraceQueryClient {
  /**
   * Get all child traces for a given parent
   * @param parentTraceHash - The parent trace hash
   * @returns Array of child trace hashes
   */
  getChildTraces(parentTraceHash: string): Promise<string[]>;
}

/**
 * Validates the maxDepth parameter
 * @param maxDepth - The maximum depth value to validate
 * @throws Error if maxDepth is invalid
 */
export function validateMaxDepth(maxDepth: number): void {
  if (typeof maxDepth !== "number" || !Number.isFinite(maxDepth)) {
    throw new Error("maxDepth must be a finite number");
  }

  if (maxDepth < 1) {
    throw new Error("maxDepth must be at least 1");
  }

  if (maxDepth > 10000) {
    throw new Error("maxDepth cannot exceed 10000 to prevent excessive traversal");
  }

  if (!Number.isInteger(maxDepth)) {
    throw new Error("maxDepth must be an integer");
  }
}

/**
 * Get the full lineage (ancestry) of a trace
 *
 * Traverses from the given trace up through its parents until reaching
 * a root trace (one with no parent) or hitting the maxDepth limit.
 *
 * @param client - Client with getParentTrace method
 * @param traceHash - Starting trace hash
 * @param options - Lineage query options
 * @returns TraceLineage with ancestors from trace to root
 *
 * @example
 * ```typescript
 * const client = new AgentAnchorClient({ ... });
 * const lineage = await getTraceLineage(client, myTraceHash);
 * console.log(`Trace has ${lineage.depth} ancestors`);
 * console.log(`Root trace: ${lineage.root}`);
 * ```
 *
 * @throws Error if maxDepth is exceeded during traversal
 * @throws Error if maxDepth parameter is invalid
 */
export async function getTraceLineage(
  client: TraceQueryClient,
  traceHash: string,
  options?: GetLineageOptions
): Promise<TraceLineage> {
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH;

  // Validate maxDepth parameter
  validateMaxDepth(maxDepth);

  // Initialize ancestors list with the starting trace
  const ancestors: string[] = [traceHash];
  let currentHash = traceHash;
  let depth = 0;

  // Iteratively traverse up the parent chain
  while (depth < maxDepth) {
    const { parentHash, hasParent } = await client.getParentTrace(currentHash);

    if (!hasParent) {
      // Reached root trace - no more parents
      break;
    }

    // Add parent to ancestors and continue traversal
    ancestors.push(parentHash);
    currentHash = parentHash;
    depth++;
  }

  // Check if we hit the depth limit without reaching root
  if (depth >= maxDepth) {
    throw new Error(
      `Exceeded maxDepth (${maxDepth}) while traversing lineage. ` +
        `Consider increasing maxDepth if you expect deeper ancestry chains.`
    );
  }

  // The ancestors array always has at least one element (the traceHash itself)
  // so we can safely assert that the root exists
  const root = ancestors[ancestors.length - 1] as string;

  return {
    traceHash,
    ancestors,
    depth: ancestors.length - 1, // depth is number of ancestors, not including self
    root,
  };
}

/**
 * Check if a trace is a root trace (convenience wrapper)
 *
 * @param client - Client with getParentTrace method
 * @param traceHash - The trace hash to check
 * @returns True if the trace has no parent (is a root)
 */
export async function isRootTraceHelper(
  client: TraceQueryClient,
  traceHash: string
): Promise<boolean> {
  const { hasParent } = await client.getParentTrace(traceHash);
  return !hasParent;
}

/**
 * Get the root trace for a given trace
 *
 * @param client - Client with getParentTrace method
 * @param traceHash - Starting trace hash
 * @param options - Lineage query options
 * @returns The root trace hash
 */
export async function getRootTrace(
  client: TraceQueryClient,
  traceHash: string,
  options?: GetLineageOptions
): Promise<string> {
  const lineage = await getTraceLineage(client, traceHash, options);
  return lineage.root;
}

/**
 * Get the depth of a trace in its lineage chain
 *
 * @param client - Client with getParentTrace method
 * @param traceHash - The trace hash to check
 * @param options - Lineage query options
 * @returns Number of ancestors (0 for root traces)
 */
export async function getTraceDepth(
  client: TraceQueryClient,
  traceHash: string,
  options?: GetLineageOptions
): Promise<number> {
  const lineage = await getTraceLineage(client, traceHash, options);
  return lineage.depth;
}

// ============ Tree Traversal Functions ============

/**
 * Validates the maxNodes parameter
 * @param maxNodes - The maximum nodes value to validate
 * @throws Error if maxNodes is invalid
 */
export function validateMaxNodes(maxNodes: number): void {
  if (typeof maxNodes !== "number" || !Number.isFinite(maxNodes)) {
    throw new Error("maxNodes must be a finite number");
  }

  if (maxNodes < 1) {
    throw new Error("maxNodes must be at least 1");
  }

  if (maxNodes > 100000) {
    throw new Error("maxNodes cannot exceed 100000 to prevent excessive traversal");
  }

  if (!Number.isInteger(maxNodes)) {
    throw new Error("maxNodes must be an integer");
  }
}

/**
 * Validates tree options
 * @param options - Tree options to validate
 * @throws Error if any option is invalid
 */
export function validateTreeOptions(options?: GetTreeOptions): void {
  if (!options) return;

  if (options.maxDepth !== undefined) {
    validateMaxDepth(options.maxDepth);
  }

  if (options.maxNodes !== undefined) {
    validateMaxNodes(options.maxNodes);
  }
}

/**
 * Get the full tree (descendants) from a root trace using iterative BFS traversal
 *
 * Traverses from the given trace down through all its descendants,
 * building a tree structure. Uses an explicit queue to avoid stack overflow
 * on deep trees.
 *
 * @param client - Client with getChildTraces and optionally getAnchor methods
 * @param rootTraceHash - Root trace hash to start from
 * @param options - Tree query options
 * @returns TraceTreeNode with all descendants
 *
 * @example
 * ```typescript
 * const client = new AgentAnchorClient({ ... });
 * const tree = await getTraceTree(client, rootHash, { maxDepth: 5 });
 * console.log(`Tree has ${countTreeNodes(tree)} nodes`);
 * ```
 *
 * @throws Error if maxNodes is exceeded during traversal
 * @throws Error if options validation fails
 */
export async function getTraceTree(
  client: TreeQueryClient,
  rootTraceHash: string,
  options?: GetTreeOptions
): Promise<TraceTreeNode> {
  // Validate options
  validateTreeOptions(options);

  const maxDepth = options?.maxDepth ?? DEFAULT_TREE_MAX_DEPTH;
  const maxNodes = options?.maxNodes ?? DEFAULT_TREE_MAX_NODES;
  const includeAnchors = options?.includeAnchors ?? false;

  // Map to store all nodes by traceHash for parent linking
  const nodeMap = new Map<string, TraceTreeNode>();

  // Queue items: [traceHash, parentTraceHash | null, depth]
  type QueueItem = [string, string | null, number];
  const queue: QueueItem[] = [[rootTraceHash, null, 0]];
  let nodeCount = 0;

  while (queue.length > 0) {
    const [traceHash, parentHash, depth] = queue.shift()!;

    // Skip if already processed (handles cycles gracefully)
    if (nodeMap.has(traceHash)) {
      // Still link to parent if this is a second reference to same node
      if (parentHash && nodeMap.has(parentHash)) {
        const existingNode = nodeMap.get(traceHash)!;
        const parent = nodeMap.get(parentHash)!;
        if (!parent.children.includes(existingNode)) {
          parent.children.push(existingNode);
        }
      }
      continue;
    }

    nodeCount++;
    if (nodeCount > maxNodes) {
      throw new Error(
        `Exceeded maxNodes (${maxNodes}) while building tree. ` +
          `Consider increasing maxNodes or decreasing maxDepth.`
      );
    }

    // Create node
    const node: TraceTreeNode = {
      traceHash,
      children: [],
      depth,
    };

    // Optionally fetch full anchor data
    if (includeAnchors && client.getAnchor) {
      try {
        node.anchor = await client.getAnchor(traceHash);
      } catch {
        // Anchor fetch failed, continue without it
        // This is non-fatal - the trace hash is still valid
      }
    }

    // Store in map
    nodeMap.set(traceHash, node);

    // Link to parent
    if (parentHash && nodeMap.has(parentHash)) {
      nodeMap.get(parentHash)!.children.push(node);
    }

    // Queue children if within depth limit
    if (depth < maxDepth) {
      const childHashes = await client.getChildTraces(traceHash);
      for (const childHash of childHashes) {
        queue.push([childHash, traceHash, depth + 1]);
      }
    }
  }

  const root = nodeMap.get(rootTraceHash);
  if (!root) {
    throw new Error(`Failed to build tree: root node not found`);
  }

  return root;
}

/**
 * Count total nodes in a trace tree
 *
 * @param tree - The trace tree to count
 * @returns Total number of nodes in the tree
 */
export function countTreeNodes(tree: TraceTreeNode): number {
  let count = 1; // Count this node
  for (const child of tree.children) {
    count += countTreeNodes(child);
  }
  return count;
}

/**
 * Get all trace hashes from a tree as a flat array
 *
 * @param tree - The trace tree to flatten
 * @returns Array of all trace hashes in the tree
 */
export function flattenTree(tree: TraceTreeNode): string[] {
  const hashes: string[] = [tree.traceHash];
  for (const child of tree.children) {
    hashes.push(...flattenTree(child));
  }
  return hashes;
}

/**
 * Find a node in the tree by trace hash
 *
 * @param tree - The trace tree to search
 * @param traceHash - The trace hash to find
 * @returns The matching node or undefined if not found
 */
export function findTreeNode(tree: TraceTreeNode, traceHash: string): TraceTreeNode | undefined {
  if (tree.traceHash === traceHash) {
    return tree;
  }
  for (const child of tree.children) {
    const found = findTreeNode(child, traceHash);
    if (found) {
      return found;
    }
  }
  return undefined;
}
