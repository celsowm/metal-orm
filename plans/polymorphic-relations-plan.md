# Polymorphic Relations — Plano de Implementação v1

## Premissa fundamental validada

Após auditoria completa do codebase, a arquitetura atual assume **target fixo por relação** em praticamente todos os caminhos:

- `relation.target.name` / `relation.target.columns` usado diretamente em 8+ arquivos
- `assertNever` em `relation-conditions.ts` vai crashar se novos tipos chegarem sem tratamento
- switches sem default em `relation-change-processor.ts` e `save-graph.ts` vão ignorar silenciosamente novos tipos

**Consequência: MorphOne/MorphMany (target fixo) cabem no motor atual. MorphTo (target dinâmico) precisa de caminho próprio.**

---

## Inventário completo de arquivos impactados

### Camada 1 — Schema & Tipos (fundação)

| Arquivo | O que muda |
|---|---|
| `src/schema/relation.ts` | + 3 interfaces, + 3 helpers, + 3 entradas em `RelationKinds`, `RelationDef` vira union de 7 |
| `src/schema/types.ts` | `RelationTargetTable`, `RelationResult`, `RelationWrapper` — adicionar branches morph |
| `src/orm/entity-metadata.ts` | `RelationMetadata` union + 3 metadata interfaces morph |
| `src/orm/runtime-types.ts` | Já aceita `RelationDef` genérico, nenhuma mudança necessária |
| `src/orm/save-graph-types.ts` | `RelationWrapper` union + `RelationInputValue` conditional — 3 novos casos |

### Camada 2 — Query Builder (joins & includes)

| Arquivo | O que muda |
|---|---|
| `src/query-builder/relation-conditions.ts` | `baseRelationCondition`: MorphOne/MorphMany = HasOne/HasMany + AND discriminator; MorphTo = throw |
| `src/query-builder/relation-join-strategies.ts` | `addRelationJoin`: MorphOne/MorphMany seguem caminho standard com condition atualizada; MorphTo = throw |
| `src/query-builder/relation-include-strategies.ts` | + `morphOneIncludeStrategy`, `morphManyIncludeStrategy`, `morphToIncludeStrategy`; mapa de 4→7 |
| `src/query-builder/relation-service.ts` | `include()` L106 usa `relation.target.name` — precisa de guard para MorphTo; MorphOne/MorphMany passam |
| `src/query-builder/relation-cte-builder.ts` | Usa `relation.target` — guard para MorphTo |
| `src/query-builder/relation-filter-utils.ts` | `splitFilterExpressions` recebe set de table names — para MorphTo, reject filter em v1 |
| `src/query-builder/hydration-planner.ts` | `isMultiplyingRelation`: adicionar MorphMany como multiplicadora |
| `src/query-builder/hydration-manager.ts` | `onRelationIncluded` / `includeRelation` — funciona se MorphOne/MorphMany tiverem `.target` |

### Camada 3 — Entity Runtime (wrappers & lazy loading)

| Arquivo | O que muda |
|---|---|
| `src/orm/entity-relations.ts` | `instantiateWrapper()`: + 3 cases no switch; param type expandido |
| `src/orm/entity.ts` | `isCollectionRelation()`: + MorphMany como coleção |
| `src/orm/entity-hydration.ts` | `populateHydrationCache()`: + MorphOne (como HasOne), + MorphMany (como HasMany), + MorphTo (key composta `type:id`) |
| `src/orm/lazy-batch.ts` | + exports para `loadMorphOneRelation`, `loadMorphManyRelation`, `loadMorphToRelation` |
| `src/orm/lazy-batch/` (novos) | `morph-one.ts`, `morph-many.ts`, `morph-to.ts` |
| `src/orm/relations/` (novos) | `morph-one.ts`, `morph-many.ts`, `morph-to.ts` — wrapper classes |

### Camada 4 — Write Path (save graph & change processor)

| Arquivo | O que muda |
|---|---|
| `src/orm/relation-change-processor.ts` | + `handleMorphManyChange`, `handleMorphOneChange`, `handleMorphToChange` (sets FK + discriminator) |
| `src/orm/save-graph.ts` | `applyRelation` switch: + 3 cases; + `handleMorphMany`, `handleMorphOne`, `handleMorphTo` |

### Camada 5 — Decorators

| Arquivo | O que muda |
|---|---|
| `src/decorators/relations.ts` | + `MorphTo()`, `MorphOne()`, `MorphMany()` decorators + option interfaces |
| `src/decorators/bootstrap.ts` (ou equiv.) | Materializar metadata morph em `TableDef.relations` |

### Camada 6 — Exports

| Arquivo | O que muda |
|---|---|
| `src/index.ts` | Exportar novos wrappers, helpers, lazy-batch |
| `src/decorators/index.ts` | Exportar novos decorators |

---

## Decisões de design

### MorphOne / MorphMany: extensão natural

Essas relações têm **target fixo** (a tabela morph, ex: `comments`, `images`). A diferença para HasOne/HasMany é apenas o filtro extra de discriminador no JOIN:

