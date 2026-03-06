import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getContentManagement } from '../client.js';
import { generateOutputPath, writeOutputFile } from '../file.js';
import type { ToolParameters } from '../types.js';

export const getContentMetaTool: Tool = {
  name: 'microcms_get_content_meta',
  description: 'Get a specific content with metadata from microCMS Management API. IMPORTANT: Use this tool ONLY when the user message contains "メタ" (meta) or "メタ情報" (metadata). This API returns metadata information such as status, createdBy, updatedBy, reservationTime, closedAt, and customStatus that are not available in the regular content API. For regular content retrieval, use microcms_get_content instead.',
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
    },
    required: ['endpoint', 'contentId'],
  },
};

export async function handleGetContentMeta(params: ToolParameters) {
  const { endpoint, contentId } = params;

  if (!endpoint) {
    throw new Error('endpoint is required');
  }

  if (!contentId) {
    throw new Error('contentId is required');
  }

  const result = await getContentManagement(endpoint, contentId);

  const outputPath = generateOutputPath(endpoint, contentId);
  await writeOutputFile(outputPath, result);

  return {
    file: outputPath,
    endpoint,
    contentId,
  };
}
