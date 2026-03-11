UPDATE menus
SET code = 'menus',
    label = 'Menu Builder',
    path = '/menus'
WHERE id = 'm_core_menus';

UPDATE menus
SET code = 'menus_main',
    label = 'Main Menu (Legacy)',
    path = '/menu-builder'
WHERE id = 'm_cfg_menubuilder'
  AND id <> 'm_core_menus';
