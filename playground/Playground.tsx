import React, { useState, useEffect } from 'react';
import { Database } from 'lucide-react';
import { SCENARIOS } from './data/scenarios';
import { useDatabaseClient } from './hooks/useDatabaseClient';
import { useMetalORM, SupportedDialect } from './hooks/useMetalORM';
import { ScenarioSidebar } from './components/ScenarioSidebar';
import { CodeViewer } from './components/CodeViewer';
import { ResultsTable } from './components/ResultsTable';
import { QueryResult } from './common/IDatabaseClient';
import { hydrateRows } from '../src/metal-orm/src/runtime/hydration';

const Playground = () => {
    const [activeScenarioId, setActiveScenarioId] = useState<string>('basic');
    const [dialect, setDialect] = useState<SupportedDialect>('SQLite');
    const [rows, setRows] = useState<any[]>([]);
    const [hydratedRows, setHydratedRows] = useState<any[]>([]);

    const activeScenario = SCENARIOS.find(s => s.id === activeScenarioId) || SCENARIOS[0];

    const dbClient = useDatabaseClient(dialect);
    const { generatedSql, generatedTs, hydrationPlan } = useMetalORM(activeScenario, dialect);

    const parseJsonIfNeeded = (val: any) => {
        if (typeof val === 'string') {
            const trimmed = val.trim();
            if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
                try {
                    return JSON.parse(trimmed);
                } catch {
                    return val;
                }
            }
        }
        return val;
    };

    // Transform QueryResult[] to row objects for table display
    const transformResults = (queryResults: QueryResult[]): any[] => {
        if (!queryResults || queryResults.length === 0) return [];

        // Get the first result (most queries return a single result)
        const result = queryResults[0];
        if (!result || !result.columns || !result.values) return [];

        // Transform each row from array format to object format
        return result.values.map(row => {
            const rowObj: any = {};
            result.columns.forEach((col, idx) => {
                rowObj[col] = parseJsonIfNeeded(row[idx]);
            });
            return rowObj;
        });
    };

    useEffect(() => {
        if (dbClient.isReady) {
            dbClient.executeSql(generatedSql).then(queryResults => {
                const transformed = transformResults(queryResults);
                setRows(transformed);
                setHydratedRows(hydrationPlan ? hydrateRows(transformed, hydrationPlan) : []);
            });
        }
    }, [dbClient, generatedSql, hydrationPlan]);

    return (
        <section className="py-8 px-4 max-w-7xl mx-auto h-screen flex flex-col">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-4 flex-shrink-0">
                <div>
                    <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
                        <Database className="text-blue-400" />
                        Live Database Playground
                    </h2>
                    <p className="text-slate-400 mt-1 text-sm">
                        Select a scenario to see MetalORM code, compilation, and execution.
                    </p>
                </div>

                <div className="flex bg-metal-800 rounded-lg p-1 border border-metal-700">
                    {(['SQLite', 'MySQL', 'SQL Server'] as const).map((d) => (
                        <button
                            key={d}
                            onClick={() => setDialect(d)}
                            className={`px-4 py-2 rounded-md text-xs font-medium transition-all ${dialect === d
                                    ? 'bg-blue-600 text-white shadow-lg'
                                    : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            {d}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
                <ScenarioSidebar
                    activeScenarioId={activeScenarioId}
                    onSelect={setActiveScenarioId}
                    isDbReady={dbClient.isReady}
                />

                <div className="lg:col-span-9 flex flex-col gap-6 min-h-0">
                    <CodeViewer
                        typescriptCode={generatedTs}
                        sqlCode={generatedSql}
                    />
                    <ResultsTable
                        results={rows}
                        hydratedResults={hydratedRows}
                        hydrationPlan={hydrationPlan}
                        error={dbClient.error}
                        isDbReady={dbClient.isReady}
                        dialect={dialect}
                    />
                </div>
            </div>
        </section>
    );
};

export default Playground;
