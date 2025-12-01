import React from 'react';
import { Layers, Database, Code, Cpu } from 'lucide-react';

const LayerCard = ({ title, icon: Icon, items, color }: any) => (
  <div className={`p-6 rounded-xl border border-metal-700 bg-metal-800/50 backdrop-blur-sm hover:border-${color}-500 transition-colors group`}>
    <div className="flex items-center gap-3 mb-4">
      <div className={`p-2 rounded-lg bg-${color}-500/10 text-${color}-400 group-hover:text-${color}-300`}>
        <Icon size={24} />
      </div>
      <h3 className="text-xl font-bold text-slate-100">{title}</h3>
    </div>
    <ul className="space-y-2">
      {items.map((item: string, i: number) => (
        <li key={i} className="flex items-center gap-2 text-slate-400 text-sm">
          <span className={`w-1.5 h-1.5 rounded-full bg-${color}-500`} />
          {item}
        </li>
      ))}
    </ul>
  </div>
);

const Architecture = () => {
  return (
    <section className="py-20 px-4 max-w-7xl mx-auto">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          <span className="gradient-text">Close-to-Metal</span> Architecture
        </h2>
        <p className="text-slate-400 max-w-2xl mx-auto">
          Designed for zero-overhead abstraction. We prioritize compile-time safety and raw SQL performance over runtime reflection.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
        {/* Connecting Line (Desktop) */}
        <div className="hidden lg:block absolute top-1/2 left-0 w-full h-0.5 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-green-500/20 -z-10" />

        <LayerCard 
          title="Schema Definition" 
          icon={Code}
          color="blue"
          items={[
            "Pure TS Objects",
            "Zero Reflection",
            "Automatic Type Inference",
            "Zod-style Definition"
          ]}
        />
        
        <LayerCard 
          title="Query AST" 
          icon={Layers}
          color="purple"
          items={[
            "Immutable Builder",
            "Subquery as Table Node",
            "State-based (Not String)",
            "Memory Efficient"
          ]}
        />

        <LayerCard 
          title="Dialect Compiler" 
          icon={Cpu}
          color="pink"
          items={[
            "Visitor Pattern",
            "Dialect specific optimization",
            "Zero Allocation Loop",
            "Smart Aliasing"
          ]}
        />

        <LayerCard 
          title="Driver & Hydrator" 
          icon={Database}
          color="green"
          items={[
            "Native Drivers (mysql2)",
            "Stream Support",
            "POJO Hydration",
            "Prepared Statements"
          ]}
        />
      </div>
    </section>
  );
};

export default Architecture;