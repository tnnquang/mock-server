// Node.js public API
export { startServer, type ServerOptions } from './server.js';
export { loadTypeFromFile, extractTypeFromLine } from './file-parser.js';
export { saveResponse } from './file-saver.js';

// Re-export core
export {
  generateMockData,
  generateFromType,
  parseAndResolve,
  parseTypes,
  validateSchema,
  normalizeSchema,
} from '../core/index.js';

export type {
  MockSchema,
  DataConfig,
  RequestConfig,
  TypeNode,
  PropertyNode,
  GeneratorOptions,
} from '../core/types.js';
