
// import { TablerIconsProps } from '@tabler/icons-react';

export type LinkTarget = '_blank' | '_self' | '_parent' | '_top';

export type NavItemType = 'group' | 'item' | 'collapse';

export interface NavItem {
  id: string;
  title?: string;
  caption?: string;
  type: NavItemType;
  url?: string;
  link?: string; // Add link property as seen in usage
  icon?: any;
  breadcrumbs?: boolean;
  target?: LinkTarget;
  children?: NavItem[];
  external?: boolean;
  disabled?: boolean;
  chip?: {
    color: 'primary' | 'secondary' | 'default' | 'error' | 'info' | 'success' | 'warning';
    variant: 'filled' | 'outlined';
    size: 'small' | 'medium';
    label: string;
    avatar?: string;
  };
}

export interface MenuItem {
    items: NavItem[];
}
