import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { create } from '../client.js';
import type { ToolParameters, MicroCMSCreateOptions } from '../types.js';
import { FIELD_FORMATS_DESCRIPTION } from '../constants.js';
import { readInputFile } from '../file.js';
import { assertRecord } from '../content-utils.js';
import { normalizeForEdit } from '../normalize.js';

export function getCreateContentPublishedTool(baseDir: string): Tool {
  return {
    name: 'microcms_create_content_published',
    description: FIELD_FORMATS_DESCRIPTION,
    inputSchema: {
      type: 'object',
      properties: {
        endpoint: {
          type: 'string',
          description: 'Content type name (e.g., "blogs", "news")',
        },
        contentFilePath: {
          type: 'string',
          description: `Absolute path to a JSON file containing the content data. Create the file in ${baseDir} using the Write tool, then specify the path here.`,
        },
        contentId: {
          type: 'string',
          description: 'Specific content ID to assign',
        },
      },
      required: ['endpoint', 'contentFilePath'],
    },
  };
}

export async function handleCreateContentPublished(params: ToolParameters) {
  const { endpoint, contentFilePath, ...options } = params;

  if (!contentFilePath) {
    throw new Error('contentFilePath is required');
  }

  const rawContent = assertRecord(await readInputFile(contentFilePath));
  const content = normalizeForEdit(rawContent);

  const createOptions: MicroCMSCreateOptions = {
    isDraft: false, // Always publish
  };

  if (options.contentId) createOptions.contentId = options.contentId;

  return await create(endpoint, content, createOptions);
}
