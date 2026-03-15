SELECT 'users' AS table_name, EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='users') AS exists_flag
UNION ALL
SELECT 'roles', EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='roles')
UNION ALL
SELECT 'user_roles', EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='user_roles')
UNION ALL
SELECT 'sessions', EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='sessions')
UNION ALL
SELECT 'projects', EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='projects')
UNION ALL
SELECT 'project_roles', EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='project_roles')
UNION ALL
SELECT 'project_applications', EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='project_applications')
UNION ALL
SELECT 'project_shortlists', EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='project_shortlists')
UNION ALL
SELECT 'project_invites', EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='project_invites')
UNION ALL
SELECT 'project_bookings', EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='project_bookings')
UNION ALL
SELECT 'talent_profiles', EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='talent_profiles')
UNION ALL
SELECT 'talent_profile_basic', EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='talent_profile_basic')
UNION ALL
SELECT 'talent_contact_public', EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='talent_contact_public')
UNION ALL
SELECT 'talent_interests', EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='talent_interests')
UNION ALL
SELECT 'talent_skills', EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='talent_skills')
UNION ALL
SELECT 'talent_appearance', EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='talent_appearance')
UNION ALL
SELECT 'talent_social_links', EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='talent_social_links')
UNION ALL
SELECT 'talent_progress', EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='talent_progress')
UNION ALL
SELECT 'sso_login_challenges', EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='sso_login_challenges')
UNION ALL
SELECT 'sso_step_up_challenges', EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='sso_step_up_challenges')
UNION ALL
SELECT 'sso_trusted_devices', EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='sso_trusted_devices')
UNION ALL
SELECT 'sso_login_events', EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='sso_login_events')
UNION ALL
SELECT 'sso_redirect_audit', EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='sso_redirect_audit');
