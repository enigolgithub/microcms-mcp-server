import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  truncateValue,
  truncateListResponse,
  FIELD_LENGTH_THRESHOLD,
  ARRAY_ELEMENTS_THRESHOLD,
  RESPONSE_SIZE_THRESHOLD,
  MAX_DEPTH,
  type TruncationStats,
} from './truncate.js';
import type { MicroCMSListResponse } from './types.js';

function makeStats(): TruncationStats {
  return { fieldsTruncated: 0, arraysTruncated: 0, contentsTruncated: 0 };
}

function makeListResponse(contents: Record<string, unknown>[], totalCount?: number): MicroCMSListResponse<Record<string, unknown>> {
  return {
    contents,
    totalCount: totalCount ?? contents.length,
    offset: 0,
    limit: contents.length,
  };
}

// ─── Layer 1: Field value truncation ─────────────────────────────────

describe('Layer 1 - Field value truncation', () => {
  test('string of exactly 200 chars is NOT truncated', () => {
    const stats = makeStats();
    const str = 'a'.repeat(FIELD_LENGTH_THRESHOLD);
    assert.equal(truncateValue(str, 0, stats), str);
    assert.equal(stats.fieldsTruncated, 0);
  });

  test('string of 201 chars is replaced with truncation marker', () => {
    const stats = makeStats();
    const str = 'a'.repeat(201);
    assert.equal(truncateValue(str, 0, stats), '[truncated: 201 chars]');
    assert.equal(stats.fieldsTruncated, 1);
  });

  test('number passes through unchanged', () => {
    const stats = makeStats();
    assert.equal(truncateValue(42, 0, stats), 42);
    assert.equal(stats.fieldsTruncated, 0);
  });

  test('boolean passes through unchanged', () => {
    const stats = makeStats();
    assert.equal(truncateValue(true, 0, stats), true);
    assert.equal(truncateValue(false, 0, stats), false);
  });

  test('null passes through unchanged', () => {
    const stats = makeStats();
    assert.equal(truncateValue(null, 0, stats), null);
  });

  test('undefined passes through unchanged', () => {
    const stats = makeStats();
    assert.equal(truncateValue(undefined, 0, stats), undefined);
  });

  test('nested object fields are truncated recursively', () => {
    const stats = makeStats();
    const input = {
      title: 'short',
      body: 'x'.repeat(300),
      nested: {
        description: 'y'.repeat(250),
        count: 5,
      },
    };
    const result = truncateValue(input, 0, stats) as Record<string, unknown>;
    assert.equal(result.title, 'short');
    assert.equal(result.body, '[truncated: 300 chars]');
    const nested = result.nested as Record<string, unknown>;
    assert.equal(nested.description, '[truncated: 250 chars]');
    assert.equal(nested.count, 5);
    assert.equal(stats.fieldsTruncated, 2);
  });
});

// ─── Layer 2: Array element limiting ─────────────────────────────────

describe('Layer 2 - Array element limiting', () => {
  test('array of exactly 10 elements is NOT truncated', () => {
    const stats = makeStats();
    const arr = Array.from({ length: ARRAY_ELEMENTS_THRESHOLD }, (_, i) => i);
    const result = truncateValue(arr, 0, stats) as number[];
    assert.equal(result.length, 10);
    assert.equal(stats.arraysTruncated, 0);
  });

  test('array of 15 elements keeps first 10 + marker', () => {
    const stats = makeStats();
    const arr = Array.from({ length: 15 }, (_, i) => i);
    const result = truncateValue(arr, 0, stats) as (number | string)[];
    assert.equal(result.length, 11); // 10 items + 1 marker
    assert.equal(result[10], '[... 5 more items]');
    assert.equal(stats.arraysTruncated, 1);
  });

  test('Layer 1 is applied to remaining elements after Layer 2 cut', () => {
    const stats = makeStats();
    const arr = Array.from({ length: 12 }, (_, i) =>
      i === 0 ? 'z'.repeat(500) : `item-${i}`
    );
    const result = truncateValue(arr, 0, stats) as string[];
    // First element should be truncated (Layer 1)
    assert.equal(result[0], '[truncated: 500 chars]');
    // Marker should be appended (Layer 2)
    assert.equal(result[10], '[... 2 more items]');
    assert.equal(stats.fieldsTruncated, 1);
    assert.equal(stats.arraysTruncated, 1);
  });
});

