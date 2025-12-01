import React from 'react';

interface Props {
    code: string;
    language: 'typescript' | 'sql';
}

export const SyntaxHighlighter: React.FC<Props> = ({ code, language }) => {
    if (language === 'sql') {
        return <code className="font-mono text-sm text-green-300 whitespace-pre-wrap">{code}</code>;
    }

    const tokens = code.split(/(\s+|[.,();:{}\[\]=])/g);

    return (
        <code className="font-mono text-sm whitespace-pre-wrap">
            {tokens.map((token, i) => {
                if (['import', 'from', 'const', 'await', 'return', 'export', 'default'].includes(token)) 
                    return <span key={i} className="text-purple-400">{token}</span>;
                
                if (['db', 'eq', 'Users', 'Orders'].includes(token)) 
                    return <span key={i} className="text-yellow-200">{token}</span>;
                
                if (['select', 'from', 'where', 'innerJoin', 'limit', 'offset', 'execute'].includes(token)) 
                    return <span key={i} className="text-blue-400">{token}</span>;
                
                if (token.startsWith("'") || token.startsWith('"')) 
                    return <span key={i} className="text-green-400">{token}</span>;
                
                if (!isNaN(Number(token)) && token.trim() !== '') 
                    return <span key={i} className="text-orange-400">{token}</span>;
                
                return <span key={i} className="text-slate-300">{token}</span>;
            })}
        </code>
    );
};