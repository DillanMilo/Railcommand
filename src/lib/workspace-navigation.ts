/** Validate native navigation commands without accepting external or auth URLs. */
export function workspaceNavigationPath(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 1500 || /[\\%#\x00-\x20]/.test(value)) return null;
  if (!/^\/(dashboard|projects|search|settings|client|admin|invite|onboarding)(?:[/?]|$)/.test(value)) return null;
  const parsed = new URL(value, 'https://workspace.invalid');
  return parsed.origin === 'https://workspace.invalid' && parsed.pathname === value.split('?')[0] ? value : null;
}

export function navigateWorkspace(
  value: unknown,
  options: { online: boolean; dirty: boolean; confirm: () => boolean; push: (path: string) => void },
): boolean {
  const path = workspaceNavigationPath(value);
  if (!path || !options.online || (options.dirty && !options.confirm())) return false;
  options.push(path);
  return true;
}
