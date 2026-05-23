import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FolderOpen, Users, Settings, Trash2, Key, Pencil } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { useProjects, useCreateProject, useDeleteProject, useUpdateProject } from '../hooks/useProjects';
import { useProjectStore } from '../store/projectStore';
import { useAuthStore } from '../store/authStore';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import { formatDate, cn } from '../utils/helpers';

const createSchema = z.object({
  name:        z.string().min(2, 'Name must be at least 2 characters').max(100),
  description: z.string().max(500).optional(),
  key:         z.string().max(10).regex(/^[A-Z0-9]*$/, 'Uppercase letters/numbers only').optional(),
});

const editSchema = z.object({
  name:        z.string().min(2, 'Name must be at least 2 characters').max(100),
  description: z.string().max(500).optional(),
});

function ProjectCard({ project, onSelect, onDelete, onEdit, isSelected }) {
  const navigate  = useNavigate();
  const user      = useAuthStore((s) => s.user);

  const myMember = project.members?.find(
    (m) => (m.userId?._id || m.userId) === user?._id || (m.userId?._id || m.userId) === user?.id
  );
  const myRole = myMember?.role ?? 'member';

  return (
    <div
      className={cn(
        'relative group cursor-pointer rounded-xl border p-5 transition-all duration-150',
        isSelected
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30 shadow-md'
          : 'border-gray-200 dark:border-secondary-700 bg-white dark:bg-secondary-800 hover:border-primary-300 hover:shadow-sm'
      )}
      onClick={() => onSelect(project)}
    >
      {/* Key badge */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-gray-100 dark:bg-secondary-700 text-gray-600 dark:text-gray-300">
          {project.key}
        </span>
        {myRole === 'admin' && (
          <span className="text-xs font-semibold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950 px-2 py-0.5 rounded">
            Admin
          </span>
        )}
      </div>

      <h3 className="font-semibold text-gray-900 dark:text-white text-base mb-1 truncate">
        {project.name}
      </h3>
      {project.description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">
          {project.description}
        </p>
      )}

      <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
        <span className="flex items-center gap-1">
          <Users className="w-3.5 h-3.5" />
          {project.members?.length ?? 0} member{project.members?.length !== 1 ? 's' : ''}
        </span>
        <span>Created {formatDate(project.createdAt)}</span>
      </div>

      {/* Hover actions */}
      <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {myRole === 'admin' && (
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(project); }}
            className="p-1.5 rounded-lg bg-white dark:bg-secondary-700 border border-gray-200 dark:border-secondary-600 text-gray-500 hover:text-primary-600 transition-colors shadow-sm"
            title="Edit project"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
        {myRole === 'admin' && (
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/projects/${project._id || project.id}/members`); }}
            className="p-1.5 rounded-lg bg-white dark:bg-secondary-700 border border-gray-200 dark:border-secondary-600 text-gray-500 hover:text-primary-600 transition-colors shadow-sm"
            title="Manage members"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        )}
        {myRole === 'admin' && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(project); }}
            className="p-1.5 rounded-lg bg-white dark:bg-secondary-700 border border-gray-200 dark:border-secondary-600 text-gray-500 hover:text-red-600 transition-colors shadow-sm"
            title="Delete project"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function Projects() {
  const navigate = useNavigate();
  const { data: projects = [], isLoading } = useProjects();
  const { mutateAsync: createProject, isPending: isCreating } = useCreateProject();
  const { mutateAsync: deleteProject, isPending: isDeleting } = useDeleteProject();
  const { mutateAsync: updateProject, isPending: isUpdating } = useUpdateProject();

  const { selectedProjectId, setSelectedProject } = useProjectStore();
  const [createOpen, setCreateOpen]   = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editTarget, setEditTarget]   = useState(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(createSchema),
    defaultValues: { name: '', description: '', key: '' },
  });

  const {
    register: registerEdit,
    handleSubmit: handleEditSubmit,
    reset: resetEdit,
    formState: { errors: editErrors },
  } = useForm({
    resolver: zodResolver(editSchema),
    defaultValues: { name: '', description: '' },
  });

  const onSubmit = async (data) => {
    const clean = { name: data.name, description: data.description };
    if (data.key) clean.key = data.key.toUpperCase();
    await createProject(clean);
    reset();
    setCreateOpen(false);
  };

  const handleSelect = (project) => {
    setSelectedProject(project);
    toast.success(`Switched to "${project.name}"`);
    navigate('/dashboard');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteProject(deleteTarget._id || deleteTarget.id);
    setDeleteTarget(null);
  };

  const openEdit = (project) => {
    setEditTarget(project);
    resetEdit({ name: project.name, description: project.description || '' });
  };

  const handleEdit = async (data) => {
    if (!editTarget) return;
    await updateProject({ id: editTarget._id || editTarget.id, data });
    setEditTarget(null);
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Projects</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {projects.length} project{projects.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>
          New Project
        </Button>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map((i) => (
            <div key={i} className="h-36 rounded-xl bg-gray-100 dark:bg-secondary-800 animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && projects.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
          <FolderOpen className="w-12 h-12 opacity-40" />
          <p className="font-medium">No projects yet</p>
          <Button variant="outline" icon={Plus} onClick={() => setCreateOpen(true)}>
            Create your first project
          </Button>
        </div>
      )}

      {!isLoading && projects.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <ProjectCard
              key={p._id || p.id}
              project={p}
              onSelect={handleSelect}
              onDelete={setDeleteTarget}
              onEdit={openEdit}
              isSelected={(p._id || p.id) === selectedProjectId}
            />
          ))}
        </div>
      )}

      {/* Create modal */}
      <Modal
        isOpen={createOpen}
        onClose={() => { setCreateOpen(false); reset(); }}
        title="Create New Project"
        size="md"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Project Name"
            required
            placeholder="e.g. Customer Portal"
            error={errors.name?.message}
            {...register('name')}
          />
          <Input
            label="Description"
            placeholder="What is this project about?"
            multiline
            rows={2}
            error={errors.description?.message}
            {...register('description')}
          />
          <Input
            label="Project Key (optional)"
            placeholder="e.g. CUST (auto-generated if blank)"
            icon={Key}
            error={errors.key?.message}
            {...register('key')}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setCreateOpen(false); reset(); }}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={isCreating}>
              Create Project
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Edit Project"
        size="md"
      >
        <form onSubmit={handleEditSubmit(handleEdit)} className="space-y-4">
          <Input
            label="Project Name"
            required
            placeholder="e.g. Customer Portal"
            error={editErrors.name?.message}
            {...registerEdit('name')}
          />
          <Input
            label="Description"
            placeholder="What is this project about?"
            multiline
            rows={2}
            error={editErrors.description?.message}
            {...registerEdit('description')}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={isUpdating}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirm modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Project"
        size="sm"
      >
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Delete <strong>{deleteTarget?.name}</strong>? This cannot be undone. All tickets in this project will be soft-deleted.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" loading={isDeleting} onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
