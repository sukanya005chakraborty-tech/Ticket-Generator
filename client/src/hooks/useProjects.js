import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import * as projectService from '../services/projectService';
import { getAllUsers } from '../services/userService';

// ── All Users ─────────────────────────────────────────────────────────────────

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn:  () => getAllUsers(),
    select:   (d) => d?.data?.users ?? [],
    staleTime: 5 * 60 * 1000,
  });
}

// ── Projects ──────────────────────────────────────────────────────────────────

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn:  () => projectService.listProjects(),
    select:   (d) => d?.data?.projects ?? [],
  });
}

export function useProject(id) {
  return useQuery({
    queryKey: ['projects', id],
    queryFn:  () => projectService.getProject(id),
    select:   (d) => d?.data?.project,
    enabled:  !!id,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: projectService.createProject,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project created');
    },
    onError: (err) => toast.error(err.message || 'Failed to create project'),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => projectService.updateProject(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['projects', id] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project updated');
    },
    onError: (err) => toast.error(err.message || 'Failed to update project'),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => projectService.deleteProject(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project deleted');
    },
    onError: (err) => toast.error(err.message || 'Failed to delete project'),
  });
}

// ── Members ───────────────────────────────────────────────────────────────────

export function useProjectMembers(projectId) {
  return useQuery({
    queryKey: ['projects', projectId, 'members'],
    queryFn:  () => projectService.listMembers(projectId),
    select:   (d) => d?.data?.members ?? [],
    enabled:  !!projectId,
  });
}

export function useAddMember(projectId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => projectService.addMember(projectId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'members'] });
      qc.invalidateQueries({ queryKey: ['projects', projectId] });
      toast.success('Member added');
    },
    onError: (err) => toast.error(err.message || 'Failed to add member'),
  });
}

export function useRemoveMember(projectId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId) => projectService.removeMember(projectId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'members'] });
      toast.success('Member removed');
    },
    onError: (err) => toast.error(err.message || 'Failed to remove member'),
  });
}

export function useUpdateMemberRole(projectId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }) => projectService.updateMemberRole(projectId, userId, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'members'] });
      toast.success('Role updated');
    },
    onError: (err) => toast.error(err.message || 'Failed to update role'),
  });
}

// ── Invites ───────────────────────────────────────────────────────────────────

export function useProjectInvites(projectId) {
  return useQuery({
    queryKey: ['projects', projectId, 'invites'],
    queryFn:  () => projectService.listInvites(projectId),
    select:   (d) => d?.data?.invites ?? [],
    enabled:  !!projectId,
  });
}

export function useSendInvite(projectId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => projectService.sendInvite(projectId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'invites'] });
      toast.success('Invite sent');
    },
    onError: (err) => toast.error(err.message || 'Failed to send invite'),
  });
}

export function useRevokeInvite(projectId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteId) => projectService.revokeInvite(projectId, inviteId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'invites'] });
      toast.success('Invite revoked');
    },
    onError: (err) => toast.error(err.message || 'Failed to revoke invite'),
  });
}
