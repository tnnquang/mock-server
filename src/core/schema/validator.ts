import type { MockSchema } from '../types.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate a MockSchema for correctness.
 */
export function validateSchema(schema: unknown): ValidationResult {
  const errors: string[] = [];

  if (!schema || typeof schema !== 'object') {
    return { valid: false, errors: ['Schema must be a non-null object'] };
  }

  const s = schema as Record<string, unknown>;

  // Must have at least one type source
  if (!s.typeDefinition && !s.pathType) {
    errors.push('Schema must have either "typeDefinition" (string) or "pathType" (file path)');
  }

  if (s.typeDefinition && typeof s.typeDefinition !== 'string') {
    errors.push('"typeDefinition" must be a string containing TypeScript type definitions');
  }

  if (s.pathType && typeof s.pathType !== 'string') {
    errors.push('"pathType" must be a string file path');
  }

  if (s.typeName !== undefined && typeof s.typeName !== 'string') {
    errors.push('"typeName" must be a string');
  }

  // Line range
  if (s.startLine !== undefined) {
    if (typeof s.startLine !== 'number' || s.startLine < 1) {
      errors.push('"startLine" must be a positive number');
    }
  }
  if (s.endLine !== undefined) {
    if (typeof s.endLine !== 'number' || s.endLine < 1) {
      errors.push('"endLine" must be a positive number');
    }
  }
  if (s.startLine && s.endLine && typeof s.startLine === 'number' && typeof s.endLine === 'number') {
    if (s.startLine > s.endLine) {
      errors.push('"startLine" must be less than or equal to "endLine"');
    }
  }

  // dataConfig
  if (s.dataConfig !== undefined) {
    if (typeof s.dataConfig !== 'object' || s.dataConfig === null) {
      errors.push('"dataConfig" must be an object');
    } else {
      const dc = s.dataConfig as Record<string, unknown>;

      if (dc.request !== undefined) {
        if (typeof dc.request !== 'object' || dc.request === null) {
          errors.push('"dataConfig.request" must be an object');
        } else {
          const req = dc.request as Record<string, unknown>;
          if (req.responseType !== undefined && req.responseType !== 'single' && req.responseType !== 'list') {
            errors.push('"dataConfig.request.responseType" must be "single" or "list"');
          }
          for (const field of ['page', 'limit', 'perPage', 'totalPage']) {
            if (req[field] !== undefined && (typeof req[field] !== 'number' || (req[field] as number) < 0)) {
              errors.push(`"dataConfig.request.${field}" must be a non-negative number`);
            }
          }
        }
      }

      if (dc.response !== undefined && (typeof dc.response !== 'object' || dc.response === null)) {
        errors.push('"dataConfig.response" must be an object (template)');
      }
    }
  }

  // responseSave
  if (s.responseSave !== undefined && s.responseSave !== false) {
    if (typeof s.responseSave !== 'object' || s.responseSave === null) {
      errors.push('"responseSave" must be false or { path: string }');
    } else {
      const rs = s.responseSave as Record<string, unknown>;
      if (!rs.path || typeof rs.path !== 'string') {
        errors.push('"responseSave.path" must be a string');
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Normalize schema: apply defaults, coerce types.
 */
export function normalizeSchema(schema: MockSchema): MockSchema {
  return {
    ...schema,
    dataConfig: {
      request: {
        responseType: 'single',
        page: 1,
        limit: 10,
        ...schema.dataConfig?.request,
      },
      response: schema.dataConfig?.response,
    },
    responseSave: schema.responseSave ?? false,
  };
}
