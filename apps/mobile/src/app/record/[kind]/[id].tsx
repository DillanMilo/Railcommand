import { useLocalSearchParams, router } from 'expo-router';
import { RecordDetailScreen } from '@/components/record-detail-screen';
import { Screen, StatusBanner } from '@/components/ui';
import { WebActionButton } from '@/components/web-shell';
import { recordScope } from '@/lib/record-detail';
import { useAuth } from '@/providers/auth-provider';
import { useMobileData } from '@/providers/mobile-data-provider';

export default function RecordDetailRoute() {
  const params = useLocalSearchParams<{ kind?: string; id?: string; projectId?: string }>();
  const { session } = useAuth();
  const { bootstrap, activeProjectId, online } = useMobileData();
  const scope = recordScope(params.kind, params.projectId, params.id);
  const userId = session?.user.id;
  const project = scope && bootstrap && bootstrap.userId === userId && bootstrap.projects.find((item) => item.id === scope.projectId);
  if (!userId || !scope || !project || activeProjectId !== scope.projectId) return <Screen>
    <StatusBanner title="Select the linked project" detail="This record is not available in the current account and project. No other project’s saved record will be shown here." />
    <WebActionButton title="Back to projects" onPress={() => router.replace('/(tabs)')} />
  </Screen>;
  return <RecordDetailScreen key={`${userId}:${scope.projectId}:${scope.kind}:${scope.recordId}`}
    userId={userId} scope={scope} projectName={project.name} online={online} />;
}
