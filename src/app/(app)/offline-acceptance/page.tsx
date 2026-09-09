import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import OfflineAcceptanceDiagnostics from './OfflineAcceptanceDiagnostics';

export const dynamic = 'force-dynamic';

export default async function OfflineAcceptancePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // This page exposes browser-local cache names for acceptance testing. Keep it
  // restricted to server-created QA identities; user_metadata is not trusted.
  if (!user || user.app_metadata?.railcommand_qa !== true) {
    notFound();
  }

  return <OfflineAcceptanceDiagnostics userId={user.id} />;
}
