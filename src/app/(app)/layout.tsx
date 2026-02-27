import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import MobileNav from '@/components/layout/MobileNav';
import PageTransition from '@/components/shared/PageTransition';
import ProjectProvider from '@/components/providers/ProjectProvider';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProjectProvider>
      <div className="flex h-screen overflow-hidden bg-rc-bg">
        {/* Sidebar - desktop only */}
        <Sidebar />

        {/* Main content area */}
        <div className="flex flex-col flex-1 min-w-0">
          <Topbar />

          <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 lg:p-8 pb-20 md:pb-6 lg:pb-8">
            <div className="mx-auto max-w-screen-2xl">
              <PageTransition>{children}</PageTransition>
            </div>
          </main>
        </div>

        {/* Mobile bottom nav */}
        <MobileNav />
      </div>
    </ProjectProvider>
  );
}
