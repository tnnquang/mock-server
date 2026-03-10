import fs from 'node:fs';
import path from 'node:path';

/**
 * Read TypeScript type definitions from a file.
 * Supports optional line range extraction.
 */
export function loadTypeFromFile(config: {
  pathType: string;
  startLine?: number;
  endLine?: number;
}): string {
  const filePath = path.resolve(config.pathType);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Type file not found: ${filePath}`);
  }

  let content = fs.readFileSync(filePath, 'utf-8');

  // Extract line range if specified
  if (config.startLine || config.endLine) {
    const lines = content.split('\n');
    const start = (config.startLine ?? 1) - 1;
    const end = config.endLine ?? lines.length;
    content = lines.slice(start, end).join('\n');
  }

  return content;
}

/**
 * Auto-detect the end of a type definition starting from a given line.
 * Tracks brace depth to find matching closing brace.
 */
export function extractTypeFromLine(content: string, startLine: number): string {
  const lines = content.split('\n');
  let depth = 0;
  let started = false;
  const result: string[] = [];

  for (let i = startLine - 1; i < lines.length; i++) {
    const line = lines[i];
    result.push(line);

    for (const ch of line) {
      if (ch === '{') {
        depth++;
        started = true;
      }
      if (ch === '}') {
        depth--;
      }
    }

    // If we've opened and closed all braces, we're done
    if (started && depth <= 0) {
      break;
    }

    // Also stop at next type/interface/enum declaration after the first
    if (result.length > 1 && /^\s*(export\s+)?(interface|type|enum)\s/.test(line) && depth === 0) {
      result.pop(); // Remove the next declaration line
      break;
    }
  }

  return result.join('\n');
}
