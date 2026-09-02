import { useLayoutEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { SymbolView } from 'expo-symbols';
import type { MobilePdfReportKind } from '@railcommand/domain';
import { WebActionButton } from './web-shell';
import { shareNativePdfReport } from '@/lib/native-report-export';
import { captureOfflineScope } from '@/lib/storage-scope';
import { useAuth } from '@/providers/auth-provider';
import { colors } from '@/theme';

export function ReportExportButton({ kind, projectId, recordIds, online }: {
  kind: MobilePdfReportKind;
  projectId: string | null;
  recordIds: string[];
  online: boolean;
}) {
  const { session, sessionRevision, isSessionCurrent } = useAuth();
  const userId = session?.user.id;
  const scope = `${sessionRevision}:${userId}:${projectId}`;
  const currentScope = useRef<{ scope: string; current: boolean } | null>(null);
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  useLayoutEffect(() => {
    const lifetime = { scope, current: true };
    currentScope.current = lifetime;
    return () => {
      lifetime.current = false;
      if (currentScope.current === lifetime) currentScope.current = null;
    };
  }, [scope]);

  const exportReport = async () => {
    if (inFlight.current) return;
    if (!online || !projectId || !userId) {
      Alert.alert('PDF export requires connectivity', 'Reconnect to verify access and generate the report. Your filters and saved work are unchanged; this request is not queued.');
      return;
    }
    const startedScope = currentScope.current;
    const offlineCurrent = captureOfflineScope(userId);
    const isCurrent = () => startedScope?.current === true && startedScope.scope === scope && currentScope.current === startedScope
      && isSessionCurrent(userId, sessionRevision) && offlineCurrent();
    if (!isCurrent()) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await shareNativePdfReport(userId, { projectId, kind, recordIds: [...recordIds] }, isCurrent);
    } catch (error) {
      if (isCurrent()) Alert.alert('Could not export PDF', error instanceof Error ? error.message : 'Please try again when connected. Your filters are unchanged.');
    } finally {
      inFlight.current = false;
      if (currentScope.current !== null && isSessionCurrent(userId, sessionRevision)) setBusy(false);
    }
  };

  return <WebActionButton title={busy ? 'Preparing PDF…' : 'Export PDF'} disabled={busy}
    onPress={() => void exportReport()}
    icon={<SymbolView accessible={false} name={{ ios: 'document.badge.arrow.up', android: 'download', web: 'download' }} tintColor={colors.ink} size={19} />} />;
}
