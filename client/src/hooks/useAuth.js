import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';
import { useProjectStore } from '../store/projectStore';
import queryClient from '../lib/queryClient';
import * as authService from '../services/authService';

export function useAuth() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading, login: storeLogin, logout: storeLogout, setLoading } = useAuthStore();
  const clearProject = useProjectStore((s) => s.clearProject);

  const login = useCallback(async (credentials) => {
    setLoading(true);
    try {
      queryClient.clear();
      clearProject();
      const response = await authService.login(credentials);
      const { user, accessToken } = response.data;
      storeLogin(user, accessToken);
      toast.success(`Welcome back, ${user.name}!`);
      navigate('/dashboard');
      return { success: true };
    } catch (error) {
      toast.error(error.message || 'Login failed. Please check your credentials.');
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, [storeLogin, setLoading, navigate, clearProject]);

  const register = useCallback(async (userData) => {
    setLoading(true);
    try {
      await authService.register(userData);
      toast.success('Account created! Please log in.');
      navigate('/login');
      return { success: true };
    } catch (error) {
      toast.error(error.message || 'Registration failed. Please try again.');
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, [setLoading, navigate]);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Ignore logout errors — always clear local state
    } finally {
      queryClient.clear();
      clearProject();
      storeLogout();
      toast.success('Logged out successfully');
      navigate('/login');
    }
  }, [storeLogout, navigate, clearProject]);

  return {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    register,
  };
}
