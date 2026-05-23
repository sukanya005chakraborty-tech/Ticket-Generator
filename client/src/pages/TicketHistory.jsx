import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Trash2, TicketIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useTickets, useDeleteTicket, useUpdateTicket } from '../hooks/useTickets';
import { useProjectMembers, useUsers } from '../hooks/useProjects';
import { useProjectStore } from '../store/projectStore';
import { useAuthStore } from '../store/authStore';
import TicketCard from '../components/tickets/TicketCard';
import { TicketListSkeleton } from '../components/ui/LoadingSkeleton';
import EmptyState from '../components/ui/EmptyState';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import TicketForm from '../components/tickets/TicketForm';
import Card from '../components/ui/Card';
import { PRIORITY_OPTIONS, STATUS_OPTIONS, SORT_OPTIONS } from '../utils/constants';

export default function TicketHistory() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [sort, setSort] = useState('createdAt_desc');

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);

  const { selectedProjectId } = useProjectStore();
  const { data: members = [] } = useProjectMembers(selectedProjectId);
  const { data: allUsers = [] } = useUsers();
  const assigneeList = allUsers.length > 0 ? allUsers : members.map((m) => ({ _id: m.userId?._id || m.userId, name: m.userId?.name || 'Unknown' }));

  const [sortBy, sortOrder] = sort.split('_');

  const effectiveAssignedTo = isAdmin ? (assignedTo || undefined) : (user?.id || user?._id);

  const { data, isLoading, isError } = useTickets({
    page,
    limit: 10,
    search,
    status,
    priority,
    assignedTo: effectiveAssignedTo,
    dueDate: dueDate || undefined,
    sortBy,
    sortOrder,
  });

  const { mutateAsync: deleteTicket, isPending: isDeleting } = useDeleteTicket();
  const { mutateAsync: updateTicket, isPending: isSaving } = useUpdateTicket();

  const tickets = data?.tickets || [];
  const totalPages = data?.totalPages || 1;
  const total = data?.total || 0;

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearch('');
    setPage(1);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteTicket(deleteTarget._id);
    setDeleteTarget(null);
  };

  const handleEdit = async (formData) => {
    if (!editTarget) return;
    await updateTicket({ id: editTarget._id, data: formData });
    setEditTarget(null);
  };

  const handleFilterChange = (setter) => (e) => {
    setter(e.target.value);
    setPage(1);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ticket History</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {total > 0 ? `${total} ticket${total !== 1 ? 's' : ''} found` : 'All your generated tickets'}
          </p>
        </div>
        <Button variant="primary" onClick={() => navigate('/generate')}>
          + New Ticket
        </Button>
      </div>

      {/* Filters */}
      <Card noPadding>
        <div className="p-4 flex flex-wrap gap-3 items-center">
          {/* Search */}
          <form onSubmit={handleSearch} className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by title or ref..."
              className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 dark:border-secondary-600 rounded-lg bg-white dark:bg-secondary-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-400 placeholder:text-gray-400"
            />
            {searchInput && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </form>

          {/* Status */}
          <select
            value={status}
            onChange={handleFilterChange(setStatus)}
            className="px-3 py-2 text-sm border border-gray-300 dark:border-secondary-600 rounded-lg bg-white dark:bg-secondary-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-100"
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          {/* Priority */}
          <select
            value={priority}
            onChange={handleFilterChange(setPriority)}
            className="px-3 py-2 text-sm border border-gray-300 dark:border-secondary-600 rounded-lg bg-white dark:bg-secondary-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-100"
          >
            <option value="">All Priorities</option>
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>

          {/* Assignee filter — admin only */}
          {isAdmin && assigneeList.length > 0 && (
            <select
              value={assignedTo}
              onChange={handleFilterChange(setAssignedTo)}
              className="px-3 py-2 text-sm border border-gray-300 dark:border-secondary-600 rounded-lg bg-white dark:bg-secondary-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-100"
            >
              <option value="">All Assignees</option>
              <option value="unassigned">Unassigned</option>
              {assigneeList.map((u) => (
                <option key={u._id} value={u._id}>{u.name}</option>
              ))}
            </select>
          )}

          {/* Due date filter */}
          <select
            value={dueDate}
            onChange={handleFilterChange(setDueDate)}
            className="px-3 py-2 text-sm border border-gray-300 dark:border-secondary-600 rounded-lg bg-white dark:bg-secondary-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-100"
          >
            <option value="">Any Due Date</option>
            <option value="overdue">Overdue</option>
            <option value="today">Due Today</option>
            <option value="week">Due This Week</option>
          </select>

          {/* Sort */}
          <select
            value={sort}
            onChange={handleFilterChange(setSort)}
            className="px-3 py-2 text-sm border border-gray-300 dark:border-secondary-600 rounded-lg bg-white dark:bg-secondary-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-100"
          >
            {SORT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          {/* Active filters indicator */}
          {(search || status || priority || (isAdmin && assignedTo) || dueDate) && (
            <button
              onClick={() => {
                setSearch('');
                setSearchInput('');
                setStatus('');
                setPriority('');
                if (isAdmin) setAssignedTo('');
                setDueDate('');
                setPage(1);
              }}
              className="text-sm text-red-500 hover:text-red-600 flex items-center gap-1 font-medium"
            >
              <X className="w-3.5 h-3.5" />
              Clear filters
            </button>
          )}
        </div>
      </Card>

      {/* Ticket list */}
      {isLoading ? (
        <TicketListSkeleton count={8} />
      ) : isError ? (
        <EmptyState
          icon={TicketIcon}
          title="Failed to load tickets"
          description="There was an error loading your tickets. Please try again."
          action={<Button variant="outline" onClick={() => window.location.reload()}>Retry</Button>}
        />
      ) : tickets.length === 0 ? (
        <EmptyState
          icon={TicketIcon}
          title={search || status || priority || assignedTo || dueDate ? 'No tickets match your filters' : 'No tickets yet'}
          description={
            search || status || priority || assignedTo || dueDate
              ? 'Try adjusting your search or filters'
              : 'Generate your first ticket to see it here'
          }
          action={
            <Button variant="primary" onClick={() => navigate('/generate')}>
              Generate Ticket
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <TicketCard
              key={ticket._id}
              ticket={ticket}
              onEdit={(t) => setEditTarget(t)}
              onDelete={(t) => setDeleteTarget(t)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={ChevronLeft}
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <div className="flex gap-1">
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let pageNum;
                if (totalPages <= 7) {
                  pageNum = i + 1;
                } else if (page <= 4) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 3) {
                  pageNum = totalPages - 6 + i;
                } else {
                  pageNum = page - 3 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-8 h-8 text-sm rounded-lg transition-colors ${
                      page === pageNum
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-secondary-700'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              icon={ChevronRight}
              iconPosition="right"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      <Modal
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        title={`Edit Ticket — ${editTarget?.ticketRef || ''}`}
        size="2xl"
      >
        {editTarget && (
          <TicketForm ticket={editTarget} onSave={handleEdit} isSaving={isSaving} members={members} />
        )}
      </Modal>

      {/* Delete confirm modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Ticket"
        size="sm"
      >
        <div className="space-y-4">
          <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg border border-red-100 dark:border-red-900">
            <p className="text-sm font-semibold text-red-800 dark:text-red-300 mb-1">
              {deleteTarget?.ticketRef} — {deleteTarget?.title}
            </p>
            <p className="text-sm text-red-600 dark:text-red-400">
              This action cannot be undone. The ticket will be permanently deleted.
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              icon={Trash2}
              loading={isDeleting}
              onClick={handleDelete}
            >
              Delete Ticket
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
