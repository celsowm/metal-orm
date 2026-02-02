/**
 * Nested Set (MPTT) Strategy
 * 
 * Implements the Modified Preorder Tree Traversal algorithm for managing
 * hierarchical data in relational databases.
 * 
 * @see https://en.wikipedia.org/wiki/Nested_set_model
 */

import type {
  TreeNode,
  NestedSetBounds,
  TreeMoveData,
  ThreadedNode,
  TreeScope,
} from './tree-types.js';

/**
 * Represents a row with nested set columns for internal calculations.
 */
export interface NestedSetRow {
  lft: number;
  rght: number;
  parentId: unknown;
  depth?: number;
  [key: string]: unknown;
}

/**
 * Represents a node with its primary key for tree operations.
 */
export interface NodeWithPk<TPk = unknown> {
  pk: TPk;
  lft: number;
  rght: number;
  parentId: unknown;
  depth?: number;
}

/**
 * Core nested set calculations and algorithms.
 * All methods are pure functions that compute values without database access.
 */
export class NestedSetStrategy {
  /**
   * Calculates the number of descendants for a node.
   * Formula: (rght - lft - 1) / 2
   */
  static childCount(lft: number, rght: number): number {
    return (rght - lft - 1) / 2;
  }

  /**
   * Determines if a node is a leaf (has no children).
   */
  static isLeaf(lft: number, rght: number): boolean {
    return rght - lft === 1;
  }

  /**
   * Determines if a node is a root (has no parent).
   */
  static isRoot(parentId: unknown): boolean {
    return parentId === null || parentId === undefined;
  }

  /**
   * Calculates the depth (level) of a node from its ancestors.
   * @param ancestorCount - Number of ancestors (nodes where ancestor.lft < node.lft AND ancestor.rght > node.rght)
   */
  static calculateDepth(ancestorCount: number): number {
    return ancestorCount;
  }

  /**
   * Checks if nodeA is an ancestor of nodeB.
   */
  static isAncestorOf(nodeA: NestedSetBounds, nodeB: NestedSetBounds): boolean {
    return nodeA.lft < nodeB.lft && nodeA.rght > nodeB.rght;
  }

  /**
   * Checks if nodeA is a descendant of nodeB.
   */
  static isDescendantOf(nodeA: NestedSetBounds, nodeB: NestedSetBounds): boolean {
    return nodeA.lft > nodeB.lft && nodeA.rght < nodeB.rght;
  }

  /**
   * Checks if two nodes are siblings (share the same parent).
   * This requires parent information, so we check if they don't overlap.
   */
  static areSiblings(nodeA: NestedSetBounds, nodeB: NestedSetBounds): boolean {
    return (
      (nodeA.rght < nodeB.lft || nodeB.rght < nodeA.lft) &&
      !this.isAncestorOf(nodeA, nodeB) &&
      !this.isDescendantOf(nodeA, nodeB)
    );
  }

  /**
   * Calculates the width of a subtree (number of lft/rght values it occupies).
   */
  static subtreeWidth(lft: number, rght: number): number {
    return rght - lft + 1;
  }

  /**
   * Creates a TreeNode wrapper from raw row data.
   */
  static createTreeNode<T extends NestedSetRow>(row: T): TreeNode<T> {
    return {
      entity: row,
      lft: row.lft,
      rght: row.rght,
      depth: row.depth,
      isLeaf: this.isLeaf(row.lft, row.rght),
      isRoot: this.isRoot(row.parentId),
      childCount: this.childCount(row.lft, row.rght),
    };
  }

  /**
   * Calculates insert position for a new node as a child of a parent.
   * New nodes are inserted as the last child (rightmost position).
   * 
   * @param parentRght - The rght value of the parent node (or 0 for root)
   * @param parentDepth - The depth of the parent (or -1 for root)
   * @returns The lft, rght, and depth for the new node
   */
  static calculateInsertAsLastChild(
    parentRght: number,
    parentDepth: number
  ): { lft: number; rght: number; depth: number } {
    return {
      lft: parentRght,
      rght: parentRght + 1,
      depth: parentDepth + 1,
    };
  }