// ─── Layer 1 + Layer 2 combined ──────────────────────────────────────

describe('Layer 1 + Layer 2 combined', () => {
  test('object with long strings inside an array with >10 elements', () => {
    const stats = makeStats();
    const arr = Array.from({ length: 15 }, (_, i) => ({
      id: i,
      body: 'content-'.repeat(50), // 400 chars, exceeds threshold
    }));
    const result = truncateValue(arr, 0, stats) as Array<Record<string, unknown> | string>;
    // 10 items kept + 1 marker
    assert.equal(result.length, 11);
    // Each kept object should have truncated body
    for (let i = 0; i < 10; i++) {
      const item = result[i] as Record<string, unknown>;
      assert.equal(item.id, i);
      assert.equal(item.body, '[truncated: 400 chars]');
    }
    assert.equal(result[10], '[... 5 more items]');
    assert.equal(stats.fieldsTruncated, 10);
    assert.equal(stats.arraysTruncated, 1);
  });
});

// ─── Layer 3: Response size limiting ─────────────────────────────────

describe('Layer 3 - Response size limiting (truncateListResponse)', () => {
  test('small response has no contents removed, no _truncationNotice', () => {
    const response = makeListResponse([
      { id: '1', title: 'Hello' },
      { id: '2', title: 'World' },
    ]);
    const result = truncateListResponse(response);
    assert.equal(result.contents.length, 2);
    assert.equal(result._truncationNotice, undefined);
  });

  test('large response has contents removed from end with exact count verification', () => {
    const contents = Array.from({ length: 200 }, (_, i) => ({
      id: `id-${i}`,
      // 199 chars each - just under threshold so NOT truncated by Layer 1
      field1: 'a'.repeat(199),
      field2: 'b'.repeat(199),
      field3: 'c'.repeat(199),
      field4: 'd'.repeat(199),
    }));
    const response = makeListResponse(contents, 200);
    const result = truncateListResponse(response);

    // Verify the result fits within the threshold
    assert.ok(result.contents.length < 200);
    assert.ok(result.contents.length >= 1);

    // Verify the exact count: adding one more item should exceed the threshold
    const sizeWithKept = JSON.stringify({
      contents: contents.slice(0, result.contents.length).map((c) => truncateValue(c, 0, makeStats())),
      totalCount: 200,
      offset: 0,
      limit: 200,
    }).length;
    assert.ok(sizeWithKept <= RESPONSE_SIZE_THRESHOLD);

    if (result.contents.length < 200) {
      const sizeWithOneMore = JSON.stringify({
        contents: contents.slice(0, result.contents.length + 1).map((c) => truncateValue(c, 0, makeStats())),
        totalCount: 200,
        offset: 0,
        limit: 200,
      }).length;
      assert.ok(sizeWithOneMore > RESPONSE_SIZE_THRESHOLD);
    }

    assert.ok(result._truncationNotice!.includes('showing'));
    assert.ok(result._truncationNotice!.includes(`showing ${result.contents.length} of 200`));
  });

  test('single content item is never removed even if over limit', () => {
    const contents = [
      {
        id: '1',
        // 199 chars per field, many fields to make it huge
        ...Object.fromEntries(
          Array.from({ length: 300 }, (_, i) => [`field${i}`, 'x'.repeat(199)])
        ),
      },
    ];
    const response = makeListResponse(contents, 1);
    const result = truncateListResponse(response);
    assert.equal(result.contents.length, 1);
  });

  test('contents array is NOT subject to Layer 2 - 15 small items all survive', () => {
    const contents = Array.from({ length: 15 }, (_, i) => ({
      id: `id-${i}`,
      title: `Title ${i}`,
    }));
    const response = makeListResponse(contents, 15);
    const result = truncateListResponse(response);
    // All 15 items should survive - contents is not treated as a regular array
    assert.equal(result.contents.length, 15);
    // No marker string should be present
    for (const item of result.contents) {
      assert.equal(typeof item, 'object');
    }
  });
});

// ─── _truncationNotice ───────────────────────────────────────────────

