import { useMemo, type ReactNode } from 'react';
import { allDocs, docOf, factOf, qualOf, type CaseBundle } from './bundle';
import type { BundleContextValue } from './BundleContext';
import { BundleContext } from './BundleContext';

export function BundleProvider({ bundle, children }: { bundle: CaseBundle; children: ReactNode }) {
  const value = useMemo<BundleContextValue>(() => ({
    bundle,
    docs: allDocs(bundle),
    docOf: (id) => docOf(bundle, id),
    factOf: (id) => factOf(bundle, id),
    qualOf: (id) => qualOf(bundle, id),
  }), [bundle]);
  return <BundleContext.Provider value={value}>{children}</BundleContext.Provider>;
}
