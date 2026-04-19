import { deleteObject, ref } from 'firebase/storage';
import { storage } from '../config/firebase';
import type { SubmissionValue } from '../types/form.types';
import { isPictureFieldValue } from './formValues';

const collectPicturePaths = (data: Record<string, SubmissionValue>): Set<string> => {
  const paths = new Set<string>();

  Object.values(data).forEach((value) => {
    if (!isPictureFieldValue(value) || !value.path) {
      return;
    }

    paths.add(value.path);
  });

  return paths;
};

export const getPictureCleanupPaths = ({
  baselineData,
  currentData,
  stagedDeletionPaths = [],
}: {
  baselineData: Record<string, SubmissionValue>;
  currentData: Record<string, SubmissionValue>;
  stagedDeletionPaths?: string[];
}): string[] => {
  const currentPaths = collectPicturePaths(currentData);
  const cleanupPaths = new Set(
    stagedDeletionPaths
      .map((path) => String(path ?? '').trim())
      .filter(Boolean),
  );

  collectPicturePaths(baselineData).forEach((path) => {
    if (!currentPaths.has(path)) {
      cleanupPaths.add(path);
    }
  });

  currentPaths.forEach((path) => {
    cleanupPaths.delete(path);
  });

  return Array.from(cleanupPaths);
};

export const cleanupPictureUploads = async (paths: string[]): Promise<void> => {
  const uniquePaths = Array.from(new Set(
    paths
      .map((path) => String(path ?? '').trim())
      .filter(Boolean),
  ));

  await Promise.allSettled(uniquePaths.map(async (path) => {
    await deleteObject(ref(storage, path));
  }));
};
