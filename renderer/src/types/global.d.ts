import type { StageDockAPI } from "../../../src/common/api.js";

declare global {
  interface Window {
    stagedock: StageDockAPI;
    electronAPI: {
      onMultiviewData: (callback: (data: any) => void) => void;
    };
  }
}

export {};
