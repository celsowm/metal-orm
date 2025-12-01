import React from 'react';
import ReactDOM from 'react-dom/client';
import Playground from '../../src/features/playground/Playground';

const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error('Could not find root element to mount to');
}

ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
        <div className="h-screen w-screen bg-[#09090b] text-slate-200 overflow-hidden font-sans selection:bg-blue-500/30">
            <Playground />
        </div>
    </React.StrictMode>
);
