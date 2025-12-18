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
});
