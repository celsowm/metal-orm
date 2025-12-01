import React, { useState } from 'react';
import Playground from './playground/Playground';
import Architecture from './src/components/Architecture';
import Benchmarks from './src/components/Benchmarks';
import Roadmap from './src/features/roadmap/Roadmap';
import { Database, Layers, BarChart3, Map } from 'lucide-react';

type Tab = 'playground' | 'architecture' | 'benchmarks' | 'roadmap';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('playground');

  const renderContent = () => {
    switch (activeTab) {
      case 'playground': return <Playground />;
      case 'architecture': return <Architecture />;
      case 'benchmarks': return <Benchmarks />;
      case 'roadmap': return <Roadmap />;
      default: return <Playground />;
    }
  };

  return (
    <div className="h-screen w-screen bg-[#09090b] text-slate-200 overflow-hidden font-sans selection:bg-blue-500/30 flex flex-col">
      {/* Global Navigation */}
      <nav className="border-b border-metal-800 bg-metal-950/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Database size={18} className="text-white" />
              </div>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-100 to-slate-400">
                MetalORM
              </span>
            </div>
            
            <div className="flex items-center gap-1 bg-metal-900/50 p-1 rounded-lg border border-metal-800">
              <NavButton 
                active={activeTab === 'playground'} 
                onClick={() => setActiveTab('playground')} 
                icon={Database} 
                label="Playground" 
              />
              <NavButton 
                active={activeTab === 'architecture'} 
                onClick={() => setActiveTab('architecture')} 
                icon={Layers} 
                label="Architecture" 
              />
              <NavButton 
                active={activeTab === 'benchmarks'} 
                onClick={() => setActiveTab('benchmarks')} 
                icon={BarChart3} 
                label="Benchmarks" 
              />
              <NavButton 
                active={activeTab === 'roadmap'} 
                onClick={() => setActiveTab('roadmap')} 
                icon={Map} 
                label="Roadmap" 
              />
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto scroll-smooth">
        {renderContent()}
      </main>
    </div>
  );
}

const NavButton = ({ active, onClick, icon: Icon, label }: any) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
      active 
        ? 'bg-metal-800 text-white shadow-sm ring-1 ring-white/10' 
        : 'text-slate-400 hover:text-slate-200 hover:bg-metal-800/50'
    }`}
  >
    <Icon size={16} className={active ? 'text-blue-400' : ''} />
    {label}
  </button>
);

export default App;