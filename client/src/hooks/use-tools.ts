import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CreateToolData } from '@/types';

export function useTools(agentId: string) {
  return useQuery({
    queryKey: ['tools', agentId],
    queryFn: () => api.getTools(agentId),
    enabled: !!agentId,
  });
}

export function useCreateTool(agentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateToolData) => api.createTool(agentId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tools', agentId] });
    },
  });
}

export function useUpdateTool(agentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateToolData> }) => api.updateTool(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tools', agentId] });
    },
  });
}

export function useDeleteTool(agentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteTool(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tools', agentId] });
    },
  });
}

export function useExecuteTool() {
  return useMutation({
    mutationFn: ({ id, params }: { id: string; params: Record<string, any> }) => api.executeTool(id, params),
  });
}
