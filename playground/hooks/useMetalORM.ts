import { useState, useEffect } from 'react';
import { SelectQueryBuilder } from '../../src/metal-orm/src/builder/select';
import { TypeScriptGenerator } from '../../src/metal-orm/src/codegen/typescript';
import { MySqlDialect } from '../../src/metal-orm/src/dialect/mysql';
import { SqlServerDialect } from '../../src/metal-orm/src/dialect/mssql';
import { SqliteDialect } from '../../src/metal-orm/src/dialect/sqlite';
import { Users } from '../data/schema';
import { Scenario } from '../data/scenarios';

export type SupportedDialect = 'MySQL' | 'SQL Server' | 'SQLite';

export const useMetalORM = (scenario: Scenario, dialect: SupportedDialect) => {
    const [generatedSql, setGeneratedSql] = useState('');
    const [generatedTs, setGeneratedTs] = useState('');

    useEffect(() => {
        let qb = new SelectQueryBuilder(Users);
        qb = scenario.build(qb);
        
        // Dynamic Code Generation
        const tsGenerator = new TypeScriptGenerator();
        setGeneratedTs(tsGenerator.generate(qb.getAST()));

        let driver;
        switch (dialect) {
            case 'MySQL': driver = new MySqlDialect(); break;
            case 'SQL Server': driver = new SqlServerDialect(); break;
            case 'SQLite': driver = new SqliteDialect(); break;
            default: driver = new SqliteDialect();
        }

        setGeneratedSql(qb.toSql(driver));
    }, [scenario, dialect]);

    return { generatedSql, generatedTs };
};