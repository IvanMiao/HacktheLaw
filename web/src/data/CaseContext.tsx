import { createContext, useContext } from 'react';
import { ORIGINAL_CASE, type CaseDataset } from './catalog';
import pdf2003 from '../../../data/caselaw/Cour de cassation chambre mixte 14 fevrier 2003 - n00-19423.pdf?url';
import pdf2014 from '../../../data/caselaw/Cour de cassation chambre mixte 12 decembre 2014 - n13-19684.pdf?url';

export const browserDataset = (dataset: CaseDataset): CaseDataset => dataset.id === 'c1-c2'
  ? {...dataset,docs:dataset.docs.map(d => d.id === 'cass2003' ? {...d,pdf:pdf2003} : d.id === 'cass2014' ? {...d,pdf:pdf2014} : d)} : dataset;
export const CaseContext = createContext<CaseDataset>(browserDataset(ORIGINAL_CASE));
export const useCase = () => useContext(CaseContext);
