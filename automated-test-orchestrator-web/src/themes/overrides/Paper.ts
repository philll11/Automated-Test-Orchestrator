// ==============================|| OVERRIDES - PAPER ||============================== //

export default function Paper(borderRadius: any) {
  return {
    MuiPaper: {
      defaultProps: {
        elevation: 0
      },
      styleOverrides: {
        root: {
          backgroundImage: 'none'
        },
        rounded: {
          borderRadius: `${borderRadius}px`
        }
      }
    }
  };
}
