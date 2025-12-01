import React, { useState } from 'react';
import { Terminal, Code2, Copy, Check } from 'lucide-react';
import { SyntaxHighlighter } from '../../../components/ui/SyntaxHighlighter';

interface Props {
    typescriptCode: string;
    sqlCode: string;
}

export const CodeViewer: React.FC<Props> = ({ typescriptCode, sqlCode }) => {
    const [activeTab, setActiveTab] = useState<'typescript' | 'sql'>('typescript');
    const [copied, setCopied] = useState(false);

    const copyToClipboard = () => {
        const text = activeTab === 'typescript' ? typescriptCode : sqlCode;
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="bg-[#0D1117] rounded-xl border border-metal-700 overflow-hidden shadow-xl group flex flex-col min-h-[300px] max-h-[50%]">
            <div className="flex items-center justify-between px-4 py-2 bg-metal-900 border-b border-metal-700">
                <div className="flex gap-4">
                    <button 
                        onClick={() => setActiveTab('typescript')}
                        className={`flex items-center gap-2 px-3 py-2 text-xs font-bold border-b-2 transition-colors ${
                            activeTab === 'typescript' 
                            ? 'border-blue-500 text-blue-400' 
                            : 'border-transparent text-slate-500 hover:text-slate-300'
                        }`}
                    >
                        <Terminal size={14} />
                        TYPESCRIPT (MetalORM)
                    </button>
                    <button 
                        onClick={() => setActiveTab('sql')}
                        className={`flex items-center gap-2 px-3 py-2 text-xs font-bold border-b-2 transition-colors ${
                            activeTab === 'sql' 
                            ? 'border-blue-500 text-blue-400' 
                            : 'border-transparent text-slate-500 hover:text-slate-300'
                        }`}
                    >
                        <Code2 size={14} />
                        COMPILED SQL
                    </button>
                </div>
                <button onClick={copyToClipboard} className="text-slate-500 hover:text-white transition-colors p-2 rounded hover:bg-metal-800">
                    {copied ? <Check size={16} className="text-green-400"/> : <Copy size={16}/>}
                </button>
            </div>
            
            <div className="flex-1 relative overflow-auto bg-[#0D1117] p-4">
                <SyntaxHighlighter 
                    code={activeTab === 'typescript' ? typescriptCode : sqlCode} 
                    language={activeTab} 
                />
            </div>
        </div>
    );
};