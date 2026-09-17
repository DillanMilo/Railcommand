/** Only present in the isolated native workspace. Desktop behavior is unchanged. */
export function nativeWorkspace() {
  if (typeof window === 'undefined') return undefined;
  return (window as Window & { ReactNativeWebView?: { postMessage(value: string): void } }).ReactNativeWebView;
}

export async function shareWorkspaceBlob(blob: Blob, name: string): Promise<boolean> {
  const bridge = nativeWorkspace();
  if (!bridge) return false;
  if (blob.size > 20 * 1024 * 1024 || !blob.size) throw new Error('Mobile exports must be between 1 byte and 20 MB. Export larger files on the website.');
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('Could not prepare the export.'));
    reader.readAsDataURL(blob);
  });
  const id = crypto.randomUUID();
  bridge.postMessage(JSON.stringify({ type: 'file-start', id, name, mime: blob.type, size: blob.size }));
  for (let offset = 0, index = 0; offset < base64.length; offset += 262144, index++) {
    bridge.postMessage(JSON.stringify({ type: 'file-chunk', id, index, data: base64.slice(offset, offset + 262144) }));
  }
  bridge.postMessage(JSON.stringify({ type: 'file-end', id }));
  return true;
}
