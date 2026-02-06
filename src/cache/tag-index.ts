/**
 * Indexa chaves por tags para invalidação em massa
 * Implementação em memória (pode ser persistida no Redis)
 */
export class TagIndex {
  private tagToKeys: Map<string, Set<string>> = new Map();
  private keyToTags: Map<string, Set<string>> = new Map();

  /**
   * Registra que uma chave pertence a determinadas tags
   */
  register(key: string, tags: string[]): void {
    // Mapeia tag -> chaves
    for (const tag of tags) {
      if (!this.tagToKeys.has(tag)) {
        this.tagToKeys.set(tag, new Set());
      }
      this.tagToKeys.get(tag)!.add(key);
    }

    // Mapeia chave -> tags (para limpeza futura)
    const existingTags = this.keyToTags.get(key) ?? new Set();
    tags.forEach(tag => existingTags.add(tag));
    this.keyToTags.set(key, existingTags);
  }

  /**
   * Remove uma chave do índice
   */
  unregister(key: string): void {
    const tags = this.keyToTags.get(key);
    if (tags) {
      for (const tag of tags) {
        this.tagToKeys.get(tag)?.delete(key);
        // Limpa tags vazias
        if (this.tagToKeys.get(tag)?.size === 0) {
          this.tagToKeys.delete(tag);
        }
      }
      this.keyToTags.delete(key);
    }
  }

  /**
   * Obtém todas as chaves de uma tag
   */
  getKeysByTag(tag: string): string[] {
    return Array.from(this.tagToKeys.get(tag) ?? []);
  }

  /**
   * Obtém todas as tags de uma chave
   */
  getTagsByKey(key: string): string[] {
    return Array.from(this.keyToTags.get(key) ?? []);
  }

  /**
   * Invalida todas as chaves de um conjunto de tags
   * Retorna as chaves afetadas
   */
  invalidateTags(tags: string[]): string[] {
    const keysToInvalidate = new Set<string>();
    
    for (const tag of tags) {
      const keys = this.tagToKeys.get(tag);
      if (keys) {
        for (const key of keys) {
          keysToInvalidate.add(key);
          this.unregister(key); // Remove do índice
        }
        // Remove a tag completamente
        this.tagToKeys.delete(tag);
      }
    }

    return Array.from(keysToInvalidate);
  }

  /**
   * Invalida por prefixo (útil para multi-tenancy)
   * Retorna as chaves afetadas
   */
  invalidatePrefix(prefix: string): string[] {
    const keysToInvalidate: string[] = [];
    
    for (const key of this.keyToTags.keys()) {
      if (key.startsWith(prefix)) {
        keysToInvalidate.push(key);
        this.unregister(key);
      }
    }

    return keysToInvalidate;
  }

  /**
   * Retorna todas as tags registradas
   */
  getAllTags(): string[] {
    return Array.from(this.tagToKeys.keys());
  }

  /**
   * Retorna todas as chaves registradas
   */
  getAllKeys(): string[] {
    return Array.from(this.keyToTags.keys());
  }

  /**
   * Limpa todo o índice
   */
  clear(): void {
    this.tagToKeys.clear();
    this.keyToTags.clear();
  }

  /**
   * Retorna estatísticas do índice
   */
  getStats(): { tags: number; keys: number } {
    return {
      tags: this.tagToKeys.size,
      keys: this.keyToTags.size,
    };
  }
}
