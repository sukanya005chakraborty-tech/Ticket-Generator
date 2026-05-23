import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Download,
  Copy,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Home,
  List,
  Check,
  MessageSquare,
  Send,
  Clock,
  User,
  Calendar,
  FolderOpen,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTicket, useUpdateTicket, useDeleteTicket, useAddComment } from '../hooks/useTickets';
import { useProjectMembers } from '../hooks/useProjects';
import { useProjectStore } from '../store/projectStore';
import { TicketDetailSkeleton } from '../components/ui/LoadingSkeleton';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import TicketForm from '../components/tickets/TicketForm';
import JsonPreview from '../components/tickets/JsonPreview';
import { formatDate, formatRelativeTime, copyToClipboard, downloadJSON } from '../utils/helpers';

export default function TicketDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [expandedTestCase, setExpandedTestCase] = useState(null);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [refCopied, setRefCopied] = useState(false);

  const [commentText, setCommentText] = useState('');

  const { selectedProjectId } = useProjectStore();
  const { data: members = [] } = useProjectMembers(selectedProjectId);

  const { data: ticket, isLoading, isError } = useTicket(id);
  const { mutateAsync: updateTicket, isPending: isSaving } = useUpdateTicket();
  const { mutateAsync: deleteTicket, isPending: isDeleting } = useDeleteTicket();
  const { mutateAsync: addComment, isPending: isAddingComment } = useAddComment();

  if (isLoading) return <TicketDetailSkeleton />;

  if (isError || !ticket) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 dark:text-gray-400 mb-4">Ticket not found or failed to load.</p>
        <Button variant="outline" icon={ArrowLeft} onClick={() => navigate('/tickets')}>
          Back to Tickets
        </Button>
      </div>
    );
  }

  const handleSave = async (formData) => {
    await updateTicket({ id: ticket._id, data: formData });
    setEditOpen(false);
  };

  const handleDelete = async () => {
    await deleteTicket(ticket._id);
    navigate('/tickets');
  };

  const handleCopyRef = async () => {
    await copyToClipboard(ticket.ticketRef);
    setRefCopied(true);
    toast.success('Reference copied!');
    setTimeout(() => setRefCopied(false), 2000);
  };

  const handleExport = () => {
    downloadJSON(ticket, `${ticket.ticketRef}.json`);
    toast.success('Ticket exported');
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    await addComment({ id: ticket._id, text: commentText });
    setCommentText('');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <Link to="/dashboard" className="hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1">
          <Home className="w-3.5 h-3.5" />
          Dashboard
        </Link>
        <span>/</span>
        <Link to="/tickets" className="hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1">
          <List className="w-3.5 h-3.5" />
          Tickets
        </Link>
        <span>/</span>
        <span className="text-gray-700 dark:text-gray-300 font-medium truncate max-w-[200px]">
          {ticket.ticketRef}
        </span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <button
              onClick={handleCopyRef}
              className="text-xs font-mono font-semibold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950 px-2 py-1 rounded hover:bg-primary-100 dark:hover:bg-primary-900 transition-colors flex items-center gap-1"
            >
              {ticket.ticketRef}
              {refCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            </button>
            <Badge value={ticket.status} size="md" dot />
            <Badge value={ticket.priority} size="md" />
            <Badge value={ticket.severity} size="md" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">
            {ticket.title}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Created {formatRelativeTime(ticket.createdAt)} &bull; Updated {formatRelativeTime(ticket.updatedAt)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button variant="ghost" size="sm" icon={Download} onClick={handleExport}>
            Export
          </Button>
          <Button variant="secondary" size="sm" icon={Pencil} onClick={() => setEditOpen(true)}>
            Edit
          </Button>
          <Button variant="danger" size="sm" icon={Trash2} onClick={() => setDeleteOpen(true)}>
            Delete
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: main details */}
        <div className="lg:col-span-2 space-y-5">
          {/* Summary */}
          {ticket.summary && (
            <Card title="Summary">
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                {ticket.summary}
              </p>
            </Card>
          )}

          {/* Description */}
          <Card title="Description">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                {ticket.description}
              </p>
            </div>
          </Card>

          {/* Steps to reproduce */}
          {ticket.stepsToReproduce?.length > 0 && (
            <Card title="Steps to Reproduce">
              <ol className="space-y-2">
                {ticket.stepsToReproduce.map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm text-gray-700 dark:text-gray-300">
                    <span className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-950 text-primary-700 dark:text-primary-400 flex items-center justify-center text-xs font-semibold shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </Card>
          )}

          {/* Expected / Actual */}
          {(ticket.expectedResult || ticket.actualResult) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {ticket.expectedResult && (
                <Card title="Expected Result">
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {ticket.expectedResult}
                  </p>
                </Card>
              )}
              {ticket.actualResult && (
                <Card title="Actual Result">
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {ticket.actualResult}
                  </p>
                </Card>
              )}
            </div>
          )}

          {/* Acceptance criteria */}
          {ticket.acceptanceCriteria?.length > 0 && (
            <Card title="Acceptance Criteria">
              <ul className="space-y-2">
                {ticket.acceptanceCriteria.map((crit, i) => (
                  <li key={i} className="flex gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <CheckSquare className="w-4 h-4 text-green-500 dark:text-green-400 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{crit}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Test cases */}
          {ticket.testCases?.length > 0 && (
            <Card title={`Test Cases (${ticket.testCases.length})`}>
              <div className="space-y-3">
                {ticket.testCases.map((tc, i) => (
                  <div
                    key={i}
                    className="border border-gray-200 dark:border-secondary-600 rounded-lg overflow-hidden"
                  >
                    <button
                      className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-secondary-700 hover:bg-gray-100 dark:hover:bg-secondary-600 transition-colors text-left"
                      onClick={() =>
                        setExpandedTestCase(expandedTestCase === i ? null : i)
                      }
                    >
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        TC{i + 1}: {tc.title || 'Test Case'}
                      </span>
                      {expandedTestCase === i ? (
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                    {expandedTestCase === i && (
                      <div className="p-4 space-y-3">
                        {tc.steps?.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                              Steps
                            </p>
                            <ol className="space-y-1">
                              {tc.steps.map((step, si) => (
                                <li key={si} className="text-sm text-gray-700 dark:text-gray-300 flex gap-2">
                                  <span className="text-gray-400 shrink-0">{si + 1}.</span>
                                  {step}
                                </li>
                              ))}
                            </ol>
                          </div>
                        )}
                        {tc.expected && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                              Expected
                            </p>
                            <p className="text-sm text-gray-700 dark:text-gray-300">{tc.expected}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Comments */}
          <Card title={`Comments (${ticket.comments?.length ?? 0})`}>
            <div className="space-y-3 mb-4">
              {ticket.comments?.length > 0 ? (
                ticket.comments.map((c) => (
                  <div key={c._id} className="flex gap-3">
                    <MessageSquare className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{c.text}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatRelativeTime(c.createdAt)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-400">No comments yet.</p>
              )}
            </div>
            <form onSubmit={handleAddComment} className="flex gap-2">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment..."
                rows={2}
                className="flex-1 rounded-lg border border-gray-300 dark:border-secondary-600 bg-white dark:bg-secondary-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-400"
              />
              <button
                type="submit"
                disabled={isAddingComment || !commentText.trim()}
                className="p-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40 transition-colors self-end"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </Card>

          {/* JSON Preview toggle */}
          <div>
            <button
              onClick={() => setJsonOpen((v) => !v)}
              className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors mb-3"
            >
              {jsonOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {jsonOpen ? 'Hide' : 'Show'} JSON Preview
            </button>
            {jsonOpen && <JsonPreview ticket={ticket} />}
          </div>
        </div>

        {/* Right: metadata */}
        <div className="space-y-4">
          <Card title="Details">
            <dl className="space-y-3">
              {[
                { label: 'Priority', value: <Badge value={ticket.priority} size="sm" dot /> },
                { label: 'Severity', value: <Badge value={ticket.severity} size="sm" /> },
                { label: 'Status', value: <Badge value={ticket.status} size="sm" dot /> },
                ticket.projectId
                  ? {
                      label: 'Project',
                      value: (
                        <span className="flex items-center gap-1">
                          <FolderOpen className="w-3.5 h-3.5 text-gray-400" />
                          {ticket.projectId?.name || ticket.projectId}
                        </span>
                      ),
                    }
                  : null,
                ticket.assignedTo?.name
                  ? {
                      label: 'Assignee',
                      value: (
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-gray-400" />
                          {ticket.assignedTo.name}
                        </span>
                      ),
                    }
                  : null,
                ticket.dueDate
                  ? {
                      label: 'Due',
                      value: (
                        <span className={`flex items-center gap-1 ${new Date(ticket.dueDate) < new Date() ? 'text-red-500 dark:text-red-400' : ''}`}>
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(ticket.dueDate, 'MMM d, yyyy')}
                        </span>
                      ),
                    }
                  : null,
                { label: 'Module', value: ticket.module },
                { label: 'Environment', value: ticket.environment },
                { label: 'Browser', value: ticket.browser },
                { label: 'Device', value: ticket.device },
                ticket.timeEstimate?.value != null
                  ? {
                      label: 'Estimate',
                      value: (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          {ticket.timeEstimate.value} {ticket.timeEstimate.unit}
                        </span>
                      ),
                    }
                  : null,
                { label: 'Created', value: formatDate(ticket.createdAt, 'MMM d, yyyy HH:mm') },
              ]
                .filter(Boolean)
                .filter((r) => r.value)
                .map(({ label, value }) => (
                  <div key={label} className="flex items-start justify-between gap-2">
                    <dt className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide shrink-0">
                      {label}
                    </dt>
                    <dd className="text-sm text-gray-800 dark:text-gray-200 text-right">
                      {typeof value === 'string' ? value : value}
                    </dd>
                  </div>
                ))}
            </dl>

            {/* Completion progress */}
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-secondary-600">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Completion
                </span>
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {ticket.completionPercentage ?? 0}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-secondary-700 rounded-full h-2">
                <div
                  className="bg-primary-600 h-2 rounded-full transition-all"
                  style={{ width: `${ticket.completionPercentage ?? 0}%` }}
                />
              </div>
            </div>
          </Card>

          {/* Labels */}
          {ticket.labels?.length > 0 && (
            <Card title="Labels">
              <div className="flex flex-wrap gap-2">
                {ticket.labels.map((label) => (
                  <span
                    key={label}
                    className="px-2 py-1 bg-gray-100 dark:bg-secondary-700 text-gray-600 dark:text-gray-400 text-xs rounded-md font-medium"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </Card>
          )}

          {/* Raw input */}
          {ticket.rawInput && (
            <Card title="Original Input">
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-6">
                {ticket.rawInput}
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      <Modal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title={`Edit — ${ticket.ticketRef}`}
        size="2xl"
      >
        <TicketForm ticket={ticket} onSave={handleSave} isSaving={isSaving} members={members} />
      </Modal>

      {/* Delete confirm modal */}
      <Modal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete Ticket"
        size="sm"
      >
        <div className="space-y-4">
          <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg border border-red-100 dark:border-red-900">
            <p className="text-sm font-semibold text-red-800 dark:text-red-300 mb-1">
              {ticket.ticketRef} — {ticket.title}
            </p>
            <p className="text-sm text-red-600 dark:text-red-400">
              This action cannot be undone.
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
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
