import { describe, it, expect } from 'vitest';

const { createNamingStrategy } = await import('../../scripts/naming-strategy.mjs');

describe('generate-entities naming strategy', () => {
  it('pluralizes Portuguese relation names and relation properties', () => {
    const strategy = createNamingStrategy('pt-BR');
    expect(strategy.pluralize('mao')).toBe('maos');
    expect(strategy.pluralize('consul')).toBe('consules');
    expect(strategy.hasManyProperty('estado_solicitacao')).toBe('estadosSolicitacao');
    expect(strategy.hasManyProperty('fator_correcao')).toBe('fatoresCorrecao');
    expect(strategy.hasManyProperty('categoria')).toBe('categorias');
    expect(strategy.hasOneProperty('estado_solicitacao')).toBe('estadoSolicitacao');
    expect(strategy.hasOneProperty('categorias')).toBe('categoria');
  });

  it('pluralizes fator_correcao as factorsCorrecao on relations', () => {
    const strategy = createNamingStrategy('pt-BR');
    expect(strategy.hasManyProperty('fator_correcao')).toBe('fatoresCorrecao');
  });

  it('respects overrides passed from JSON maps', () => {
    const strategy = createNamingStrategy('pt-BR', {
      irmao: 'irmaos',
      pais: 'paises'
    });
    expect(strategy.pluralize('irmao')).toBe('irmaos');
    expect(strategy.pluralize('pais')).toBe('paises');
    expect(strategy.hasManyProperty('irmao')).toBe('irmaos');
  });

  it('applies relation property overrides by class name', () => {
    const relationOverrides = {
      Empresa: {
        pessoas: 'raizesCNPJs',
        filiais: 'unidadesNegocio'
      },
      Usuario: {
        posts: 'publicacoes'
      }
    };
    const strategy = createNamingStrategy('pt-BR', {}, relationOverrides);

    // Overridden properties
    expect(strategy.applyRelationOverride('Empresa', 'pessoas')).toBe('raizesCNPJs');
    expect(strategy.applyRelationOverride('Empresa', 'filiais')).toBe('unidadesNegocio');
    expect(strategy.applyRelationOverride('Usuario', 'posts')).toBe('publicacoes');

    // Non-overridden properties pass through unchanged
    expect(strategy.applyRelationOverride('Empresa', 'clientes')).toBe('clientes');
    expect(strategy.applyRelationOverride('OutraClasse', 'pessoas')).toBe('pessoas');
  });

  it('applies class name overrides for table names', () => {
    const classNameOverrides = {
      'users_table': 'UserAccount',
      'order_items': 'OrderLineItem',
      'legacy_tbl': 'LegacyTable'
    };
    const strategy = createNamingStrategy('en', {}, {}, classNameOverrides);

    // Overridden class names
    expect(strategy.classNameFromTable('users_table')).toBe('UserAccount');
    expect(strategy.classNameFromTable('order_items')).toBe('OrderLineItem');
    expect(strategy.classNameFromTable('legacy_tbl')).toBe('LegacyTable');

    // Non-overridden tables follow normal naming
    expect(strategy.classNameFromTable('products')).toBe('Product');
    expect(strategy.classNameFromTable('categories')).toBe('Category');
  });

  it('classNameOverrides works with irregulars and relation overrides together', () => {
    const irregulars = { person: 'people' };
    const relationOverrides = { User: { posts: 'articles' } };
    const classNameOverrides = { 'users_tbl': 'UserProfile' };

    const strategy = createNamingStrategy('en', irregulars, relationOverrides, classNameOverrides);

    // Class name override
    expect(strategy.classNameFromTable('users_tbl')).toBe('UserProfile');

    // Irregular pluralization still works
    expect(strategy.pluralize('person')).toBe('people');

    // Relation override still works
    expect(strategy.applyRelationOverride('User', 'posts')).toBe('articles');

    // Normal naming for non-overridden tables
    expect(strategy.classNameFromTable('posts')).toBe('Post');
  });

  describe('belongsToProperty', () => {
    it('uses trimmed FK name when it ends with _id', () => {
      const strategy = createNamingStrategy('pt-BR');
      expect(strategy.belongsToProperty('usuario_id', 'usuarios')).toBe('usuario');
      expect(strategy.belongsToProperty('categoria_id', 'categorias')).toBe('categoria');
      expect(strategy.belongsToProperty('especializada_id', 'usuarios')).toBe('especializada');
    });

    it('uses FK name when it does not end with _id but is different from target table', () => {
      const strategy = createNamingStrategy('pt-BR');
      // FK names like "criador", "responsavel_judicial" should be preserved
      expect(strategy.belongsToProperty('criador', 'dbo.usuario')).toBe('criador');
      expect(strategy.belongsToProperty('responsavel_judicial', 'dbo.usuario')).toBe('responsavelJudicial');
      expect(strategy.belongsToProperty('responsavel_administrativo', 'dbo.usuario')).toBe('responsavelAdministrativo');
      expect(strategy.belongsToProperty('responsavel_substituto', 'dbo.usuario')).toBe('responsavelSubstituto');
    });

    it('falls back to target table name when FK name matches target', () => {
      const strategy = createNamingStrategy('pt-BR');
      // When FK name is same as target table (e.g., "usuario" FK to "usuarios" table)
      expect(strategy.belongsToProperty('usuario', 'usuarios')).toBe('usuario');
      expect(strategy.belongsToProperty('categoria', 'categorias')).toBe('categoria');
    });

    it('handles schema-prefixed target tables', () => {
      const strategy = createNamingStrategy('pt-BR');
      // Should strip schema prefix when comparing
      expect(strategy.belongsToProperty('criador', 'dbo.usuario')).toBe('criador');
      expect(strategy.belongsToProperty('usuario_id', 'public.usuarios')).toBe('usuario');
    });

    it('generates unique property names for multiple FKs to same table', () => {
      const strategy = createNamingStrategy('pt-BR');
      // Simulating the bug scenario: 4 FKs to usuario table
      const props = new Set();
      props.add(strategy.belongsToProperty('criador', 'dbo.usuario'));
      props.add(strategy.belongsToProperty('responsavel_judicial', 'dbo.usuario'));
      props.add(strategy.belongsToProperty('responsavel_administrativo', 'dbo.usuario'));
      props.add(strategy.belongsToProperty('responsavel_substituto', 'dbo.usuario'));
      props.add(strategy.belongsToProperty('especializada_id', 'dbo.usuario'));

      // All should be unique
      expect(props.size).toBe(5);
      expect(props.has('criador')).toBe(true);
      expect(props.has('responsavelJudicial')).toBe(true);
      expect(props.has('responsavelAdministrativo')).toBe(true);
      expect(props.has('responsavelSubstituto')).toBe(true);
      expect(props.has('especializada')).toBe(true);
    });
  });
});
