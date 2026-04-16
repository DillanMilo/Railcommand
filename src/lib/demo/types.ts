// Demo Account System Types

export interface DemoAccount {
  id: string;
  slug: string;
  company_name: string;
  description: string;
  organization_id: string | null;
  project_id: string | null;
  demo_user_id: string | null;
  is_active: boolean;
  is_team_demo: boolean;
  demo_password: string;
  created_at: string;
  expires_at: string | null;
  last_accessed_at: string | null;
  access_count: number;
}

export interface DemoTeamLogin {
  id: string;
  demo_account_id: string;
  profile_id: string;
  email: string;
  display_name: string;
  project_role: string;
  demo_password: string;
  created_at: string;
}

export interface DemoPreset {
  slug: string;
  companyName: string;
  description: string;
  isTeamDemo: boolean;
  /** Project template — name, location, budget, etc. */
  project: {
    name: string;
    description: string;
    location: string;
    client: string;
    budgetTotal: number;
    budgetSpent: number;
    startDate: string;
    targetEndDate: string;
  };
  /** Primary PM login (always created) */
  primaryUser: {
    fullName: string;
    email: string;
    password: string;
    orgRole: 'admin' | 'manager' | 'member' | 'viewer';
    projectRole: 'manager' | 'superintendent' | 'foreman' | 'engineer' | 'contractor' | 'inspector' | 'owner';
  };
  /** Additional logins for team demos */
  teamUsers?: {
    fullName: string;
    email: string;
    password: string;
    orgRole: 'admin' | 'manager' | 'member' | 'viewer';
    projectRole: 'manager' | 'superintendent' | 'foreman' | 'engineer' | 'contractor' | 'inspector' | 'owner';
  }[];
}

/** Preset configurations for built-in demos */
export const DEMO_PRESETS: Record<string, DemoPreset> = {
  team: {
    slug: 'team',
    companyName: 'A5 Rail — Team Demo',
    description: 'Internal team demo for Dillan, Caleb, and Mark to test real collaboration',
    isTeamDemo: true,
    project: {
      name: 'Englewood Yard Expansion — Phase 2',
      description: 'Track expansion including new classification yard, 3 sidings, signal upgrades, and grade crossing improvements. BNSF contract, FRA-regulated.',
      location: 'Englewood, CO',
      client: 'BNSF Railway',
      budgetTotal: 4200000,
      budgetSpent: 2856000,
      startDate: '2025-08-15',
      targetEndDate: '2026-06-30',
    },
    primaryUser: {
      fullName: 'Dillan Milosevich',
      email: 'dillan@creativecurrents.io',
      password: 'RailDemo2026!team',
      orgRole: 'admin',
      projectRole: 'manager',
    },
    teamUsers: [
      {
        fullName: 'Caleb Douglas',
        email: 'caleb@lenaserv.com',
        password: 'RailDemo2026!caleb',
        orgRole: 'admin',
        projectRole: 'manager',
      },
      {
        fullName: 'Mark Allen',
        email: 'mark.allen@a5rail.com',
        password: 'RailDemo2026!mark',
        orgRole: 'member',
        projectRole: 'owner',
      },
    ],
  },
  up: {
    slug: 'up',
    companyName: 'Union Pacific',
    description: 'Prospect demo for Union Pacific railroad',
    isTeamDemo: false,
    project: {
      name: 'Bailey Yard Modernization — Track & Signal',
      description: 'Comprehensive modernization of the world\'s largest classification yard. Includes track replacement on 12 classification tracks, new retarder installations, PTC signal upgrades, and centralized dispatching integration.',
      location: 'North Platte, NE',
      client: 'Union Pacific Railroad',
      budgetTotal: 18500000,
      budgetSpent: 12580000,
      startDate: '2025-06-01',
      targetEndDate: '2027-03-31',
    },
    primaryUser: {
      fullName: 'Demo Project Manager',
      email: 'up-demo@railcommand.app',
      password: 'RailDemo2026!up',
      orgRole: 'admin',
      projectRole: 'manager',
    },
  },
  tva: {
    slug: 'tva',
    companyName: 'Tennessee Valley Authority',
    description: 'Prospect demo for TVA infrastructure projects',
    isTeamDemo: false,
    project: {
      name: 'Bull Run Fossil Plant — Rail Access Rehabilitation',
      description: 'Complete rehabilitation of 8.2 miles of coal delivery rail line including bridge replacements, curve realignment, drainage improvements, and new CTC signal system.',
      location: 'Clinton, TN',
      client: 'Tennessee Valley Authority',
      budgetTotal: 9200000,
      budgetSpent: 5060000,
      startDate: '2025-09-15',
      targetEndDate: '2026-12-31',
    },
    primaryUser: {
      fullName: 'Demo Project Manager',
      email: 'tva-demo@railcommand.app',
      password: 'RailDemo2026!tva',
      orgRole: 'admin',
      projectRole: 'manager',
    },
  },
};
