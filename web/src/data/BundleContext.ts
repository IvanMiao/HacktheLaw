import { createContext } from 'react';
import type { CaseBundle, Fact, Qualification } from './bundle';
import type { Doc } from './documents';

export type BundleContextValue = {
  bundle: CaseBundle; docs: Doc[];
  docOf: (id: string) => Doc; factOf: (id: string) => Fact; qualOf: (id: string) => Qualification;
};

export const BundleContext = createContext<BundleContextValue | null>(null);
