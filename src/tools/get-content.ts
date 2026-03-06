import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getListDetail } from '../client.js';
import { generateOutputPath, writeOutputFile } from '../file.js';
import { normalizeForEdit } from '../normalize.js';
import type { ToolParameters, MicroCMSGetOptions } from '../types.js';

export const getContentTool: Tool = {
  name: 'microcms_get_content',
  description: 'Get a specific content from microCMS',
  inputSchema: {
    type: 'object',
    properties: {
      endpoint: {
        type: 'string',
        description: 'Content type name (e.g., "blogs", "news")',
      },
      contentId: {
        type: 'string',
        description: 'Content ID to retrieve',
      },
      draftKey: {
        type: 'string',
        description: 'Draft key for preview',
      },
      fields: {
        type: 'string',
        description: 'Comma-separated list of fields to retrieve',
      },
      depth: {
        type: 'number',
        description: 'Depth of reference expansion (1-3)',
        minimum: 1,
        maximum: 3,
      },
      forEdit: {
        type: 'boolean',
        description:
          'If true, output file is normalized to request-compatible format (media objects→URL strings, relation objects→ID strings, system fields removed). Use this when you plan to edit and re-submit the content via update tools.',
      },
    },
    required: ['endpoint', 'contentId'],
  },
};

export async function handleGetContent(params: ToolParameters) {
  const { endpoint, contentId, ...options } = params;

  if (!contentId) {
    throw new Error('contentId is required');
  }

  const queries: MicroCMSGetOptions = {};

  if (options.draftKey) queries.draftKey = options.draftKey;
  if (options.fields) queries.fields = options.fields;
  if (options.depth) queries.depth = options.depth;

  const result = await getListDetail(endpoint, contentId, queries);

  const forEdit = Boolean(options.forEdit);
  const outputData =
    forEdit && typeof result === 'object' && result !== null
      ? normalizeForEdit(result as Record<string, unknown>)
      : result;

  const outputPath = generateOutputPath(endpoint, contentId);
  await writeOutputFile(outputPath, outputData);

  const fields =
    typeof outputData === 'object' && outputData !== null
      ? Object.keys(outputData)
      : [];

  return {
    file: outputPath,
    endpoint,
    contentId,
    fields,
    forEdit,
  };
}