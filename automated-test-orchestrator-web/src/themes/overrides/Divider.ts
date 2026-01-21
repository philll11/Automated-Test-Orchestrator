// ==============================|| OVERRIDES - DIVIDER ||============================== //

export default function Divider(theme: any) {
  return {
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: theme.vars.palette.divider
        }
      }
    }
  };
}
