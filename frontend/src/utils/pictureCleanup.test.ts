import { describe, expect, it } from 'vitest';
import { getPictureCleanupPaths } from './pictureCleanup';

describe('pictureCleanup', () => {
  it('keeps the currently referenced picture path out of the cleanup set', () => {
    expect(getPictureCleanupPaths({
      baselineData: {},
      currentData: {
        '1': {
          url: 'https://example.com/new.jpg',
          path: 'uploads/new.jpg',
          name: 'new.jpg',
          contentType: 'image/jpeg',
          size: 100,
        },
      },
      stagedDeletionPaths: ['uploads/old.jpg', 'uploads/new.jpg'],
    })).toEqual(['uploads/old.jpg']);
  });

  it('adds removed baseline picture paths to the cleanup set', () => {
    expect(getPictureCleanupPaths({
      baselineData: {
        '1': {
          url: 'https://example.com/original.jpg',
          path: 'uploads/original.jpg',
          name: 'original.jpg',
          contentType: 'image/jpeg',
          size: 100,
        },
      },
      currentData: {},
    })).toEqual(['uploads/original.jpg']);
  });

  it('deduplicates cleanup paths collected from staged and baseline sources', () => {
    expect(getPictureCleanupPaths({
      baselineData: {
        '1': {
          url: 'https://example.com/original.jpg',
          path: 'uploads/original.jpg',
          name: 'original.jpg',
          contentType: 'image/jpeg',
          size: 100,
        },
      },
      currentData: {},
      stagedDeletionPaths: ['uploads/original.jpg', 'uploads/original.jpg'],
    })).toEqual(['uploads/original.jpg']);
  });
});
