import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns';
import { clsx } from 'clsx';

export function formatDate(date, fmt = 'MMM d, yyyy') {
  if (!date) return '';
  try {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    if (!isValid(d)) return '';
    return format(d, fmt);
  } catch {
    return '';
  }
}

export function formatRelativeTime(date) {
  if (!date) return '';
  try {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    if (!isValid(d)) return '';
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return '';
  }
}

export function truncateText(text, length = 100) {
  if (!text) return '';
  if (text.length <= length) return text;
  return text.slice(0, length).trimEnd() + '...';
}

export function getPriorityColor(priority) {
  const colors = {
    Critical: 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950 dark:border-red-800',
    High: 'text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-950 dark:border-orange-800',
    Medium: 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:text-yellow-400 dark:bg-yellow-950 dark:border-yellow-800',
    Low: 'text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-950 dark:border-green-800',
  };
  return colors[priority] || 'text-gray-600 bg-gray-50 border-gray-200 dark:text-gray-400 dark:bg-gray-900 dark:border-gray-700';
}

export function getSeverityColor(severity) {
  const colors = {
    Blocker: 'text-red-700 bg-red-100 border-red-300 dark:text-red-400 dark:bg-red-950 dark:border-red-800',
    Critical: 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950 dark:border-red-800',
    Major: 'text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-950 dark:border-orange-800',
    Minor: 'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950 dark:border-blue-800',
    Trivial: 'text-gray-600 bg-gray-50 border-gray-200 dark:text-gray-400 dark:bg-gray-900 dark:border-gray-700',
  };
  return colors[severity] || 'text-gray-600 bg-gray-50 border-gray-200';
}

export function getStatusColor(status) {
  const colors = {
    draft: 'text-gray-600 bg-gray-100 border-gray-300 dark:text-gray-400 dark:bg-gray-800 dark:border-gray-700',
    open: 'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950 dark:border-blue-800',
    'in-progress': 'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800',
    resolved: 'text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-950 dark:border-green-800',
    closed: 'text-gray-500 bg-gray-100 border-gray-200 dark:text-gray-500 dark:bg-gray-800 dark:border-gray-700',
  };
  return colors[status] || 'text-gray-600 bg-gray-50 border-gray-200';
}

export async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
  } else {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-999999px';
    textarea.style.top = '-999999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}

export function downloadJSON(data, filename = 'ticket.json') {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function cn(...classes) {
  return clsx(...classes);
}

export function getInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join('');
}

export function getAvatarColor(name = '') {
  const colors = [
    'bg-blue-500',
    'bg-purple-500',
    'bg-green-500',
    'bg-red-500',
    'bg-amber-500',
    'bg-teal-500',
    'bg-indigo-500',
    'bg-pink-500',
    'bg-cyan-500',
    'bg-orange-500',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function formatNumber(num) {
  if (num === null || num === undefined) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return String(num);
}
