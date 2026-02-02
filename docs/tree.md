# Tree Behavior (Nested Set / MPTT)

MetalORM provides a full-featured Tree Behavior implementation using the Nested Set Model (also known as Modified Preorder Tree Traversal or MPTT). This allows efficient hierarchical data operations with O(log n) complexity for most tree operations.

## Overview

The Tree Behavior is organized into 4 phases/layers:

| Phase | Layer | Files | Purpose |
|-------|-------|-------|---------|
| 1 | Core Types | [`tree-types.ts`](../src/tree/tree-types.ts), [`nested-set-strategy.ts`](../src/tree/nested-set-strategy.ts) | TreeConfig, TreeNode, MPTT algorithm |
| 2 | Query Builder | [`tree-query.ts`](../src/tree/tree-query.ts) | Level 1: `treeQuery()` finder factory |
| 3 | Runtime Manager | [`tree-manager.ts`](../src/tree/tree-manager.ts) | Level 2: `TreeManager` class with operations |
| 4 | Decorators | [`tree-decorator.ts`](../src/tree/tree-decorator.ts) | Level 3: `@Tree`, `@TreeParent`, `@TreeChildren` |

## Installation

Tree Behavior is included in the main package. Import from `metal-orm/tree`:

```ts
import { TreeManager, treeQuery, createTreeManager } from 'metal-orm/tree';
import { Tree, TreeParent, TreeChildren } from 'metal-orm/tree';
```

## Quick Start

### Level 1: Using TreeQuery (Query Builder)

```ts
import { defineTable, col } from 'metal-orm';
import { treeQuery } from 'metal-orm/tree';

const categories = defineTable('categories', {
  id: col.primaryKey(col.int()),
  name: col.varchar(255),
  parentId: col.int().nullable(),
  lft: col.int(),
  rght: col.int(),
  depth: col.int().nullable(),
});

// Create a tree query builder
const tree = treeQuery(categories);

// Find root nodes
const roots = await tree.findRoots().execute(session);

// Find direct children of a node
const children = await tree.findDirectChildren(5).execute(session);

// Find all descendants
const descendants = await tree.findDescendants({ lft: 1, rght: 14 }).execute(session);

// Find ancestors
const ancestors = await tree.findAncestors({ lft: 3, rght: 4 }).execute(session);

// Get threaded/nested structure
const threaded = await tree.findSubtree({ lft: 1, rght: 14 }).execute(session);
```

### Level 2: Using TreeManager (Runtime Operations)

```ts
import { TreeManager } from 'metal-orm/tree';

const manager = new TreeManager({
  executor: session.executor,
  dialect: session.dialect,
  table: categories,
  config: {
    parentKey: 'parentId',
    leftKey: 'lft',
    rightKey: 'rght',
    depthKey: 'depth',
  },
});

// Get a node by ID
const node = await manager.getNode(5);

// Get all root nodes
const roots = await manager.getRoots();

// Get direct children
const children = await manager.getChildren(5);

// Get all descendants
const descendants = await manager.getDescendants(node);

// Get parent
const parent = await manager.getParent(node);

// Get path from root to node
const path = await manager.getPath(node);

// Get threaded (nested) structure
const threaded = await manager.getDescendantsThreaded(node);

// Move node up/down among siblings
await manager.moveUp(node);
await manager.moveDown(node);

// Move node to new parent
await manager.moveTo(node, newParentId);

// Insert new node
const newId = await manager.insertAsChild(parentId, { name: 'New Node' });

// Remove node (re-parent children to parent)
await manager.removeFromTree(node);

// Delete node and all descendants
const deletedCount = await manager.deleteSubtree(node);

// Recover tree from parent_id relationships
const result = await manager.recover();

// Validate tree structure
const errors = await manager.validate();
if (errors.length > 0) {
  console.error('Tree validation errors:', errors);
}

// Create scoped manager (for multi-tree tables)
const scopedManager = manager.withScope({ tenantId: 42 });
```

### Level 3: Using Decorators (Class-based Entities)

```ts
import { Entity, Column, PrimaryKey, bootstrapEntities } from 'metal-orm';
import { Tree, TreeParent, TreeChildren } from 'metal-orm/tree';

@Entity()
@Tree({
  parentKey: 'parentId',
  leftKey: 'lft',
  rightKey: 'rght',
  depthKey: 'depth',
  scope: ['tenantId'],
  cascadeCallbacks: true,
})
class Category {
  @PrimaryKey(col.int())
  id!: number;

  @Column(col.varchar(255))
  name!: string;

  @Column(col.int().nullable())
  parentId!: number | null;

  @Column(col.int())
  lft!: number;

  @Column(col.int())
  rght!: number;

  @Column(col.int().nullable())
  depth!: number | null;

  @Column(col.int())
  tenantId!: number;

  @TreeParent()
  parent?: Category;

  @TreeChildren()
  children?: Category[];
}

// Bootstrap entities once at startup
const tables = bootstrapEntities();
```

