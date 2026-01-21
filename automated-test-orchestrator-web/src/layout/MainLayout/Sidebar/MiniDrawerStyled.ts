// material-ui
import { styled, Theme, CSSObject } from '@mui/material/styles';
import Drawer from '@mui/material/Drawer';

// project imports
import { drawerWidth } from 'store/constant';

function openedMixin(theme: Theme): CSSObject {
  return {
    width: drawerWidth,
    borderRight: 'none',
    zIndex: 1099,
    background: (theme.vars || theme).palette.background.default,
    overflowX: 'hidden',
    boxShadow: 'none',
    transition: theme.transitions.create('width', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen + 200
    })
  };
}

function closedMixin(theme: Theme): CSSObject {
  return {
    borderRight: 'none',
    zIndex: 1099,
    background: (theme.vars || theme).palette.background.default,
    overflowX: 'hidden',
    width: 72,
    transition: theme.transitions.create('width', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen + 200
    })
  };
}

// ==============================|| DRAWER - MINI STYLED ||============================== //

const MiniDrawerStyled = styled(Drawer, { shouldForwardProp: (prop) => prop !== 'open' })<{ open?: boolean }>(({ theme, open }) => ({
  width: drawerWidth,
  borderRight: '0px',
  flexShrink: 0,
  whiteSpace: 'nowrap',
  boxSizing: 'border-box',
  ...(open && {
    ...openedMixin(theme as any),
    '& .MuiDrawer-paper': openedMixin(theme as any)
  }),
  ...(!open && {
    ...closedMixin(theme as any),
    '& .MuiDrawer-paper': closedMixin(theme as any)
  })
}));

export default MiniDrawerStyled;
