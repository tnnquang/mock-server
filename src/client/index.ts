import type { MockSchema, MockServerOptions, MockServerInstance } from '../core/types.js';
import { FetchInterceptor } from './interceptor.js';

export type { MockSchema, MockServerOptions, MockServerInstance } from '../core/types.js';

/**
 * Create and start a mock server that intercepts HTTP requests.
 *
 * Call this at the root of your application (e.g., main.ts, App.tsx, root layout):
 *
 * ```ts
 * import { createMockServer } from '@niceteam/mock-server/client';
 *
 * const mock = createMockServer({
 *   baseURL: 'http://localhost:3000',
 *   locale: 'vi',    // auto-detect by default
 *   delay: 200,       // simulate latency
 *   logging: true,    // log intercepted requests
 *   types: {          // pre-register types
 *     User: 'interface User { id: string; name: string; email: string; }',
 *   },
 * });
 *
 * // Later: make requests
 * const res = await fetch('http://localhost:3000/api/users', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     typeName: 'User',
 *     typeDefinition: 'interface User { id: string; name: string; email: string; age: number; }',
 *     dataConfig: {
 *       request: { responseType: 'list', limit: 10 },
 *       response: { data: { items: '{{data}}', total: '{{total}}' } }
 *     }
 *   })
 * });
 *
 * // Or use pre-registered type (no typeDefinition needed if type was registered):
 * const res2 = await fetch('http://localhost:3000/api/users', {
 *   method: 'POST',
 *   body: JSON.stringify({
 *     typeName: 'User',
 *     typeDefinition: 'interface User {}', // minimal, will use registered type
 *     dataConfig: { request: { responseType: 'list', limit: 5 } }
 *   })
 * });
 *
 * // Stop intercepting
 * mock.stop();
 * ```
 */
export function createMockServer(options?: MockServerOptions): MockServerInstance {
  const interceptor = new FetchInterceptor(options);
  interceptor.enable();

  return {
    stop: () => interceptor.disable(),
    registerType: (name, definition) => interceptor.registerType(name, definition),
    unregisterType: (name) => interceptor.unregisterType(name),
    generate: (schema) => interceptor.generate(schema),
  };
}

/**
 * Generate mock data directly without intercepting HTTP.
 * Useful for testing or when you don't need HTTP mocking.
 */
export { generateMockData } from '../core/generator/index.js';
export { parseAndResolve, parseTypes } from '../core/parser/index.js';
export { validateSchema } from '../core/schema/index.js';
