import React from 'react';
import { NavLink, Stack, Text, ScrollArea } from '@mantine/core';
import type { Scenario } from '../data/scenarios.js';

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
    const categorizedEntries = Object.entries(categorizedScenarios) as [string, Scenario[]][];

    return (
        <ScrollArea h="calc(100vh - 80px)">
            <Stack gap="md">
                {categorizedEntries.map(([category, items]) => (
                    <div key={category}>
                        <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb="xs" px="xs">
                            {category}
                        </Text>
                        <Stack gap={2}>
                            {items.map((scenario) => (
                                <NavLink
                                    key={scenario.id}
                                    label={scenario.title}
                                    description={scenario.description}
                                    active={selectedId === scenario.id}
                                    onClick={() => onSelect(scenario)}
                                    variant="light"
                                    color="indigo"
                                    style={{ borderRadius: 'var(--mantine-radius-md)' }}
                                />
                            ))}
                        </Stack>
                    </div>
                ))}
            </Stack>
        </ScrollArea>
    );
};
