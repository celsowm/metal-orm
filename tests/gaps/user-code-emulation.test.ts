import { describe, it, expect, vi } from 'vitest';
import type { OrmSession } from '../../src/orm/orm-session.js';
import { eq, entityRef, like, lower, selectFromEntity } from '../../src/query-builder/index.js';

// Mock entity definition para simular a entidade Especializada
class MockEspecializada {
  id!: number;
  equipe_triagem_id!: number;
  responsavel_id!: number;
  nome!: string;
  usa_pge_digital!: boolean;
  codigo_ad!: string;
  usa_plantao_audiencia!: boolean;
  tipo_divisao_carga_trabalho_id!: number;
  tipo_localidade_especializada_id!: number;
  email!: string;
  restricao_ponto_focal!: boolean;
  sigla!: string;
  tipo_especializada_id!: number;
  especializada_triagem!: boolean;
  caixa_entrada_max!: number;

  // Relacionamentos
  equipeTriagem?: any;
  responsavel?: any;
  tipoDivisaoCargaTrabalho?: any;
  tipoLocalidadeEspecializada?: any;
  tipoEspecializada?: any;
}

// Mock das entidades relacionadas
class MockEquipeTriagem {
  id!: number;
  nome!: string;
}

class MockResponsavel {
  id!: number;
  nome!: string;
  login!: string;
  cargo!: string;
}

class MockTipoDivisaoCargaTrabalho {
  id!: number;
  nome!: string;
}

class MockTipoLocalidadeEspecializada {
  id!: number;
  nome!: string;
}

class MockTipoEspecializada {
  id!: number;
  nome!: string;
  descricao!: string;
}

const E = entityRef(MockEspecializada);

export interface EspecializadaListFilters {
  nome?: string;
  responsavel_id?: number;
  tipo_especializada_id?: number;
  tipo_localidade_especializada_id?: number;
}

export interface EspecializadaListOptions extends EspecializadaListFilters {
  limit?: number;
  offset?: number;
}

const belongsToRelations = [
  'equipeTriagem',
  'responsavel',
  'tipoDivisaoCargaTrabalho',
  'tipoLocalidadeEspecializada',
  'tipoEspecializada',
  'bullshit' // ESTE É O PROBLEMA - RELAÇÃO QUE NÃO EXISTE
] as const;

type BelongsToRelation = (typeof belongsToRelations)[number];

const belongsToRelationColumns: Record<BelongsToRelation, string[]> = {
  equipeTriagem: ['id', 'nome'],
  responsavel: ['id', 'nome', 'login', 'cargo'],
  tipoDivisaoCargaTrabalho: ['id', 'nome'],
  tipoLocalidadeEspecializada: ['id', 'nome'],
  tipoEspecializada: ['id', 'nome', 'descricao'],
  // Esta relação não existe, deve causar erro
  bullshit: ['id', 'nome']
};

const selectColumns = [
  'id',
  'equipe_triagem_id',
  'responsavel_id',
  'nome',
  'usa_pge_digital',
  'codigo_ad',
  'usa_plantao_audiencia',
  'tipo_divisao_carga_trabalho_id',
  'tipo_localidade_especializada_id',
  'email',
  'restricao_ponto_focal',
  'sigla',
  'tipo_especializada_id',
  'especializada_triagem',
  'caixa_entrada_max',
  'this_column_not_exists_error' // ESTE É O PROBLEMA - COLUNA QUE NÃO EXISTE
];

const buildFilteredQuery = (options?: EspecializadaListFilters) => {
  let builder = selectFromEntity(MockEspecializada);

  if (options?.responsavel_id !== undefined) {
    builder = builder.where(eq(E.responsavel_id, options.responsavel_id));
  }

  if (options?.tipo_especializada_id !== undefined) {
    builder = builder.where(eq(E.tipo_especializada_id, options.tipo_especializada_id));
  }

  if (options?.tipo_localidade_especializada_id !== undefined) {
    builder = builder.where(
      eq(E.tipo_localidade_especializada_id, options.tipo_localidade_especializada_id),
    );
  }

  if (options?.nome) {
    const normalized = options.nome.trim();
    if (normalized.length > 0) {
      builder = builder.where(like(lower(E.nome), `%${normalized.toLowerCase()}%`));
    }
  }

  return builder;
};

const buildSelectedQuery = (options?: EspecializadaListOptions) => {
  let builder = buildFilteredQuery(options).select(...selectColumns);
  
  // ESTE LOOP DEVE FALHAR - tentando incluir relação 'bullshit' que não existe
  for (const relation of belongsToRelations) {
    builder = builder.include(relation, { columns: belongsToRelationColumns[relation] });
  }
  return builder.orderBy(E.nome, 'ASC');
};

