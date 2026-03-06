import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { create } from '../client.js';
import type { BulkToolParameters, BulkCreateResult } from '../types.js';
import { FIELD_FORMATS_DESCRIPTION } from '../constants.js';
import { readInputFile } from '../file.js';
import { assertRecord } from '../content-utils.js';
import { normalizeForEdit } from '../normalize.js';

const BULK_DESCRIPTION = `
  Create multiple contents in microCMS at once.
  This tool processes contents sequentially and continues even if some fail.
  Results include success/failure status for each content.

  ${FIELD_FORMATS_DESCRIPTION}
`;

export function getCreateContentsBulkPublishedTool(baseDir: string): Tool {
  return {
    name: 'microcms_create_contents_bulk_published',
    description: BULK_DESCRIPTION,
    inputSchema: {
      type: 'object',
      properties: {
        endpoint: {
          type: 'string',
          description: 'Content type name (e.g., "blogs", "news")',
        },
        contentFilePaths: {
          type: 'array',
          items: { type: 'string' },
          description: `Array of absolute paths to JSON files. Each file should contain a single content JSON object created in ${baseDir}.`,
        },
      },
      required: ['endpoint', 'contentFilePaths'],
    },
  };
}

export function getCreateContentsBulkDraftTool(baseDir: string): Tool {
  return {
    name: 'microcms_create_contents_bulk_draft',
    description: BULK_DESCRIPTION,
    inputSchema: {
      type: 'object',
      properties: {
        endpoint: {
          type: 'string',
          description: 'Content type name (e.g., "blogs", "news")',
        },
        contentFilePaths: {
          type: 'array',
          items: { type: 'string' },
          description: `Array of absolute paths to JSON files. Each file should contain a single content JSON object created in ${baseDir}.`,
        },
      },
      required: ['endpoint', 'contentFilePaths'],
    },
  };
}

async function handleBulkCreate(
  params: BulkToolParameters,
  isDraft: boolean
): Promise<BulkCreateResult> {
  const { endpoint, contentFilePaths } = params;

  if (!Array.isArray(contentFilePaths) || contentFilePaths.length === 0) {
    throw new Error('contentFilePaths must be a non-empty array');
  }

  const results: BulkCreateResult['results'] = [];
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < contentFilePaths.length; i++) {
    try {
      const rawContent = assertRecord(await readInputFile(contentFilePaths[i]));
      const content = normalizeForEdit(rawContent);

      const result = await create(endpoint, content, { isDraft });

      results.push({
        index: i,
        success: true,
        id: result.id,
      });
      successCount++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      results.push({
        index: i,
        success: false,
        error: errorMessage,
      });
      failureCount++;
    }
  }

  return {
    totalCount: contentFilePaths.length,
    successCount,
    failureCount,
    results,
  };
}

export async function handleCreateContentsBulkPublished(
  params: BulkToolParameters
): Promise<BulkCreateResult> {
  return handleBulkCreate(params, false);
}

export async function handleCreateContentsBulkDraft(
  params: BulkToolParameters
): Promise<BulkCreateResult> {
  return handleBulkCreate(params, true);
}