## Configuration Options

### TreeConfig

```ts
interface TreeConfig {
  /** Column name for parent reference (default: 'parentId') */
  parentKey: string;
  /** Column name for left boundary (default: 'lft') */
  leftKey: string;
  /** Column name for right boundary (default: 'rght') */
  rightKey: string;
  /** Optional column name for cached depth level */
  depthKey?: string;
  /** Columns used for scoping multiple trees in one table */
  scope?: string[];
  /** Whether to load and delete children individually to trigger hooks */
  cascadeCallbacks?: boolean;
  /** Custom ordering for tree recovery (column -> direction) */
  recoverOrder?: Record<string, 'ASC' | 'DESC'>;
}
```

### Default Configuration

```ts
const defaultConfig: TreeConfig = {
  parentKey: 'parentId',
  leftKey: 'lft',
  rightKey: 'rght',
  depthKey: undefined,
  scope: [],
  cascadeCallbacks: false,
  recoverOrder: undefined,
};
```

## MPTT Basics

The Nested Set Model stores each node with `lft` and `rght` values that define the tree structure:

```
Root (lft=1, rght=14)
├── Child 1 (lft=2, rght=9)
│   ├── Grandchild 1 (lft=3, rght=4)
│   ├── Grandchild 2 (lft=5, rght=8)
│   │   ├── Great-Grandchild (lft=6, rght=7)
│   └── Empty (lft=9, rght=10)
└── Child 2 (lft=11, rght=12)
```

Properties:
- A node's descendants have `lft` > node.lft AND `rght` < node.rght
- A node's children have `parentId` = node.id
- Root nodes have `parentId` = NULL
- Leaf nodes have `lft` + 1 = `rght`

## API Reference

### TreeQuery Methods

| Method | Description |
|--------|-------------|
| `findRoots()` | Find all root nodes (parentId IS NULL) |
| `findById(id)` | Find node by primary key |
| `findDirectChildren(parentId)` | Find direct children of a node |
| `findDescendants(bounds)` | Find all descendants using bounds |
| `findAncestors(bounds, options)` | Find ancestors using bounds |
| `findSubtree(bounds)` | Get flat list for threading |
| `withScope(scope)` | Apply scope filter |

### TreeManager Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `getNode(id)` | Get node with tree metadata | `TreeNodeResult \| null` |
| `getRoots()` | Get all root nodes | `TreeNodeResult[]` |
| `getChildren(parentId)` | Get direct children | `TreeNodeResult[]` |
| `getDescendants(node)` | Get all descendants | `TreeNodeResult[]` |
| `getPath(node, includeSelf)` | Get path from root | `TreeNodeResult[]` |
| `getSiblings(node, includeSelf)` | Get siblings | `TreeNodeResult[]` |
| `getParent(node)` | Get parent node | `TreeNodeResult \| null` |
| `getDescendantsThreaded(node)` | Get nested structure | `ThreadedNode[]` |
| `getLevel(node)` | Get depth level | `number` |
| `childCount(node)` | Count descendants | `number` |
| `moveUp(node)` | Move up among siblings | `boolean` |
| `moveDown(node)` | Move down among siblings | `boolean` |
| `moveTo(node, newParentId)` | Move to new parent | `void` |
| `insertAsChild(parentId, data)` | Insert new node | `unknown` (id) |
| `removeFromTree(node)` | Remove, re-parent children | `void` |
| `deleteSubtree(node)` | Delete node + descendants | `number` (count) |
| `recover()` | Rebuild from parent_id | `RecoverResult` |
| `validate()` | Validate tree structure | `string[]` (errors) |
| `withScope(scope)` | Create scoped manager | `TreeManager` |

### Decorators

| Decorator | Target | Purpose |
|-----------|--------|---------|
| `@Tree(options)` | Class | Mark entity as tree, configure options |
| `@TreeParent()` | Field | Mark field as parent relation |
| `@TreeChildren()` | Field | Mark field as children relation |

### Helper Functions

| Function | Purpose |
|----------|---------|
| `getTreeMetadata(entityClass)` | Get tree metadata from class |
| `hasTreeBehavior(entityClass)` | Check if entity has tree |
| `getTreeConfig(entityClass)` | Get tree configuration |
| `getTreeBounds(entity, config)` | Get lft/rght from entity |
| `getTreeParentId(entity, config)` | Get parentId from entity |
| `setTreeBounds(entity, config, lft, rght, depth?)` | Set tree bounds |
| `setTreeParentId(entity, config, parentId)` | Set parentId |

