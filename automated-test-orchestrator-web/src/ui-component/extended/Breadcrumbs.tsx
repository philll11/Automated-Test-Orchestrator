import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

// material-ui
import { useTheme } from '@mui/material/styles';
import Card from '@mui/material/Card';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import MuiBreadcrumbs from '@mui/material/Breadcrumbs';
import Box from '@mui/material/Box';

// project imports
import navigation from 'menu-items';
import { NavItem as NavItemModel } from 'menu-items/types';

// assets
import { IconChevronRight, IconTallymark1 } from '@tabler/icons-react';
import AccountTreeTwoToneIcon from '@mui/icons-material/AccountTreeTwoTone';
import HomeIcon from '@mui/icons-material/Home';
import HomeTwoToneIcon from '@mui/icons-material/HomeTwoTone';

// ==============================|| BREADCRUMBS TITLE ||============================== //

function BTitle({ title }: { title: string }) {
  return (
    <Grid>
      <Typography variant="h4" sx={{ fontWeight: 500 }}>
        {title}
      </Typography>
    </Grid>
  );
}

interface BreadcrumbLink {
  to?: string;
  icon?: React.ElementType;
  title: string;
}

interface BreadcrumbsProps {
  card?: boolean;
  custom?: boolean;
  divider?: boolean;
  heading?: string;
  icon?: boolean;
  icons?: boolean;
  links?: BreadcrumbLink[];
  maxItems?: number;
  rightAlign?: boolean;
  separator?: React.ElementType | React.ReactNode;
  title?: boolean;
  titleBottom?: boolean;
  sx?: any;
  [key: string]: any;
}

