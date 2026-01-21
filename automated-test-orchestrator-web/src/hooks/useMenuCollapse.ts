import { useEffect, Dispatch, SetStateAction } from 'react';
import { matchPath } from 'react-router-dom';
import { NavItem } from 'menu-items/types';

// ==============================|| MENU COLLAPSED - RECURSIVE FUNCTION ||============================== //

/**
 * Recursively traverses menu items to find and open the correct parent menu.
 * If a menu item matches the current pathname, it marks the corresponding menu as selected and opens it.
 *
 * @param {NavItem[]} items - List of menu items.
 * @param {string} pathname - Current route pathname.
 * @param {string | undefined} menuId - ID of the menu to be set as selected.
 * @param {Dispatch<SetStateAction<string | null>>} setSelected - Function to update the selected menu.
 * @param {Dispatch<SetStateAction<boolean>>} setOpen - Function to update the open state.
 */

function setParentOpenedMenu(
  items: NavItem[],
  pathname: string,
  menuId: string | undefined,
  setSelected: Dispatch<SetStateAction<string | null>>,
  setOpen: Dispatch<SetStateAction<boolean>>
) {
  for (const item of items) {
    // Recursively check child menus
    if (item.children?.length) {
      setParentOpenedMenu(item.children, pathname, menuId, setSelected, setOpen);
    }

    // Check if the current menu item matches the pathname
    if ((item.url && matchPath({ path: item.url, end: false }, pathname)) || item.url === pathname) {
      setSelected(menuId ?? null); // Select the parent menu
      setOpen(true); // Open the menu
    }
  }
}

// ==============================|| MENU COLLAPSED - HOOK ||============================== //

/**
 * Hook to handle menu collapse behavior based on the current route.
 * Automatically expands the parent menu of the active route item.
 *
 * @param {NavItem} menu - The menu object containing items.
 * @param {string} pathname - Current route pathname.
 * @param {boolean} miniMenuOpened - Flag indicating if the mini menu is open.
 * @param {Dispatch<SetStateAction<string | null>>} setSelected - Function to update selected menu state.
 * @param {Dispatch<SetStateAction<boolean>>} setOpen - Function to update menu open state.
 * @param {Dispatch<SetStateAction<HTMLElement | null>>} setAnchorEl - Function to update the anchor element state.
 */

export default function useMenuCollapse(
  menu: NavItem,
  pathname: string,
  miniMenuOpened: boolean,
  setSelected: Dispatch<SetStateAction<string | null>>,
  setOpen: Dispatch<SetStateAction<boolean>>,
  setAnchorEl: Dispatch<SetStateAction<HTMLElement | null>>
) {
  useEffect(() => {
    setOpen(false); // Close the menu initially
    !miniMenuOpened ? setSelected(null) : setAnchorEl(null); // Reset selection based on menu state

    // If menu has children, determine which should be opened
    if (menu.children?.length) {
      setParentOpenedMenu(menu.children, pathname, menu.id, setSelected, setOpen);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, menu.children]);
}
