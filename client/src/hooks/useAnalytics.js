import { useQuery } from '@tanstack/react-query';
import * as analyticsService from '../services/analyticsService';
import { useProjectStore } from '../store/projectStore';

export function useOverview() {
  const selectedProjectId = useProjectStore((s) => s.selectedProjectId);
  return useQuery({
    queryKey: ['analytics', 'overview', selectedProjectId || 'all'],
    queryFn: () => analyticsService.getOverview(selectedProjectId),
    select: (data) => data?.data?.overview,
    staleTime: 2 * 60 * 1000,
  });
}

export function useTrends(period = 'month') {
  const selectedProjectId = useProjectStore((s) => s.selectedProjectId);
  return useQuery({
    queryKey: ['analytics', 'trends', period, selectedProjectId || 'all'],
    queryFn: () => analyticsService.getTrends(period, selectedProjectId),
    select: (data) => data?.data?.trends?.trend,
    staleTime: 5 * 60 * 1000,
  });
}