  /**
   * Calculates insert position for a new node as the first child of a parent.
   * 
   * @param parentLft - The lft value of the parent node
   * @param parentDepth - The depth of the parent (or -1 for root)
   * @returns The lft, rght, and depth for the new node
   */
  static calculateInsertAsFirstChild(
    parentLft: number,
    parentDepth: number
  ): { lft: number; rght: number; depth: number } {
    return {
      lft: parentLft + 1,
      rght: parentLft + 2,
      depth: parentDepth + 1,
    };
  }

  /**
   * Calculates insert position for a new root node.
   * 
   * @param maxRght - Current maximum rght value in the tree (or 0 if empty)
   * @returns The lft, rght, and depth for the new root
   */
  static calculateInsertAsRoot(maxRght: number): { lft: number; rght: number; depth: number } {
    return {
      lft: maxRght + 1,
      rght: maxRght + 2,
      depth: 0,
    };
  }

  /**
   * Generates SQL conditions for updating lft values after an insert.
   * All nodes with lft >= insertPoint need lft += width.
   * 
   * @param insertPoint - The lft value where the new node is inserted
   * @param width - The width to shift (usually 2 for a new leaf)
   */
  static calculateLftShiftForInsert(
    insertPoint: number,
    width: number = 2
  ): { threshold: number; delta: number } {
    return { threshold: insertPoint, delta: width };
  }

  /**
   * Generates SQL conditions for updating rght values after an insert.
   * All nodes with rght >= insertPoint need rght += width.
   */
  static calculateRghtShiftForInsert(
    insertPoint: number,
    width: number = 2
  ): { threshold: number; delta: number } {
    return { threshold: insertPoint, delta: width };
  }

  /**
   * Calculates the gap left after deleting a subtree.
   * This gap needs to be closed by shifting all nodes to the right.
   */
  static calculateDeleteGap(lft: number, rght: number): { start: number; width: number } {
    return {
      start: lft,
      width: rght - lft + 1,
    };
  }

  /**
   * Calculates shifts needed for all nodes after a delete.
   * Nodes with lft > deletedRght need lft -= width.
   * Nodes with rght > deletedRght need rght -= width.
   */
  static calculateShiftForDelete(
    deletedRght: number,
    width: number
  ): { threshold: number; delta: number } {
    return { threshold: deletedRght, delta: -width };
  }

  /**
   * Calculates the move operation for a subtree.
   * This is complex as it involves:
   * 1. Creating a gap at the new position
   * 2. Moving the subtree
   * 3. Closing the old gap
   * 
   * @param node - The node being moved
   * @param newParent - The new parent (null for moving to root)
   * @param position - Where to place relative to newParent
   */
  static calculateMove(
    node: NestedSetBounds & { depth?: number },
    newParent: (NestedSetBounds & { depth?: number }) | null,
    position: 'firstChild' | 'lastChild' = 'lastChild'
  ): TreeMoveData {
    const width = this.subtreeWidth(node.lft, node.rght);
    
    let targetLft: number;
    let newDepth: number;
    
    if (newParent === null) {
      targetLft = 1;
      newDepth = 0;
    } else if (position === 'firstChild') {
      targetLft = newParent.lft + 1;
      newDepth = (newParent.depth ?? 0) + 1;
    } else {
      targetLft = newParent.rght;
      newDepth = (newParent.depth ?? 0) + 1;
    }

    const delta = targetLft - node.lft;

    return {
      newParentId: newParent ? null : null,
      newLft: targetLft,
      newRght: targetLft + width - 1,
      newDepth,
      delta,
    };
  }

