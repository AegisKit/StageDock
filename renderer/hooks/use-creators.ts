"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateCreatorPayload,
  CreatorWithStatus,
  UpdateCreatorPayload,
} from "../../src/common/types.js";
import { getStageDock, isStageDockAvailable } from "../lib/stagedock";
import { useStageDockReady } from "./use-stagedock-ready";

const CREATORS_QUERY_KEY = ["creators"];

export function useCreators() {
  const ready = useStageDockReady();
  const query = useQuery<CreatorWithStatus[]>({
    queryKey: CREATORS_QUERY_KEY,
    queryFn: async () => {
      if (!ready) {
        // readyでない場合は空配列を返す
        return [];
      }
      return getStageDock().creators.list();
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

export function useCreateCreator() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateCreatorPayload) => {
      if (!isStageDockAvailable()) {
        throw new Error("StageDock bridge is not ready yet.");
      }
      return getStageDock().creators.create(payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CREATORS_QUERY_KEY });
    },
  });
}

export function useUpdateCreator() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateCreatorPayload) => {
      if (!isStageDockAvailable()) {
        throw new Error("StageDock bridge is not ready yet.");
      }
      return getStageDock().creators.update(payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CREATORS_QUERY_KEY });
    },
  });
}

export function useDeleteCreator() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!isStageDockAvailable()) {
        throw new Error("StageDock bridge is not ready yet.");
      }
      return getStageDock().creators.delete(id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CREATORS_QUERY_KEY });
    },
  });
}
