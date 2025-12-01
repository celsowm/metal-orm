import { SelectQueryBuilder } from '@orm/builder/select';

export interface Scenario {
    id: string;
    title: string;
    description: string;
    category: string;
    build: (builder: SelectQueryBuilder<any>) => SelectQueryBuilder<any>;
}
