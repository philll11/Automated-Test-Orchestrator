import { useEffect, useState, ReactNode, SyntheticEvent } from 'react';

// material-ui
import MuiAccordion from '@mui/material/Accordion';
import MuiAccordionDetails from '@mui/material/AccordionDetails';
import MuiAccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';

// assets
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

// ==============================|| ACCORDION ||============================== //

interface AccordionItem {
  id: string;
  title: ReactNode | string;
  content: ReactNode;
  disabled?: boolean;
  defaultExpand?: boolean;
  expanded?: boolean;
}

interface AccordionProps {
  data: AccordionItem[];
  defaultExpandedId?: string | boolean | null;
  expandIcon?: ReactNode;
  square?: boolean;
  toggle?: boolean;
}

export default function Accordion({ data, defaultExpandedId = null, expandIcon, square, toggle }: AccordionProps) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState<string | boolean | null>(null);
  const handleChange = (panel: string) => (event: SyntheticEvent, newExpanded: boolean) => {
    toggle && setExpanded(newExpanded ? panel : false);
  };

  useEffect(() => {
    setExpanded(defaultExpandedId);
  }, [defaultExpandedId]);

  return (
    <Box sx={{ width: '100%' }}>
      {data &&
        data.map((item) => (
          <MuiAccordion
            key={item.id}
            elevation={0}
            defaultExpanded={!item.disabled && item.defaultExpand}
            expanded={(!!(!toggle && !item.disabled && item.expanded)) || (toggle && expanded === item.id)}
            disabled={item.disabled}
            square={square}
            onChange={handleChange(item.id)}
          >
            <MuiAccordionSummary
              expandIcon={expandIcon || expandIcon === false ? expandIcon : <ExpandMoreIcon />}
              sx={{ color: theme.palette.mode === 'dark' ? 'grey.500' : 'grey.800', fontWeight: 500 }}
            >
              {item.title}
            </MuiAccordionSummary>
            <MuiAccordionDetails>{item.content}</MuiAccordionDetails>
          </MuiAccordion>
        ))}
    </Box>
  );
}
