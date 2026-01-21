// ==============================|| OVERRIDES - LIST ITEM ICON ||============================== //

export default function ListItemIcon(theme: any) {
  return {
    MuiListItemIcon: {
      styleOverrides: {
        root: {
          color: theme.vars.palette.text.primary,
          minWidth: '36px'
        }
      }
    }
  };
}
