UPDATE menus
SET path='/projects/list',
    label='Projects List',
    parent_id='m_projects_root',
    sort_order=111,
    group_key='projects'
WHERE id='m_projects_list';

SELECT id, code, label, path, parent_id, sort_order, group_key
FROM menus
WHERE id IN ('m_projects_root','m_projects_list','m_projects_board','m_proj_archive_root','m_proj_finish_bulk','m_proj_archive_view')
ORDER BY sort_order ASC, id ASC;
