// material-ui
import { styled } from '@mui/material/styles';
import MuiInputLabel, { InputLabelProps as MuiInputLabelProps } from '@mui/material/InputLabel';

interface CustomInputLabelProps extends MuiInputLabelProps {
  horizontal?: boolean;
}

const BInputLabel = styled(MuiInputLabel, {
  shouldForwardProp: (prop) => prop !== 'horizontal'
})<CustomInputLabelProps>(({ theme, horizontal }) => ({
  color: (theme as any).vars?.palette.text.primary || theme.palette.text.primary,
  fontWeight: 500,
  marginBottom: horizontal ? 0 : 8
}));

export default function InputLabel({ children, horizontal = false, ...others }: CustomInputLabelProps) {
  return (
    <BInputLabel horizontal={horizontal} {...others}>
      {children}
    </BInputLabel>
  );
}
