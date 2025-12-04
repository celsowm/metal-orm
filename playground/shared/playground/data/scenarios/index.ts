import type { Scenario } from './types.js';
import { BASIC_SCENARIOS } from './basics.js';
import { FILTERING_SCENARIOS } from './filtering.js';
import { RELATIONSHIP_SCENARIOS } from './relationships.js';
import { AGGREGATION_SCENARIOS } from './aggregation.js';
import { PAGINATION_SCENARIOS } from './pagination.js';
import { ORDERING_SCENARIOS } from './ordering.js';
import { HYDRATION_SCENARIOS } from './hydration.js';
import { EDGE_CASE_SCENARIOS } from './edge_cases.js';

export * from './types.js';
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
