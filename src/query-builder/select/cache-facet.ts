import type { CacheOptions, CacheState, Duration } from '../../cache/cache-interfaces.js';

/**
 * Facet para gerenciar estado de cache no SelectQueryBuilder
 * Segue o padrão de facets existente no projeto
 */
export interface CacheFacetContext {
  state: CacheState;
}

export class CacheFacet {
  /**
   * Configura opções de cache no contexto
   */
  cache(
    context: CacheFacetContext,
    options: CacheOptions
  ): CacheFacetContext {
    return {
      state: {
        ...context.state,
        options,
      },
    };
  }

  /**
   * Obtém as opções de cache do contexto
   */
  getOptions(context: CacheFacetContext): CacheOptions | undefined {
    return context.state.options;
  }

  /**
   * Verifica se há configuração de cache
   */
  hasCache(context: CacheFacetContext): boolean {
    return context.state.options !== undefined;
  }

  /**
   * Cria opções de cache a partir de parâmetros variados
   * API flexível para diferentes casos de uso
   */
  static createOptions(
    key: string,
    ttl: Duration,
    tagsOrConfig?: string[] | { tags?: string[]; autoInvalidate?: boolean }
  ): CacheOptions {
    let tags: string[] | undefined;
    let autoInvalidate: boolean | undefined;

    if (Array.isArray(tagsOrConfig)) {
      tags = tagsOrConfig;
    } else if (tagsOrConfig) {
      tags = tagsOrConfig.tags;
      autoInvalidate = tagsOrConfig.autoInvalidate;
    }

    return {
      key,
      ttl,
      tags,
      autoInvalidate,
    };
  }
}
