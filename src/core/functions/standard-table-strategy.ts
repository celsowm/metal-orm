import type { TableFunctionRenderer, TableFunctionStrategy } from './table-types.js';

export class StandardTableFunctionStrategy implements TableFunctionStrategy {
  protected renderers: Map<string, TableFunctionRenderer> = new Map();

  protected add(key: string, renderer: TableFunctionRenderer) {
    this.renderers.set(key, renderer);
  }

  getRenderer(key: string): TableFunctionRenderer | undefined {
    return this.renderers.get(key);
  }
}
