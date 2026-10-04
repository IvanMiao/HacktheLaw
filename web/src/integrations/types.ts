import type { CaseBundle } from '../data/bundle.js';
import type { Analysis, AnalysisState } from '../engine/chains.js';
export type Review = { label:string; profileId:string; model:string; live:true; providerUsed:string; requestCount:1; notes:{text:string;documentIds:string[]}[] };
export type CaseExport = { version:'1'; bundle:CaseBundle; state:AnalysisState; analysis:Analysis; memoMarkdown:string; aiReview?:Review; reviewRequired:true };
