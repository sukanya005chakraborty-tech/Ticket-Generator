import { useQuery } from '@tanstack/react-query';
import * as adminService from '../services/adminService';

export function useActivityLogs(params = {}) {
  return useQuery({
    queryKey: ['activity-logs', params],
    queryFn:  () => adminService.getActivityLogs(params),
    select:   (res) => res?.data,
    staleTime: 30 * 1000, // 30s — logs change frequently
  });
}
