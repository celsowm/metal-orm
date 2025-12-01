import React from 'react';
import type { QueryResult } from '@orm/playground/features/playground/common/IDatabaseClient';

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
            <div className="results-error">
                <h3>Error</h3>
                <p>{error}</p>
            </div>
        );
    }

    if (results.length === 0 || !results[0] || results[0].values.length === 0) {
        return (
            <div className="results-empty">
                <p>No results returned</p>
            </div>
        );
    }

    const { columns, values } = results[0];

    return (
        <div className="results-table-container">
            <div className="results-header">
                <h3>Results</h3>
                {executionTime !== undefined && (
                    <span className="execution-time">
                        Executed in {executionTime.toFixed(2)}ms
                    </span>
                )}
            </div>
            <div className="table-wrapper">
                <table className="results-table">
                    <thead>
                        <tr>
                            {columns.map((col, idx) => (
                                <th key={idx}>{col}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {values.map((row, rowIdx) => (
                            <tr key={rowIdx}>
                                {row.map((cell, cellIdx) => (
                                    <td key={cellIdx}>
                                        {cell === null ? <span className="null-value">NULL</span> : String(cell)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="results-footer">
                {values.length} row{values.length !== 1 ? 's' : ''}
            </div>
        </div>
    );
};
