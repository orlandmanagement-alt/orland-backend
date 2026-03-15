PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_organizations_owner_user_id
ON organizations(owner_user_id);

CREATE INDEX IF NOT EXISTS idx_organizations_status
ON organizations(status);

CREATE TABLE IF NOT EXISTS client_members (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_client_members_org_user_role
ON client_members(organization_id, user_id, role_name);

CREATE INDEX IF NOT EXISTS idx_client_members_user_id
ON client_members(user_id);

CREATE INDEX IF NOT EXISTS idx_client_members_organization_id
ON client_members(organization_id);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  project_type TEXT,
  location_text TEXT,
  description TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_projects_organization_id
ON projects(organization_id);

CREATE INDEX IF NOT EXISTS idx_projects_owner_user_id
ON projects(owner_user_id);

CREATE INDEX IF NOT EXISTS idx_projects_status
ON projects(status);

CREATE INDEX IF NOT EXISTS idx_projects_project_type
ON projects(project_type);

CREATE TABLE IF NOT EXISTS project_roles (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  gender_requirement TEXT,
  age_range TEXT,
  location_text TEXT,
  role_description TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_roles_project_id
ON project_roles(project_id);

CREATE INDEX IF NOT EXISTS idx_project_roles_status
ON project_roles(status);

CREATE TABLE IF NOT EXISTS project_applications (
  id TEXT PRIMARY KEY,
  project_role_id TEXT NOT NULL,
  talent_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted',
  message TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_project_applications_role_talent
ON project_applications(project_role_id, talent_user_id);

CREATE INDEX IF NOT EXISTS idx_project_applications_talent_user_id
ON project_applications(talent_user_id);

CREATE INDEX IF NOT EXISTS idx_project_applications_status
ON project_applications(status);

CREATE TABLE IF NOT EXISTS project_shortlists (
  id TEXT PRIMARY KEY,
  project_role_id TEXT NOT NULL,
  talent_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'shortlisted',
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_project_shortlists_role_talent
ON project_shortlists(project_role_id, talent_user_id);

CREATE INDEX IF NOT EXISTS idx_project_shortlists_talent_user_id
ON project_shortlists(talent_user_id);

CREATE INDEX IF NOT EXISTS idx_project_shortlists_status
ON project_shortlists(status);

CREATE TABLE IF NOT EXISTS project_invites (
  id TEXT PRIMARY KEY,
  project_role_id TEXT NOT NULL,
  talent_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  message TEXT,
  response_message TEXT,
  created_at INTEGER NOT NULL,
  responded_at INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_project_invites_role_talent
ON project_invites(project_role_id, talent_user_id);

CREATE INDEX IF NOT EXISTS idx_project_invites_talent_user_id
ON project_invites(talent_user_id);

CREATE INDEX IF NOT EXISTS idx_project_invites_status
ON project_invites(status);

CREATE TABLE IF NOT EXISTS project_bookings (
  id TEXT PRIMARY KEY,
  project_role_id TEXT NOT NULL,
  talent_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_project_bookings_role_talent
ON project_bookings(project_role_id, talent_user_id);

CREATE INDEX IF NOT EXISTS idx_project_bookings_talent_user_id
ON project_bookings(talent_user_id);

CREATE INDEX IF NOT EXISTS idx_project_bookings_status
ON project_bookings(status);

CREATE TABLE IF NOT EXISTS talent_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  display_name TEXT,
  public_slug TEXT,
  visibility_status TEXT DEFAULT 'private',
  visibility_reason TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_talent_profiles_user_id
ON talent_profiles(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_talent_profiles_public_slug
ON talent_profiles(public_slug);

CREATE INDEX IF NOT EXISTS idx_talent_profiles_visibility_status
ON talent_profiles(visibility_status);

CREATE TABLE IF NOT EXISTS talent_profile_basic (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  gender TEXT,
  dob TEXT,
  location TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_talent_profile_basic_user_id
ON talent_profile_basic(user_id);

CREATE TABLE IF NOT EXISTS talent_contact_public (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  website TEXT,
  contact_visibility TEXT DEFAULT 'private',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_talent_contact_public_user_id
ON talent_contact_public(user_id);

CREATE INDEX IF NOT EXISTS idx_talent_contact_public_visibility
ON talent_contact_public(contact_visibility);

CREATE TABLE IF NOT EXISTS talent_interests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  interest_name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_talent_interests_user_interest
ON talent_interests(user_id, interest_name);

CREATE INDEX IF NOT EXISTS idx_talent_interests_user_id
ON talent_interests(user_id);

CREATE TABLE IF NOT EXISTS talent_skills (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  skill_name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_talent_skills_user_skill
ON talent_skills(user_id, skill_name);

CREATE INDEX IF NOT EXISTS idx_talent_skills_user_id
ON talent_skills(user_id);

CREATE TABLE IF NOT EXISTS talent_appearance (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  height_cm INTEGER,
  weight_kg INTEGER,
  eye_color TEXT,
  hair_color TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_talent_appearance_user_id
ON talent_appearance(user_id);

CREATE TABLE IF NOT EXISTS talent_social_links (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_talent_social_links_user_platform
ON talent_social_links(user_id, platform);

CREATE INDEX IF NOT EXISTS idx_talent_social_links_user_id
ON talent_social_links(user_id);

CREATE TABLE IF NOT EXISTS talent_progress (
  user_id TEXT PRIMARY KEY,
  completion_percent INTEGER NOT NULL DEFAULT 0,
  visibility_status TEXT DEFAULT 'private',
  visibility_reason TEXT,
  phone_verified INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_talent_progress_visibility_status
ON talent_progress(visibility_status);
