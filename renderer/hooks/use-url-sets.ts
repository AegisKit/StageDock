"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SaveUrlSetPayload, UrlSet } from "../../src/common/types.js";
import { getStageDock, isStageDockAvailable } from "../lib/stagedock";
import { useStageDockReady } from "./use-stagedock-ready";

const URL_SETS_QUERY_KEY = ["url-sets"];

export function useUrlSets() {
  const ready = useStageDockReady();
  const query = useQuery<UrlSet[]>({
    queryKey: URL_SETS_QUERY_KEY,
    queryFn: async () => {
      if (!ready) {
        // readyでない場合は空配列を返す
        return [];
      }
      return getStageDock().urlSets.list();
    },
    enabled: true, // 常に有効にして、queryFn内で制御
    initialData: [],
  });

  // readyがtrueになった時にデータを再取得
  useEffect(() => {
    if (ready && query.data?.length === 0) {
      query.refetch();
    }
  }, [ready, query.data?.length, query.refetch]);

  return query;
}

export function useSaveUrlSet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: SaveUrlSetPayload) => {
      if (!isStageDockAvailable()) {
        throw new Error("StageDock bridge is not ready yet.");
      }
      return getStageDock().urlSets.save(payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: URL_SETS_QUERY_KEY });
    },
  });
}

export function useDeleteUrlSet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!isStageDockAvailable()) {
        throw new Error("StageDock bridge is not ready yet.");
      }
      return getStageDock().urlSets.delete(id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: URL_SETS_QUERY_KEY });
    },
  });
}

export function useTouchUrlSet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!isStageDockAvailable()) {
        throw new Error("StageDock bridge is not ready yet.");
      }
      return getStageDock().urlSets.touch(id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: URL_SETS_QUERY_KEY });
    },
  });
}
