import React from 'react';
import { Tabs, Card, Text, Badge, Group, Alert, Code, ScrollArea } from '@mantine/core';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { QueryResult } from '../shared/playground/common/IDatabaseClient.js';
import { ResultsTable } from './ResultsTable.js';

/**
 * Converts tabular results to JSON array of objects
 */
const convertTabularToJson = (results: QueryResult[]): Record<string, any>[] => {
    if (!results.length || !results[0].values.length) return [];

    const { columns, values } = results[0];
    return values.map(row => {
        const obj: Record<string, any> = {};
        columns.forEach((col, idx) => {
            obj[col] = row[idx];
        });
        return obj;
    });
};

interface ResultsTabsProps {
    results: QueryResult[];
    hydratedResults?: Record<string, any>[];
    executionTime?: number;
    error?: string | null;
}

/**
 * Component that displays query results in tabbed interface with Table and JSON views
 * Follows SRP by coordinating result display modes
 */
export const ResultsTabs: React.FC<ResultsTabsProps> = ({
    results,
    hydratedResults,
    executionTime,
    error
}) => {
    const hasResults = results.length > 0 && results[0].values.length > 0;
    const hasHydratedResults = hydratedResults && hydratedResults.length > 0;

    // Use hydrated results if available, otherwise convert tabular data to JSON
    const jsonData = hasHydratedResults ? hydratedResults : convertTabularToJson(results);
    const jsonTitle = hasHydratedResults ? 'Hydrated Results' : 'Results as JSON';

    if (error) {
        return (
            <Alert variant="light" color="red" title="Error" mt="md">
                {error}
            </Alert>
        );
    }

    return (
        <Card withBorder shadow="sm" radius="md" p={0}>
            <Tabs defaultValue="table">
                <Group justify="space-between" px="md" py="xs" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
                    <Tabs.List style={{ borderBottom: 'none' }}>
                        <Tabs.Tab value="table">Table</Tabs.Tab>
                        {hasResults && <Tabs.Tab value="json">JSON</Tabs.Tab>}
                    </Tabs.List>
                    {executionTime !== undefined && (
                        <Badge variant="light" color="green" size="lg">
                            {executionTime.toFixed(2)}ms
                        </Badge>
                    )}
                </Group>

                <Tabs.Panel value="table">
                    <ResultsTable
                        results={results}
                        executionTime={undefined}
                        error={null}
                    />
                </Tabs.Panel>

                {hasResults && (
                    <Tabs.Panel value="json">
                        <Group justify="space-between" px="md" py="xs" bg="var(--mantine-color-dark-6)">
                            <Text size="sm" fw={500}>{jsonTitle}</Text>
                            <Text size="xs" c="dimmed">{jsonData.length} object{jsonData.length !== 1 ? 's' : ''}</Text>
                        </Group>
                        <ScrollArea h={400} bg="#282c34">
                            <SyntaxHighlighter
                                language="json"
                                style={oneDark}
                                customStyle={{
                                    margin: 0,
                                    padding: '1.25rem',
                                    background: 'transparent',
                                    fontSize: '0.85rem',
                                    lineHeight: '1.5'
                                }}
                            >
                                {JSON.stringify(jsonData, null, 2)}
                            </SyntaxHighlighter>
                        </ScrollArea>
                    </Tabs.Panel>
                )}
            </Tabs>
        </Card>
    );
};
