import React from 'react';
import { Table, Text, Alert, ScrollArea } from '@mantine/core';
import type { QueryResult } from '../shared/playground/common/IDatabaseClient.js';

interface ResultsTableProps {
    results: QueryResult[];
    executionTime?: number;
    error?: string | null;
}

/**
 * Component responsible for displaying query results in a table
 * Follows SRP by handling only results visualization
 */
export const ResultsTable: React.FC<ResultsTableProps> = ({
    results,
    executionTime,
    error
}) => {
    if (error) {
        return (
            <Alert variant="light" color="red" title="Error">
                {error}
            </Alert>
        );
    }

    if (results.length === 0 || !results[0] || results[0].values.length === 0) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--mantine-color-dimmed)' }}>
                <Text>No results returned</Text>
            </div>
        );
    }

    const { columns, values } = results[0];

    return (
        <div>
            <ScrollArea>
                <Table striped highlightOnHover horizontalSpacing="md" verticalSpacing="sm">
                    <Table.Thead>
                        <Table.Tr>
                            {columns.map((col, idx) => (
                                <Table.Th key={idx} style={{ whiteSpace: 'nowrap' }}>{col}</Table.Th>
                            ))}
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {values.map((row, rowIdx) => (
                            <Table.Tr key={rowIdx}>
                                {row.map((cell, cellIdx) => (
                                    <Table.Td key={cellIdx}>
                                        {cell === null ? <Text span c="dimmed" fs="italic">NULL</Text> : String(cell)}
                                    </Table.Td>
                                ))}
                            </Table.Tr>
                        ))}
                    </Table.Tbody>
                </Table>
            </ScrollArea>
            <div style={{ padding: '0.5rem 1rem', borderTop: '1px solid var(--mantine-color-default-border)', backgroundColor: 'var(--mantine-color-body)' }}>
                <Text size="xs" c="dimmed">{values.length} row{values.length !== 1 ? 's' : ''}</Text>
            </div>
        </div>
    );
};
