export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-rc-bg dark:bg-rc-bg flex items-center justify-center p-4 sm:p-8">
      {children}
    </div>
  );
}
