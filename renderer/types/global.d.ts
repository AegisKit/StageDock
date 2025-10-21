/* eslint-disable @typescript-eslint/consistent-type-definitions */

export {};

declare global {
  interface Window {
    stagedock: import('../../src/preload').StageDockAPI;
  }
}
