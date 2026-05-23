import { useNavigate } from 'react-router-dom';
import { Eye, Pencil, Trash2, Clock, Layers, Calendar, User, AlertCircle } from 'lucide-react';
import Badge from '../ui/Badge';
import { formatDate, formatRelativeTime, truncateText, cn } from '../../utils/helpers';

function isDueOverdue(dueDate, status) {
  if (!dueDate) return false;
  if (status === 'resolved' || status === 'closed') return false;
  return new Date(dueDate) < new Date();
}

function isDueSoon(dueDate, status) {
  if (!dueDate) return false;
  if (status === 'resolved' || status === 'closed') return false;
  const diff = new Date(dueDate) - new Date();
  return diff >= 0 && diff < 24 * 60 * 60 * 1000;
}

export default function TicketCard({ ticket, onEdit, onDelete }) {
  const navigate = useNavigate();

  const handleView = (e) => {
    e.stopPropagation();
    navigate(`/tickets/${ticket._id}`);
  };

  const handleEdit = (e) => {
    e.stopPropagation();
    onEdit?.(ticket);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    onDelete?.(ticket);
  };

  const overdue = isDueOverdue(ticket.dueDate, ticket.status);
  const dueSoon = isDueSoon(ticket.dueDate, ticket.status);
  const assigneeName = ticket.assignedTo?.name || null;

  return (
    <div
      className={cn(
        'bg-white dark:bg-secondary-800 rounded-xl border shadow-sm',
        overdue
          ? 'border-red-300 dark:border-red-700'
          : 'border-gray-200 dark:border-secondary-700',
        'hover:shadow-md hover:border-primary-200 dark:hover:border-primary-700',
        'transition-all duration-200 cursor-pointer group'
      )}
      onClick={handleView}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Ref + badges */}
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-xs font-mono font-semibold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950 px-2 py-0.5 rounded">
                {ticket.ticketRef || '#???'}
              </span>
              <Badge value={ticket.priority} size="sm" dot />
              <Badge value={ticket.severity} size="sm" />
              <Badge value={ticket.status} size="sm" />
              {overdue && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 px-1.5 py-0.5 rounded">
                  <AlertCircle className="w-3 h-3" /> Overdue
                </span>
              )}
              {dueSoon && !overdue && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-1.5 py-0.5 rounded">
                  <Clock className="w-3 h-3" /> Due Today
                </span>
              )}
            </div>

            {/* Title */}
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1 line-clamp-2 group-hover:text-primary-700 dark:group-hover:text-primary-400 transition-colors">
              {ticket.title || 'Untitled Ticket'}
            </h3>

            {/* Summary */}
            {ticket.summary && (
              <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">
                {truncateText(ticket.summary, 150)}
              </p>
            )}

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
              {ticket.module && (
                <span className="flex items-center gap-1">
                  <Layers className="w-3 h-3" />
                  {ticket.module}
                </span>
              )}
              {ticket.environment && (
                <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-secondary-700 rounded text-gray-500 dark:text-gray-400">
                  {ticket.environment}
                </span>
              )}
              {assigneeName && (
                <span className="flex items-center gap-1 text-blue-500 dark:text-blue-400">
                  <User className="w-3 h-3" />
                  {assigneeName}
                </span>
              )}
              {ticket.dueDate && (
                <span className={cn(
                  'flex items-center gap-1',
                  overdue ? 'text-red-500 dark:text-red-400' : dueSoon ? 'text-amber-500 dark:text-amber-400' : ''
                )}>
                  <Calendar className="w-3 h-3" />
                  {formatDate(ticket.dueDate, 'MMM d')}
                </span>
              )}
              <span className="flex items-center gap-1 ml-auto">
                <Clock className="w-3 h-3" />
                {formatRelativeTime(ticket.createdAt)}
              </span>
            </div>

            {/* Labels */}
            {ticket.labels?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {ticket.labels.slice(0, 4).map((label) => (
                  <span
                    key={label}
                    className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-secondary-700 text-gray-600 dark:text-gray-400 rounded"
                  >
                    {label}
                  </span>
                ))}
                {ticket.labels.length > 4 && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    +{ticket.labels.length - 4} more
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleView}
              className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:text-primary-400 dark:hover:bg-primary-950 transition-colors"
              title="View ticket"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              onClick={handleEdit}
              className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:text-amber-400 dark:hover:bg-amber-950 transition-colors"
              title="Edit ticket"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={handleDelete}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950 transition-colors"
              title="Delete ticket"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
