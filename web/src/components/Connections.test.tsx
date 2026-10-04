import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Connections } from './Connections';
import { LocaleProvider } from '../i18n/LocaleProvider';
describe('Connections UI',()=>{
 it.each(['en','fr'])('offers source/provider/analysis/export controls in %s without secrets or raw result dumps',lang=>{
  vi.stubGlobal('location',{search:`?lang=${lang}`});vi.stubGlobal('localStorage',{getItem:()=>null});
  const html=renderToStaticMarkup(<LocaleProvider><Connections onClose={()=>{}} onView={()=>{}} /></LocaleProvider>);
  for(const term of lang==='en'?['Connections','Synthetic SQLite demo bridge','Text AI API','Import matter','Run deterministic analysis','Export result','Developer API']:['Connexions','Passerelle SQLite synthétique','API IA texte','Importer le dossier','Analyser avec le moteur déterministe','Exporter le résultat','API développeur'])expect(html).toContain(term);
  expect(html).toContain('role="dialog"');expect(html).not.toContain('MISTRAL_API_KEY');expect(html).not.toContain('type="password"');expect(html).not.toContain('<pre');vi.unstubAllGlobals();
 });
});
