import React from 'react';
import type { Scenario } from '../data/scenarios';

interface ScenarioListProps {
    scenarios: Scenario[];
    selectedId: string | null;
    onSelect: (scenario: Scenario) => void;
}

/**
 * Component responsible for displaying the list of scenarios
 * Follows SRP by handling only scenario list rendering and selection
 */
export const ScenarioList: React.FC<ScenarioListProps> = ({
    scenarios,
    selectedId,
    onSelect
}) => {
    // Group scenarios by category
    const categorizedScenarios = scenarios.reduce((acc, scenario) => {
        if (!acc[scenario.category]) {
            acc[scenario.category] = [];
        }
        acc[scenario.category].push(scenario);
        return acc;
    }, {} as Record<string, Scenario[]>);

    return (
        <div className="scenario-list">
            <h2>Scenarios</h2>
            {Object.entries(categorizedScenarios).map(([category, items]) => (
                <div key={category} className="scenario-category">
                    <h3>{category}</h3>
                    <ul>
                        {items.map((scenario) => (
                            <li
                                key={scenario.id}
                                className={selectedId === scenario.id ? 'selected' : ''}
                                onClick={() => onSelect(scenario)}
                            >
                                <div className="scenario-title">{scenario.title}</div>
                                <div className="scenario-desc">{scenario.description}</div>
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </div>
    );
};
