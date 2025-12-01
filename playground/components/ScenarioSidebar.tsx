import React, { useState, useEffect } from 'react';
import { BookOpen, ChevronRight, ChevronDown, Folder, FileCode, Search } from 'lucide-react';
import { Scenario, SCENARIOS } from '../data/scenarios';

interface Props {
    activeScenarioId: string;
    onSelect: (id: string) => void;
    isDbReady: boolean;
}

export const ScenarioSidebar: React.FC<Props> = ({ activeScenarioId, onSelect, isDbReady }) => {
    // 1. Group scenarios by category
    const categories = SCENARIOS.reduce((acc, scenario) => {
        if (!acc[scenario.category]) acc[scenario.category] = [];
        acc[scenario.category].push(scenario);
        return acc;
    }, {} as Record<string, typeof SCENARIOS>);

    // 2. State for expanded folders - Initialize ALL to true by default
    const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
        const initial: Record<string, boolean> = {};
        Object.keys(categories).forEach(cat => initial[cat] = true);
        return initial;
    });

    const toggle = (cat: string) => {
        setExpanded(prev => ({ ...prev, [cat]: !prev[cat] }));
    };

    return (
        <div className="lg:col-span-3 bg-metal-900 border border-metal-700 rounded-xl flex flex-col shadow-2xl overflow-hidden h-[600px]">
            <div className="flex items-center gap-2 p-4 border-b border-metal-700 bg-metal-800/30">
                <BookOpen className="text-blue-400" size={18} />
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Examples Explorer</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-metal-700 scrollbar-track-transparent">
                {Object.entries(categories).map(([category, items]) => (
                    <div key={category} className="mb-1 select-none">
                        <button 
                            onClick={() => toggle(category)}
                            className="w-full flex items-center gap-2 p-2 text-slate-400 hover:text-slate-100 hover:bg-white/5 rounded-md transition-colors text-xs font-bold uppercase tracking-wide group"
                        >
                            {expanded[category] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            <Folder size={14} className={`transition-colors ${expanded[category] ? 'text-blue-400' : 'text-blue-500/60 group-hover:text-blue-400'}`} />
                            {category}
                            <span className="ml-auto text-[10px] text-slate-600 font-mono">{items.length}</span>
                        </button>
                        
                        {expanded[category] && (
                            <div className="relative ml-2 pl-2 mt-1 space-y-0.5">
                                {/* Tree vertical line */}
                                <div className="absolute left-0 top-0 bottom-2 w-px bg-metal-800" />

                                {items.map(scenario => (
                                    <button
                                        key={scenario.id}
                                        onClick={() => onSelect(scenario.id)}
                                        className={`w-full text-left flex items-start gap-2 p-2 rounded-md transition-all text-sm group/item relative ${
                                            activeScenarioId === scenario.id
                                            ? 'bg-blue-500/10 text-blue-400'
                                            : 'text-slate-400 hover:bg-metal-800 hover:text-slate-200'
                                        }`}
                                    >
                                        <FileCode size={14} className={`mt-0.5 shrink-0 transition-colors ${activeScenarioId === scenario.id ? 'text-blue-400' : 'text-slate-600 group-hover/item:text-slate-400'}`} />
                                        <div className="flex flex-col gap-0.5 overflow-hidden">
                                            <span className="block font-medium leading-tight truncate">{scenario.title}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="p-3 border-t border-metal-800 bg-metal-950/30">
                <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-slate-500">
                    <div className={`w-1.5 h-1.5 rounded-full ${isDbReady ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-red-500'}`} />
                    {isDbReady ? "SQLite Engine Ready" : "Loading Core..."}
                </div>
            </div>
        </div>
    );
};