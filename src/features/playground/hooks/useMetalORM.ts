import { useState, useEffect } from 'react';
import { SelectQueryBuilder } from '../../../metal-orm/src/builder/select';
import { TypeScriptGenerator } from '../../../metal-orm/src/codegen/typescript';
import { MySqlDialect } from '../../../metal-orm/src/dialect/mysql';
import { SqlServerDialect } from '../../../metal-orm/src/dialect/mssql';
import { SqliteDialect } from '../../../metal-orm/src/dialect/sqlite';
import { HydrationPlan } from '../../../metal-orm/src/ast/query';
import { Users } from '../data/schema';
import { Scenario } from '../data/scenarios';

export type SupportedDialect = 'MySQL' | 'SQL Server' | 'SQLite';

export const useMetalORM = (scenario: Scenario, dialect: SupportedDialect) => {
    const [generatedSql, setGeneratedSql] = useState('');
    const [generatedTs, setGeneratedTs] = useState('');
    const [hydrationPlan, setHydrationPlan] = useState<HydrationPlan | undefined>(undefined);

    useEffect(() => {
        let qb = new SelectQueryBuilder(Users);
        qb = scenario.build(qb);

        setHydrationPlan(qb.getHydrationPlan());
        
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

    return { generatedSql, generatedTs, hydrationPlan };
};
