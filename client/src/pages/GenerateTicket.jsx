import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Copy, Download, TicketIcon, FolderOpen, User, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import { useGenerateTicket, useUpdateTicket } from '../hooks/useTickets';
import { useProjectStore } from '../store/projectStore';
import { useProjectMembers, useUsers } from '../hooks/useProjects';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import TicketForm from '../components/tickets/TicketForm';
import JsonPreview from '../components/tickets/JsonPreview';
import Badge from '../components/ui/Badge';
import { BROWSER_OPTIONS, DEVICE_OPTIONS, ENVIRONMENT_OPTIONS, EXAMPLE_PROMPTS } from '../utils/constants';
import { copyToClipboard, downloadJSON } from '../utils/helpers';
import { exportTicket as exportTicketService } from '../services/ticketService';

const MAX_CHARS = 2000;

export default function GenerateTicket() {
  const [description, setDescription] = useState('');
  const [environment, setEnvironment] = useState('');
  const [browser, setBrowser] = useState('');
  const [device, setDevice] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [generatedTicket, setGeneratedTicket] = useState(null);
  const [savedId, setSavedId] = useState(null);

  const { selectedProject, selectedProjectId } = useProjectStore();
  const { data: members = [] } = useProjectMembers(selectedProjectId);
  const { data: allUsers = [] } = useUsers();
  const assigneeList = allUsers.length > 0 ? allUsers : members.map((m) => ({ _id: m.userId?._id || m.userId, name: m.userId?.name || 'Unknown', email: m.userId?.email }));

  const { mutateAsync: generate, isPending: isGenerating } = useGenerateTicket();
  const { mutateAsync: updateTicket, isPending: isSaving } = useUpdateTicket();

  const handleGenerate = async () => {
    if (!description.trim()) {
      toast.error('Please describe the issue first');
      return;
    }
    if (description.length > MAX_CHARS) {
      toast.error(`Description must be under ${MAX_CHARS} characters`);
      return;
    }

    try {
      const response = await generate({
        rawInput: description.trim(),
        environment: environment || undefined,
        browser: browser || undefined,
        device: device || undefined,
        assignedTo: assignedTo || undefined,
        dueDate: dueDate || undefined,
        projectId: selectedProjectId || undefined,
      });
      const ticket = response?.data?.ticket;
      if (ticket) {
        setGeneratedTicket(ticket);
        setSavedId(ticket._id || null);
        toast.success('Ticket generated successfully!');
      }
    } catch (error) {
      // Error handled by mutation onError
    }
  };

  const handleSave = async (formData) => {
    if (!savedId) return;
    try {
      const response = await updateTicket({ id: savedId, data: formData });
      const updated = response?.data?.ticket;
      if (updated) {
        setGeneratedTicket(updated);
        toast.success('Ticket saved!');
      }
    } catch {
      // handled by mutation
    }
  };

  const handleCopyJSON = async () => {
    if (!generatedTicket) return;
    try {
      await copyToClipboard(JSON.stringify(generatedTicket, null, 2));
      toast.success('JSON copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleExport = async (format = 'json') => {
    if (!savedId) return;
    try {
      const response = await exportTicketService(savedId, format);
      const { ticket: data, filename } = response.data;
      downloadJSON(data, filename);
      toast.success(`Ticket exported as ${format.toUpperCase()}`);
    } catch {
      toast.error('Export failed');
    }
  };

  const fillExample = (prompt) => {
    setDescription(prompt);
  };

  const remaining = MAX_CHARS - description.length;

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Generate Ticket</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Describe your issue and let AI create a detailed, well-structured Jira ticket.
        </p>
        {selectedProject && (
          <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-primary-700 dark:text-primary-400 bg-primary-50 dark:bg-primary-950 px-2.5 py-1 rounded-full">
            <FolderOpen className="w-3.5 h-3.5" />
            <span>{selectedProject.name}</span>
            <span className="font-mono text-primary-500">· {selectedProject.key}</span>
          </div>
        )}
        {!selectedProject && (
          <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 rounded-full">
            <FolderOpen className="w-3.5 h-3.5" />
            <span>No project selected —</span>
            <Link to="/projects" className="underline">select one</Link>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        {/* Left panel — input */}
        <div className="space-y-4">
          <Card title="Describe Your Issue">
            <div className="space-y-4">
              {/* Textarea */}
              <div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the bug or issue in plain English... e.g. 'The login button doesn't work on mobile devices. When I click it nothing happens and the form doesn't submit.'"
                  rows={8}
                  maxLength={MAX_CHARS}
                  className="w-full rounded-lg border border-gray-300 dark:border-secondary-600 bg-white dark:bg-secondary-800 text-gray-900 dark:text-gray-100 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-900/30 focus:border-primary-400 placeholder:text-gray-400 dark:placeholder:text-gray-500 resize-y"
                />
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-gray-400">
                    Be as detailed as possible for better results
                  </span>
                  <span
                    className={`text-xs font-medium ${
                      remaining < 200
                        ? remaining < 50
                          ? 'text-red-500'
                          : 'text-amber-500'
                        : 'text-gray-400'
                    }`}
                  >
                    {remaining} / {MAX_CHARS}
                  </span>
                </div>
              </div>

              {/* Context */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                    <User className="w-3 h-3" /> Assign To
                  </label>
                  <select
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-secondary-600 bg-white dark:bg-secondary-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-400"
                  >
                    <option value="">Unassigned</option>
                    {assigneeList.map((u) => (
                      <option key={u._id} value={u._id}>{u.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Due Date
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full rounded-lg border border-gray-300 dark:border-secondary-600 bg-white dark:bg-secondary-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                    Environment
                  </label>
                  <select
                    value={environment}
                    onChange={(e) => setEnvironment(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-secondary-600 bg-white dark:bg-secondary-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-400"
                  >
                    <option value="">Any</option>
                    {ENVIRONMENT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                    Browser
                  </label>
                  <select
                    value={browser}
                    onChange={(e) => setBrowser(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-secondary-600 bg-white dark:bg-secondary-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-400"
                  >
                    <option value="">Any</option>
                    {BROWSER_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                    Device
                  </label>
                  <select
                    value={device}
                    onChange={(e) => setDevice(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-secondary-600 bg-white dark:bg-secondary-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-400"
                  >
                    <option value="">Any</option>
                    {DEVICE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <Button
                variant="primary"
                size="lg"
                fullWidth
                icon={isGenerating ? undefined : Sparkles}
                loading={isGenerating}
                onClick={handleGenerate}
                disabled={!description.trim() || isGenerating}
              >
                {isGenerating ? 'Generating with AI...' : 'Generate Ticket'}
              </Button>
            </div>
          </Card>

          {/* Example prompts */}
          <Card title="Example Prompts" subtitle="Click to use as a starting point">
            <div className="space-y-2">
              {EXAMPLE_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => fillExample(prompt)}
                  className="w-full text-left text-sm text-gray-600 dark:text-gray-400 hover:text-primary-700 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950 px-3 py-2.5 rounded-lg transition-colors border border-transparent hover:border-primary-100 dark:hover:border-primary-900 leading-relaxed"
                >
                  <span className="text-primary-500 mr-2">→</span>
                  {prompt.length > 100 ? prompt.slice(0, 100) + '...' : prompt}
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* Right panel — output */}
        <div className="space-y-4">
          {isGenerating && (
            <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-secondary-800 rounded-xl border border-gray-200 dark:border-secondary-700 shadow-sm">
              <div className="relative mb-4">
                <div className="w-16 h-16 rounded-full border-4 border-primary-100 dark:border-primary-900 border-t-primary-600 animate-spin" />
                <Sparkles className="w-6 h-6 text-primary-600 dark:text-primary-400 absolute inset-0 m-auto" />
              </div>
              <p className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">
                AI is generating your ticket...
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Analyzing description, detecting priority, creating test cases
              </p>
            </div>
          )}

          {!isGenerating && !generatedTicket && (
            <div className="bg-white dark:bg-secondary-800 rounded-xl border border-dashed border-gray-300 dark:border-secondary-600 shadow-sm">
              <EmptyState
                icon={TicketIcon}
                title="No ticket generated yet"
                description="Describe your issue on the left and click Generate Ticket to see the AI-generated ticket here."
              />
            </div>
          )}

          {!isGenerating && generatedTicket && (
            <>
              {/* Action bar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950 px-2 py-1 rounded">
                    {generatedTicket.ticketRef}
                  </span>
                  <Badge value={generatedTicket.priority} size="sm" dot />
                  <Badge value={generatedTicket.status} size="sm" />
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" icon={Copy} onClick={handleCopyJSON}>
                    Copy JSON
                  </Button>
                  <Button variant="ghost" size="sm" icon={Download} onClick={() => handleExport('json')}>
                    JSON
                  </Button>
                  <Button variant="ghost" size="sm" icon={Download} onClick={() => handleExport('jira')}>
                    Jira
                  </Button>
                </div>
              </div>

              {/* Editable form */}
              <Card title="Edit Generated Ticket" subtitle="Review and modify the AI-generated content">
                <TicketForm
                  ticket={generatedTicket}
                  onSave={handleSave}
                  isSaving={isSaving}
                  members={members}
                />
              </Card>

              {/* JSON Preview */}
              <JsonPreview ticket={generatedTicket} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
