import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation } from '@tanstack/react-query';
import { CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import * as projectService from '../services/projectService';
import { useAuthStore } from '../store/authStore';
import { useProjectStore } from '../store/projectStore';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

const newUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
});

export default function AcceptInvite() {
  const [searchParams]        = useSearchParams();
  const navigate               = useNavigate();
  const token                  = searchParams.get('token');
  const isAuthenticated        = useAuthStore((s) => s.isAuthenticated);
  const login                  = useAuthStore((s) => s.login);
  const setSelectedProject     = useProjectStore((s) => s.setSelectedProject);

  // Load invite details
  const { data: inviteData, isLoading, isError, error } = useQuery({
    queryKey: ['invite', token],
    queryFn:  () => projectService.getInviteByToken(token),
    select:   (d) => d?.data?.invite,
    enabled:  !!token,
    retry:    false,
  });

  const { mutateAsync: acceptInvite, isPending: isAccepting } = useMutation({
    mutationFn: projectService.acceptInvite,
    onError: (err) => toast.error(err.message || 'Failed to accept invite'),
  });

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(newUserSchema),
  });

  const doAccept = async (extraData = {}) => {
    const result = await acceptInvite({ token, ...extraData });
    const { project, isNewUser, tokens } = result?.data || {};

    if (isNewUser && tokens) {
      // Auto-login the new user
      login({ ...result?.data }, tokens.accessToken);
    }

    if (project) setSelectedProject(project);
    toast.success(`Joined "${project?.name}" successfully!`);
    navigate('/dashboard');
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-secondary-900">
        <div className="text-center p-8">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-1">Invalid Link</h2>
          <p className="text-sm text-gray-500">No invite token found in this URL.</p>
          <Link to="/login" className="mt-4 inline-block text-primary-600 hover:underline text-sm">Go to Login</Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-secondary-900">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-secondary-900">
        <div className="text-center p-8 max-w-sm">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-1">Invite Not Valid</h2>
          <p className="text-sm text-gray-500 mb-4">{error?.message || 'This invite has expired or already been used.'}</p>
          <Link to="/login" className="text-primary-600 hover:underline text-sm">Go to Login</Link>
        </div>
      </div>
    );
  }

  const projectName  = inviteData?.projectId?.name || 'a project';
  const inviterName  = inviteData?.invitedBy?.name || 'Someone';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-secondary-900 p-4">
      <div className="w-full max-w-md bg-white dark:bg-secondary-800 rounded-2xl shadow-xl p-8">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-primary-100 dark:bg-primary-950 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="w-7 h-7 text-primary-600 dark:text-primary-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">You're Invited!</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            <strong>{inviterName}</strong> invited you to join{' '}
            <strong className="text-primary-600 dark:text-primary-400">{projectName}</strong>
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Role: {inviteData?.role}</p>
        </div>

        {isAuthenticated ? (
          // Existing logged-in user — just one click to accept
          <Button variant="primary" className="w-full" loading={isAccepting} onClick={() => doAccept()}>
            Join {projectName}
          </Button>
        ) : (
          // New user — need name + password
          <div className="space-y-4">
            <p className="text-sm text-center text-gray-500 dark:text-gray-400">
              Create your account to join
            </p>
            <form onSubmit={handleSubmit((d) => doAccept(d))} className="space-y-3">
              <Input
                label="Your Name"
                required
                placeholder="Jane Smith"
                error={errors.name?.message}
                {...register('name')}
              />
              <Input
                label="Password"
                type="password"
                required
                placeholder="Min 8 chars, 1 uppercase, 1 number"
                error={errors.password?.message}
                {...register('password')}
              />
              <Button variant="primary" type="submit" className="w-full" loading={isAccepting}>
                Create Account & Join
              </Button>
            </form>
            <p className="text-xs text-center text-gray-400">
              Already have an account?{' '}
              <Link to={`/login?redirect=/accept-invite?token=${token}`} className="text-primary-600 hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
