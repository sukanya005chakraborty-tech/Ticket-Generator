import {
  TicketIcon,
  TrendingUp,
  Clock,
  Zap,
  BarChart2,
  Activity,
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
  Area,
  AreaChart,
} from 'recharts';
import { useOverview, useTrends } from '../hooks/useAnalytics';
import StatCard from '../components/ui/StatCard';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import { StatCardSkeleton } from '../components/ui/LoadingSkeleton';
import { Skeleton } from '../components/ui/LoadingSkeleton';
import { formatDate } from '../utils/helpers';
import { CHART_COLORS } from '../utils/constants';

const PRIORITY_ORDER = ['Critical', 'High', 'Medium', 'Low'];
const SEVERITY_ORDER = ['Blocker', 'Critical', 'Major', 'Minor', 'Trivial'];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-secondary-800 border border-secondary-700 rounded-lg px-3 py-2 shadow-lg">
        <p className="text-xs text-gray-400 mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} className="text-sm font-medium" style={{ color: p.color || '#60a5fa' }}>
            {p.name}: {p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Analytics() {
  const { data: overview, isLoading: overviewLoading } = useOverview();
  const { data: trends, isLoading: trendsLoading } = useTrends('month');

  const priorityData = PRIORITY_ORDER.map((p) => ({
    name: p,
    count: overview?.countByPriority?.[p] || 0,
    fill: CHART_COLORS[p],
  }));

  const severityData = SEVERITY_ORDER.map((s) => ({
    name: s,
    count: overview?.countBySeverity?.[s] || 0,
    fill: CHART_COLORS[s],
  }));

  const statusData = overview?.countByStatus
    ? Object.entries(overview.countByStatus)
        .filter(([, v]) => v > 0)
        .map(([key, value]) => ({
          name: key.charAt(0).toUpperCase() + key.slice(1).replace('-', ' '),
          value,
          fill: CHART_COLORS[key],
        }))
    : [];

  const trendData = (trends || []).map((t) => ({
    date: formatDate(t.date, 'MMM d'),
    count: t.count,
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Insights into your ticket generation activity
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {overviewLoading ? (
          Array.from({ length: 6 }, (_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard
              title="Total Tickets"
              value={overview?.totalTickets || 0}
              icon={TicketIcon}
              color="blue"
              changeLabel="all time"
            />
            <StatCard
              title="This Week"
              value={overview?.ticketsThisWeek || 0}
              icon={TrendingUp}
              color="green"
              changeLabel="tickets"
            />
            <StatCard
              title="This Month"
              value={overview?.ticketsThisMonth || 0}
              icon={Activity}
              color="purple"
              changeLabel="tickets"
            />
            <StatCard
              title="Avg. Generation Time"
              value={Math.round(overview?.averageGenerationTime || 0)}
              suffix="ms"
              icon={Clock}
              color="amber"
              changeLabel="per ticket"
            />
            <StatCard
              title="Tokens Used"
              value={(overview?.totalTokensUsed || 0).toLocaleString()}
              icon={Zap}
              color="teal"
              changeLabel="total"
            />
            <StatCard
              title="Open Tickets"
              value={overview?.countByStatus?.open || 0}
              icon={BarChart2}
              color="red"
              changeLabel="need attention"
            />
          </>
        )}
      </div>

      {/* Trends chart */}
      <Card
        title="Ticket Creation Trends"
        subtitle="Tickets generated per day over the last 30 days"
      >
        {trendsLoading ? (
          <Skeleton className="h-72 w-full rounded-lg" />
        ) : trendData.length === 0 ? (
          <EmptyState
            title="No trend data available"
            description="Generate tickets to see trends over time"
          />
        ) : (
          <ResponsiveContainer width="100%" height={288}>
            <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:stroke-secondary-700" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="count"
                name="Tickets"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#colorCount)"
                dot={{ fill: '#3b82f6', r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Priority + Status charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Priority bar chart */}
        <Card title="By Priority" subtitle="Distribution across priority levels">
          {overviewLoading ? (
            <Skeleton className="h-56 w-full rounded-lg" />
          ) : priorityData.every((d) => d.count === 0) ? (
            <EmptyState title="No data yet" />
          ) : (
            <ResponsiveContainer width="100%" height={224}>
              <BarChart data={priorityData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:stroke-secondary-700" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Tickets" radius={[6, 6, 0, 0]}>
                  {priorityData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Status donut */}
        <Card title="By Status" subtitle="Current status distribution">
          {overviewLoading ? (
            <Skeleton className="h-56 w-full rounded-lg" />
          ) : statusData.length === 0 ? (
            <EmptyState title="No data yet" />
          ) : (
            <ResponsiveContainer width="100%" height={224}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {statusData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  formatter={(value) => (
                    <span style={{ color: '#9ca3af', fontSize: '12px' }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Severity bar chart */}
      <Card title="By Severity" subtitle="Distribution across severity levels">
        {overviewLoading ? (
          <Skeleton className="h-56 w-full rounded-lg" />
        ) : severityData.every((d) => d.count === 0) ? (
          <EmptyState title="No severity data yet" description="Generate tickets to see severity distribution" />
        ) : (
          <ResponsiveContainer width="100%" height={224}>
            <BarChart data={severityData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:stroke-secondary-700" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Tickets" radius={[6, 6, 0, 0]}>
                {severityData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}