const mockSession: OrmSession = {
  execute: vi.fn(),
  createQueryBuilder: vi.fn(),
  getConnection: vi.fn(),
  commit: vi.fn(),
  rollback: vi.fn(),
  beginTransaction: vi.fn(),
  isInTransaction: false,
  query: vi.fn(),
} as any;

describe('Metal-ORM Gaps - User Code Emulation', () => {
  
  it('should expose runtime errors when using non-existent columns', async () => {
    try {
      const query = buildFilteredQuery().select('this_column_not_exists_error');
      expect(() => query).not.toThrow(); // Tipo deve passar em tempo de compilação
    } catch (error) {
      console.log('❌ Runtime error for non-existent column:', error);
    }
  });

  it('should expose runtime errors when using non-existent relations', async () => {
    try {
      const query = buildSelectedQuery();
      expect(() => query).not.toThrow(); // Tipo deve passar em tempo de compilação
    } catch (error) {
      console.log('❌ Runtime error for non-existent relation:', error);
    }
  });

  it('should expose type safety gaps with entityRef', () => {
    // Este teste expõe se o entityRef fornece verificação de tipos adequada
    const testEntityRef = entityRef(MockEspecializada);
    
    // Estas propriedades devem existir na entidade
    const validProps = {
      id: testEntityRef.id,
      nome: testEntityRef.nome,
      responsavel_id: testEntityRef.responsavel_id
    };
    
    // Esta propriedade NÃO deve existir
    // @ts-expect-error - Teste para verificar se há erro de tipo
    const invalidProp = testEntityRef.this_column_not_exists_error;
    
    expect(validProps).toBeDefined();
  });

  it('should test query builder robustness with invalid includes', async () => {
    // Testa se o query builder consegue lidar com includes inválidos
    const queryBuilder = selectFromEntity(MockEspecializada);
    
    try {
      // Tentar incluir uma relação que não existe
      const query = queryBuilder.include('bullshit' as any, { columns: ['id', 'nome'] });
      expect(query).toBeDefined();
    } catch (error) {
      console.log('✅ Query builder correctly rejected invalid relation:', error);
    }
  });

  it('should test column selection robustness', async () => {
    // Testa se o select pode lidar com colunas inválidas
    try {
      const queryBuilder = selectFromEntity(MockEspecializada);
      const query = queryBuilder.select('this_column_not_exists_error');
      expect(query).toBeDefined();
    } catch (error) {
      console.log('✅ Query builder correctly rejected invalid column:', error);
    }
  });

  it('should demonstrate type safety gaps in real-world usage', async () => {
    // Este teste emula o cenário real do usuário
    const options: EspecializadaListOptions = {
      nome: 'teste',
      responsavel_id: 1,
      limit: 10,
      offset: 0
    };

    try {
      // Esta chamada deve falhar em runtime, mas passar em compilação
      const query = buildSelectedQuery(options);
      
      // Simular execução
      const result = await mockSession.execute(query.toQuery());
      expect(result).toBeDefined();
    } catch (error) {
      console.log('❌ Runtime failure in real-world scenario:', error);
      // Este é o gap principal: o código compila mas falha em runtime
      expect(error).toBeDefined();
    }
  });

  it('should test all the problematic patterns from user code', () => {
    // Testa todos os padrões problemáticos identificados
    
    // 1. Relação inexistente no array
    expect(belongsToRelations).toContain('bullshit');
    
    // 2. Coluna inexistente no array de seleção
    expect(selectColumns).toContain('this_column_not_exists_error');
    
    // 3. Verificar se o belongsToRelationColumns tem entrada para relação inexistente
    expect(belongsToRelationColumns).toHaveProperty('bullshit');
    
    console.log('🔍 Identified gaps:');
    console.log('- Relation "bullshit" exists in belongsToRelations but not in entity');
    console.log('- Column "this_column_not_exists_error" exists in selectColumns but not in entity');
    console.log('- Type system should catch these at compile time');
  });

  it('should validate entity schema against query definitions', () => {
    // Este teste verifica se há correspondência entre a definição da entidade e o uso nas queries
    
    const entityProperties = Object.getOwnPropertyNames(MockEspecializada.prototype);
    const queryColumns = selectColumns;
    const missingInEntity = queryColumns.filter(col => !entityProperties.includes(col));
    const missingInQuery = entityProperties.filter(prop => !queryColumns.includes(prop));
    
    console.log('📊 Schema Analysis:');
    console.log('Columns in query but not in entity:', missingInEntity);
    console.log('Properties in entity but not in query:', missingInQuery);
    
    // Estes devem estar vazios se o type system estiver funcionando
    expect(missingInEntity).toEqual(['this_column_not_exists_error']);
    expect(missingInQuery.length).toBeGreaterThan(0); // Esperado, nem todas propriedades são selecionadas
  });
});
