import fs from 'node:fs';
import path from 'node:path';

/**
 * Save generated data to a file.
 * Supports both relative and absolute paths.
 */
export function saveResponse(data: unknown, savePath: string, cwd?: string): string {
  let resolvedPath: string;

  if (path.isAbsolute(savePath)) {
    resolvedPath = savePath;
  } else {
    resolvedPath = path.resolve(cwd || process.cwd(), savePath);
  }

  // Create directory if it doesn't exist
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const content = JSON.stringify(data, null, 2);
  fs.writeFileSync(resolvedPath, content, 'utf-8');

  return resolvedPath;
}
