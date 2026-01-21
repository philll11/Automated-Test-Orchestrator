// assets
import { IconKey } from '@tabler/icons-react';
import { NavItem } from './types';

// constant
const icons = {
  IconKey
};

// ==============================|| EXTRA PAGES MENU ITEMS ||============================== //

const pages: NavItem = {
  id: 'pages',
  title: 'Pages',
  caption: 'Pages Caption',
  icon: icons.IconKey,
  type: 'group',
  children: [
    {
      id: 'authentication',
      title: 'Authentication',
      type: 'collapse',
      icon: icons.IconKey,
      children: [
        {
          id: 'login',
          title: 'Login',
          type: 'item',
          url: '/pages/login',
          target: '_blank'
        },
        {
          id: 'register',
          title: 'Register',
          type: 'item',
          url: '/pages/register',
          target: '_blank'
        }
      ]
    }
  ]
};

export default pages;
