import React, { useEffect, useState } from 'react';
import { Table, Loader2 } from 'lucide-react';
import { SupportedDialect } from '../hooks/useMetalORM';
import { HydrationPlan } from '../../src/metal-orm/src/ast/query';

interface Props {
    results: any[];
    hydratedResults?: any[];
    hydrationPlan?: HydrationPlan;
    error: string | null;
    isDbReady: boolean;
    dialect: SupportedDialect;
}

export const ResultsTable: React.FC<Props> = ({ results, hydratedResults = [], hydrationPlan, error, isDbReady, dialect }) => {
    const hasHydrated = !!hydrationPlan && hydratedResults.length > 0;
    const [view, setView] = useState<'flat' | 'nested'>(hasHydrated ? 'nested' : 'flat');

    useEffect(() => {
        setView(hasHydrated ? 'nested' : 'flat');
    }, [hasHydrated]);

    const activeRows = view === 'nested' && hasHydrated ? hydratedResults : results;
    const rowCount = activeRows.length;

    return (
        <div className="flex-1 bg-metal-900 rounded-xl border border-metal-700 overflow-hidden shadow-xl flex flex-col min-h-[200px]">
            <div className="flex items-center justify-between px-4 py-3 bg-metal-800 border-b border-metal-700 flex-shrink-0 gap-3">
                <div className="flex items-center gap-2">
                    <Table size={16} className="text-blue-400"/>
                    <span className="text-xs font-mono font-bold text-slate-300">QUERY RESULT</span>
                </div>
                <div className="flex items-center gap-2">
                    {hasHydrated && (
                        <div className="flex bg-metal-900 rounded-md border border-metal-700 overflow-hidden text-[11px]">
                            <button
                                onClick={() => setView('flat')}
                                className={`px-3 py-1 ${view === 'flat' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white'}`}
                            >
                                Flat rows
                            </button>
                            <button
                                onClick={() => setView('nested')}
                                className={`px-3 py-1 ${view === 'nested' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white'}`}
                            >
                                Hydrated JSON
                            </button>
                        </div>
                    )}
                    {dialect !== 'SQLite' && (
                        <span className="text-xs text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded border border-orange-400/20">
                            Execution disabled for {dialect} (Switch to SQLite)
                        </span>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-auto bg-metal-900/50 p-4">
                {!isDbReady ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3">
                        <Loader2 className="animate-spin text-blue-500" size={32} />
                        <p>Initializing In-Browser Database...</p>
                    </div>
                ) : error ? (
                    <div className="p-4 bg-red-900/20 border border-red-900/50 rounded-lg text-red-200 text-sm font-mono">
                        ERROR: {error}
                    </div>
                ) : view === 'nested' && hasHydrated ? (
                    hydratedResults.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500">
                            <p className="font-mono text-sm">No related records to hydrate.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <div className="text-[11px] text-slate-400 uppercase font-semibold tracking-wide">
                                Graph: {hydrationPlan?.rootTable} {'->'} {hydrationPlan?.relations.map(r => r.name).join(', ')}
                            </div>
                            <pre className="bg-metal-950 border border-metal-800 rounded-lg p-4 text-xs text-slate-100 overflow-auto">{JSON.stringify(hydratedResults, null, 2)}</pre>
                        </div>
                    )
                ) : activeRows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500">
                        <p className="font-mono text-sm">No records found matching query.</p>
                    </div>
                ) : (
                    <div className="w-full">
                        <table className="w-full text-left text-sm font-mono border-collapse">
                            <thead className="sticky top-0 bg-metal-900 shadow-sm z-10">
                                <tr className="border-b border-metal-700">
                                    {Object.keys(activeRows[0]).map((key) => (
                                        <th key={key} className="p-3 text-slate-400 font-medium uppercase text-xs tracking-wider whitespace-nowrap">
                                            {key}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-metal-800/50">
                                {activeRows.map((row, i) => (
                                    <tr key={i} className="hover:bg-metal-800/40 transition-colors">
                                        {Object.values(row).map((val: any, j) => {
                                            const display =
                                                val === null || val === undefined
                                                    ? 'null'
                                                    : typeof val === 'object'
                                                        ? JSON.stringify(val)
                                                        : val;
                                            return (
                                                <td key={j} className="p-3 text-slate-300 whitespace-nowrap">
                                                    {display}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            <div className="px-4 py-2 bg-metal-950 border-t border-metal-800 text-xs text-slate-500 flex justify-between flex-shrink-0">
                <span>{rowCount} rows returned</span>
                <span className="font-mono">{dialect === 'SQLite' ? 'Execution Time: < 1ms' : 'Simulation Mode'}</span>
            </div>
        </div>
    );
};
