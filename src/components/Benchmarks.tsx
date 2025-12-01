import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const data = [
  { name: 'MetalORM', reqs: 14500, color: '#38bdf8' },
  { name: 'Kysely', reqs: 13800, color: '#818cf8' },
  { name: 'Prisma', reqs: 4200, color: '#fb7185' },
  { name: 'TypeORM', reqs: 3800, color: '#f472b6' },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-metal-900 border border-metal-700 p-3 rounded shadow-xl">
        <p className="font-bold text-slate-100">{label}</p>
        <p className="text-blue-400">{`${payload[0].value.toLocaleString()} req/sec`}</p>
      </div>
    );
  }
  return null;
};

const Benchmarks = () => {
  return (
    <section className="py-20 px-4 bg-metal-800/30 border-y border-metal-800">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-12">
        <div className="md:w-1/2">
            <h2 className="text-3xl font-bold mb-6">Unmatched Performance</h2>
            <p className="text-slate-400 mb-6 leading-relaxed">
                By avoiding runtime reflection and optimizing object hydration, MetalORM achieves throughput comparable to raw driver usage.
                We generate prepared statements by default, allowing the database engine to cache execution plans effectively.
            </p>
            <ul className="space-y-4">
                <li className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                    <span className="text-slate-300">3.5x Faster than Prisma in simple selects</span>
                </li>
                <li className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                    <span className="text-slate-300">Near-zero hydration overhead</span>
                </li>
                <li className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                    <span className="text-slate-300">Lower memory footprint (GC friendly)</span>
                </li>
            </ul>
        </div>
        
        <div className="md:w-1/2 w-full h-[300px] md:h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                    <XAxis type="number" stroke="#94a3b8" fontSize={12} tickFormatter={(val) => `${val/1000}k`} />
                    <YAxis dataKey="name" type="category" stroke="#e2e8f0" width={80} fontSize={14} fontWeight={600} />
                    <Tooltip content={<CustomTooltip />} cursor={{fill: '#1e293b'}} />
                    <Bar dataKey="reqs" radius={[0, 4, 4, 0]} barSize={32}>
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
            <p className="text-center text-xs text-slate-500 mt-4">Benchmark: Select * from Users (100 rows) • Node v20 • AWS t3.medium</p>
        </div>
      </div>
    </section>
  );
};

export default Benchmarks;