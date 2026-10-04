import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { isFirmImport } from '../integrations/provenance';
import { FactDetail } from './Facts';
import { SAMPLE } from '../data/sample';
import { BundleProvider } from '../data/BundleProvider';
import { LocaleProvider } from '../i18n/LocaleProvider';
import { analyse, initialState } from '../engine/chains';
const bundle={...SAMPLE,id:'firm-import',trace:[{at:0,stage:'ingest' as const,kind:'note' as const,text:'Imported source annotations; quote verification is not legal confirmation.'}]};
describe('firm source provenance',()=>{
 it('distinguishes source imports from recorded/live model output',()=>{expect(isFirmImport(bundle)).toBe(true);expect(isFirmImport(SAMPLE)).toBe(false);});
 it('does not describe an imported proposal as an actual AI extraction',()=>{vi.stubGlobal('location',{search:'?lang=en'});vi.stubGlobal('localStorage',{getItem:()=>null});const state=initialState(bundle);const html=renderToStaticMarkup(<LocaleProvider><BundleProvider bundle={bundle}><FactDetail fact={bundle.facts[2]} state={state} analysis={analyse(bundle,state)} onDecide={()=>{}} onAnchor={()=>{}} onOpenLink={()=>{}} onAdopt={()=>{}} onSaveReview={()=>{}} /></BundleProvider></LocaleProvider>);expect(html).toContain('Imported proposal');expect(html).toContain('Quote matched · not legal confirmation');expect(html).not.toContain('AI-inferred</span>');vi.unstubAllGlobals();});
});
