import React, { useState, useEffect } from 'react';
import { Card, Button, Title, Text, Tabs, Loader, Group, Stack, Badge, ActionIcon, CopyButton, Tooltip } from '@mantine/core';
import { IconPlayerPlay, IconCode, IconDatabase, IconCheck, IconCopy } from '@tabler/icons-react'; // Assuming tabler icons are available or we use text
import type { Scenario } from '../data/scenarios.js';
import type { QueryExecutionResult } from '@orm/playground/features/playground/api/types.js';
import { CodeDisplay } from './CodeDisplay.js';
import { ResultsTabs } from './ResultsTabs.js';
import { PlaygroundApiService } from '../services/PlaygroundApiService.js';

const describeBinding = (value: unknown): { display: string; type: string } => {
    if (value === null) {
        return { display: 'null', type: 'null' };
    }
    if (typeof value === 'undefined') {
        return { display: 'undefined', type: 'undefined' };
    }
    if (typeof value === 'string') {
        return { display: `"${value}"`, type: 'string' };
    }
    if (typeof value === 'number') {
        return { display: value.toString(), type: Number.isInteger(value) ? 'integer' : 'number' };
    }
    if (typeof value === 'boolean') {
        return { display: value ? 'true' : 'false', type: 'boolean' };
    }
    if (Array.isArray(value)) {
        return { display: JSON.stringify(value), type: 'array' };
    }
    return { display: JSON.stringify(value), type: typeof value };
};

const BindingsDisplay: React.FC<{ params: unknown[] }> = ({ params }) => {
    const hasParams = Array.isArray(params) && params.length > 0;

    return (
        <div
            style={{
                border: '1px solid var(--mantine-color-dark-5)',
                borderRadius: 'var(--mantine-radius-md)',
                padding: 'var(--mantine-spacing-md)',
                background: 'var(--mantine-color-dark-8)'
            }}
        >
            <Group justify="space-between" mb="sm">
                <Text fw={500}>Bindings</Text>
                {hasParams && (
                    <CopyButton value={JSON.stringify(params, null, 2)}>
                        {({ copied, copy }) => (
                            <Tooltip label={copied ? 'Copied' : 'Copy JSON'} withArrow>
                                <ActionIcon variant="subtle" color={copied ? 'teal' : 'blue'} onClick={copy}>
                                    {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                                </ActionIcon>
                            </Tooltip>
                        )}
                    </CopyButton>
                )}
            </Group>
            {!hasParams && <Text c="dimmed" fz="sm">Query has no parameter bindings.</Text>}
            {hasParams && (
                <Stack gap="xs">
                    {params.map((value, index) => {
                        const { display, type } = describeBinding(value);
                        return (
                        <Group
                            key={`${index}-${String(value)}`}
                            justify="space-between"
                            style={{
                                border: '1px solid var(--mantine-color-dark-5)',
                                borderRadius: 'var(--mantine-radius-sm)',
                                padding: 'var(--mantine-spacing-xs)'
                            }}
                        >
                            <Badge variant="light" color="grape">#{index + 1}</Badge>
                            <div style={{ textAlign: 'right' }}>
                                <Text style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>
                                    {display}
                                </Text>
                                <Text fz="xs" c="dimmed">
                                    {type.toUpperCase()}
                                </Text>
                            </div>
                        </Group>
                        );
                    })}
                </Stack>
            )}
        </div>
    );
};

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
                                <Stack gap="sm" p="md">
                                    <CodeDisplay code={result.sql} language="sql" />
                                    <BindingsDisplay params={result.params} />
                                </Stack>
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
