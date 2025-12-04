import { IncomingMessage, ServerResponse } from 'node:http';
import { SqliteClient } from '../../src/playground/features/playground/clients/SqliteClient.js';
import { SCENARIOS } from '../../src/playground/features/playground/data/scenarios/index.js';
import { QueryExecutionService } from '../../src/playground/features/playground/services/QueryExecutionService.js';
import type { ApiStatusResponse } from '../../src/playground/features/playground/api/types.js';

export const PLAYGROUND_API_PREFIX = '/api/playground';

const sqliteClient = new SqliteClient();
const queryExecutionService = new QueryExecutionService(sqliteClient);

const sendJson = (res: ServerResponse, payload: unknown, status = 200) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
};

const parseJsonBody = (req: IncomingMessage) =>
  new Promise<Record<string, unknown>>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });

const handleStatus = (_req: IncomingMessage, res: ServerResponse) => {
  const body: ApiStatusResponse = {
    ready: sqliteClient.isReady,
    error: sqliteClient.error
  };
  sendJson(res, body);
};

const handleExecute = async (req: IncomingMessage, res: ServerResponse) => {
  try {
    const { scenarioId } = await parseJsonBody(req);
    if (!scenarioId || typeof scenarioId !== 'string') {
      sendJson(res, { error: 'Missing scenarioId' }, 400);
      return;
    }

    const scenario = SCENARIOS.find(s => s.id === scenarioId);
    if (!scenario) {
      sendJson(res, { error: `Scenario '${scenarioId}' not found` }, 404);
      return;
    }

    const result = await queryExecutionService.executeScenario(scenario);
    sendJson(res, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    sendJson(res, { error: message }, 500);
  }
};

export const createPlaygroundApiMiddleware = () => {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const pathname = req.url ? req.url.split('?')[0] : '';

    if (req.method === 'GET' && pathname === '/status') {
      handleStatus(req, res);
      return;
    }

    if (req.method === 'POST' && pathname === '/execute') {
      await handleExecute(req, res);
      return;
    }

    next();
  };
};

export const playgroundApiPlugin = () => ({
  name: 'metal-orm-playground-api',
  configureServer(server) {
    server.middlewares.use(PLAYGROUND_API_PREFIX, createPlaygroundApiMiddleware());
  },
  configurePreviewServer(server) {
    server.middlewares.use(PLAYGROUND_API_PREFIX, createPlaygroundApiMiddleware());
  },
});
