import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { Database } from "bun:sqlite";
import { createBunSqliteExecutor } from "../../../../src/core/execution/executors/bun-sqlite-executor";

describe("BunSqliteExecutor", () => {
  let db: Database;

  beforeAll(() => {
    db = new Database(":memory:");
    db.run("CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)");
  });

  afterAll(() => {
    db.close();
  });

  test("executeSql: SELECT", async () => {
    const executor = createBunSqliteExecutor(db);
    db.run("INSERT INTO users (name) VALUES ('Alice')");

    const payload = await executor.executeSql("SELECT * FROM users WHERE name = ?", ["Alice"]);

    expect(payload.resultSets).toBeDefined();
    expect(payload.resultSets![0].values).toHaveLength(1);
    expect(payload.resultSets![0].columns).toEqual(["id", "name"]);
    expect(payload.resultSets![0].values[0][1]).toBe("Alice");
  });

  test("executeSql: INSERT", async () => {
    const executor = createBunSqliteExecutor(db);
    const payload = await executor.executeSql("INSERT INTO users (name) VALUES (?)", ["Bob"]);

    expect(payload.resultSets![0].meta?.rowsAffected).toBe(1);
    expect(payload.resultSets![0].meta?.insertId).toBeDefined();
  });

  test("executeSql: RETURNING", async () => {
    const executor = createBunSqliteExecutor(db);
    const payload = await executor.executeSql("INSERT INTO users (name) VALUES (?) RETURNING id, name", ["Charlie"]);

    expect(payload.resultSets![0].values).toHaveLength(1);
    expect(payload.resultSets![0].columns).toEqual(["id", "name"]);
    expect(payload.resultSets![0].values[0][1]).toBe("Charlie");
  });

  test("transactions", async () => {
    const executor = createBunSqliteExecutor(db);

    await executor.beginTransaction();
    await executor.executeSql("INSERT INTO users (name) VALUES (?)", ["Dave"]);
    await executor.rollbackTransaction();

    const payload = await executor.executeSql("SELECT * FROM users WHERE name = ?", ["Dave"]);
    expect(payload.resultSets![0].values).toHaveLength(0);

    await executor.beginTransaction();
    await executor.executeSql("INSERT INTO users (name) VALUES (?)", ["Eve"]);
    await executor.commitTransaction();

    const payload2 = await executor.executeSql("SELECT * FROM users WHERE name = ?", ["Eve"]);
    expect(payload2.resultSets![0].values).toHaveLength(1);
  });

  test("savepoints", async () => {
    const executor = createBunSqliteExecutor(db);

    await executor.beginTransaction();
    await executor.executeSql("INSERT INTO users (name) VALUES (?)", ["Frank"]);

    await executor.savepoint!("sp1");
    await executor.executeSql("INSERT INTO users (name) VALUES (?)", ["Grace"]);

    await executor.rollbackToSavepoint!("sp1");
    await executor.releaseSavepoint!("sp1");
    await executor.commitTransaction();

    const payloadF = await executor.executeSql("SELECT * FROM users WHERE name = ?", ["Frank"]);
    expect(payloadF.resultSets![0].values).toHaveLength(1);

    const payloadG = await executor.executeSql("SELECT * FROM users WHERE name = ?", ["Grace"]);
    expect(payloadG.resultSets![0].values).toHaveLength(0);
  });
});
