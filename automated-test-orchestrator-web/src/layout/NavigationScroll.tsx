import { useEffect } from 'react';

interface NavigationScrollProps {
  children?: React.ReactNode;
}

export default function NavigationScroll({ children }: NavigationScrollProps) {
  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'smooth'
    });
  }, []);

  return <>{children || null}</>;
}
