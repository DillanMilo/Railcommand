import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  isValidPasswordRecoveryToken,
  PASSWORD_RECOVERY_COOKIE,
} from '@/lib/auth/password-recovery';
import ResetPasswordForm from './ResetPasswordForm';

export const metadata: Metadata = {
  title: 'Reset Password',
  description: 'Create a new password for your RailCommand account.',
};

export default async function ResetPasswordPage() {
  const cookieStore = await cookies();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isRecoverySession =
    !!user &&
    isValidPasswordRecoveryToken(
      cookieStore.get(PASSWORD_RECOVERY_COOKIE)?.value,
      user.id
    );

  if (!isRecoverySession || !user) {
    redirect('/login?error=recovery_link_invalid');
  }

  return <ResetPasswordForm email={user.email ?? 'your RailCommand account'} />;
}
