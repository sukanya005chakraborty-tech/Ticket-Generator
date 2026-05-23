export const PRIORITY_OPTIONS = [
  { value: 'Critical', label: 'Critical', color: 'danger' },
  { value: 'High', label: 'High', color: 'warning' },
  { value: 'Medium', label: 'Medium', color: 'info' },
  { value: 'Low', label: 'Low', color: 'success' },
];

export const SEVERITY_OPTIONS = [
  { value: 'Blocker', label: 'Blocker', color: 'danger' },
  { value: 'Critical', label: 'Critical', color: 'danger' },
  { value: 'Major', label: 'Major', color: 'warning' },
  { value: 'Minor', label: 'Minor', color: 'info' },
  { value: 'Trivial', label: 'Trivial', color: 'default' },
];

export const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft', color: 'default' },
  { value: 'open', label: 'Open', color: 'info' },
  { value: 'in-progress', label: 'In Progress', color: 'warning' },
  { value: 'resolved', label: 'Resolved', color: 'success' },
  { value: 'closed', label: 'Closed', color: 'default' },
];

export const BROWSER_OPTIONS = [
  { value: 'Chrome', label: 'Chrome' },
  { value: 'Firefox', label: 'Firefox' },
  { value: 'Safari', label: 'Safari' },
  { value: 'Edge', label: 'Edge' },
  { value: 'Opera', label: 'Opera' },
  { value: 'Other', label: 'Other' },
];

export const DEVICE_OPTIONS = [
  { value: 'Desktop', label: 'Desktop' },
  { value: 'Mobile', label: 'Mobile' },
  { value: 'Tablet', label: 'Tablet' },
  { value: 'Other', label: 'Other' },
];

export const ENVIRONMENT_OPTIONS = [
  { value: 'Production', label: 'Production' },
  { value: 'Staging', label: 'Staging' },
  { value: 'Development', label: 'Development' },
  { value: 'UAT', label: 'UAT' },
  { value: 'QA', label: 'QA' },
];

export const SORT_OPTIONS = [
  { value: 'createdAt_desc', label: 'Newest First' },
  { value: 'createdAt_asc', label: 'Oldest First' },
  { value: 'priority_desc', label: 'Priority (High to Low)' },
  { value: 'priority_asc', label: 'Priority (Low to High)' },
  { value: 'updatedAt_desc', label: 'Recently Updated' },
];

export const EXAMPLE_PROMPTS = [
  'Login button is not working on mobile devices — clicking the button does nothing and the form doesn\'t submit',
  'Users get a 500 error when uploading files larger than 5MB on the profile page in production',
  'The dashboard page takes more than 10 seconds to load when a user has more than 100 tickets',
  'Password reset email is not being sent when a user requests it from the forgot password page',
  'Search results show duplicate entries when filtering by both status and priority at the same time',
];

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export const CHART_COLORS = {
  Critical: '#ef4444',
  High: '#f97316',
  Medium: '#eab308',
  Low: '#22c55e',
  Blocker: '#dc2626',
  Major: '#f97316',
  Minor: '#3b82f6',
  Trivial: '#6b7280',
  draft: '#6b7280',
  open: '#3b82f6',
  'in-progress': '#f59e0b',
  resolved: '#22c55e',
  closed: '#6b7280',
};
