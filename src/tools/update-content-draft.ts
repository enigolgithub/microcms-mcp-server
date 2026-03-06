import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { update } from '../client.js';
import type { ToolParameters, MicroCMSUpdateOptions } from '../types.js';
import { FIELD_FORMATS_DESCRIPTION } from '../constants.js';
import { readInputFile } from '../file.js';
import { assertRecord } from '../content-utils.js';
import { normalizeForEdit } from '../normalize.js';

export function getUpdateContentDraftTool(baseDir: string): Tool {
  return {
    name: 'microcms_update_content_draft',
    description: FIELD_FORMATS_DESCRIPTION,
    inputSchema: {
      type: 'object',
      properties: {
        endpoint: {
          type: 'string',
          description: 'Content type name (e.g., "blogs", "news")',
        },
        contentId: {
          type: 'string',
          description: 'Content ID to update',
        },
        contentFilePath: {
          type: 'string',
          description: `Absolute path to a JSON file containing the content data. Create the file in ${baseDir} using the Write tool, then specify the path here.`,
        },
      },
      required: ['endpoint', 'contentId', 'contentFilePath'],
    },
  };
}

export async function handleUpdateContentDraft(params: ToolParameters) {
  const { endpoint, contentId, contentFilePath } = params;

  if (!contentId) {
    throw new Error('contentId is required');
  }

  if (!contentFilePath) {
    throw new Error('contentFilePath is required');
  }

  const rawContent = assertRecord(await readInputFile(contentFilePath));
  const content = normalizeForEdit(rawContent);

  const updateOptions: MicroCMSUpdateOptions = {
    isDraft: true, // Always save as draft
  };

  return await update(endpoint, contentId, content, updateOptions);
}
