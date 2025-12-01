import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CodeDisplayProps {
    code: string;
    language?: 'sql' | 'typescript';
    title?: string;
}

/**
 * Component responsible for displaying syntax-highlighted code
 * Follows SRP by handling only code display formatting
 */
export const CodeDisplay: React.FC<CodeDisplayProps> = ({
    code,
    language = 'sql',
    title
}) => {
    return (
        <div className="code-display">
            {title && <h3>{title}</h3>}
            <SyntaxHighlighter
                language={language}
                style={oneDark}
                customStyle={{
                    margin: 0,
                    padding: '1.25rem',
                    background: 'transparent',
                    fontSize: '0.9rem',
                    lineHeight: '1.6'
                }}
                codeTagProps={{
                    style: {
                        fontFamily: 'JetBrains Mono, Fira Code, monospace'
                    }
                }}
            >
                {code}
            </SyntaxHighlighter>
        </div>
    );
};
