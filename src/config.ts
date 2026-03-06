import * as path from 'node:path';
import * as os from 'node:os';

export interface Config {
  serviceDomain: string;
  apiKey: string;
  fileDir: string;
}

export function parseConfig(): Config {
  const args = process.argv.slice(2);

  // Parse command line arguments
  let serviceDomain: string | undefined;
  let apiKey: string | undefined;
  let fileDir: string | undefined;

  const serviceIdIndex = args.indexOf('--service-id');
  if (serviceIdIndex !== -1 && serviceIdIndex + 1 < args.length) {
    serviceDomain = args[serviceIdIndex + 1];
  }

  const apiKeyIndex = args.indexOf('--api-key');
  if (apiKeyIndex !== -1 && apiKeyIndex + 1 < args.length) {
    apiKey = args[apiKeyIndex + 1];
  }

  const fileDirIndex = args.indexOf('--file-dir');
  if (fileDirIndex !== -1 && fileDirIndex + 1 < args.length) {
    fileDir = args[fileDirIndex + 1];
  }

  // Fallback to environment variables if not provided via command line
  serviceDomain = serviceDomain || process.env.MICROCMS_SERVICE_ID;
  apiKey = apiKey || process.env.MICROCMS_API_KEY;
  fileDir = fileDir || process.env.MICROCMS_FILE_DIR;

  // Set environment variable for file-manager to pick up
  if (fileDir) {
    process.env.MICROCMS_FILE_DIR = fileDir;
  }

  if (!serviceDomain || !apiKey) {
    throw new Error(
      'microCMS credentials are required. Provide them via:\n' +
      '  Command line: --service-id <service-id> --api-key <key>\n' +
      '  Environment variables: MICROCMS_SERVICE_ID and MICROCMS_API_KEY'
    );
  }

  return {
    serviceDomain,
    apiKey,
    fileDir: fileDir || path.join(os.tmpdir(), 'microcms-mcp'),
  };
}
