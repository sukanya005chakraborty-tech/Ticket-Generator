import { useNavigate } from 'react-router-dom';
import {
  TicketIcon,
  TrendingUp,
  Clock,
  CheckCircle,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { useOverview, useTrends } from '../hooks/useAnalytics';
import { useTickets } from '../hooks/useTickets';
import { useAuthStore } from '../store/authStore';
import StatCard from '../components/ui/StatCard';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { DashboardSkeleton } from '../components/ui/LoadingSkeleton';
import EmptyState from '../components/ui/EmptyState';
import { formatRelativeTime, truncateText } from '../utils/helpers';
import { CHART_COLORS } from '../utils/constants';

const PRIORITY_ORDER = ['Critical', 'High', 'Medium', 'Low'];

export default function Dashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  const { data: overview, isLoading: overviewLoading } = useOverview();
  const { data: trends, isLoading: trendsLoading } = useTrends();
  const { data: recentData, isLoading: ticketsLoading } = useTickets({
    limit: 5,
    sortBy: 'createdAt',
    sortOrder: 'desc',
    assignedTo: isAdmin ? undefined : (user?.id || user?._id),
  });

  const isLoading = overviewLoading || trendsLoading;

  if (isLoading) return <DashboardSkeleton />;

  // Priority bar chart data
  const priorityData = PRIORITY_ORDER.map((p) => ({
    name: p,
    count: overview?.countByPriority?.[p] || 0,
    fill: CHART_COLORS[p],
  }));

  // Status pie chart data
  const statusData = overview?.countByStatus
    ? Object.entries(overview.countByStatus)
        .filter(([, v]) => v > 0)
        .map(([key, value]) => ({
          name: key.charAt(0).toUpperCase() + key.slice(1),
          value,
          fill: CHART_COLORS[key],
        }))
    : [];

  const recentTickets = recentData?.tickets || [];
  const openCount = overview?.countByStatus?.open || 0;
  const inProgressCount = overview?.countByStatus?.['in-progress'] || 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Welcome back, {user?.name?.split(' ')[0] || 'there'} 👋
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Here&apos;s what&apos;s happening with your tickets today.
          </p>
        </div>
        <Button
          variant="primary"
          icon={Sparkles}
          onClick={() => navigate('/generate')}
        >
          Generate Ticket
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Total Tickets"
          value={overview?.totalTickets || 0}
          icon={TicketIcon}
          color="blue"
          change={null}
          changeLabel="all time"
        />
        <StatCard
          title="This Week"
          value={overview?.ticketsThisWeek || 0}
          icon={TrendingUp}
          color="green"
          change={null}
          changeLabel="tickets created"
        />
        <StatCard
          title="Open"
          value={openCount}
          icon={Clock}
          color="amber"
          change={null}
          changeLabel="need attention"
        />
        <StatCard
          title="In Progress"
          value={inProgressCount}
          icon={CheckCircle}
          color="purple"
          change={null}
          changeLabel="being worked on"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar chart — by priority */}
        <Card title="Tickets by Priority" subtitle="Distribution across priority levels">
          {priorityData.every((d) => d.count === 0) ? (
            <EmptyState
              title="No ticket data yet"
              description="Start generating tickets to see priority distribution"
            />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={priorityData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:stroke-secondary-700" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: '#1e293b',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#f1f5f9',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {priorityData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Pie chart — by status */}
        <Card title="Tickets by Status" subtitle="Current status distribution">
          {statusData.length === 0 ? (
            <EmptyState
              title="No ticket data yet"
              description="Generate tickets to see status distribution"
            />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {statusData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: '#1e293b',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#f1f5f9',
                    fontSize: '12px',
                  }}
                />
                <Legend
                  formatter={(value) => (
                    <span style={{ color: '#6b7280', fontSize: '12px' }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Recent tickets */}
      <Card
        title="Recent Tickets"
        subtitle="Your latest generated tickets"
        action={
          <button
            onClick={() => navigate('/tickets')}
            className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 flex items-center gap-1 font-medium"
          >
            View all <ArrowRight className="w-4 h-4" />
          </button>
        }
      >
        {ticketsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 py-3 border-b border-gray-100 dark:border-secondary-700 last:border-0 animate-pulse">
                <div className="h-4 w-16 bg-gray-200 dark:bg-secondary-700 rounded" />
                <div className="h-4 flex-1 bg-gray-200 dark:bg-secondary-700 rounded" />
                <div className="h-5 w-16 bg-gray-200 dark:bg-secondary-700 rounded" />
              </div>
            ))}
          </div>
        ) : recentTickets.length === 0 ? (
          <EmptyState
            icon={TicketIcon}
            title="No tickets yet"
            description="Generate your first AI-powered ticket to get started"
            action={
              <Button
                variant="primary"
                size="sm"
                icon={Sparkles}
                onClick={() => navigate('/generate')}
              >
                Generate Ticket
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-secondary-700">
            {recentTickets.map((ticket) => (
              <div
                key={ticket._id}
                className="flex items-center gap-4 py-3 hover:bg-gray-50 dark:hover:bg-secondary-700/50 rounded-lg px-2 -mx-2 cursor-pointer transition-colors"
                onClick={() => navigate(`/tickets/${ticket._id}`)}
              >
                <span className="text-xs font-mono font-semibold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950 px-2 py-0.5 rounded shrink-0">
                  {ticket.ticketRef}
                </span>
                <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 min-w-0 truncate">
                  {truncateText(ticket.title, 60)}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge value={ticket.priority} size="xs" />
                  <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">
                    {formatRelativeTime(ticket.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Token usage */}
      {overview?.totalTokensUsed > 0 && (
        <div className="bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-950 dark:to-blue-950 border border-primary-100 dark:border-primary-900 rounded-xl p-5">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-sm font-medium text-primary-700 dark:text-primary-300">
                AI Token Usage
              </p>
              <p className="text-2xl font-bold text-primary-900 dark:text-primary-100 mt-0.5">
                {overview.totalTokensUsed.toLocaleString()}
                <span className="text-sm font-normal text-primary-600 dark:text-primary-400 ml-2">
                  tokens used
                </span>
              </p>
            </div>
            <div className="text-sm text-primary-600 dark:text-primary-400">
              Avg. {Math.round(overview.averageGenerationTime || 0)}ms per ticket
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
