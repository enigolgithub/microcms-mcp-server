export function assertRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Content file must contain a JSON object');
  }
  return value as Record<string, unknown>;
}
