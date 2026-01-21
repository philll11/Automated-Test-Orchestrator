// material-ui
import { styled } from '@mui/material/styles';

// ==============================|| AUTHENTICATION 1 WRAPPER ||============================== //

const AuthWrapper1 = styled('div')(({ theme }: { theme: any }) => ({
  backgroundColor: (theme.vars || theme).palette.grey[100],
  minHeight: '100vh'
}));

export default AuthWrapper1;
