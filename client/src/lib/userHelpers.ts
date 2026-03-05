export function formatLastLogin(lastLoginAt: string | null): string {
  if (!lastLoginAt) return 'Never';
  const date = new Date(lastLoginAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (diffDays === 0) return `Today, ${time}`;
  if (diffDays === 1) return `Yesterday, ${time}`;
  if (diffDays < 7) return `${diffDays} days ago, ${time}`;
  return date.toLocaleString([], { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function formatDateCreated(createdAt: string | null): string {
  if (!createdAt) return 'Unknown';
  const date = new Date(createdAt);
  return date.toLocaleDateString();
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function getDisplayName(
  firstName?: string,
  lastName?: string,
  email?: string
): string {
  return [firstName, lastName].filter(Boolean).join(' ').trim() || email || '';
}