describe('_truncationNotice', () => {
  test('absent when no truncation occurred', () => {
    const response = makeListResponse([{ id: '1', title: 'short' }]);
    const result = truncateListResponse(response);
    assert.equal(result._truncationNotice, undefined);
    assert.ok(!('_truncationNotice' in result));
  });

  test('present with field count when field truncation occurs', () => {
    const response = makeListResponse([
      { id: '1', body: 'x'.repeat(300) },
    ]);
    const result = truncateListResponse(response);
    assert.ok(result._truncationNotice);
    assert.ok(result._truncationNotice.includes('1 field value(s)'));
    assert.ok(result._truncationNotice.includes('microcms_get_content'));
    assert.ok(!result._truncationNotice.includes('showing'));
  });

  test('present with array count when array truncation occurs', () => {
    const response = makeListResponse([
      {
        id: '1',
        tags: Array.from({ length: 15 }, (_, i) => `tag-${i}`),
      },
    ]);
    const result = truncateListResponse(response);
    assert.ok(result._truncationNotice);
    assert.ok(result._truncationNotice.includes('1 array field(s)'));
    assert.ok(result._truncationNotice.includes('microcms_get_content'));
  });

  test('includes guidance about microcms_get_content when truncation occurs', () => {
    const response = makeListResponse([
      { id: '1', body: 'x'.repeat(300) },
    ]);
    const result = truncateListResponse(response);
    assert.ok(result._truncationNotice!.includes('microcms_get_content'));
  });

  test('when contentsTruncated > 0, includes "showing X of Y" message', () => {
    const contents = Array.from({ length: 200 }, (_, i) => ({
      id: `id-${i}`,
      field1: 'a'.repeat(199),
      field2: 'b'.repeat(199),
      field3: 'c'.repeat(199),
      field4: 'd'.repeat(199),
    }));
    const response = makeListResponse(contents, 200);
    const result = truncateListResponse(response);
    const kept = result.contents.length;
    assert.ok(result._truncationNotice!.includes(`showing ${kept} of 200`));
  });
});

// ─── Circular reference ─────────────────────────────────────────────

describe('Circular reference', () => {
  test('circular object reference returns marker instead of infinite recursion', () => {
    const stats = makeStats();
    const obj: Record<string, unknown> = { id: '1', title: 'test' };
    obj.self = obj; // circular reference
    const result = truncateValue(obj, 0, stats) as Record<string, unknown>;
    assert.equal(result.id, '1');
    assert.equal(result.title, 'test');
    assert.equal(result.self, '[circular reference]');
  });

  test('circular reference in nested structure', () => {
    const stats = makeStats();
    const parent: Record<string, unknown> = { name: 'parent' };
    const child: Record<string, unknown> = { name: 'child', parent };
    parent.child = child;
    const result = truncateValue(parent, 0, stats) as Record<string, unknown>;
    const resultChild = result.child as Record<string, unknown>;
    assert.equal(resultChild.name, 'child');
    assert.equal(resultChild.parent, '[circular reference]');
  });

  test('same object referenced twice without circularity returns marker for second occurrence', () => {
    const stats = makeStats();
    const shared: Record<string, unknown> = { value: 'shared' };
    const obj = { a: shared, b: shared };
    const result = truncateValue(obj, 0, stats) as Record<string, unknown>;
    // First encounter is processed normally, second is detected as seen
    const a = result.a as Record<string, unknown>;
    assert.equal(a.value, 'shared');
    assert.equal(result.b, '[circular reference]');
  });
});

// ─── Edge cases ──────────────────────────────────────────────────────

describe('Edge cases', () => {
  test('empty contents array', () => {
    const response = makeListResponse([]);
    const result = truncateListResponse(response);
    assert.equal(result.contents.length, 0);
    assert.equal(result._truncationNotice, undefined);
  });

  test('MAX_DEPTH reached stops recursing but does not error', () => {
    const stats = makeStats();
    // Build a deeply nested object
    let obj: unknown = { value: 'z'.repeat(300) };
    for (let i = 0; i < MAX_DEPTH + 5; i++) {
      obj = { child: obj };
    }
    // Should not throw
    const result = truncateValue(obj, 0, stats);
    assert.ok(result !== undefined);

    // Walk down to verify: the innermost levels beyond MAX_DEPTH should NOT be truncated
    let current = result as Record<string, unknown>;
    for (let i = 0; i < MAX_DEPTH; i++) {
      current = current.child as Record<string, unknown>;
    }
    // At depth MAX_DEPTH, recursion stops, so deeper structures are returned as-is
    // The object at this depth should still have 'child' (not truncated away)
    assert.ok('child' in current);
  });
});
