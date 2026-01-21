import PropTypes from 'prop-types';

// material-ui
import { styled } from '@mui/material/styles';
import Box from '@mui/material/Box';

// project import
import { withAlpha } from 'utils/colorUtils';

// third party
import { BrowserView, MobileView } from 'react-device-detect';
import SimpleBar, { Props as SimpleBarProps } from 'simplebar-react';
import { MUIStyledCommonProps } from '@mui/system';

// root style
const RootStyle = styled(BrowserView)({
  flexGrow: 1,
  height: '100%',
  overflow: 'hidden'
});

// scroll bar wrapper
const SimpleBarStyle = styled(SimpleBar)(({ theme }: { theme: any }) => ({
  maxHeight: '100%',
  '& .simplebar-scrollbar': {
    '&:before': { backgroundColor: withAlpha((theme.vars || theme).palette.grey[500], 0.48) },
    '&.simplebar-visible:before': { opacity: 1 }
  },
  '& .simplebar-track.simplebar-vertical': { width: 10 },
  '& .simplebar-track.simplebar-horizontal .simplebar-scrollbar': { height: 6 },
  '& .simplebar-mask': { zIndex: 'inherit' }
}));

// ==============================|| SIMPLE SCROLL BAR  ||============================== //

interface SimpleBarScrollProps extends SimpleBarProps {
  children: React.ReactNode;
  sx?: any;
}

export default function SimpleBarScroll({ children, sx, ...other }: SimpleBarScrollProps) {
  return (
    <>
      <RootStyle>
        <SimpleBarStyle clickOnTrack={false} sx={sx} data-simplebar-direction={'ltr'} {...other}>
          {children}
        </SimpleBarStyle>
      </RootStyle>
      <MobileView>
        <Box sx={{ overflowX: 'auto', ...sx }} {...other}>
          {children}
        </Box>
      </MobileView>
    </>
  );
}