  /**
   * Calculates the shifts needed for moveUp operation.
   * Moves a node one position up among its siblings.
   * 
   * @returns null if already at top, otherwise the swap data
   */
  static calculateMoveUp(
    node: NestedSetBounds,
    previousSibling: NestedSetBounds | null
  ): { nodeShift: number; siblingShift: number } | null {
    if (!previousSibling) return null;

    const nodeWidth = this.subtreeWidth(node.lft, node.rght);
    const siblingWidth = this.subtreeWidth(previousSibling.lft, previousSibling.rght);

    return {
      nodeShift: -siblingWidth,
      siblingShift: nodeWidth,
    };
  }

  /**
   * Calculates the shifts needed for moveDown operation.
   * Moves a node one position down among its siblings.
   * 
   * @returns null if already at bottom, otherwise the swap data
   */
  static calculateMoveDown(
    node: NestedSetBounds,
    nextSibling: NestedSetBounds | null
  ): { nodeShift: number; siblingShift: number } | null {
    if (!nextSibling) return null;

    const nodeWidth = this.subtreeWidth(node.lft, node.rght);
    const siblingWidth = this.subtreeWidth(nextSibling.lft, nextSibling.rght);

    return {
      nodeShift: siblingWidth,
      siblingShift: -nodeWidth,
    };
  }

  /**
   * Rebuilds the tree structure from parent_id relationships.
   * Returns an array of updates to apply.
   * 
   * This is a recursive algorithm that assigns lft/rght values
   * based on the parent_id hierarchy.
   * 
   * @param nodes - All nodes with their pk and parentId
   * @param orderFn - Optional function to sort siblings
   * @returns Array of updates with pk, new lft, rght, and depth
   */
  static recover<TPk>(
    nodes: NodeWithPk<TPk>[],
    orderFn?: (a: NodeWithPk<TPk>, b: NodeWithPk<TPk>) => number
  ): Array<{ pk: TPk; lft: number; rght: number; depth: number }> {
    const updates: Array<{ pk: TPk; lft: number; rght: number; depth: number }> = [];
    const childrenMap = new Map<unknown, NodeWithPk<TPk>[]>();

    for (const node of nodes) {
      const parentKey = node.parentId ?? null;
      if (!childrenMap.has(parentKey)) {
        childrenMap.set(parentKey, []);
      }
      childrenMap.get(parentKey)!.push(node);
    }

    if (orderFn) {
      for (const children of childrenMap.values()) {
        children.sort(orderFn);
      }
    }

    const traverse = (parentId: unknown, left: number, depth: number): number => {
      const children = childrenMap.get(parentId) ?? [];
      let currentLeft = left;

      for (const child of children) {
        const childLft = currentLeft;
        currentLeft = traverse(child.pk, currentLeft + 1, depth + 1);
        const childRght = currentLeft;
        currentLeft++;

        updates.push({
          pk: child.pk,
          lft: childLft,
          rght: childRght,
          depth,
        });
      }

      return currentLeft;
    };

    traverse(null, 1, 0);

    return updates;
  }

  /**
   * Converts a flat list of nodes (ordered by lft) into a threaded tree structure.
   * 
   * @param nodes - Flat array of nodes ordered by lft
   * @param getLft - Function to extract lft from a node
   * @param getRght - Function to extract rght from a node
   */
  static toThreaded<T>(
    nodes: T[],
    getLft: (node: T) => number,
    getRght: (node: T) => number
  ): ThreadedNode<T>[] {
    const result: ThreadedNode<T>[] = [];
    const stack: ThreadedNode<T>[] = [];

    for (const node of nodes) {
      const threadedNode: ThreadedNode<T> = { node, children: [] };
      const nodeLft = getLft(node);
      const nodeRght = getRght(node);

      while (stack.length > 0) {
        const parent = stack[stack.length - 1];
        const parentRght = getRght(parent.node);
        if (parentRght > nodeRght) {
          break;
        }
        stack.pop();
      }

      if (stack.length === 0) {
        result.push(threadedNode);
      } else {
        stack[stack.length - 1].children.push(threadedNode);
      }

      if (!this.isLeaf(nodeLft, nodeRght)) {
        stack.push(threadedNode);
      }
    }

    return result;
  }

