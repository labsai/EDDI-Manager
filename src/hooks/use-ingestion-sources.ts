import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listIngestionSources,
  createIngestionSource,
  updateIngestionSource,
  deleteIngestionSource,
  triggerIngestion,
  type RagIngestionSource,
} from "@/lib/api/ingestion-sources";

const ingestionKeys = {
  all: (ragConfigUri: string) => ["ingestion-sources", ragConfigUri] as const,
  list: (ragConfigUri: string) => ["ingestion-sources", "list", ragConfigUri] as const,
};

export function useIngestionSources(ragConfigUri?: string) {
  return useQuery({
    queryKey: ingestionKeys.list(ragConfigUri ?? ""),
    queryFn: () => listIngestionSources(ragConfigUri!),
    enabled: !!ragConfigUri,
  });
}

export function useCreateIngestionSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (source: RagIngestionSource) => createIngestionSource(source),
    onSuccess: (_data, source) => {
      qc.invalidateQueries({ queryKey: ingestionKeys.all(source.ragConfigUri) });
    },
  });
}

export function useUpdateIngestionSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; version: number; source: RagIngestionSource }) =>
      updateIngestionSource(args.id, args.version, args.source),
    onSuccess: (_data, args) => {
      qc.invalidateQueries({ queryKey: ingestionKeys.all(args.source.ragConfigUri) });
    },
  });
}

export function useDeleteIngestionSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; version: number; ragConfigUri: string }) =>
      deleteIngestionSource(args.id, args.version),
    onSuccess: (_data, args) => {
      qc.invalidateQueries({ queryKey: ingestionKeys.all(args.ragConfigUri) });
    },
  });
}

export function useTriggerIngestion() {
  return useMutation({
    mutationFn: (args: { id: string; version: number }) => triggerIngestion(args.id, args.version),
  });
}
