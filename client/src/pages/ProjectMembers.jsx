import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, UserPlus, Mail, Trash2, ShieldCheck, Shield, Crown, Clock, X
} from 'lucide-react';
import { useProject, useUsers } from '../hooks/useProjects';
import {
  useProjectMembers, useAddMember, useRemoveMember, useUpdateMemberRole,
  useProjectInvites, useSendInvite, useRevokeInvite,
} from '../hooks/useProjects';
import { useAuthStore } from '../store/authStore';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import { formatDate, formatRelativeTime, getInitials, getAvatarColor, cn } from '../utils/helpers';

const ROLE_BADGE = {
  admin:  { label: 'Admin',  icon: Crown,       className: 'text-amber-600 bg-amber-50 dark:bg-amber-950 dark:text-amber-400' },
  member: { label: 'Member', icon: Shield,       className: 'text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400' },
};

const INVITE_STATUS_COLOR = {
  pending:  'text-amber-600 bg-amber-50 dark:bg-amber-950',
  accepted: 'text-green-600 bg-green-50 dark:bg-green-950',
  expired:  'text-gray-500 bg-gray-100 dark:bg-secondary-700',
  revoked:  'text-red-500 bg-red-50 dark:bg-red-950',
};

export default function ProjectMembers() {
  const { id: projectId } = useParams();
  const { data: project }  = useProject(projectId);
  const { data: members = [], isLoading: membersLoading } = useProjectMembers(projectId);
  const { data: invites = [] } = useProjectInvites(projectId);
  const { data: allUsers = [] } = useUsers();

  const user = useAuthStore((s) => s.user);

  const myMember   = members.find((m) => (m.userId?._id || m.userId?._id) === user?._id || (m.userId?.id || m.userId?.id) === user?.id);
  const isAdmin    = myMember?.role === 'admin' || user?.role === 'admin';

  const { mutateAsync: addMember,    isPending: isAdding }   = useAddMember(projectId);
  const { mutateAsync: removeMember, isPending: isRemoving } = useRemoveMember(projectId);
  const { mutateAsync: updateRole }                          = useUpdateMemberRole(projectId);
  const { mutateAsync: sendInvite,   isPending: isSending }  = useSendInvite(projectId);
  const { mutateAsync: revokeInvite }                        = useRevokeInvite(projectId);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole,  setInviteRole]  = useState('member');
  const [removeTarget, setRemoveTarget] = useState(null);
  const [directUserId, setDirectUserId] = useState('');
  const [directRole,   setDirectRole]   = useState('member');

  // Members already in project — exclude from direct-add dropdown
  const memberIds = new Set(members.map((m) => {
    const uid = m.userId?._id || m.userId?.id || m.userId;
    return uid?.toString();
  }));
  const addableUsers = allUsers.filter((u) => !memberIds.has(u._id?.toString()));

  const handleDirectAdd = async (e) => {
    e.preventDefault();
    if (!directUserId) return;
    await addMember({ userId: directUserId, role: directRole });
    setDirectUserId('');
    setDirectRole('member');
  };

  const handleSendInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    await sendInvite({ email: inviteEmail.trim(), role: inviteRole });
    setInviteEmail('');
    setInviteRole('member');
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    const uid = removeTarget.userId?._id || removeTarget.userId?.id || removeTarget.userId;
    await removeMember(uid);
    setRemoveTarget(null);
  };

  const handleRoleChange = async (member, newRole) => {
    const uid = member.userId?._id || member.userId?.id || member.userId;
    await updateRole({ userId: uid, role: newRole });
  };

  return (
    <div className="animate-fade-in space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <Link to="/projects" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-3">
          <ArrowLeft className="w-4 h-4" /> Back to Projects
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {project?.name || 'Project'} — Members
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">{members.length} member{members.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Invite form (admin only) */}
      {isAdmin && (
        <Card className="p-5">
          <h2 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-primary-500" /> Invite by Email
          </h2>
          <form onSubmit={handleSendInvite} className="flex gap-2 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="email@example.com"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                icon={Mail}
              />
            </div>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-secondary-600 bg-white dark:bg-secondary-700 text-sm text-gray-700 dark:text-gray-200"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <Button variant="primary" type="submit" loading={isSending} icon={UserPlus}>
              Send Invite
            </Button>
          </form>

          {addableUsers.length > 0 && (
            <form onSubmit={handleDirectAdd} className="flex gap-2 flex-wrap mt-4 pt-4 border-t border-gray-100 dark:border-secondary-700">
              <select
                value={directUserId}
                onChange={(e) => setDirectUserId(e.target.value)}
                className="flex-1 min-w-[200px] px-3 py-2 rounded-lg border border-gray-300 dark:border-secondary-600 bg-white dark:bg-secondary-700 text-sm text-gray-700 dark:text-gray-200"
              >
                <option value="">— Add existing user —</option>
                {addableUsers.map((u) => (
                  <option key={u._id} value={u._id}>{u.name} ({u.email})</option>
                ))}
              </select>
              <select
                value={directRole}
                onChange={(e) => setDirectRole(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-300 dark:border-secondary-600 bg-white dark:bg-secondary-700 text-sm text-gray-700 dark:text-gray-200"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <Button variant="outline" type="submit" loading={isAdding} icon={UserPlus} disabled={!directUserId}>
                Add
              </Button>
            </form>
          )}
        </Card>
      )}

      {/* Members list */}
      <Card className="divide-y divide-gray-100 dark:divide-secondary-700 overflow-hidden">
        {membersLoading && (
          <div className="p-6 text-center text-sm text-gray-400">Loading members…</div>
        )}
        {!membersLoading && members.map((member) => {
          const uid    = member.userId?._id || member.userId?.id || member.userId;
          const name   = member.userId?.name  || 'Unknown';
          const email  = member.userId?.email || '';
          const avatar = member.userId?.avatar;
          const isSelf = uid === user?._id || uid === user?.id;
          const { className: roleCls } = ROLE_BADGE[member.role] || ROLE_BADGE.member;

          return (
            <div key={uid} className="flex items-center gap-3 px-4 py-3">
              {/* Avatar */}
              {avatar ? (
                <img src={avatar} alt={name} className="w-9 h-9 rounded-full object-cover shrink-0" />
              ) : (
                <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0', getAvatarColor(name))}>
                  {getInitials(name)}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                  {name} {isSelf && <span className="text-xs text-gray-400">(you)</span>}
                </p>
                <p className="text-xs text-gray-400 truncate">{email}</p>
              </div>

              {/* Role badge / selector */}
              {isAdmin && !isSelf ? (
                <select
                  value={member.role}
                  onChange={(e) => handleRoleChange(member, e.target.value)}
                  className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-secondary-600 bg-white dark:bg-secondary-700 text-gray-700 dark:text-gray-200"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              ) : (
                <span className={cn('text-xs font-semibold px-2 py-0.5 rounded', roleCls)}>
                  {member.role}
                </span>
              )}

              {/* Remove button */}
              {(isAdmin || isSelf) && (
                <button
                  onClick={() => setRemoveTarget(member)}
                  className="p-1.5 rounded text-gray-300 hover:text-red-500 transition-colors ml-1"
                  title={isSelf ? 'Leave project' : 'Remove member'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </Card>

      {/* Pending invites (admin only) */}
      {isAdmin && invites.filter((i) => i.status === 'pending').length > 0 && (
        <div>
          <h2 className="font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4" /> Pending Invites
          </h2>
          <Card className="divide-y divide-gray-100 dark:divide-secondary-700 overflow-hidden">
            {invites.filter((i) => i.status === 'pending').map((invite) => (
              <div key={invite._id} className="flex items-center gap-3 px-4 py-3">
                <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{invite.email}</p>
                  <p className="text-xs text-gray-400">Invited {formatRelativeTime(invite.createdAt)} · expires {formatDate(invite.expiresAt)}</p>
                </div>
                <span className={cn('text-xs font-semibold px-2 py-0.5 rounded', INVITE_STATUS_COLOR[invite.status])}>
                  {invite.status}
                </span>
                <span className="text-xs text-gray-400">{invite.role}</span>
                <button
                  onClick={() => revokeInvite(invite._id)}
                  className="p-1.5 rounded text-gray-300 hover:text-red-500 transition-colors"
                  title="Revoke invite"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* Remove confirm */}
      <Modal isOpen={!!removeTarget} onClose={() => setRemoveTarget(null)} title="Remove Member" size="sm">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {removeTarget?.userId?._id === user?._id
            ? 'Leave this project?'
            : `Remove ${removeTarget?.userId?.name} from this project?`
          }
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setRemoveTarget(null)}>Cancel</Button>
          <Button variant="danger" loading={isRemoving} onClick={handleRemove}>Confirm</Button>
        </div>
      </Modal>
    </div>
  );
}
