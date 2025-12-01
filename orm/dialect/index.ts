import { SelectQueryNode } from '../ast';

export interface Dialect {
    compile(ast: SelectQueryNode): string;
}