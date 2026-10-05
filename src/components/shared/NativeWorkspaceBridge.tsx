"use client";

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { nativeWorkspace, shareWorkspaceBlob } from '@/lib/native-workspace';

import { navigateWorkspace } from '@/lib/workspace-navigation';

// No project content or credentials cross this bridge. Native downloads use the
// bounded blob helper; normal web requests retain the user's existing RLS checks.
export default function NativeWorkspaceBridge() {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    const bridge = nativeWorkspace();
    if (!bridge) return;
    let dirty = false;
    const state = window as Window & { railcommandWorkspaceOnline?: boolean };
    const send = (type: string, fields = {}) => bridge.postMessage(JSON.stringify({ type, ...fields }));
    send('ready', { path: pathname, clientNavigation: true });
    send('dirty', { value: false });
    const changed = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target?.matches('input, textarea, select, [contenteditable=true]')) return;
      if (target.matches('input[type=search], [data-workspace-ignore-dirty]')) return;
      dirty = true;
      send('dirty', { value: true });
    };
    const navigate = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest('a') : null;
      if (!target || target.hasAttribute('download')) return;
      if (state.railcommandWorkspaceOnline === false) {
        event.preventDefault(); event.stopImmediatePropagation();
        window.alert('You are offline. This page stays open. Reconnect before navigating or saving. Use Field tools for offline logs.');
      } else if (dirty && !window.confirm('Leave this page? Any unsaved changes may be lost.')) {
        event.preventDefault(); event.stopImmediatePropagation();
      }
    };
    const submitting = (event: Event) => {
      if (state.railcommandWorkspaceOnline !== false) return;
      event.preventDefault(); event.stopImmediatePropagation();
      window.alert('You are offline. Reconnect to save. Your entered values remain on this page.');
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty) { event.preventDefault(); event.returnValue = ''; }
    };
    const nativeNavigate = (event: Event) => {
      navigateWorkspace((event as CustomEvent<{ path?: unknown }>).detail?.path, {
        online: state.railcommandWorkspaceOnline !== false,
        // The retained page remains authoritative even if native dirty messages lag.
        dirty,
        confirm: () => window.confirm('Leave this page? Any unsaved changes may be lost.'),
        push: (path) => router.push(path),
      });
    };
    const download = (event: Event) => {
      const value = (event as CustomEvent<{ url?: unknown }>).detail?.url;
      if (typeof value !== 'string') return;
      void (async () => {
        const url = new URL(value, location.origin);
        const storageOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin;
        if (url.protocol !== 'https:' || (url.origin !== location.origin && (url.origin !== storageOrigin || !url.pathname.startsWith('/storage/v1/object/')))) throw new Error('Open this external file on the website.');
        const response = await fetch(url, { credentials: url.origin === location.origin ? 'same-origin' : 'omit', redirect: 'error', cache: 'no-store' });
        if (!response.ok) throw new Error('Could not download this file. Please try again.');
        const length = Number(response.headers.get('content-length'));
        if (length > 20 * 1024 * 1024) throw new Error('Use the website to download files over 20 MB.');
        // Bound streaming reads too; Content-Length may be absent or inaccurate.
        const reader = response.body?.getReader();
        if (!reader) throw new Error('Could not read the download.');
        const chunks: Uint8Array<ArrayBuffer>[] = []; let size = 0;
        try {
          while (true) {
            const { value: bytes, done } = await reader.read();
            if (done) break;
            size += bytes.byteLength;
            if (size > 20 * 1024 * 1024) throw new Error('Use the website to download files over 20 MB.');
            chunks.push(new Uint8Array(bytes));
          }
        } finally { await reader.cancel(); }
        const name = url.pathname.split('/').pop() || 'railcommand-export';
        await shareWorkspaceBlob(new Blob(chunks, { type: response.headers.get('content-type')?.split(';')[0] || 'application/octet-stream' }), name);
      })().catch((error: unknown) => window.alert(error instanceof Error ? error.message : 'Could not export the file.'));
    };
    window.addEventListener('railcommand:navigate', nativeNavigate);
    window.addEventListener('railcommand:download', download);
    document.addEventListener('input', changed, true);
    document.addEventListener('change', changed, true);
    document.addEventListener('click', navigate, true);
    document.addEventListener('submit', submitting, true);
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      window.removeEventListener('railcommand:navigate', nativeNavigate);
      window.removeEventListener('railcommand:download', download);
      document.removeEventListener('input', changed, true);
      document.removeEventListener('change', changed, true);
      document.removeEventListener('click', navigate, true);
      document.removeEventListener('submit', submitting, true);
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, [pathname, router]);
  return null;
}
