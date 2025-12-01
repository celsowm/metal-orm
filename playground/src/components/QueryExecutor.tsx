import React, { useState, useEffect } from 'react';
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
    const [activeCodeTab, setActiveCodeTab] = useState<'sql' | 'typescript'>('sql');

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
            <div className="query-executor-empty">
                <p>Select a scenario from the list to execute</p>
            </div>
        );
    }

    return (
        <div className="query-executor">
            <div className="scenario-header">
                <h2>{scenario.title}</h2>
                <p className="scenario-description">{scenario.description}</p>
                <button onClick={executeQuery} disabled={isLoading} className="execute-btn">
                    {isLoading ? 'Executing...' : 'Re-execute Query'}
                </button>
            </div>

            {result && (
                <>
                    <div className="code-tabs">
                        <div className="code-tabs-header">
                            <button
                                className={`code-tab-button ${activeCodeTab === 'sql' ? 'active' : ''}`}
                                onClick={() => setActiveCodeTab('sql')}
                            >
                                SQL
                            </button>
                            <button
                                className={`code-tab-button ${activeCodeTab === 'typescript' ? 'active' : ''}`}
                                onClick={() => setActiveCodeTab('typescript')}
                            >
                                TypeScript
                            </button>
                        </div>
                        <div className="code-tab-content">
                            {activeCodeTab === 'sql' && (
                                <CodeDisplay code={result.sql} language="sql" title="Generated SQL" />
                            )}
                            {activeCodeTab === 'typescript' && (
                                <CodeDisplay code={result.typescriptCode} language="typescript" title="TypeScript Builder Code" />
                            )}
                        </div>
                    </div>
                    <ResultsTabs
                        results={result.results}
                        hydratedResults={result.hydratedResults}
                        executionTime={result.executionTime}
                        error={result.error}
                    />
                </>
            )}

            {isLoading && (
                <div className="loading-spinner">
                    <p>Executing query...</p>
                </div>
            )}
        </div>
    );
};
