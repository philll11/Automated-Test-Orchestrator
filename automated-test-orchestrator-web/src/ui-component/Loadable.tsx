import { Suspense, ComponentType, FC, ComponentProps } from 'react';

// project imports
import Loader from './Loader';

// ==============================|| LOADABLE - LAZY LOADING ||============================== //

export default function Loadable<P extends object>(Component: ComponentType<P>): FC<P> {
  const WrappedComponent = (props: P) => (
    <Suspense fallback={<Loader />}>
      <Component {...props} />
    </Suspense>
  );

  return WrappedComponent;
}
