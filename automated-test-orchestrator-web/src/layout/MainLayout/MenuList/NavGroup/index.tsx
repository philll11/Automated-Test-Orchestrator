import { Activity, useEffect, useState } from 'react';
import { matchPath, useLocation } from 'react-router-dom';

// material-ui
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import Typography from '@mui/material/Typography';

// project imports
import NavCollapse from '../NavCollapse';
import NavItem from '../NavItem';

import { useGetMenuMaster } from 'api/menu';
import { NavItem as NavItemModel } from 'menu-items/types';

// ==============================|| SIDEBAR MENU LIST GROUP ||============================== //

export interface NavGroupProps {
  item: NavItemModel;
  lastItem?: number;
  remItems?: any[]; // TODO: Define specific type if possible
  lastItemId?: string;
  setSelectedID?: (id?: string) => void;
}

export default function NavGroup({ item, lastItem, remItems = [], lastItemId, setSelectedID }: NavGroupProps) {
  const { pathname } = useLocation();

  const { menuMaster } = useGetMenuMaster();
  const drawerOpen = menuMaster.isDashboardDrawerOpened;

  const [anchorEl, setAnchorEl] = useState<null | Element>(null);
  const [currentItem, setCurrentItem] = useState(item);

  const openMini = Boolean(anchorEl);

  useEffect(() => {
    if (lastItem) {
      if (item.id === lastItemId) {
        const localItem = { ...item };
        const elements = remItems.map((ele: any) => ele.elements);
        localItem.children = elements.flat(1);
        setCurrentItem(localItem);
      } else {
        setCurrentItem(item);
      }
    }
  }, [item, lastItem, remItems, lastItemId]);

  const checkOpenForParent = (child: NavItemModel[], id: string) => {
    child.forEach((ele: NavItemModel) => {
      if (ele.children?.length) {
        checkOpenForParent(ele.children, currentItem.id);
      }
      if (ele?.url && !!matchPath({ path: ele?.link ? ele.link : ele.url!, end: true }, pathname)) {
        if (setSelectedID) setSelectedID(id);
      }
    });
  };

  const checkSelectedOnload = (data: NavItemModel) => {
    const childrens = data.children ? data.children : [];
    childrens.forEach((itemCheck: NavItemModel) => {
      if (itemCheck?.children?.length) {
        checkOpenForParent(itemCheck.children, currentItem.id);
      }
      if (itemCheck?.url && !!matchPath({ path: itemCheck?.link ? itemCheck.link : itemCheck.url!, end: true }, pathname)) {
        if (setSelectedID) setSelectedID(currentItem.id);
      }
    });

    if (data?.url && !!matchPath({ path: data?.link ? data.link : data.url!, end: true }, pathname)) {
      if (setSelectedID) setSelectedID(currentItem.id);
    }
  };


  // keep selected-menu on page load and use for horizontal menu close on change routes
  useEffect(() => {
    checkSelectedOnload(currentItem);
    if (openMini) setAnchorEl(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, currentItem]);

  // menu list collapse & items
  const items = currentItem.children?.map((menu) => {
    switch (menu?.type) {
      case 'collapse':
        return <NavCollapse key={menu.id} menu={menu} level={1} parentId={currentItem.id} />;
      case 'item':
        return <NavItem key={menu.id} item={menu} level={1} />;
      default:
        return (
          <Typography key={menu?.id} variant="h6" align="center" sx={{ color: 'error.main' }}>
            Menu Items Error
          </Typography>
        );
    }
  });

  return (
    <>
      <List
        disablePadding={!drawerOpen}
        subheader={
          currentItem.title &&
          drawerOpen && (
            <Typography
              variant="caption"
              gutterBottom
              sx={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: 'text.heading',
                padding: 0.75,
                textTransform: 'capitalize',
                marginTop: 1.25
              }}
            >
              {currentItem.title}
              {currentItem.caption && (
                <Typography
                  gutterBottom
                  sx={{
                    display: 'block',
                    fontSize: '0.6875rem',
                    fontWeight: 500,
                    color: 'text.secondary',
                    textTransform: 'capitalize',
                    lineHeight: 1.66
                  }}
                >
                  {currentItem.caption}
                </Typography>
              )}
            </Typography>
          )
        }
      >
        {items}
      </List>

      {/* group divider */}
      <Activity mode={drawerOpen ? 'visible' : 'hidden'}>
        <Divider sx={{ mt: 0.25, mb: 1.25 }} />
      </Activity>
    </>
  );
}
