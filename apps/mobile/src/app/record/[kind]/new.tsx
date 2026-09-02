import { router, useLocalSearchParams } from 'expo-router';
import { RecordCreateScreen } from '@/components/record-create-screen';
import { Screen, StatusBanner } from '@/components/ui';
import { WebActionButton } from '@/components/web-shell';
import { recordScope } from '@/lib/record-detail';
import { useAuth } from '@/providers/auth-provider';
import { useMobileData } from '@/providers/mobile-data-provider';

export default function NewRecordRoute() {
  const params = useLocalSearchParams<{ kind?: string; projectId?: string }>();
  const { session } = useAuth();
  const { bootstrap, activeProjectId, online } = useMobileData();
  const userId = session?.user.id;
  const scope = recordScope(params.kind, params.projectId, params.projectId);
  const project = scope && bootstrap && bootstrap.userId === userId && bootstrap.projects.find((item) => item.id === scope.projectId);
  if (!userId || !scope || !project || activeProjectId !== scope.projectId) return <Screen>
    <StatusBanner title="Select a project" detail="Open this form from an available project. Saved work from another account or project is never shown here." />
    <WebActionButton title="Back to projects" onPress={() => router.replace('/(tabs)')} />
  </Screen>;
  const canCreate = scope.kind === 'rfis' ? project.canCreateRfi === true : project.canCreateSubmittal === true;
  return <RecordCreateScreen key={`${userId}:${scope.kind}:${scope.projectId}`} userId={userId} project={project} kind={scope.kind} online={online} canCreate={canCreate} />;
}
