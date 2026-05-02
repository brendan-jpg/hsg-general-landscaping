'use client';

import { useEffect } from 'react';

function buildBestRows(count: number): number[] {
  if (count <= 0) return [];

  const rowSizes = [4, 3, 2];
  const solutions: number[][] = [];

  function walk(remaining: number, rows: number[]) {
    if (remaining === 0) {
      solutions.push([...rows]);
      return;
    }

    rowSizes.forEach((size) => {
      if (size <= remaining) {
        rows.push(size);
        walk(remaining - size, rows);
        rows.pop();
      }
    });
  }

  walk(count, []);

  if (solutions.length === 0) {
    return [count];
  }

  const scoreRows = (rows: number[]) => {
    const rowCount = rows.length;
    const average = count / rowCount;
    const variance = rows.reduce((total, size) => total + (size - average) ** 2, 0) / rowCount;
    return { rowCount, variance };
  };

  solutions.sort((left, right) => {
    const leftScore = scoreRows(left);
    const rightScore = scoreRows(right);

    if (leftScore.rowCount !== rightScore.rowCount) {
      return leftScore.rowCount - rightScore.rowCount;
    }

    if (Math.abs(leftScore.variance - rightScore.variance) > 0.0001) {
      return leftScore.variance - rightScore.variance;
    }

    for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
      const leftValue = left[index] ?? 0;
      const rightValue = right[index] ?? 0;
      if (leftValue !== rightValue) {
        return rightValue - leftValue;
      }
    }

    return 0;
  });

  return solutions[0] ?? [];
}

function applyAutoGridColumns(root: ParentNode = document) {
  const grids = root.querySelectorAll<HTMLElement>('.auto-grid');
  const isCompactViewport =
    typeof window !== 'undefined' && window.matchMedia('(max-width: 991px)').matches;

  grids.forEach((grid) => {
    const items = Array.from(grid.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement,
    );
    const count = items.length;

    items.forEach((item) => {
      item.style.gridColumn = '';
    });
    grid.style.gridTemplateColumns = '';

    let cols = 4;
    if (count <= 2) cols = 2;
    else if (count === 3) cols = 3;
    else if (count % 4 === 1) cols = 3;

    grid.style.setProperty('--cols', String(cols));

    if (isCompactViewport || count <= 4) {
      return;
    }

    const rows = buildBestRows(count);
    if (rows.length <= 1) {
      return;
    }

    grid.style.gridTemplateColumns = 'repeat(12, minmax(0, 1fr))';

    let itemIndex = 0;
    rows.forEach((rowSize) => {
      const span = rowSize === 4 ? 3 : rowSize === 3 ? 4 : 6;
      for (let index = 0; index < rowSize; index += 1) {
        const item = items[itemIndex];
        if (item) {
          item.style.gridColumn = `span ${span}`;
        }
        itemIndex += 1;
      }
    });
  });
}

export default function AutoGridRuntime() {
  useEffect(() => {
    applyAutoGridColumns();

    const observer = new MutationObserver(() => {
      applyAutoGridColumns();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    const handleResize = () => {
      applyAutoGridColumns();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return null;
}
