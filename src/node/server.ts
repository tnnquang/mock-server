import express from 'express';
import cors from 'cors';
import type { MockSchema, GeneratorOptions } from '../core/types.js';
import { generateMockData } from '../core/generator/index.js';
import { validateSchema } from '../core/schema/index.js';
import { loadTypeFromFile } from './file-parser.js';

export interface ServerOptions {
  port?: number;
  locale?: string;
  logging?: boolean;
}

/**
 * Create and start an Express mock server.
 * Uses a single catch-all route - any method, any path.
 * The request body must contain a MockSchema.
 */
export function startServer(options: ServerOptions = {}): { app: ReturnType<typeof express>; close: () => void } {
  const port = options.port || 3000;
  const generatorOptions: GeneratorOptions = {
    locale: options.locale,
  };

  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Health check
  app.get('/_mock-server/health', (_req, res) => {
    res.json({ status: 'ok', version: '2.0.0' });
  });

  // Catch-all route: any method, any path
  app.all('*', (req, res) => {
    try {
      const body = req.body;

      if (!body || Object.keys(body).length === 0) {
        res.status(400).json({
          error: 'Request body is empty. Send a MockSchema JSON in the request body.',
          example: {
            typeDefinition: 'interface User { id: string; name: string; email: string; }',
            dataConfig: {
              request: { responseType: 'list', limit: 5 },
            },
          },
        });
        return;
      }

      // Resolve pathType to typeDefinition (server-side only)
      const schema: MockSchema = { ...body };
      if (schema.pathType && !schema.typeDefinition) {
        schema.typeDefinition = loadTypeFromFile({
          pathType: schema.pathType,
          startLine: schema.startLine,
          endLine: schema.endLine,
        });
      }

      const validation = validateSchema(schema);
      if (!validation.valid) {
        res.status(400).json({ error: 'Invalid schema', details: validation.errors });
        return;
      }

      if (options.logging) {
        console.log(`[mock-server] ${req.method} ${req.path}`);
      }

      // Apply query params as request config overrides
      if (req.query.page) {
        schema.dataConfig = schema.dataConfig || {};
        schema.dataConfig.request = schema.dataConfig.request || {};
        schema.dataConfig.request.page = parseInt(req.query.page as string, 10);
      }
      if (req.query.limit) {
        schema.dataConfig = schema.dataConfig || {};
        schema.dataConfig.request = schema.dataConfig.request || {};
        schema.dataConfig.request.limit = parseInt(req.query.limit as string, 10);
      }

      const data = generateMockData(schema, undefined, generatorOptions);

      res.json(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[mock-server] Error:`, message);
      res.status(500).json({ error: message });
    }
  });

  const server = app.listen(port, () => {
    console.log(`[mock-server] Running on http://localhost:${port}`);
    console.log(`[mock-server] Send POST requests with MockSchema in body to any endpoint`);
  });

  return {
    app,
    close: () => server.close(),
  };
}
