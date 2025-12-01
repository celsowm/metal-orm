import React, { useState } from 'react';
import { Database } from 'lucide-react';
import { SCENARIOS } from './data/scenarios';
import { useSqlite } from './hooks/useSqlite';
import { useMetalORM, SupportedDialect } from './hooks/useMetalORM';
import { ScenarioSidebar } from './components/ScenarioSidebar';
import { CodeViewer } from './components/CodeViewer';
import { ResultsTable } from './components/ResultsTable';

const Playground = () => {
    const [activeScenarioId, setActiveScenarioId] = useState<string>('basic');
    const [dialect, setDialect] = useState<SupportedDialect>('SQLite');

    const activeScenario = SCENARIOS.find(s => s.id === activeScenarioId) || SCENARIOS[0];
    
    // Hooks manage the complexity now
    const { isReady, error, executeSql } = useSqlite();
    const { generatedSql, generatedTs } = useMetalORM(activeScenario, dialect);

    // Derived state: Execute only if supported
    const results = (dialect === 'SQLite' && isReady) ? executeSql(generatedSql) : [];

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
                        Running real <span className="text-slate-200 font-bold">SQLite (WASM)</span>. 
                        Select a scenario to see MetalORM code, compilation, and execution.
                    </p>
                </div>
                
                <div className="flex bg-metal-800 rounded-lg p-1 border border-metal-700">
                    {(['SQLite', 'MySQL', 'SQL Server'] as const).map((d) => (
                        <button
                            key={d}
                            onClick={() => setDialect(d)}
                            className={`px-4 py-2 rounded-md text-xs font-medium transition-all ${
                                dialect === d 
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
                    isDbReady={isReady}
                />

                <div className="lg:col-span-9 flex flex-col gap-6 min-h-0">
                    <CodeViewer 
                        typescriptCode={generatedTs}
                        sqlCode={generatedSql}
                    />
                    <ResultsTable 
                        results={results}
                        error={error}
                        isDbReady={isReady}
                        dialect={dialect}
                    />
                </div>
            </div>
        </section>
    );
};

export default Playground;