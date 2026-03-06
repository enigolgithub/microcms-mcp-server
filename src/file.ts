import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';

const MAX_INPUT_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const SAFE_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

let baseDir: string = path.join(os.tmpdir(), 'microcms-mcp');

export function getBaseDir(): string {
  return baseDir;
}

export async function setupIODirectory(): Promise<void> {
  const configuredDir = process.env.MICROCMS_FILE_DIR;
  if (configuredDir) {
    baseDir = configuredDir;
  }
  await fs.mkdir(baseDir, { recursive: true });
}

function sanitizeName(value: string): string {
  if (SAFE_NAME_PATTERN.test(value)) {
    return value;
  }
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64) || 'unknown';
}

export function generateOutputPath(endpoint: string, contentId: string): string {
  const safeEndpoint = sanitizeName(endpoint);
  const safeContentId = sanitizeName(contentId);

  const now = new Date();
  const timestamp = now.toISOString().replace(/[-T:.Z]/g, '');
  const shortUUID = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  const fileName = `${safeEndpoint}_${safeContentId}_${timestamp}_${shortUUID}.json`;
  return path.join(baseDir, fileName);
}

export async function writeOutputFile(filePath: string, data: unknown): Promise<string> {
  const resolved = validateFilePath(filePath);
  const content = JSON.stringify(data, null, 2);
  await fs.writeFile(resolved, content, 'utf-8');
  return resolved;
}

export function validateFilePath(filePath: string): string {
  const resolved = path.resolve(filePath);
  const base = getBaseDir();
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    throw new Error(
      `File path must be within the file I/O directory: ${base}\nGiven path: ${resolved}`
    );
  }
  return resolved;
}

export async function readInputFile(filePath: string): Promise<unknown> {
  const resolved = validateFilePath(filePath);

  const raw = await fs.readFile(resolved, 'utf-8');
  if (Buffer.byteLength(raw, 'utf-8') > MAX_INPUT_FILE_SIZE) {
    throw new Error(
      `Input file exceeds maximum size of ${MAX_INPUT_FILE_SIZE / 1024 / 1024}MB`
    );
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Failed to parse JSON from file: ${resolved}`);
  }
}
