import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { QueryResult } from '@orm/playground/features/playground/common/IDatabaseClient';
import { ResultsTable } from './ResultsTable';

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
    const [activeTab, setActiveTab] = useState<'table' | 'json'>('table');

    const hasResults = results.length > 0 && results[0].values.length > 0;
    const hasHydratedResults = hydratedResults && hydratedResults.length > 0;

    // Use hydrated results if available, otherwise convert tabular data to JSON
    const jsonData = hasHydratedResults ? hydratedResults : convertTabularToJson(results);
    const jsonTitle = hasHydratedResults ? 'Hydrated Results' : 'Results as JSON';

    if (error) {
        return (
            <div className="results-error">
                <h3>Error</h3>
                <p>{error}</p>
            </div>
        );
    }

    return (
        <div className="results-tabs-container">
            <div className="tabs-header">
                <div className="tabs">
                    <button
                        className={`tab-button ${activeTab === 'table' ? 'active' : ''}`}
                        onClick={() => setActiveTab('table')}
                    >
                        Table
                    </button>
                    {hasResults && (
                        <button
                            className={`tab-button ${activeTab === 'json' ? 'active' : ''}`}
                            onClick={() => setActiveTab('json')}
                        >
                            JSON
                        </button>
                    )}
                </div>
                {executionTime !== undefined && (
                    <span className="execution-time">
                        Executed in {executionTime.toFixed(2)}ms
                    </span>
                )}
            </div>

            <div className="tab-content">
                {activeTab === 'table' && (
                    <ResultsTable
                        results={results}
                        executionTime={undefined} // Hide execution time in table view since it's shown in header
                        error={null} // Error already handled above
                    />
                )}

                {activeTab === 'json' && hasResults && (
                    <div className="results-json-container">
                        <div className="results-header">
                            <h3>{jsonTitle}</h3>
                        </div>
                        <div className="json-content">
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
                        </div>
                        <div className="results-footer">
                            {jsonData.length} object{jsonData.length !== 1 ? 's' : ''}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
