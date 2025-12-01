import type { Scenario } from './types';
import { BASIC_SCENARIOS } from './basics';
import { FILTERING_SCENARIOS } from './filtering';
import { RELATIONSHIP_SCENARIOS } from './relationships';
import { AGGREGATION_SCENARIOS } from './aggregation';
import { PAGINATION_SCENARIOS } from './pagination';
import { ORDERING_SCENARIOS } from './ordering';
import { HYDRATION_SCENARIOS } from './hydration';
import { EDGE_CASE_SCENARIOS } from './edge_cases';

export * from './types';
export { BASIC_SCENARIOS };
export { FILTERING_SCENARIOS };
export { RELATIONSHIP_SCENARIOS };
export { AGGREGATION_SCENARIOS };
export { PAGINATION_SCENARIOS };
export { ORDERING_SCENARIOS };
export { HYDRATION_SCENARIOS };

export const SCENARIOS: Scenario[] = [
    ...BASIC_SCENARIOS,
    ...FILTERING_SCENARIOS,
    ...RELATIONSHIP_SCENARIOS,
    ...AGGREGATION_SCENARIOS,
    ...ORDERING_SCENARIOS,
    ...PAGINATION_SCENARIOS,
    ...HYDRATION_SCENARIOS,
    ...EDGE_CASE_SCENARIOS
];
