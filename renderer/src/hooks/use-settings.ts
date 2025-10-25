import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getStageDock, isStageDockAvailable } from "../lib/stagedock";
import { useStageDockReady } from "./use-stagedock-ready";

export function useSetting<TValue = unknown>(key: string, fallback?: TValue) {
  const ready = useStageDockReady();

  return useQuery<TValue | undefined>({
    queryKey: ["settings", key],
    queryFn: async () => getStageDock().settings.get<TValue>(key),
    enabled: ready,
    initialData: fallback,
  });
}

export function useSetSetting<TValue = unknown>() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: TValue }) => {
      if (!isStageDockAvailable()) {
        throw new Error("StageDock bridge is not ready yet.");
      }
      return getStageDock().settings.set<TValue>(key, value);
    },
    onSuccess: (_res, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["settings", variables.key],
      });
    },
  });
}
