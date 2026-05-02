'use client';

import { useMemo, useRef } from 'react';

function normalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeValue);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((accumulator, key) => {
        accumulator[key] = normalizeValue((value as Record<string, unknown>)[key]);
        return accumulator;
      }, {});
  }

  return value;
}

function toSnapshot(value: unknown) {
  return JSON.stringify(normalizeValue(value));
}

export default function useDirtyState(value: unknown) {
  const initialSnapshotRef = useRef<string | null>(null);
  const currentSnapshot = useMemo(() => toSnapshot(value), [value]);

  if (initialSnapshotRef.current === null) {
    initialSnapshotRef.current = currentSnapshot;
  }

  return currentSnapshot !== initialSnapshotRef.current;
}
