import React from 'react';

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
            <pre className={`language-${language}`}>
                <code>{code}</code>
            </pre>
        </div>
    );
};
