import React from 'react';
import { CheckCircle2, Circle, GitBranch, ArrowRight } from 'lucide-react';

interface FeatureNode {
  title: string;
  status: 'done' | 'in-progress' | 'planned';
  description?: string;
  children?: FeatureNode[];
}

const roadmapData: FeatureNode[] = [
  {
    title: "INITIALIZATION & SCOPE",
    status: "done",
    children: [
      { title: "Table Targeting", status: "done" },
      { title: "Model/Entity Context", status: "done" },
      { title: "Alias Definition", status: "done" }
    ]
  },
  {
    title: "PROJECTION (SELECTION)",
    status: "done",
    children: [
      { title: "Specific Columns", status: "done" },
      { title: "Raw Expressions", status: "done" },
      { title: "Aggregations (Count, Sum, Avg, Max, Min)", status: "done" },
      { title: "Deduplication (Distinct)", status: "planned" }
    ]
  },
  {
    title: "RELATIONSHIP QUERIES",
    status: "in-progress",
    children: [
      { 
        title: "One-to-Many (1:N)", 
        status: "in-progress",
        children: [
            { title: "Smart Joins", status: "done" },
            { title: "Eager Loading Children", status: "planned" },
            { title: "Filtering Children", status: "planned" }
        ]
      },
      { 
        title: "Many-to-Many (N:N)", 
        status: "planned",
        children: [
            { title: "Pivot Logic", status: "planned" }
        ]
      }
    ]
  },
  {
    title: "COMPLEX QUERIES",
    status: "planned",
    children: [
        { title: "Subqueries", status: "planned" },
        { title: "CTEs", status: "planned" },
        { title: "Conditional Logic", status: "planned" }
    ]
  },
  {
      title: "PHYSICAL JOINS",
      status: "done",
      children: [
          { title: "Inner/Left/Right Joins", status: "done" },
          { title: "Cross/Lateral Joins", status: "planned" }
      ]
  },
  {
    title: "FILTERING (CONSTRAINTS)",
    status: "done",
    children: [
        { title: "Basic Operators", status: "done" },
        { title: "Logical Grouping (AND/OR)", status: "done" },
        { title: "Null Handling", status: "done" },
        { title: "Set Membership (IN)", status: "done" },
        { title: "Pattern Matching (Like)", status: "done" },
        { title: "JSON Path", status: "done" },
        { title: "Relationship Existence", status: "planned" }
    ]
  },
  {
      title: "GROUPING & AGGREGATION",
      status: "done",
      children: [
          { title: "Group By", status: "done" },
          { title: "Having", status: "planned" },
          { title: "Window Functions", status: "planned" }
      ]
  },
  {
    title: "SORTING & LIMITING",
    status: "done",
    children: [
        { title: "Order By", status: "done" },
        { title: "Pagination (Limit/Offset)", status: "done" }
    ]
  },
  {
      title: "EXECUTION",
      status: "done",
      children: [
          { title: "Fetch Collection", status: "done" },
          { title: "Streaming", status: "planned" }
      ]
  }
];

const StatusIcon = ({ status }: { status: string }) => {
  if (status === 'done') return <CheckCircle2 size={16} className="text-green-500" />;
  if (status === 'in-progress') return <GitBranch size={16} className="text-blue-400" />;
  return <Circle size={16} className="text-slate-600" />;
};

const FeatureTree = ({ nodes, level = 0 }: { nodes: FeatureNode[], level?: number }) => {
  return (
    <div className={`flex flex-col gap-3 ${level > 0 ? 'ml-6 border-l border-metal-800 pl-6' : ''}`}>
      {nodes.map((node, i) => (
        <div key={i} className="relative group">
           {level > 0 && (
             <div className="absolute -left-6 top-3 w-6 h-[1px] bg-metal-800 group-hover:bg-metal-700 transition-colors" />
           )}
          
          <div className={`
            p-3 rounded-lg border border-metal-800/50 bg-metal-900/30 backdrop-blur-sm
            transition-all duration-200 hover:border-metal-700 hover:bg-metal-800/50
            flex flex-col gap-2
            ${node.status === 'in-progress' ? 'ring-1 ring-blue-500/20 shadow-[0_0_15px_-3px_rgba(59,130,246,0.1)]' : ''}
          `}>
            <div className="flex items-center gap-3">
              <StatusIcon status={node.status} />
              <span className={`font-mono text-sm ${node.status === 'planned' ? 'text-slate-500' : 'text-slate-200'}`}>
                {node.title}
              </span>
              {node.status === 'in-progress' && (
                <span className="text-[10px] uppercase font-bold tracking-wider bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20">
                    Dev
                </span>
              )}
            </div>
          </div>
          
          {node.children && (
            <div className="mt-3">
              <FeatureTree nodes={node.children} level={level + 1} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const Roadmap = () => {
  return (
    <section className="py-20 px-4 max-w-5xl mx-auto">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-4xl font-bold mb-4 flex items-center justify-center gap-3">
          <span className="gradient-text">Feature</span> Map
        </h2>
        <p className="text-slate-400 max-w-2xl mx-auto">
          Our path to building the most performant, close-to-metal TypeScript ORM.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-12">
        <div className="bg-metal-950 rounded-2xl border border-metal-800 p-8 shadow-2xl">
            <FeatureTree nodes={roadmapData} />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-xl bg-gradient-to-br from-green-500/10 to-transparent border border-green-500/20">
                <div className="flex items-center gap-3 mb-2">
                    <CheckCircle2 className="text-green-400" />
                    <h3 className="text-lg font-bold text-green-100">Done</h3>
                </div>
                <p className="text-sm text-green-200/60">Implemented and available in the playground.</p>
            </div>
            
            <div className="p-6 rounded-xl bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/20">
                <div className="flex items-center gap-3 mb-2">
                    <GitBranch className="text-blue-400" />
                    <h3 className="text-lg font-bold text-blue-100">In Progress</h3>
                </div>
                <p className="text-sm text-blue-200/60">Currently being engineered in the core AST.</p>
            </div>
            
            <div className="p-6 rounded-xl bg-gradient-to-br from-slate-500/10 to-transparent border border-slate-500/20">
                <div className="flex items-center gap-3 mb-2">
                    <Circle className="text-slate-400" />
                    <h3 className="text-lg font-bold text-slate-100">Planned</h3>
                </div>
                <p className="text-sm text-slate-400/60">Specified in the roadmap, pending implementation.</p>
            </div>
        </div>
      </div>
    </section>
  );
};

export default Roadmap;