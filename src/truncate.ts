import type { MicroCMSListResponse } from './types.js';

// Constants
export const FIELD_LENGTH_THRESHOLD = 200;
export const ARRAY_ELEMENTS_THRESHOLD = 10;
export const RESPONSE_SIZE_THRESHOLD = 40_000;
export const MAX_DEPTH = 10;

export interface TruncationStats {
  fieldsTruncated: number;
  arraysTruncated: number;
  contentsTruncated: number;
}

export interface TruncatedListResponse {
  contents: unknown[];
  totalCount: number;
  offset: number;
  limit: number;
  _truncationNotice?: string;
}

export function truncateValue(
  value: unknown,
  depth: number,
  stats: TruncationStats,
  seen?: WeakSet<object>
): unknown {
  if (value === null || value === undefined) return value;

  // Layer 1: string truncation
  if (typeof value === 'string') {
    if (value.length > FIELD_LENGTH_THRESHOLD) {
      stats.fieldsTruncated++;
      return `[truncated: ${value.length} chars]`;
    }
    return value;
  }

  // number, boolean → pass through
  if (typeof value !== 'object') return value;

  // Depth limit: stop recursing
  if (depth >= MAX_DEPTH) return value;

  // Circular reference check
  const visited = seen ?? new WeakSet<object>();
  if (visited.has(value)) return '[circular reference]';
  visited.add(value);

  // Layer 2 + recursion: arrays
  if (Array.isArray(value)) {
    let items = value;
    let marker: string | null = null;
    if (value.length > ARRAY_ELEMENTS_THRESHOLD) {
      items = value.slice(0, ARRAY_ELEMENTS_THRESHOLD);
      marker = `[... ${value.length - ARRAY_ELEMENTS_THRESHOLD} more items]`;
      stats.arraysTruncated++;
    }
    const result = items.map((item) => truncateValue(item, depth + 1, stats, visited));
    if (marker) result.push(marker);
    return result;
  }

  // Recursion: objects
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    result[key] = truncateValue(val, depth + 1, stats, visited);
  }
  return result;
}

function buildTruncationNotice(
  stats: TruncationStats,
  originalContentsCount: number
): string | undefined {
  const { fieldsTruncated, arraysTruncated, contentsTruncated } = stats;

  if (fieldsTruncated === 0 && arraysTruncated === 0 && contentsTruncated === 0) {
    return undefined;
  }

  const parts: string[] = [];

  if (fieldsTruncated > 0) {
    parts.push(
      `${fieldsTruncated} field value(s) exceeding 200 characters were replaced with "[truncated: N chars]".`
    );
  }

  if (arraysTruncated > 0) {
    parts.push(
      `${arraysTruncated} array field(s) exceeding 10 elements were limited to the first 10 items.`
    );
  }

  if (contentsTruncated > 0) {
    const kept = originalContentsCount - contentsTruncated;
    parts.push(
      `Response size exceeded limit: showing ${kept} of ${originalContentsCount} items. Use offset to retrieve remaining items.`
    );
  }

  parts.push(
    "Use microcms_get_content with the content's endpoint and contentId to retrieve full content."
  );

  return parts.join(' ');
}

export function truncateListResponse<T>(
  response: MicroCMSListResponse<T>
): TruncatedListResponse {
  const stats: TruncationStats = {
    fieldsTruncated: 0,
    arraysTruncated: 0,
    contentsTruncated: 0,
  };

  // Step 1: Layer 1 + Layer 2 on each content item
  let truncatedContents = response.contents.map(
    (content) => truncateValue(content, 0, stats)
  );

  // Step 2: Layer 3 - reduce contents if response too large (binary search)
  const baseOverhead = JSON.stringify({
    contents: [],
    totalCount: response.totalCount,
    offset: response.offset,
    limit: response.limit,
  }).length;

  if (truncatedContents.length > 0) {
    const itemSizes = truncatedContents.map(
      (item) => JSON.stringify(item).length
    );

    // Calculate cumulative sizes: baseOverhead + items + separators
    // JSON array format: [item1,item2,...] — each item after the first adds a comma
    let cumulativeSize = baseOverhead;
    let keepCount = truncatedContents.length;

    // Find how many items fit using prefix sums
    for (let i = 0; i < itemSizes.length; i++) {
      const separatorSize = i === 0 ? 0 : 1; // comma between items
      cumulativeSize += itemSizes[i] + separatorSize;
      if (cumulativeSize > RESPONSE_SIZE_THRESHOLD && i >= 1) {
        keepCount = i;
        break;
      }
    }

    if (keepCount < truncatedContents.length) {
      stats.contentsTruncated = truncatedContents.length - keepCount;
      truncatedContents = truncatedContents.slice(0, keepCount);
    }
  }

  // Step 3: Add _truncationNotice
  const notice = buildTruncationNotice(stats, response.contents.length);
  const result: TruncatedListResponse = {
    contents: truncatedContents,
    totalCount: response.totalCount,
    offset: response.offset,
    limit: response.limit,
  };
  if (notice) {
    result._truncationNotice = notice;
  }
  return result;
}
