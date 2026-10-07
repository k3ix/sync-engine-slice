import type { ValueTransformer } from 'typeorm';

// pg returns bigint as a string; every bigint here stays below Number.MAX_SAFE_INTEGER.
export const bigintTransformer: ValueTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};
