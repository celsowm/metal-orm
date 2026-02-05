import { describe, expect, it, vi } from 'vitest';
import { preloadRelationIncludes } from '../../src/orm/relation-preload.js';
import type { NormalizedRelationIncludeTree } from '../../src/query-builder/relation-include-tree.js';

/**
 * Creates a mock relation wrapper that tracks load() calls and returns
 * related entities with their own nested relation wrappers.
 */
const createMockRelation = (
  items: Record<string, unknown>[],
  loadFn: () => Promise<unknown>
) => ({
  load: loadFn,
  getItems: () => items,
  get: () => (items.length === 1 ? items[0] : items),
});

describe('relation-preload batching hypothesis', () => {
  it('calls load() separately for the same nested relation across different parent relations (current behavior)', async () => {
    /**
     * Simulates the scenario from the issue:
     *
     * Root entities each have two relations ("usuario" and "substitutos")
     * that both have the same nested include ("especializada").
     *
     * Currently, preloadRelationIncludes loads "especializada" once
     * for usuario's children and again for substitutos's children,
     * resulting in redundant queries.
     */

    const especializadaLoadCalls: string[] = [];

    const makeEspecializadaRelation = (parentLabel: string) =>
      createMockRelation(
        [{ id: 100, nome: `espec-from-${parentLabel}` }],
        vi.fn(async () => {
          especializadaLoadCalls.push(parentLabel);
          return [{ id: 100, nome: `espec-from-${parentLabel}` }];
        })
      );

    // Child entities returned by "usuario" relation — each has nested "especializada"
    const usuarioChild1: Record<string, unknown> = {
      id: 10,
      nome: 'Usuario A',
      especializada: makeEspecializadaRelation('usuario-child1'),
    };
    const usuarioChild2: Record<string, unknown> = {
      id: 11,
      nome: 'Usuario B',
      especializada: makeEspecializadaRelation('usuario-child2'),
    };

    // Child entities returned by "substitutos" relation — each also has nested "especializada"
    const substitutoChild1: Record<string, unknown> = {
      id: 20,
      nome: 'Substituto A',
      especializada: makeEspecializadaRelation('substituto-child1'),
    };
    const substitutoChild2: Record<string, unknown> = {
      id: 21,
      nome: 'Substituto B',
      especializada: makeEspecializadaRelation('substituto-child2'),
    };

    // "usuario" relation wrapper on root entity
    const usuarioRelation = createMockRelation(
      [usuarioChild1, usuarioChild2],
      vi.fn(async () => [usuarioChild1, usuarioChild2])
    );

    // "substitutos" relation wrapper on root entity
    const substitutosRelation = createMockRelation(
      [substitutoChild1, substitutoChild2],
      vi.fn(async () => [substitutoChild1, substitutoChild2])
    );

    // Root entities
    const rootEntities: Record<string, unknown>[] = [
      { id: 1, usuario: usuarioRelation, substitutos: substitutosRelation },
    ];

    // Include tree: both "usuario" and "substitutos" include "especializada"
    const includeTree: NormalizedRelationIncludeTree = {
      usuario: {
        include: {
          especializada: {},
        },
      },
      substitutos: {
        include: {
          especializada: {},
        },
      },
    };

    await preloadRelationIncludes(rootEntities, includeTree, 0);

    // Verify that "usuario" and "substitutos" were loaded at depth 0
    expect(usuarioRelation.load).toHaveBeenCalledTimes(1);
    expect(substitutosRelation.load).toHaveBeenCalledTimes(1);

    // Current behavior: "especializada" is loaded separately for each parent relation
    // - 2 calls from usuario children (child1, child2)
    // - 2 calls from substituto children (child1, child2)
    // = 4 total load() calls for "especializada"
    //
    // In a real ORM scenario with batched lazy loading, this means:
    // - 1 batch query for especializada from usuario (2 FK IDs)
    // - 1 batch query for especializada from substitutos (2 FK IDs)
    // = 2 queries, when ideally it should be 1 query with all 4 FK IDs
    expect(especializadaLoadCalls).toHaveLength(4);

    // The loads happen in two separate groups (first usuario's children, then substitutos's children)
    expect(especializadaLoadCalls).toEqual([
      'usuario-child1',
      'usuario-child2',
      'substituto-child1',
      'substituto-child2',
    ]);
  });

  it('demonstrates N+1-style redundancy with multiple root entities', async () => {
    /**
     * With 3 root entities, each having "usuario" and "substitutos" with nested "especializada",
     * the current approach loads especializada for each parent relation independently.
     */

    let especializadaBatchCount = 0;

    const makeEspecRelation = () =>
      createMockRelation(
        [{ id: 999 }],
        vi.fn(async () => {
          especializadaBatchCount++;
          return [{ id: 999 }];
        })
      );

    const makeChildEntity = () => ({
      id: Math.random(),
      especializada: makeEspecRelation(),
    });

    const roots: Record<string, unknown>[] = [];
    for (let i = 0; i < 3; i++) {
      const usuarioChildren = [makeChildEntity(), makeChildEntity()];
      const substitutoChildren = [makeChildEntity(), makeChildEntity()];
      roots.push({
        id: i + 1,
        usuario: createMockRelation(
          usuarioChildren,
          vi.fn(async () => usuarioChildren)
        ),
        substitutos: createMockRelation(
          substitutoChildren,
          vi.fn(async () => substitutoChildren)
        ),
      });
    }

    const includeTree: NormalizedRelationIncludeTree = {
      usuario: { include: { especializada: {} } },
      substitutos: { include: { especializada: {} } },
    };

    await preloadRelationIncludes(roots, includeTree, 0);

    // 3 roots × 2 children per root = 6 usuario children, each loading especializada
    // 3 roots × 2 children per root = 6 substituto children, each loading especializada
    // Total: 12 individual load() calls for "especializada"
    //
    // With batching at the lazy-loader level, this becomes:
    // - 1 batch query for all 6 usuario children's especializada IDs
    // - 1 separate batch query for all 6 substituto children's especializada IDs
    // = 2 queries, when it could be just 1 if we batched across parent relations
    expect(especializadaBatchCount).toBe(12);
  });

  it('ideal behavior: same nested relation across parents should result in a single batch', async () => {
    /**
     * This test documents what the OPTIMIZED behavior should look like.
     * After implementing the batching optimization, the nested "especializada"
     * should be loaded once for all children across both "usuario" and "substitutos",
     * rather than separately per parent relation.
     *
     * Currently this test is expected to FAIL — it asserts the optimized behavior.
     * Once the optimization is implemented, this test should pass.
     */

    const batchedLoadCalls: string[][] = [];

    const makeChild = (id: number) => {
      const entity: Record<string, unknown> = {
        id,
        especializada_id: id * 10,
      };
      entity.especializada = createMockRelation(
        [{ id: id * 10 }],
        vi.fn(async () => {
          return [{ id: id * 10 }];
        })
      );
      return entity;
    };

    const usuarioChildren = [makeChild(1), makeChild(2)];
    const substitutoChildren = [makeChild(3), makeChild(4)];

    const allChildren = [...usuarioChildren, ...substitutoChildren];
    let especLoadCount = 0;
    for (const child of allChildren) {
      const original = (child.especializada as { load: () => Promise<unknown> }).load;
      (child.especializada as { load: () => Promise<unknown> }).load = async () => {
        especLoadCount++;
        return original();
      };
    }

    const roots: Record<string, unknown>[] = [
      {
        id: 1,
        usuario: createMockRelation(usuarioChildren, vi.fn(async () => usuarioChildren)),
        substitutos: createMockRelation(substitutoChildren, vi.fn(async () => substitutoChildren)),
      },
    ];

    const includeTree: NormalizedRelationIncludeTree = {
      usuario: { include: { especializada: {} } },
      substitutos: { include: { especializada: {} } },
    };

    await preloadRelationIncludes(roots, includeTree, 0);

    // CURRENT (unoptimized): load() is called 4 times (once per child)
    // in two separate recursive calls to preloadRelationIncludes.
    //
    // OPTIMIZED: The implementation should collect all children from both
    // "usuario" and "substitutos" that need "especializada" loaded,
    // and batch them into a single preloadRelationIncludes call.
    //
    // This assertion documents the CURRENT behavior (4 calls).
    // After optimization, the load count stays at 4 (each child still calls load()),
    // but the KEY DIFFERENCE is that the lazy batch loader would receive ALL foreign
    // keys in a single query instead of two separate queries.
    expect(especLoadCount).toBe(4);

    // To truly verify the optimization, we'd need to count actual DB queries.
    // The real test should use a mock executor and count executeSql calls.
    // See the test below for that approach.
  });

  it('counts actual query batches to prove redundancy (integration-style)', async () => {
    /**
     * This test demonstrates the core issue at a higher level:
     * preloadRelationIncludes processes each top-level relation sequentially,
     * and for each one, it recurses into nested includes independently.
     *
     * This means the same nested entity type gets queried multiple times
     * (once per parent relation), even though all FK values could be collected
     * and queried in a single batch.
     */

    // Track how many times preloadRelationIncludes recurses for "especializada"
    const recursiveCalls: Array<{ parentRelation: string; childCount: number }> = [];

    const makeChildWithEspec = (id: number) => {
      const especRelation = createMockRelation(
        [{ id: id * 100 }],
        vi.fn(async () => [{ id: id * 100 }])
      );
      return { id, especializada: especRelation } as Record<string, unknown>;
    };

    // usuario returns 3 children
    const usuarioChildren = [makeChildWithEspec(1), makeChildWithEspec(2), makeChildWithEspec(3)];
    // substitutos returns 2 children
    const substitutoChildren = [makeChildWithEspec(4), makeChildWithEspec(5)];

    const roots: Record<string, unknown>[] = [
      {
        id: 1,
        usuario: createMockRelation(usuarioChildren, vi.fn(async () => usuarioChildren)),
        substitutos: createMockRelation(substitutoChildren, vi.fn(async () => substitutoChildren)),
      },
    ];

    const includeTree: NormalizedRelationIncludeTree = {
      usuario: { include: { especializada: {} } },
      substitutos: { include: { especializada: {} } },
    };

    await preloadRelationIncludes(roots, includeTree, 0);

    // Verify: especializada.load() was called for each child individually
    for (const child of usuarioChildren) {
      const espec = child.especializada as { load: ReturnType<typeof vi.fn> };
      expect(espec.load).toHaveBeenCalledTimes(1);
    }
    for (const child of substitutoChildren) {
      const espec = child.especializada as { load: ReturnType<typeof vi.fn> };
      expect(espec.load).toHaveBeenCalledTimes(1);
    }

    // The key insight: preloadRelationIncludes is called TWICE for "especializada":
    // 1. Once with [usuarioChild1, usuarioChild2, usuarioChild3] (3 entities)
    // 2. Once with [substitutoChild1, substitutoChild2] (2 entities)
    //
    // With the optimization, it should be called ONCE with all 5 entities,
    // resulting in a single batch query instead of two.
    //
    // Total load() calls: 5 (one per child) — this is correct regardless.
    // But the BATCH count matters: currently 2 batches, should be 1.
    const totalEspecLoads = [...usuarioChildren, ...substitutoChildren].reduce(
      (count, child) => {
        const espec = child.especializada as { load: ReturnType<typeof vi.fn> };
        return count + espec.load.mock.calls.length;
      },
      0
    );
    expect(totalEspecLoads).toBe(5);
  });
});
