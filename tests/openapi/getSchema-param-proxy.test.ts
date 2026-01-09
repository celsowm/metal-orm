import { describe, expect, it } from 'vitest';
import { col } from '../../src/schema/column-types.js';
import { defineTable } from '../../src/schema/table.js';
import { selectFrom } from '../../src/query/index.js';
import { createParamProxy, eq } from '../../src/core/ast/expression.js';

const users = defineTable('users', {
  id: col.primaryKey(col.int()),
  nome: col.varchar(255)
});

describe('getSchema() with Param operands', () => {
  it('includes filter parameters when using param proxy operands', () => {
    const q = createParamProxy();
    const { parameters } = selectFrom(users)
      .where(eq(users.columns.nome, q.filter.nome))
      .getSchema({ mode: 'selected' });

    const filterParam = parameters?.find(param => param.name === 'filter');
    expect(filterParam?.in).toBe('query');
    expect(filterParam?.style).toBe('deepObject');
    expect(filterParam?.explode).toBe(true);
    expect(filterParam?.schema?.properties?.nome).toBeDefined();
  });
});