export default function Breadcrumbs({
  card,
  custom = false,
  divider = false,
  heading,
  icon = true,
  icons,
  links,
  maxItems,
  rightAlign = true,
  separator = IconChevronRight,
  title = true,
  titleBottom,
  sx,
  ...others
}: BreadcrumbsProps) {
  const theme = useTheme();
  const location = useLocation();
  const [main, setMain] = useState<NavItemModel>();
  const [item, setItem] = useState<NavItemModel>();

  const iconSX = {
    marginRight: 6,
    marginTop: -2,
    width: '1rem',
    height: '1rem',
    color: (theme.vars || theme).palette.secondary.main
  };

  const linkSX = {
    display: 'flex',
    textDecoration: 'none',
    alignContent: 'center',
    alignItems: 'center'
  };

  let customLocation = location.pathname;

  useEffect(() => {
    navigation?.items?.map((menu: NavItemModel) => {
      if (menu.type && menu.type === 'group') {
        if (menu?.url && menu.url === customLocation) {
          setMain(menu);
          setItem(menu);
        } else {
          getCollapse(menu);
        }
      }
      return false;
    });
  });

  // set active item state
  const getCollapse = (menu: NavItemModel) => {
    if (!custom && menu.children) {
      menu.children.filter((collapse: NavItemModel) => {
        if (collapse.type && collapse.type === 'collapse') {
          getCollapse(collapse);
          if (collapse.url === customLocation) {
            setMain(collapse);
            setItem(collapse);
          }
        } else if (collapse.type && collapse.type === 'item') {
          if (customLocation === collapse.url) {
            setMain(menu);
            setItem(collapse);
          }
        }
        return false;
      });
    }
  };

  // item separator
  const SeparatorIcon = separator as React.ElementType;
  const separatorIcon = separator ? <SeparatorIcon stroke={1.5} size="16px" /> : <IconTallymark1 stroke={1.5} size="16px" />;

  let mainContent;
  let itemContent;
  let breadcrumbContent = <Typography />;
  let itemTitle = '';
  let CollapseIcon;
  let ItemIcon;

  // collapse item
  if (main && main.type === 'collapse') {
    CollapseIcon = main.icon ? main.icon : AccountTreeTwoToneIcon;
    mainContent = (
      <Typography
        {...(main.url && { component: Link, to: main.url })}
        variant="h6"
        noWrap
        sx={{
          overflow: 'hidden',
          lineHeight: 1.5,
          mb: -0.625,
          textOverflow: 'ellipsis',
          maxWidth: { xs: 102, sm: 'unset' },
          display: 'inline-block'
        }}
        color={window.location.pathname === main.url ? 'text.primary' : 'text.secondary'}
      >
        {icons && <CollapseIcon style={{ ...iconSX }} />}
        {main.title}
      </Typography>
    );
  }

  if (!custom && main && main.type === 'collapse' && main.breadcrumbs === true) {
    breadcrumbContent = (
      <Card sx={card === false ? { mb: 3, bgcolor: 'transparent', ...sx } : { mb: 3, bgcolor: 'background.default', ...sx }} {...others}>
        <Box sx={{ p: 1.25, px: card === false ? 0 : 2 }}>
          <Grid
            container
            direction={rightAlign ? 'row' : 'column'}
            sx={{ justifyContent: rightAlign ? 'space-between' : 'flex-start', alignItems: rightAlign ? 'center' : 'flex-start' }}
            spacing={1}
          >
            {title && !titleBottom && <BTitle title={main.title || ''} />}
            <Grid>
              <MuiBreadcrumbs
                aria-label="breadcrumb"
                maxItems={maxItems || 8}
                separator={separatorIcon}
                sx={{ '& .MuiBreadcrumbs-separator': { width: 16, ml: 1.25, mr: 1.25 } }}
              >
                <Typography component={Link} to="/" variant="h6" sx={{ ...linkSX, color: 'text.secondary' }}>
                  {icons && <HomeTwoToneIcon style={iconSX} />}
                  {icon && !icons && <HomeIcon style={{ ...iconSX, marginRight: 0 }} />}
                  {(!icon || icons) && 'Dashboard'}
                </Typography>
                {mainContent}
              </MuiBreadcrumbs>
            </Grid>
            {title && titleBottom && <BTitle title={main.title || ''} />}
          </Grid>
        </Box>
        {card === false && divider !== false && <Divider sx={{ mt: 2 }} />}
      </Card>
    );
  }

  // items
  if ((item && item.type === 'item') || (item?.type === 'group' && item?.url) || custom) {
    itemTitle = item?.title || '';

    ItemIcon = item?.icon ? item.icon : AccountTreeTwoToneIcon;
    itemContent = (
      <Typography
        variant="h6"
        noWrap
        sx={{
          ...linkSX,
          color: 'text.secondary',
          display: 'inline-block',
          overflow: 'hidden',
          lineHeight: 1.5,
          mb: -0.625,
          textOverflow: 'ellipsis',
          maxWidth: { xs: 102, sm: 'unset' }
        }}
      >
        {icons && <ItemIcon style={{ ...iconSX }} />}
        {itemTitle}
      </Typography>
    );

    let tempContent = (
      <MuiBreadcrumbs
        aria-label="breadcrumb"
        maxItems={maxItems || 8}
        separator={separatorIcon}
        sx={{ '& .MuiBreadcrumbs-separator': { width: 16, mx: 0.75 } }}
      >
        <Typography component={Link} to="/" variant="h6" sx={{ ...linkSX, color: 'text.secondary' }}>
          {icons && <HomeTwoToneIcon style={{ ...iconSX }} />}
          {icon && !icons && <HomeIcon style={{ ...iconSX, marginRight: 0 }} />}
          {(!icon || icons) && 'Dashboard'}
        </Typography>
        {mainContent}
        {itemContent}
      </MuiBreadcrumbs>
    );

    if (custom && links && links?.length > 0) {
      tempContent = (
        <MuiBreadcrumbs
          aria-label="breadcrumb"
          maxItems={maxItems || 8}
          separator={separatorIcon}
          sx={{ '& .MuiBreadcrumbs-separator': { width: 16, ml: 1.25, mr: 1.25 } }}
        >
          {links?.map((link, index) => {
            CollapseIcon = link.icon ? link.icon : AccountTreeTwoToneIcon;

            return (
              <Typography
                key={index}
                {...(link.to && { component: Link, to: link.to })}
                variant="h6"
                sx={{ ...linkSX, color: 'text.secondary' }}
              >
                {link.icon && <CollapseIcon style={iconSX} />}
                {link.title}
              </Typography>
            );
          })}
        </MuiBreadcrumbs>
      );
    }

    // main
    if (item?.breadcrumbs !== false || custom) {
      breadcrumbContent = (
        <Card
          sx={
            card === false
              ? { mb: 3, bgcolor: 'transparent', ...sx }
              : {
                  mb: 3,
                  bgcolor: 'background.default',
                  ...sx
                }
          }
          {...others}
        >
          <Box sx={{ p: 1.25, px: card === false ? 0 : 2 }}>
            <Grid
              container
              direction={rightAlign ? 'row' : 'column'}
              sx={{ justifyContent: rightAlign ? 'space-between' : 'flex-start', alignItems: rightAlign ? 'center' : 'flex-start' }}
              spacing={1}
            >
              {title && !titleBottom && <BTitle title={custom ? (heading || '') : (item?.title || '')} />}
              <Grid>{tempContent}</Grid>
              {title && titleBottom && <BTitle title={custom ? (heading || '') : (item?.title || '')} />}
            </Grid>
          </Box>
          {card === false && divider !== false && <Divider sx={{ mt: 2 }} />}
        </Card>
      );
    }
  }

  return breadcrumbContent;
}


