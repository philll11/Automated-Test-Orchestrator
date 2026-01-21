// ==============================|| OVERRIDES - LIST ITEM TEXT ||============================== //

export default function ListItemText(theme: any) {
  return {
    MuiListItemText: {
      styleOverrides: {
        primary: {
          color: theme.vars.palette.text.dark
        }
      }
    }
  };
}