```sql
-- HasMany normal:
JOIN comments ON comments.post_id = posts.id

-- MorphMany:
JOIN comments ON comments.commentable_id = posts.id
             AND comments.commentable_type = 'post'
```

Todas as APIs existentes (join, include, CTE, filter, hydration) funcionam sem mudança arquitetural.

### MorphTo: caminho separado

MorphTo **não tem `.target` fixo**. Isso quebra:

1. `relation.target.name` (usado em 8+ locais)
2. `resolveTargetColumns(relation)` que lê `relation.target.columns`
3. `splitFilterExpressions` que monta set de table names
4. `ensureCorrelationName` / join planners
5. Hydration cache que assume 1 namespace de PK

**Decisão v1:** MorphTo suporta apenas **lazy loading** e **eager include batch-based** (sem JOIN). O include faz:

1. Executar query principal (roots)
2. Ler `(typeField, idField)` de cada root
3. Agrupar IDs por tipo
4. 1 query por tipo (batch)
5. Remontar resultados por `type:id`

**joinRelation('commentable')** em MorphTo → throw com mensagem clara em v1.

### Cache key para MorphTo

```typescript
// Em entity-hydration.ts para MorphTo:
const compositeKey = `${typeValue}:${idValue}`;
cache.set(compositeKey, row);
```

Necessário porque tabelas diferentes podem ter PKs iguais (post.id=1, video.id=1).

### Discriminator no write path

Ao anexar em MorphMany/MorphOne, o change processor deve setar **2 colunas** no filho:
- `idField` = PK do pai
- `typeField` = `typeValue` da relação

Ao setar MorphTo, deve setar **2 colunas** no root:
- `typeField` = discriminador do target
- `idField` = PK do target

---

## Interfaces finais propostas

```typescript
// schema/relation.ts

interface MorphToRelation<TTargets extends Record<string, TableDef> = Record<string, TableDef>> {
  type: typeof RelationKinds.MorphTo;
  typeField: string;       // coluna que guarda o discriminador ('commentableType')
  idField: string;         // coluna que guarda a FK ('commentableId')
  targets: TTargets;       // { post: postsTable, video: videosTable }
  targetKey?: string;      // default: PK de cada target
  cascade?: CascadeMode;
}

interface MorphOneRelation<TTarget extends TableDef = TableDef> {
  type: typeof RelationKinds.MorphOne;
  target: TTarget;         // tabela morph (images, etc.)
  morphName: string;       // 'imageable' — nome do par polimórfico
  typeField: string;       // 'imageableType' — coluna discriminador no target
  idField: string;         // 'imageableId' — coluna FK no target
  typeValue: string;       // 'user' — valor persistido no discriminador
  localKey?: string;       // default: PK do root
  cascade?: CascadeMode;
}

interface MorphManyRelation<TTarget extends TableDef = TableDef> {
  type: typeof RelationKinds.MorphMany;
  target: TTarget;
  morphName: string;
  typeField: string;
  idField: string;
  typeValue: string;
  localKey?: string;
  cascade?: CascadeMode;
}
```

### Propriedade-chave: MorphOne/MorphMany têm `.target`

Isso é intencional e crítico. Mantém compatibilidade com todo o motor que assume `relation.target`.

### MorphTo **não tem** `.target`

Tem `.targets` (plural) — Record de possíveis targets. O motor nunca deve tentar acessar `.target` nele.

---

## Helpers de schema

```typescript
export const morphTo = <TTargets extends Record<string, TableDef>>(opts: {
  typeField: string;
  idField: string;
  targets: TTargets;
  targetKey?: string;
  cascade?: CascadeMode;
}): MorphToRelation<TTargets> => ({
  type: RelationKinds.MorphTo,
  ...opts
});

export const morphOne = <TTarget extends TableDef>(target: TTarget, opts: {
  as: string;
  typeValue: string;
  localKey?: string;
  typeField?: string;
  idField?: string;
  cascade?: CascadeMode;
}): MorphOneRelation<TTarget> => ({
  type: RelationKinds.MorphOne,
  target,
  morphName: opts.as,
  typeField: opts.typeField ?? `${opts.as}Type`,
  idField: opts.idField ?? `${opts.as}Id`,
  typeValue: opts.typeValue,
  localKey: opts.localKey,
  cascade: opts.cascade
});

export const morphMany = <TTarget extends TableDef>(target: TTarget, opts: {
  as: string;
  typeValue: string;
  localKey?: string;
  typeField?: string;
  idField?: string;
  cascade?: CascadeMode;
}): MorphManyRelation<TTarget> => ({
  type: RelationKinds.MorphMany,
  target,
  morphName: opts.as,
  typeField: opts.typeField ?? `${opts.as}Type`,
  idField: opts.idField ?? `${opts.as}Id`,
  typeValue: opts.typeValue,
  localKey: opts.localKey,
  cascade: opts.cascade
});
```

