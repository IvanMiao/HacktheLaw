import { useContext } from 'react';
import { BundleContext } from './BundleContext';

export function useBundle() {
  const context = useContext(BundleContext);
  if (!context) throw new Error('BundleProvider is required');
  return context;
}