### TreeEntityRegistry

```ts
import { treeEntityRegistry } from 'metal-orm/tree';

// Register entity (done automatically by @Tree)
treeEntityRegistry.register(MyTreeEntity, 'my_table');

// Look up by table name
const entityClass = treeEntityRegistry.getByTableName('categories');

// Check if table has tree behavior
const isTree = treeEntityRegistry.isTreeTable('categories');

// Get all tree entities
const allTrees = treeEntityRegistry.getAll();

// Clear registry
treeEntityRegistry.clear();
```

## Multi-Tree Scoping

For tables containing multiple trees (e.g., categories for different tenants), use the scope feature:

```ts
// Define table with scope column
const categories = defineTable('categories', {
  id: col.primaryKey(col.int()),
  name: col.varchar(255),
  parentId: col.int().nullable(),
  lft: col.int(),
  rght: col.int(),
  tenantId: col.int(),
});

// Create manager with scope
const manager = new TreeManager({
  executor: session.executor,
  dialect: session.dialect,
  table: categories,
  config: {
    parentKey: 'parentId',
    leftKey: 'lft',
    rightKey: 'rght',
    scope: ['tenantId'],  // Enable scoping
  },
});

// Operations only affect the scoped tree
const scopedManager = manager.withScope({ tenantId: 42 });
const roots = await scopedManager.getRoots(); // Only tenant 42's roots
```

## Tree Recovery

If tree structure gets corrupted (e.g., from manual data manipulation), use `recover()`:

```ts
const result = await manager.recover();

if (result.success) {
  console.log(`Recovered ${result.processed} nodes`);
} else {
  console.error('Recovery failed:', result.errors);
}
```

The recovery algorithm:
1. Reads all nodes with their parent_id relationships
2. Rebuilds lft/rght values using depth-first traversal
3. Applies updates in a single transaction

## Validation

Validate tree structure integrity:

```ts
const errors = await manager.validate();

if (errors.length === 0) {
  console.log('Tree is valid');
} else {
  errors.forEach(err => console.error(err));
}
```

Common validation errors:
- `lft value must be less than rght value`
- `Node X is not a descendant of parent Y`
- `Gap detected in tree structure`

## Concurrency Considerations

For concurrent tree modifications, use transactions with locking:

```ts
await session.transaction(async (txSession) => {
  const executor = txSession.executor;
  
  // Use FOR UPDATE or equivalent if your dialect supports it
  // This prevents concurrent modifications to the same tree portion
  
  const node = await manager.getNode(5);
  await manager.moveTo(node, newParentId);
});
```

## Comparison with Other ORMs

| Aspect | CakePHP | MetalORM |
|--------|---------|----------|
| Attachment | `$this->addBehavior('Tree')` | `@Tree()` decorator or `TreeManager` |
| Concurrency | Documentation only | Optional pessimistic locking via `session.transaction()` |
| Scoping | Runtime config | Typed scope array in config |
| Recovery ordering | `recoverOrder` config | Same, but typed `Record<string, 'ASC'|'DESC'>` |
| Finders | `find('children', for: $id)` | `tree.findChildren(id)` returns `SelectQueryBuilder` |
| Type safety | PHP arrays | Full generics: `TreeNode<Category>`, typed finders |

## Testing

Tree Behavior includes comprehensive test coverage:

```bash
# Run all tree tests
npx vitest run tests/tree/

# Run specific phase
npx vitest run tests/tree/phase3-tree-manager.test.ts
```

Test files:
- [`phase1-tree-types.test.ts`](../tests/tree/phase1-tree-types.test.ts) - Core types & config
- [`phase2-tree-query.test.ts`](../tests/tree/phase2-tree-query.test.ts) - Query builder
- [`phase3-tree-manager.test.ts`](../tests/tree/phase3-tree-manager.test.ts) - Runtime operations
- [`phase4-tree-decorator.test.ts`](../tests/tree/phase4-tree-decorator.test.ts) - Decorators

## Performance Considerations

- **Reads are O(log n)** using index on (lft, rght)
- **Moves are O(log n)** for small movements, O(n) for large tree changes
- **Inserts require shifting** - use `insertAsChild()` which handles this
- **Recovery is O(n)** - processes entire tree
- **Indexes**: Ensure `(lft, rght)` and `parentId` are indexed for best performance

## Related Documentation

- [Schema Definition](./schema-definition.md)
- [Query Builder](./query-builder.md)
- [Runtime & Unit of Work](./runtime.md)
- [Relations](./relations/index.md)
- [Transactions](./transactions.md)
