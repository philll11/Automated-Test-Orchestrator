import dashboard from './dashboard';
import pages from './pages';
import utilities from './utilities';
import other from './other';
import { MenuItem } from './types';

// ==============================|| MENU ITEMS ||============================== //

const menuItems: MenuItem = {
  items: [dashboard, pages, utilities, other]
};

export default menuItems;
