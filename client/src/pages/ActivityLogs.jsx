import { useState } from 'react';
import { Activity, RefreshCw, User, Search } from 'lucide-react';
import { useActivityLogs } from '../hooks/useAdmin';
import { ActivityLog } from '../components/ui/LoadingSkeleton';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

const ACTION_LABELS = {
  ticket_created:   { label: 'Ticket Created',   color: 'success' },
  ticket_updated:   { label: 'Ticket Updated',   color: 'info' },
  ticket_deleted:   { label: 'Ticket Deleted',   color: 'danger' },
  ticket_exported:  { label: 'Ticket Exported',  color: 'default' },
  user_login:       { label: 'Login',            color: 'success' },
  user_logout:      { label: 'Logout',           color: 'default' },
  settings_updated: { label: 'Settings Updated', color: 'info' },
  password_changed: { label: 'Password Changed', color: 'warning' },
  profile_updated:  { label: 'Profile Updated',  color: 'info' },
};

const ACTION_OPTIONS = ['', ...Object.keys(ACTION_LABELS)];

function formatAction(action) {
  return ACTION_LABELS[action] || { label: action, color: 'default' };
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

export default function ActivityLogs() {
  const [page, setPage]           = useState(1);
  const [action, setAction]       = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate]     = useState('');
  const [search, setSearch]       = useState('');

  const params = { page, limit: 25, action: action || undefined, startDate: startDate || undefined, endDate: endDate || undefined };
  const { data, isLoading, refetch, isFetching } = useActivityLogs(params);

  const logs       = data?.logs       || [];
  const pagination = data?.pagination || {};

  const handleReset = () => {
    setPage(1);
    setAction('');
    setStartDate('');
    setEndDate('');
    setSearch('');
  };

  const filtered = search.trim()
    ? logs.filter((l) => {
        const name  = l.userId?.name?.toLowerCase()  || '';
        const email = l.userId?.email?.toLowerCase() || '';
        const q     = search.toLowerCase();
        return name.includes(q) || email.includes(q);
      })
    : logs;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary-600" />
            Activity Logs
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            All user actions — last 90 days
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          icon={RefreshCw}
          onClick={() => refetch()}
          loading={isFetching}
        >
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by user..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 w-full text-sm rounded-lg border border-gray-200 dark:border-secondary-600 bg-white dark:bg-secondary-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <select
            value={action}
            onChange={(e) => { setAction(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-secondary-600 bg-white dark:bg-secondary-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {ACTION_OPTIONS.map((a) => (
              <option key={a} value={a}>{a ? ACTION_LABELS[a]?.label : 'All actions'}</option>
            ))}
          </select>

          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-secondary-600 bg-white dark:bg-secondary-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-secondary-600 bg-white dark:bg-secondary-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />

          <Button variant="ghost" size="sm" onClick={handleReset}>Reset</Button>
        </div>
      </Card>

      {/* Table */}
      <Card>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 dark:bg-secondary-700 rounded animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500">
            <Activity className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>No activity logs found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-secondary-700 text-left text-gray-500 dark:text-gray-400">
                  <th className="pb-3 pr-4 font-medium">User</th>
                  <th className="pb-3 pr-4 font-medium">Action</th>
                  <th className="pb-3 pr-4 font-medium">Resource</th>
                  <th className="pb-3 pr-4 font-medium">IP</th>
                  <th className="pb-3 font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-secondary-700">
                {filtered.map((log) => {
                  const { label, color } = formatAction(log.action);
                  return (
                    <tr key={log._id} className="hover:bg-gray-50 dark:hover:bg-secondary-750 transition-colors">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center shrink-0">
                            <User className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white leading-tight">
                              {log.userId?.name || 'Unknown'}
                            </p>
                            <p className="text-xs text-gray-400">{log.userId?.email || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={color}>{label}</Badge>
                      </td>
                      <td className="py-3 pr-4 text-gray-500 dark:text-gray-400">
                        {log.resourceType
                          ? `${log.resourceType}${log.metadata?.ticketRef ? ` · ${log.metadata.ticketRef}` : ''}`
                          : '—'}
                      </td>
                      <td className="py-3 pr-4 text-gray-400 font-mono text-xs">
                        {log.ipAddress || '—'}
                      </td>
                      <td className="py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
                        {formatDate(log.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 dark:border-secondary-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {pagination.total} total logs
            </p>
            <div className="flex gap-2">
              <Button
                variant="ghost" size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300">
                {page} / {pagination.totalPages}
              </span>
              <Button
                variant="ghost" size="sm"
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
