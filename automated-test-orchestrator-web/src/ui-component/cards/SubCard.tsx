import PropTypes from 'prop-types';
import { ReactNode } from 'react';

// material-ui
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import { SxProps, Theme } from '@mui/material/styles';

// ==============================|| CUSTOM SUB CARD ||============================== //

export interface SubCardProps {
  children?: ReactNode;
  className?: string;
  content?: boolean;
  contentClass?: string;
  darkTitle?: boolean;
  secondary?: ReactNode;
  sx?: SxProps<Theme>;
  contentSX?: SxProps<Theme>;
  footerSX?: SxProps<Theme>;
  title?: ReactNode;
  actions?: ReactNode;
  [key: string]: any;
}

export default function SubCard({
  children,
  className,
  content = true,
  contentClass,
  darkTitle,
  secondary,
  sx = {},
  contentSX = {},
  footerSX = {},
  title,
  actions,
  ...others
}: SubCardProps) {
  const defaultShadow = '0 2px 14px 0 rgb(32 40 45 / 8%)';

  return (
    <Card
      sx={(theme) => ({
        border: '1px solid',
        borderColor: 'divider',
        ':hover': { boxShadow: defaultShadow },
        ...(typeof sx === 'function' ? sx(theme) : sx || {})
      })}
      {...others}
    >
      {/* card header and action */}
      {!darkTitle && title && <CardHeader sx={{ p: 2.5 }} title={<Typography variant="h5">{title}</Typography>} action={secondary} />}
      {darkTitle && title && <CardHeader sx={{ p: 2.5 }} title={<Typography variant="h4">{title}</Typography>} action={secondary} />}

      {/* content & header divider */}
      {title && <Divider />}

      {/* card content */}
      {content && (
        <CardContent sx={{ p: 2.5, ...contentSX }} className={contentClass || ''}>
          {children}
        </CardContent>
      )}
      {!content && children}

      {/* actions & footer divider */}
      {actions && <Divider />}

      {actions && <CardActions sx={{ p: 2.5, ...footerSX }}>{actions}</CardActions>}
    </Card>
  );
}

SubCard.propTypes = {
  children: PropTypes.oneOfType([PropTypes.string, PropTypes.node, PropTypes.any]),
  className: PropTypes.string,
  content: PropTypes.bool,
  contentClass: PropTypes.string,
  darkTitle: PropTypes.bool,
  secondary: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  sx: PropTypes.object,
  contentSX: PropTypes.object,
  footerSX: PropTypes.object,
  title: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  actions: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  others: PropTypes.any
} as any;
