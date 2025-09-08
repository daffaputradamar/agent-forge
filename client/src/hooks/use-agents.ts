import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Agent, CreateAgentData } from "../types";
import { useToast } from "./use-toast";

export function useAgents() {
  return useQuery({
    queryKey: ["agents"],
    queryFn: api.getAgents,
  });
}

export function useAgent(id: string) {
  return useQuery({
    queryKey: ["agents", id],
    queryFn: () => api.getAgent(id),
    enabled: !!id,
  });
}

export function useCreateAgent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: CreateAgentData) => api.createAgent(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      toast({
        title: "Agent created",
        description: "Your new agent has been created successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create agent. Please try again.",
        variant: "destructive",
      });
    },
  });
}

export function useUpdateAgent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateAgentData> }) =>
      api.updateAgent(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      queryClient.invalidateQueries({ queryKey: ["agents", id] });
      toast({
        title: "Agent updated",
        description: "Your agent has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update agent. Please try again.",
        variant: "destructive",
      });
    },
  });
}

export function useDeleteAgent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => api.deleteAgent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      toast({
        title: "Agent deleted",
        description: "Your agent has been deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete agent. Please try again.",
        variant: "destructive",
      });
    },
  });
}
