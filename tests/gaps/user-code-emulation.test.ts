import { describe, it, expect, vi } from 'vitest';
import type { OrmSession } from '../../src/orm/orm-session.js';
import { eq, like } from '../../src/core/ast/expression.js';
import { lower } from '../../src/core/functions/text.js';
import { entityRef, selectFromEntity, bootstrapEntities } from '../../src/decorators/bootstrap.js';
import { Entity, PrimaryKey, Column, BelongsTo } from '../../src/decorators/index.js';
import { col } from '../../src/schema/column-types.js';

// Level 3 decorator-based entity definitions
@Entity()
class MockEspecializada {
  @PrimaryKey(col.int())
  id!: number;

  @Column(col.int())
  equipe_triagem_id!: number;

  @Column(col.int())
  responsavel_id!: number;

  @Column(col.varchar(255))
  nome!: string;

  @Column(col.boolean())
  usa_pge_digital!: boolean;

  @Column(col.varchar(255))
  codigo_ad!: string;

  @Column(col.boolean())
  usa_plantao_audiencia!: boolean;

  @Column(col.int())
  tipo_divisao_carga_trabalho_id!: number;

  @Column(col.int())
  tipo_localidade_especializada_id!: number;

  @Column(col.varchar(255))
  email!: string;

  @Column(col.boolean())
  restricao_ponto_focal!: boolean;

  @Column(col.varchar(255))
  sigla!: string;

  @Column(col.int())
  tipo_especializada_id!: number;

  @Column(col.boolean())
  especializada_triagem!: boolean;

  @Column(col.int())
  caixa_entrada_max!: number;

  // Relacionamentos
  @BelongsTo({ target: () => MockEquipeTriagem, foreignKey: 'equipe_triagem_id' })
  equipeTriagem?: any;

  @BelongsTo({ target: () => MockResponsavel, foreignKey: 'responsavel_id' })
  responsavel?: any;

  @BelongsTo({ target: () => MockTipoDivisaoCargaTrabalho, foreignKey: 'tipo_divisao_carga_trabalho_id' })
  tipoDivisaoCargaTrabalho?: any;

  @BelongsTo({ target: () => MockTipoLocalidadeEspecializada, foreignKey: 'tipo_localidade_especializada_id' })
  tipoLocalidadeEspecializada?: any;

  @BelongsTo({ target: () => MockTipoEspecializada, foreignKey: 'tipo_especializada_id' })
  tipoEspecializada?: any;
}

@Entity()
class MockEquipeTriagem {
  @PrimaryKey(col.int())
  id!: number;

  @Column(col.varchar(255))
  nome!: string;
}

@Entity()
class MockResponsavel {
  @PrimaryKey(col.int())
  id!: number;

  @Column(col.varchar(255))
  nome!: string;

  @Column(col.varchar(255))
  login!: string;

  @Column(col.varchar(255))
  cargo!: string;
}

@Entity()
class MockTipoDivisaoCargaTrabalho {
  @PrimaryKey(col.int())
  id!: number;

  @Column(col.varchar(255))
  nome!: string;
}

@Entity()
class MockTipoLocalidadeEspecializada {
  @PrimaryKey(col.int())
  id!: number;

  @Column(col.varchar(255))
  nome!: string;
}

@Entity()
class MockTipoEspecializada {
  @PrimaryKey(col.int())
  id!: number;

  @Column(col.varchar(255))
  nome!: string;

  @Column(col.text())
  descricao!: string;
}

// Initialize entity metadata
bootstrapEntities();

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

const entitySelectColumns = [
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
  'caixa_entrada_max'
];

const selectColumns = [
  ...entitySelectColumns,
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

const buildSelectedQuery = (options?: EspecializadaListOptions, includeMissingColumn = false) => {
  const columnsToSelect = includeMissingColumn ? selectColumns : entitySelectColumns;
  let builder = buildFilteredQuery(options).select(...(columnsToSelect as any));

  // ESTE LOOP DEVE FALHAR - tentando incluir relação 'bullshit' que não existe
  for (const relation of belongsToRelations) {
    // @ts-expect-error - Now caught by strict typing
    builder = builder.include(relation, { columns: belongsToRelationColumns[relation] });
  }
  return builder.orderBy(E.nome, 'ASC');
};



describe('Metal-ORM Gaps - User Code Emulation', () => {

  it('should expose runtime errors when using non-existent columns', () => {
    expect(() => {
      // @ts-expect-error - Now caught by strict typing
      buildFilteredQuery().select('this_column_not_exists_error');
    }).toThrow(/Column 'this_column_not_exists_error'/);
  });

  it('should expose runtime errors when using non-existent relations', () => {
    expect(() => buildSelectedQuery()).toThrow(/Relation 'bullshit' not found/);
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

    // Esta propriedade NÃO deve existir - agora o TypeScript deve pegar isso
    const invalidProp = (testEntityRef as any).this_column_not_exists_error;

    expect(validProps).toBeDefined();
  });

  it('should test query builder robustness with invalid includes', () => {
    const queryBuilder = selectFromEntity(MockEspecializada);
    expect(() =>
      queryBuilder.include('bullshit' as any, { columns: ['id', 'nome'] }),
    ).toThrow(/Relation 'bullshit' not found/);
  });

  it('should test column selection robustness', () => {
    const queryBuilder = selectFromEntity(MockEspecializada);
    expect(() => {
      // @ts-expect-error - Now caught by strict typing
      queryBuilder.select('this_column_not_exists_error');
    }).toThrow(/Column 'this_column_not_exists_error'/);
  });

  it('should demonstrate type safety gaps in real-world usage', () => {
    const options: EspecializadaListOptions = {
      nome: 'teste',
      responsavel_id: 1,
      limit: 10,
      offset: 0
    };

    expect(() => buildSelectedQuery(options, true)).toThrow(/Column 'this_column_not_exists_error'/);
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

    // Agora que usamos decoradores, devemos verificar contra a definição da tabela
    const table = E; // entityRef retorna uma table reference
    const tableColumnNames = Object.keys(table.columns);
    const queryColumns = selectColumns;
    const missingInEntity = queryColumns.filter(col => !tableColumnNames.includes(col));
    const missingInQuery = tableColumnNames.filter(col => !queryColumns.includes(col));

    console.log('📊 Schema Analysis:');
    console.log('Table columns:', tableColumnNames);
    console.log('Query columns:', queryColumns);
    console.log('Columns in query but not in table:', missingInEntity);
    console.log('Columns in table but not in query:', missingInQuery);

    // Agora que usamos decoradores, todas as colunas válidas existem na tabela
    // Apenas 'this_column_not_exists_error' deve estar faltando
    expect(missingInEntity).toEqual(['this_column_not_exists_error']);
    expect(missingInQuery.length).toBe(0); // Todas as colunas da tabela estão sendo selecionadas
  });
});
