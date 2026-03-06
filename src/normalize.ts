const SYSTEM_FIELDS = ['id', 'createdAt', 'updatedAt', 'publishedAt', 'revisedAt'];

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isMediaValue(v: unknown): v is Record<string, unknown> & { url: string } {
  return (
    isObject(v) &&
    typeof v.url === 'string' &&
    (typeof v.height === 'number' || typeof v.width === 'number')
  );
}

function isRelationValue(v: unknown): v is Record<string, unknown> & { id: string } {
  return (
    isObject(v) &&
    typeof v.id === 'string' &&
    typeof v.createdAt === 'string' &&
    typeof v.updatedAt === 'string'
  );
}

function normalizeValue(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  if (isMediaValue(v)) return v.url;
  if (isRelationValue(v)) return v.id;
  if (Array.isArray(v)) {
    if (v.length > 0 && v.every(isMediaValue)) return v.map((e) => e.url);
    if (v.length > 0 && v.every(isRelationValue)) return v.map((e) => e.id);
    return v.map(normalizeValue);
  }
  if (isObject(v)) {
    return Object.fromEntries(
      Object.entries(v).map(([k, val]) => [k, normalizeValue(val)])
    );
  }
  return v;
}

export function normalizeForEdit(
  content: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(content)) {
    if (SYSTEM_FIELDS.includes(key)) continue;
    result[key] = normalizeValue(value);
  }
  return result;
}
