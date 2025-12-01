import { SelectQueryBuilder } from '../../../../metal-orm/src/builder/select';

export interface Scenario {
    id: string;
    title: string;
    description: string;
    category: string;
    build: (builder: SelectQueryBuilder<any>) => SelectQueryBuilder<any>;
}
