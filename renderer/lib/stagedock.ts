'use client';

import type { StageDockAPI } from '../../src/common/api.js';

export function isStageDockAvailable(): boolean {
  return typeof window !== 'undefined' && Boolean(window.stagedock);
}

export function getStageDock(): StageDockAPI {
  if (!isStageDockAvailable()) {
    throw new Error('StageDock API is not available in this context.');
  }

  return window.stagedock;
}
