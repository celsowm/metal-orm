import React, { useState, useEffect } from 'react';
import { Card, Button, Title, Text, Tabs, Loader, Group, Stack, Badge, ActionIcon, CopyButton, Tooltip } from '@mantine/core';
import { IconPlayerPlay, IconCode, IconDatabase, IconCheck, IconCopy } from '@tabler/icons-react'; // Assuming tabler icons are available or we use text
import type { Scenario } from '../data/scenarios';
import type { QueryExecutionResult } from '@orm/playground/features/playground/api/types';
import { CodeDisplay } from './CodeDisplay';
import { ResultsTabs } from './ResultsTabs';
import { PlaygroundApiService } from '../services/PlaygroundApiService';

interface QueryExecutorProps {
    scenario: Scenario | null;
    queryService: PlaygroundApiService;
}

/**
 * Component responsible for executing queries and displaying results
 * Follows SRP by coordinating query execution and result display
 */
export const QueryExecutor: React.FC<QueryExecutorProps> = ({
    scenario,
    queryService
}) => {
    const [result, setResult] = useState<QueryExecutionResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (scenario) {
            executeQuery();
        }
    }, [scenario]);

    const executeQuery = async () => {
        if (!scenario) return;

        setIsLoading(true);
        const executionResult = await queryService.executeScenario(scenario.id);
        setResult(executionResult);
        setIsLoading(false);
    };

    if (!scenario) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--mantine-color-dimmed)' }}>
                <Text>Select a scenario from the list to execute</Text>
            </div>
        );
    }

    return (
        <Stack gap="lg">
            <div>
                <Group justify="space-between" align="start" mb="md">
                    <div>
                        <Title order={2}>{scenario.title}</Title>
                        <Text c="dimmed" mt="xs">{scenario.description}</Text>
                    </div>
                    <Button
                        onClick={executeQuery}
                        loading={isLoading}
                        leftSection={<span>▶</span>}
                        variant="gradient"
                        gradient={{ from: 'indigo', to: 'cyan' }}
                    >
                        Re-execute Query
                    </Button>
                </Group>
            </div>

            {result && (
                <>
                    <Card withBorder shadow="sm" radius="md" p={0}>
                        <Tabs defaultValue="sql">
                            <Tabs.List>
                                <Tabs.Tab value="sql" leftSection={<span>SQL</span>}>Generated SQL</Tabs.Tab>
                                <Tabs.Tab value="typescript" leftSection={<span>TS</span>}>TypeScript</Tabs.Tab>
                            </Tabs.List>

                            <Tabs.Panel value="sql">
                                <CodeDisplay code={result.sql} language="sql" />
                            </Tabs.Panel>

                            <Tabs.Panel value="typescript">
                                <CodeDisplay code={result.typescriptCode} language="typescript" />
                            </Tabs.Panel>
                        </Tabs>
                    </Card>

                    <ResultsTabs
                        results={result.results}
                        hydratedResults={result.hydratedResults}
                        executionTime={result.executionTime}
                        error={result.error}
                    />
                </>
            )}

            {isLoading && (
                <Group justify="center" p="xl">
                    <Loader type="dots" />
                    <Text>Executing query...</Text>
                </Group>
            )}
        </Stack>
    );
};