  /**
   * Generates a flat tree list with depth prefixes.
   * Useful for select/dropdown rendering.
   * 
   * @param nodes - Flat array of nodes ordered by lft
   * @param getKey - Function to extract key from a node
   * @param getValue - Function to extract display value from a node
   * @param getDepth - Function to extract or calculate depth
   * @param spacer - Prefix string per depth level
   */
  static toTreeList<T, K, V extends string>(
    nodes: T[],
    getKey: (node: T) => K,
    getValue: (node: T) => V,
    getDepth: (node: T, index: number) => number,
    spacer: string = '__'
  ): Array<{ key: K; value: string; depth: number }> {
    return nodes.map((node, index) => {
      const depth = getDepth(node, index);
      const prefix = spacer.repeat(depth);
      return {
        key: getKey(node),
        value: prefix + getValue(node),
        depth,
      };
    });
  }

  /**
   * Validates that a tree has no overlapping or orphaned nodes.
   * Returns validation errors if any.
   */
  static validateTree<T>(
    nodes: T[],
    getLft: (node: T) => number,
    getRght: (node: T) => number,
    getPk: (node: T) => unknown
  ): string[] {
    const errors: string[] = [];
    const sorted = [...nodes].sort((a, b) => getLft(a) - getLft(b));

    for (let i = 0; i < sorted.length; i++) {
      const node = sorted[i];
      const lft = getLft(node);
      const rght = getRght(node);
      const pk = getPk(node);

      if (lft >= rght) {
        errors.push(`Node ${pk}: lft (${lft}) must be less than rght (${rght})`);
      }

      if (lft < 1) {
        errors.push(`Node ${pk}: lft (${lft}) must be positive`);
      }

      for (let j = i + 1; j < sorted.length; j++) {
        const other = sorted[j];
        const otherLft = getLft(other);
        const otherRght = getRght(other);
        const otherPk = getPk(other);

        if (otherLft < rght && otherRght > rght) {
          errors.push(
            `Node ${pk} (${lft}-${rght}) overlaps with node ${otherPk} (${otherLft}-${otherRght})`
          );
        }
      }
    }

    return errors;
  }

  /**
   * Calculates depth for each node based on ancestor count.
   * Assumes nodes are ordered by lft.
   */
  static calculateDepths<T>(
    nodes: T[],
    getLft: (node: T) => number,
    getRght: (node: T) => number
  ): Map<T, number> {
    const depths = new Map<T, number>();
    const stack: { rght: number }[] = [];

    for (const node of nodes) {
      const lft = getLft(node);
      const rght = getRght(node);

      while (stack.length > 0 && stack[stack.length - 1].rght < lft) {
        stack.pop();
      }

      depths.set(node, stack.length);

      if (!this.isLeaf(lft, rght)) {
        stack.push({ rght });
      }
    }

    return depths;
  }
}

/**
 * Builds scope conditions for multi-tree tables.
 */
export function buildScopeConditions(
  scope: string[] | undefined,
  scopeValues: TreeScope
): Record<string, unknown> {
  if (!scope || scope.length === 0) return {};
  
  const conditions: Record<string, unknown> = {};
  for (const key of scope) {
    if (key in scopeValues) {
      conditions[key] = scopeValues[key];
    }
  }
  return conditions;
}

/**
 * Extracts scope values from an entity.
 */
export function extractScopeValues(
  entity: Record<string, unknown>,
  scope: string[] | undefined
): TreeScope {
  if (!scope || scope.length === 0) return {};
  
  const values: TreeScope = {};
  for (const key of scope) {
    if (key in entity) {
      values[key] = entity[key];
    }
  }
  return values;
}
