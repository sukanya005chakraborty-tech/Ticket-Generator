import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import * as ticketService from '../services/ticketService';
import { useProjectStore } from '../store/projectStore';

/**
 * All ticket list queries automatically scope to selectedProjectId when set.
 * Pass ignoreProject: true to fetch regardless of selected project.
 */
export function useTickets(filters = {}) {
  const selectedProjectId = useProjectStore((s) => s.selectedProjectId);
  const { ignoreProject, ...rest } = filters;

  const effectiveFilters = {
    ...rest,
    ...(selectedProjectId && !ignoreProject ? { projectId: selectedProjectId } : {}),
  };

  return useQuery({
    queryKey: ['tickets', effectiveFilters],
    queryFn: () => ticketService.getTickets(effectiveFilters),
    select: (data) => ({
      tickets:    data?.data || [],
      total:      data?.meta?.pagination?.total      || 0,
      totalPages: data?.meta?.pagination?.totalPages || 1,
      page:       data?.meta?.pagination?.page       || 1,
      hasNext:    data?.meta?.pagination?.hasNext    || false,
      hasPrev:    data?.meta?.pagination?.hasPrev    || false,
    }),
    keepPreviousData: true,
  });
}

export function useTicket(id) {
  return useQuery({
    queryKey: ['ticket', id],
    queryFn:  () => ticketService.getTicketById(id),
    select:   (data) => data?.data?.ticket,
    enabled:  !!id,
  });
}

export function useGenerateTicket() {
  const queryClient       = useQueryClient();
  const selectedProjectId = useProjectStore((s) => s.selectedProjectId);

  return useMutation({
    mutationFn: (data) =>
      ticketService.generateTicket({
        ...data,
        ...(selectedProjectId ? { projectId: selectedProjectId } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to generate ticket');
    },
  });
}

export function useUpdateTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => ticketService.updateTicket(id, data),
    onSuccess: (_response, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
      toast.success('Ticket updated successfully');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update ticket');
    },
  });
}

export function useDeleteTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ticketService.deleteTicket,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      toast.success('Ticket deleted successfully');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete ticket');
    },
  });
}

export function useAddComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, text }) => ticketService.addComment(id, text),
    onSuccess: (_response, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
      toast.success('Comment added');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to add comment');
    },
  });
}