---

## Type guards necessários

```typescript
// Helpers para o motor interno usar sem casts inseguros

export const isSingleTargetRelation = (
  rel: RelationDef
): rel is Exclude<RelationDef, MorphToRelation> =>
  rel.type !== RelationKinds.MorphTo;

export const isMorphRelation = (rel: RelationDef): rel is
  MorphToRelation | MorphOneRelation | MorphManyRelation =>
  rel.type === RelationKinds.MorphTo ||
  rel.type === RelationKinds.MorphOne ||
  rel.type === RelationKinds.MorphMany;
```

---

## Ordem de implementação (6 fases)

### Fase 1 — Schema & tipos (fundação, sem quebrar nada)
**Risco: zero** — só adiciona tipos, não altera comportamento.

1. `src/schema/relation.ts` — adicionar RelationKinds, interfaces, helpers
2. `src/schema/types.ts` — expandir conditional types
3. `src/orm/entity-metadata.ts` — expandir RelationMetadata union

### Fase 2 — Cercar MorphTo (proteção contra crash)
**Risco: baixo** — só adiciona throws explícitos.

1. `src/query-builder/relation-conditions.ts` — MorphTo case → throw
2. `src/query-builder/relation-join-strategies.ts` — MorphTo guard → throw
3. `src/query-builder/relation-service.ts` — MorphTo guard em include()

### Fase 3 — MorphOne/MorphMany joins & includes (end-to-end)
**Risco: médio** — toca join conditions + hydration.

1. `src/query-builder/relation-conditions.ts` — MorphOne/MorphMany = base condition + AND discriminator
2. `src/query-builder/relation-join-strategies.ts` — MorphOne/MorphMany seguem caminho standard
3. `src/query-builder/relation-include-strategies.ts` — reusar `standardIncludeStrategy` (target existe)
4. `src/query-builder/hydration-planner.ts` — MorphMany como multiplicadora

### Fase 4 — Entity runtime (wrappers, lazy load, hydration)
**Risco: médio** — novos arquivos + extensão de switches.

1. `src/orm/relations/morph-one.ts` — wrapper (reusa API de HasOneReference)
2. `src/orm/relations/morph-many.ts` — wrapper (reusa API de HasManyCollection)
3. `src/orm/relations/morph-to.ts` — wrapper (API própria, target dinâmico)
4. `src/orm/lazy-batch/morph-one.ts` — batch loader (como HasOne + discriminator filter)
5. `src/orm/lazy-batch/morph-many.ts` — batch loader (como HasMany + discriminator filter)
6. `src/orm/lazy-batch/morph-to.ts` — batch loader por tipo (agrupar ids, N queries)
7. `src/orm/entity-relations.ts` — expandir instantiateWrapper
8. `src/orm/entity.ts` — isCollectionRelation + MorphMany
9. `src/orm/entity-hydration.ts` — populateHydrationCache + 3 casos morph

### Fase 5 — Write path (save graph & change processor)
**Risco: médio** — lógica de FK + discriminator.

1. `src/orm/relation-change-processor.ts` — 3 handlers morph
2. `src/orm/save-graph.ts` — 3 handlers + applyRelation switch
3. `src/orm/save-graph-types.ts` — RelationWrapper union + RelationInputValue

### Fase 6 — Decorators & exports
**Risco: baixo** — nova funcionalidade, não altera existente.

1. `src/decorators/relations.ts` — MorphTo, MorphOne, MorphMany decorators
2. `src/decorators/bootstrap.ts` — materializar metadata morph → RelationDef
3. `src/index.ts` — exports
4. `src/decorators/index.ts` — exports

---

## Restrições v1

### ✅ Entra
- MorphTo, MorphOne, MorphMany (schema + decorators)
- Eager include para MorphOne/MorphMany (via JOIN com discriminator)
- Eager include para MorphTo (batch-based, sem JOIN)
- Lazy loading para todos os 3
- Save graph com FK + discriminator
- Relation change processing

### ❌ Não entra
- `joinRelation()` para MorphTo
- Nested include polimórfico por target (ex: `include('commentable', { targets: { post: { include: { author: true } } } })`)
- `whereHas()` para MorphTo
- BelongsToMany polimórfico (morph many-to-many)
- Filter/CTE para MorphTo includes
- Codegen TS para morph includes

---

## Roadmap futuro

### v2
- Nested include por target
- `joinMorph('relation', 'target')` 
- `whereHasMorph('relation', 'target', qb => ...)`
- Tipagem melhorada nos decorators

### v3
- Many-to-many polimórfico
- Codegen TS entendendo includes polimórficos
- Otimizações de batching/cache
- Filtros compostos cross-target

---

## Resumo em uma frase

**MorphMany/MorphOne são relações normais com `.target` fixo + filtro extra de discriminador; MorphTo é uma relação de target dinâmico sem `.target`, resolvida por batch-load agrupado por tipo, com JOIN explicitamente bloqueado em v1.**
