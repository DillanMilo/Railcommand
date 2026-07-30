import { notFound } from 'next/navigation';
import { FlowWorkspacePreview, isFlowKey } from '@/components/command/FlowWorkspacePreview';

export default async function CommandCenterFlowPage({
  params,
}: {
  params: Promise<{ flow: string }>;
}) {
  const { flow } = await params;

  if (!isFlowKey(flow)) {
    notFound();
  }

  return <FlowWorkspacePreview flow={flow} />;
}
