import { describe, it, expect } from 'vitest';
import { SelectQueryBuilder } from '../../../src/query-builder/select.js';
import { defineTable } from '../../../src/schema/table.js';
import { col } from '../../../src/schema/column-types.js';
import { PostgresDialect } from '../../../src/core/dialect/postgres/index.js';
import { MySqlDialect } from '../../../src/core/dialect/mysql/index.js';
import { SqliteDialect } from '../../../src/core/dialect/sqlite/index.js';
import { SqlServerDialect } from '../../../src/core/dialect/mssql/index.js';

import { coalesce, nullif, greatest, least, ifNull } from '../../../src/core/functions/control-flow.js';
import { age, localTime, localTimestamp } from '../../../src/core/functions/datetime.js';
import { log2, cbrt } from '../../../src/core/functions/numeric.js';
import { reverse, initcap, md5, sha1, sha2 } from '../../../src/core/functions/text.js';
import { stddev, variance } from '../../../src/core/ast/aggregate-functions.js';

const users = defineTable('users', {
    id: col.int(),
    name: col.varchar(255),
    created_at: col.datetime(),
    score: col.int()
});

const compileSql = (dialect: any, builder: SelectQueryBuilder<any, any>): string => builder.compile(dialect).sql;

describe('Extended SQL Function Dialects', () => {
    const postgres = new PostgresDialect();
    const mysql = new MySqlDialect();
    const sqlite = new SqliteDialect();
    const mssql = new SqlServerDialect();

    it('renders control-flow helpers consistently', () => {
        const qb = new SelectQueryBuilder(users).select({
            nameCoalesce: coalesce(users.columns.name, 'anonymous'),
            nameAlias: ifNull(users.columns.name, 'anonymous'),
            nullIfEmpty: nullif(users.columns.name, ''),
            highestScore: greatest(users.columns.score, 100),
            lowestScore: least(users.columns.score, 0)
        });

        expect(compileSql(postgres, qb)).toContain('COALESCE("users"."name"');
        expect(compileSql(mysql, qb)).toContain('COALESCE(`users`.`name`');
        expect(compileSql(sqlite, qb)).toContain('COALESCE("users"."name"');
        expect(compileSql(mssql, qb)).toContain('COALESCE([users].[name]');

        expect(compileSql(postgres, qb)).toContain('NULLIF("users"."name"');
        expect(compileSql(mysql, qb)).toContain('NULLIF(`users`.`name`');
        expect(compileSql(sqlite, qb)).toContain('NULLIF("users"."name"');
        expect(compileSql(mssql, qb)).toContain('NULLIF([users].[name]');

        expect(compileSql(postgres, qb)).toContain('GREATEST("users"."score"');
        expect(compileSql(mysql, qb)).toContain('GREATEST(`users`.`score`');
        expect(compileSql(sqlite, qb)).toContain('GREATEST("users"."score"');
        expect(compileSql(mssql, qb)).toContain('GREATEST([users].[score]');

        expect(compileSql(postgres, qb)).toContain('LEAST("users"."score"');
        expect(compileSql(mysql, qb)).toContain('LEAST(`users`.`score`');
        expect(compileSql(sqlite, qb)).toContain('LEAST("users"."score"');
        expect(compileSql(mssql, qb)).toContain('LEAST([users].[score]');

        expect(compileSql(postgres, qb)).not.toContain('IFNULL');
        expect(compileSql(mysql, qb)).not.toContain('IFNULL');
        expect(compileSql(sqlite, qb)).not.toContain('IFNULL');
        expect(compileSql(mssql, qb)).not.toContain('IFNULL');
    });

    it('renders datetime helpers consistently', () => {
        const qb = new SelectQueryBuilder(users).select({
            ageSinceCreate: age(users.columns.created_at),
            localTimeNow: localTime(),
            localTimestampNow: localTimestamp()
        });

        expect(compileSql(postgres, qb)).toContain('AGE("users"."created_at")');
        expect(compileSql(mysql, qb)).toContain('AGE(`users`.`created_at`)');
        expect(compileSql(sqlite, qb)).toContain('AGE("users"."created_at")');
        expect(compileSql(mssql, qb)).toContain('AGE([users].[created_at])');

        expect(compileSql(postgres, qb)).toContain('LOCALTIME');
        expect(compileSql(mysql, qb)).toContain('LOCALTIME');
        expect(compileSql(sqlite, qb)).toContain('LOCALTIME');
        expect(compileSql(mssql, qb)).toContain('LOCALTIME');

        expect(compileSql(postgres, qb)).toContain('LOCALTIMESTAMP');
        expect(compileSql(mysql, qb)).toContain('LOCALTIMESTAMP');
        expect(compileSql(sqlite, qb)).toContain('LOCALTIMESTAMP');
        expect(compileSql(mssql, qb)).toContain('LOCALTIMESTAMP');
    });

    it('renders numeric and text helpers consistently', () => {
        const qb = new SelectQueryBuilder(users).select({
            log2Score: log2(users.columns.score),
            cubeRootScore: cbrt(users.columns.score),
            reversedName: reverse(users.columns.name),
            titleName: initcap(users.columns.name),
            hashedMd5: md5(users.columns.name),
            hashedSha1: sha1(users.columns.name),
            hashedSha2: sha2(users.columns.name, 256)
        });

        expect(compileSql(postgres, qb)).toContain('LOG2("users"."score")');
        expect(compileSql(mysql, qb)).toContain('LOG2(`users`.`score`)');
        expect(compileSql(sqlite, qb)).toContain('LOG2("users"."score")');
        expect(compileSql(mssql, qb)).toContain('LOG2([users].[score]');

        expect(compileSql(postgres, qb)).toContain('CBRT("users"."score")');
        expect(compileSql(mysql, qb)).toContain('CBRT(`users`.`score`)');
        expect(compileSql(sqlite, qb)).toContain('CBRT("users"."score")');
        expect(compileSql(mssql, qb)).toContain('CBRT([users].[score]');

        expect(compileSql(postgres, qb)).toContain('REVERSE("users"."name")');
        expect(compileSql(mysql, qb)).toContain('REVERSE(`users`.`name`)');
        expect(compileSql(sqlite, qb)).toContain('REVERSE("users"."name")');
        expect(compileSql(mssql, qb)).toContain('REVERSE([users].[name]');

        expect(compileSql(postgres, qb)).toContain('INITCAP("users"."name")');
        expect(compileSql(mysql, qb)).toContain('INITCAP(`users`.`name`)');
        expect(compileSql(sqlite, qb)).toContain('INITCAP("users"."name")');
        expect(compileSql(mssql, qb)).toContain('INITCAP([users].[name]');

        expect(compileSql(postgres, qb)).toContain('MD5("users"."name")');
        expect(compileSql(mysql, qb)).toContain('MD5(`users`.`name`)');
        expect(compileSql(sqlite, qb)).toContain('MD5("users"."name")');
        expect(compileSql(mssql, qb)).toContain('MD5([users].[name]');

        expect(compileSql(postgres, qb)).toContain('SHA1("users"."name")');
        expect(compileSql(mysql, qb)).toContain('SHA1(`users`.`name`)');
        expect(compileSql(sqlite, qb)).toContain('SHA1("users"."name")');
        expect(compileSql(mssql, qb)).toContain('SHA1([users].[name]');

        expect(compileSql(postgres, qb)).toContain('SHA2("users"."name"');
        expect(compileSql(mysql, qb)).toContain('SHA2(`users`.`name`');
        expect(compileSql(sqlite, qb)).toContain('SHA2("users"."name"');
        expect(compileSql(mssql, qb)).toContain('SHA2([users].[name]');
    });

    it('renders aggregate helpers consistently', () => {
        const qb = new SelectQueryBuilder(users).select({
            deviation: stddev(users.columns.score),
            varianceScore: variance(users.columns.score)
        });

        expect(compileSql(postgres, qb)).toContain('STDDEV("users"."score")');
        expect(compileSql(mysql, qb)).toContain('STDDEV(`users`.`score`)');
        expect(compileSql(sqlite, qb)).toContain('STDDEV("users"."score")');
        expect(compileSql(mssql, qb)).toContain('STDDEV([users].[score]');

        expect(compileSql(postgres, qb)).toContain('VARIANCE("users"."score")');
        expect(compileSql(mysql, qb)).toContain('VARIANCE(`users`.`score`)');
        expect(compileSql(sqlite, qb)).toContain('VARIANCE("users"."score")');
        expect(compileSql(mssql, qb)).toContain('VARIANCE([users].[score]');
    });
});
