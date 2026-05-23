import { useState, useMemo, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  pointerWithin,
  rectIntersection,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { GripVertical, Sparkles, Eye, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTickets } from '../hooks/useTickets';
import { useProjectMembers, useUsers } from '../hooks/useProjects';
import { useProjectStore } from '../store/projectStore';
import { useAuthStore } from '../store/authStore';
import * as ticketService from '../services/ticketService';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { formatRelativeTime, formatDate, cn } from '../utils/helpers';

// ---------------------------------------------------------------------------
// Column config
// ---------------------------------------------------------------------------
const COLUMNS = [
  { id: 'draft',       label: 'Draft',       dotClass: 'bg-gray-400',  headerClass: 'text-gray-600 dark:text-gray-400',   bgClass: 'bg-gray-50 dark:bg-secondary-900/60',   overClass: 'ring-2 ring-gray-400 bg-gray-100 dark:bg-secondary-800' },
  { id: 'open',        label: 'Open',        dotClass: 'bg-blue-500',  headerClass: 'text-blue-600 dark:text-blue-400',   bgClass: 'bg-blue-50/50 dark:bg-blue-950/20',     overClass: 'ring-2 ring-blue-400 bg-blue-50 dark:bg-blue-950/40' },
  { id: 'in-progress', label: 'In Progress', dotClass: 'bg-amber-500', headerClass: 'text-amber-600 dark:text-amber-400', bgClass: 'bg-amber-50/50 dark:bg-amber-950/20',   overClass: 'ring-2 ring-amber-400 bg-amber-50 dark:bg-amber-950/40' },
  { id: 'resolved',    label: 'Resolved',    dotClass: 'bg-green-500', headerClass: 'text-green-600 dark:text-green-400', bgClass: 'bg-green-50/50 dark:bg-green-950/20',   overClass: 'ring-2 ring-green-400 bg-green-50 dark:bg-green-950/40' },
  { id: 'closed',      label: 'Closed',      dotClass: 'bg-gray-400',  headerClass: 'text-gray-500 dark:text-gray-500',   bgClass: 'bg-gray-50 dark:bg-secondary-900/60',   overClass: 'ring-2 ring-gray-400 bg-gray-100 dark:bg-secondary-800' },
];

const COLUMN_IDS = new Set(COLUMNS.map((c) => c.id));

// ---------------------------------------------------------------------------
// Pure card display — no DnD hooks (safe to render in DragOverlay)
// ---------------------------------------------------------------------------
function CardDisplay({ ticket, isDragging = false, isDragOverlay = false }) {
  const navigate = useNavigate();

  return (
    <div
      className={cn(
        'bg-white dark:bg-secondary-800 rounded-lg border p-3 group select-none',
        isDragging && !isDragOverlay && 'opacity-30 shadow-none border-dashed border-primary-300 dark:border-primary-700',
        !isDragging && !isDragOverlay && 'border-gray-200 dark:border-secondary-700 shadow-sm',
        isDragOverlay && 'shadow-2xl border-primary-400 dark:border-primary-500 rotate-1 scale-105 cursor-grabbing'
      )}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="w-4 h-4 mt-0.5 text-gray-300 dark:text-secondary-600 shrink-0" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
            <span className="text-xs font-mono font-semibold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950 px-1.5 py-0.5 rounded">
              {ticket.ticketRef || '#???'}
            </span>
            <Badge value={ticket.priority} size="xs" dot />
          </div>

          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 line-clamp-2 mb-2">
            {ticket.title || 'Untitled Ticket'}
          </p>

          <div className="flex items-center justify-between gap-2">
            {ticket.module && (
              <span className="text-xs text-gray-400 dark:text-gray-500 truncate">{ticket.module}</span>
            )}
            <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto shrink-0">
              {formatRelativeTime(ticket.createdAt)}
            </span>
          </div>
          {ticket.dueDate && (
            <div className={cn(
              'flex items-center gap-1 text-xs mt-1.5',
              new Date(ticket.dueDate) < new Date()
                ? 'text-red-500 dark:text-red-400'
                : 'text-gray-400 dark:text-gray-500'
            )}>
              <Calendar className="w-3 h-3 shrink-0" />
              {formatDate(ticket.dueDate, 'MMM d')}
            </div>
          )}
        </div>

        {!isDragOverlay && (
          <button
            // Stop pointer-down so this button doesn't trigger drag
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => navigate(`/tickets/${ticket._id}`)}
            className="p-1 rounded text-gray-300 hover:text-primary-500 dark:hover:text-primary-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            title="View ticket"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Draggable card — entire card surface is the drag handle
// ---------------------------------------------------------------------------
function DraggableCard({ ticket }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useDraggable({
    id: ticket._id,
    data: { columnId: ticket.status },
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className="cursor-grab active:cursor-grabbing touch-none"
    >
      <CardDisplay ticket={ticket} isDragging={isDragging} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Droppable column — full area is the drop target
// ---------------------------------------------------------------------------
function KanbanColumn({ column, tickets }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col min-w-[272px] w-[272px] shrink-0 rounded-xl p-3 min-h-[500px] transition-all duration-150',
        isOver ? column.overClass : column.bgClass
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', column.dotClass)} />
        <span className={cn('text-xs font-bold uppercase tracking-widest', column.headerClass)}>
          {column.label}
        </span>
        <span className="ml-auto text-xs font-semibold text-gray-400 dark:text-gray-500 bg-white/70 dark:bg-secondary-800/70 px-2 py-0.5 rounded-full">
          {tickets.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2 flex-1">
        {tickets.map((ticket) => (
          <DraggableCard key={ticket._id} ticket={ticket} />
        ))}

        {tickets.length === 0 && (
          <div className={cn(
            'flex-1 flex items-center justify-center rounded-lg border-2 border-dashed min-h-[100px] text-xs italic transition-colors pointer-events-none',
            isOver
              ? 'border-current text-current opacity-50'
              : 'border-gray-200 dark:border-secondary-700 text-gray-400 dark:text-gray-600'
          )}>
            Drop here
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collision: prefer pointer-within, fall back to rect intersection
// ---------------------------------------------------------------------------
function customCollision(args) {
  const hits = pointerWithin(args);
  return hits.length > 0 ? hits : rectIntersection(args);
}

// ---------------------------------------------------------------------------
// Board page
// ---------------------------------------------------------------------------
export default function KanbanBoard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTicket, setActiveTicket] = useState(null);
  const [localOverrides, setLocalOverrides] = useState({});
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  const [assignedTo, setAssignedTo] = useState(() => isAdmin ? '' : (user?.id || user?._id || ''));

  const { selectedProjectId } = useProjectStore();
  const { data: members = [] } = useProjectMembers(selectedProjectId);
  const { data: allUsers = [] } = useUsers();
  const allAssigneeList = allUsers.length > 0 ? allUsers : members.map((m) => ({ _id: m.userId?._id || m.userId, name: m.userId?.name || 'Unknown' }));
  const assigneeList = isAdmin ? allAssigneeList : allAssigneeList.filter((u) => (u._id?.toString() === (user?.id || user?._id?.toString())));

  const { data, isLoading, isError } = useTickets({ limit: 100, assignedTo: assignedTo || undefined });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } })
  );

  const grouped = useMemo(() => {
    const tickets = data?.tickets || [];
    const map = Object.fromEntries(COLUMNS.map((c) => [c.id, []]));
    tickets.forEach((t) => {
      const status = localOverrides[t._id] ?? t.status;
      if (map[status]) map[status].push({ ...t, status });
    });
    return map;
  }, [data?.tickets, localOverrides]);

  const handleDragStart = useCallback(({ active }) => {
    const ticket = (data?.tickets || []).find((t) => t._id === active.id);
    setActiveTicket(ticket ?? null);
  }, [data?.tickets]);

  const handleDragEnd = useCallback(async ({ active, over }) => {
    setActiveTicket(null);
    if (!over) return;

    const ticketId = String(active.id);
    const newStatus = String(over.id);

    if (!COLUMN_IDS.has(newStatus)) return;

    const ticket = (data?.tickets || []).find((t) => t._id === ticketId);
    if (!ticket) return;

    const currentStatus = localOverrides[ticketId] ?? ticket.status;
    if (currentStatus === newStatus) return;

    // Optimistic update
    setLocalOverrides((prev) => ({ ...prev, [ticketId]: newStatus }));

    try {
      await ticketService.updateTicket(ticketId, { status: newStatus });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      setLocalOverrides((prev) => { const n = { ...prev }; delete n[ticketId]; return n; });
    } catch {
      setLocalOverrides((prev) => { const n = { ...prev }; delete n[ticketId]; return n; });
      toast.error('Failed to move ticket');
    }
  }, [data?.tickets, localOverrides, queryClient]);

  if (isLoading) {
    return (
      <div className="animate-fade-in space-y-4">
        <div className="h-8 w-48 bg-gray-200 dark:bg-secondary-700 rounded animate-pulse" />
        <div className="flex gap-3 overflow-x-auto pb-4">
          {COLUMNS.map((c) => (
            <div key={c.id} className="min-w-[272px] w-[272px] space-y-3 bg-gray-50 dark:bg-secondary-900 rounded-xl p-3">
              <div className="h-5 w-20 bg-gray-200 dark:bg-secondary-700 rounded animate-pulse" />
              {[1, 2].map((i) => (
                <div key={i} className="h-24 bg-gray-100 dark:bg-secondary-800 rounded-lg animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-500 dark:text-gray-400">
        <p className="font-medium">Failed to load tickets</p>
        <Button variant="outline" onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Kanban Board</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {data?.tickets?.length || 0} tickets · drag cards to change status
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {assigneeList.length > 0 && (
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 dark:border-secondary-600 rounded-lg bg-white dark:bg-secondary-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-100"
            >
              <option value="">All Assignees</option>
              <option value="unassigned">Unassigned</option>
              {assigneeList.map((u) => (
                <option key={u._id} value={u._id}>{u.name}</option>
              ))}
            </select>
          )}
          <Button variant="primary" icon={Sparkles} onClick={() => navigate('/generate')}>
            Generate Ticket
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto pb-6">
        <DndContext
          sensors={sensors}
          collisionDetection={customCollision}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-3 min-w-max">
            {COLUMNS.map((col) => (
              <KanbanColumn key={col.id} column={col} tickets={grouped[col.id]} />
            ))}
          </div>

          <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.18,0.67,0.6,1.22)' }}>
            {activeTicket ? <CardDisplay ticket={activeTicket} isDragOverlay /> : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
