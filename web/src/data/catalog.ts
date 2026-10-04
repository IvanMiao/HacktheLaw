import { CASE, FACTS, QUALIFICATIONS, type Fact, type Qualification } from './case.ts';
import { DOCS, type Doc } from './documents.ts';

export type CaseId = 'c1-c2' | 'c3' | 'c4' | 'c5';
export type CaseDataset = {
  id: CaseId;
  meta: { title: string; court: string; side: string; amount: string; relationship: string; asOf: string; nextHearing?: string };
  facts: Fact[]; qualifications: Qualification[]; docs: Doc[];
};
export const ORIGINAL_CASE: CaseDataset = {id:'c1-c2', meta:CASE, facts:FACTS, qualifications:QUALIFICATIONS, docs:DOCS};

// Each embedded exhibit is authored synthetic evidence, never an official retrieved document.
function exhibit(id: string, title: string, date: string | undefined, text: string, group: Doc['group'] = 'case'): Doc {
  return {id, title, short:title, date, group, provenance:'mock', format:'text',
    note:group === 'case' ? 'SYNTHETIC — fictional demo evidence.' : 'SYNTHETIC rule summary — not official legal text; lawyer review required.',
    text:`SYNTHETIC — DOCUMENT FICTIF POUR DÉMONSTRATION\n${title}\n${date ?? ''}\n\n${text}`};
}
function fact(id: string, date: string, doc: string, kind: string, summary: string, quote: string, qualification?: string): Fact {
  return {id, date, doc, kind, summary, anchors:[{doc, quote}], qualification};
}
function qual(id: string, factId: string, proposed: boolean, question: string, yes: string, no: string, rule: string, reasoning: string, whatIfLabel: string, source: Qualification['source'] = 'rule', confidence: Qualification['confidence'] = 'high'): Qualification {
  return {id, factId, proposed, question, yes, no, rule, reasoning, whatIfLabel, source, confidence};
}
const C3: CaseDataset = {
  id:'c3', meta:{title:'Créations Verrières SAS v. Fonderie Ardennaise SARL', court:'Tribunal de commerce de Charleville-Mézières', side:'Defendant (Fonderie Ardennaise SARL)', amount:'42 600 €', relationship:'Between merchants — collective proceedings', asOf:'2026-10-04'},
  docs:[
    exhibit('c3-contract','Contrat de fourniture','2019-03-12','Créations Verrières SAS fournit des pièces à Fonderie Ardennaise SARL. Les deux parties contractent en qualité de commerçants.'),
    exhibit('c3-invoice','Facture F-2024-211','2024-09-05',"Créations Verrières SAS → Fonderie Ardennaise SARL\nMontant : 42 600 €\nDate d'échéance : 05/09/2024"),
    exhibit('c3-judgment',"Jugement d'ouverture",'2025-11-10','Tribunal de commerce de Charleville-Mézières\nOuvre une procédure de redressement judiciaire à l’égard de Fonderie Ardennaise SARL.'),
    exhibit('c3-bodacc','Avis BODACC fictif','2025-11-20','Jugement du 10 novembre 2025 publié le 20 novembre 2025. Mandataire judiciaire désigné. Aucune sûreté ni contrat publié ou extension géographique ne sont supposés dans cette fixture.'),
    exhibit('c3-list','Liste des créanciers','2025-11-25','Créations Verrières SAS — 42 600 €\nAuteur de la fixture : cette liste identifie la créance mais ne constitue pas, dans les faits synthétiques retenus, une déclaration régulière réputée faite pour le créancier. La portée de L622-24 doit être vérifiée par un avocat.'),
    exhibit('c3-register','Attestation du mandataire','2026-01-20','Aucune déclaration reçue au 20 janvier 2026 pour Créations Verrières SAS. Auteur de la fixture : aucune déclaration régulière, directe ou réputée faite par le débiteur, n’est retenue; il ne s’agit pas d’une déduction à partir d’une pièce manquante.'),
    exhibit('c3-writ','Assignation en paiement','2026-02-02','Créations Verrières SAS demande le paiement de la facture F-2024-211 devant le Tribunal de commerce de Charleville-Mézières.'),
    exhibit('c3-email','Courriel du conseil','2026-02-18','Nous avons appris la procédure collective après réception de la réponse à notre assignation. Aucune impossibilité de connaître l’existence de notre créance n’est décrite.'),
    exhibit('c3-relief','État des demandes de relevé','2026-10-04','Auteur de la fixture : aucune demande de relevé de forclusion ni ordonnance accordant un relevé n’a été déposée ou rendue au 4 octobre 2026.'),
    exhibit('c3-rules','C. com. — references and review',undefined,'L622-21 / L631-14 : arrêt ou interdiction des actions individuelles en paiement de créances antérieures.\nL622-24 / R622-24 : déclaration, délai ordinaire de deux mois depuis la publication BODACC.\nL622-26 : exclusion des répartitions sauf relevé judiciaire, inopposabilité sous les conditions légales du plan, non-extinction. Délai ordinaire de six mois; report exceptionnel fondé sur l’impossibilité de connaître l’obligation du débiteur, non sur la seule ignorance de la procédure. Résumé pédagogique, pas un extrait officiel.','statute'),
  ],
  facts:[
    fact('g0','2019-03-12','c3-contract','Contract','Supply contract between merchants','Les deux parties contractent en qualité de commerçants.'),
    fact('g1','2024-09-05','c3-invoice','Invoice','Invoice F-2024-211 (€42,600) — pre-existing debt',"Date d'échéance : 05/09/2024"),
    fact('g2','2025-11-10','c3-judgment','Court order','Opening judgment — redressement judiciaire','Ouvre une procédure de redressement judiciaire'),
    fact('g3','2025-11-20','c3-bodacc','Registry','BODACC publication starts declaration period','publié le 20 novembre 2025'),
    fact('g4','2025-11-25','c3-list','Exhibits','Creditor included in debtor list','Créations Verrières SAS — 42 600 €','q-listed'),
    fact('g5','2026-01-20','c3-register','Registry','Fixture confirms no regular declaration by deadline','Aucune déclaration reçue au 20 janvier 2026','q-declared'),
    fact('g6','2026-02-02','c3-writ','Writ','New post-opening payment action','paiement de la facture F-2024-211'),
    fact('g7','2026-02-18','c3-email','Email','Counsel asserts late knowledge of proceedings','Nous avons appris la procédure collective','q-knowledge'),
    fact('g8','2026-10-04','c3-relief','Registry','Fixture confirms no relief application or order','aucune demande de relevé de forclusion ni ordonnance'),
  ],
  qualifications:[
    qual('q-listed','g4',false,'Was the creditor omitted from the debtor list?','Omitted — possible relief ground','Listed — no omission shown','L622-6 / L622-26 C. com.','The synthetic list names the creditor. Omission is a possible judicial relief ground, not an automatic waiver.','The creditor was omitted from the list'),
    qual('q-declared','g5',false,'Was a regular claim declaration filed in time?','Declared in time','No regular declaration in time','L622-24 / R622-24 C. com.','The authored fixture expressly excludes direct or deemed regular declaration by 20 January 2026. List effects under L622-24 require review.','A regular declaration was filed in time'),
    qual('q-knowledge','g7',false,'Was the creditor unable to know the existence of the debt?','Possible exceptional relief timing — court review','No debt-knowledge impossibility established','L622-26 C. com.','Ignorance of insolvency is not inability to know the existence of the debt. The email alone proves neither a statutory exception nor judicial relief.','Hypothetical proof of inability to know the existence of the debt','ai_inferred','medium'),
  ],
};
const C4: CaseDataset = {
  id:'c4', meta:{title:'M. Antoine Rigal v. MobiPlus Distribution SAS', court:'Tribunal judiciaire de Paris', side:'Defendant (M. Antoine Rigal, consumer)', amount:'Jurisdiction dispute', relationship:'B2C — consumer contract', asOf:'2026-10-04'},
  docs:[
    exhibit('c4-cgv','CGV — article 22','2025-01-01',"Tout litige relatif à l'exécution des présentes sera porté devant les tribunaux de Paris."),
    exhibit('c4-order','Confirmation de commande','2025-09-02','M. Antoine Rigal, consommateur, domicile : 14 rue de la Fosse, Nantes.'),
    exhibit('c4-writ','Assignation — MobiPlus c/ Rigal','2025-12-05','MobiPlus Distribution SAS assigne M. Rigal devant le Tribunal judiciaire de Paris pour paiement du solde du prix.'),
    exhibit('c4-first','Premières conclusions Rigal','2026-01-15','M. Rigal conteste le bien-fondé de la demande : les marchandises étaient défectueuses et valablement rejetées. Auteur de la fixture : défense au fond, sans exception d’incompétence dans ces premières conclusions.'),
    exhibit('c4-second','Secondes conclusions Rigal','2026-03-01',"Soulève pour la première fois une exception d'incompétence territoriale et désigne le Tribunal judiciaire de Nantes comme juridiction demandée."),
    exhibit('c4-reply','Réplique MobiPlus','2026-04-10','MobiPlus invoque l’article 74 CPC : la défense au fond du 15 janvier précède l’exception du 1er mars.'),
    exhibit('c4-management','Ordonnance de mise en état','2026-04-20','La chronologie des conclusions est non contestée : l’exception figure dans les secondes conclusions. La présente fixture ne constate aucune décision de transfert.'),
    exhibit('c4-rules','CPC / C. conso. — references and review',undefined,'CPC 48 : clause territoriale réputée non écrite sauf parties toutes commerçantes et mention très apparente.\nCPC 74 : exceptions simultanées avant toute défense au fond ou fin de non-recevoir, même pour un fondement d’ordre public. CPC 75 : motivation et désignation de la juridiction demandée.\nCPC 77 : pouvoirs territoriaux d’office limités. R632-1 C. conso. : contrôle d’office distinct, contradictoire; pas de transfert automatique. R631-3 vise le choix de saisine du consommateur demandeur, pas un transfert garanti pour le défendeur.','statute'),
  ],
  facts:[
    fact('h1','2025-01-01','c4-cgv','Contract','Consumer CGV designate Paris courts','sera porté devant les tribunaux de Paris','q-clause-void'),
    fact('h2','2025-09-02','c4-order','Order confirmation','Consumer domiciled in Nantes','14 rue de la Fosse, Nantes'),
    fact('h3','2025-12-05','c4-writ','Writ','Retailer sues consumer in Paris','Tribunal judiciaire de Paris'),
    fact('h4','2026-01-15','c4-first','Submissions','First submissions defend the merits without jurisdiction objection','conteste le bien-fondé de la demande','q-merits-first'),
    fact('h5','2026-03-01','c4-second','Submissions','Second submissions object to jurisdiction and name Nantes',"exception d'incompétence territoriale"),
    fact('h6','2026-04-10','c4-reply','Submissions','Retailer invokes CPC 74 sequencing','la défense au fond du 15 janvier précède'),
    fact('h7','2026-04-20','c4-management','Court order','Case-management order records undisputed chronology','La chronologie des conclusions est non contestée'),
  ],
  qualifications:[
    qual('q-clause-void','h1',true,'Is the consumer jurisdiction clause deemed unwritten?','Clause ineffective against consumer','Hypothetical clause effectiveness — review','art. 48 CPC','A consumer is not contracting as a merchant. The timing bar does not validate this clause.','Hypothetical effective clause (different merchant facts)'),
    qual('q-merits-first','h4',true,'Were merits submissions filed before the jurisdiction objection?','Merits first — timing bar','Objection first — timing bar removed','arts. 74, 75 CPC','The first submissions argue the merits only. A timely, reasoned objection naming Nantes would remove this timing bar, not guarantee transfer.','Jurisdiction objection raised before the merits'),
  ],
};
const C5: CaseDataset = {
  id:'c5', meta:{title:'Trans-Alpine Logistique SAS v. Minoterie du Verdon SA', court:"Cour d'appel de Grenoble", side:'Respondent (Minoterie du Verdon SA)', amount:'Carriage charges — appeal', relationship:'Ordinary appeal with mandatory representation', asOf:'2026-10-04'},
  docs:[
    exhibit('c5-judgment','Jugement de première instance','2025-07-01','Tribunal de commerce de Grenoble : déboute la société Trans-Alpine Logistique de sa demande de paiement des frais de transport.'),
    exhibit('c5-service','Signification du jugement','2025-07-08','Jugement signifié le 08 juillet 2025 à Trans-Alpine Logistique SAS.'),
    exhibit('c5-declaration',"Déclaration d'appel",'2025-08-01',"Trans-Alpine Logistique déclare interjeter appel le 1er août 2025. Procédure ordinaire avec représentation obligatoire, hors bref délai."),
    exhibit('c5-email','Courriel du conseil','2025-10-20',"Nous sommes en attente du rapport d'expertise avant de finaliser nos conclusions. Ce courriel ne constate pas un événement extérieur insurmontable."),
    exhibit('c5-submissions',"Conclusions de l'appelant",'2025-11-20','Concluant pour la société Trans-Alpine : remise au greffe le 20 novembre 2025. Auteur de la fixture : aucune conclusion antérieure; la conformité du dispositif et la notification à l’intimé restent à vérifier.'),
    exhibit('c5-order','Ordonnance de caducité','2025-12-15',"Après invitation à présenter leurs observations, constate la caducité de la déclaration d'appel du 1er août 2025. Aucune rétractation de cette ordonnance n’est supposée."),
    exhibit('c5-incidental','Lettre de Minoterie du Verdon','2026-01-10','Auteur de la fixture : aucun appel incident n’a été formé, aucun appel principal ni recours contre l’ordonnance ne demeure pendant; vérifier délais et recours avant toute conclusion de caractère définitif.'),
    exhibit('c5-rules','CPC — appeal references and review',undefined,'CPC 538 : délai ordinaire d’appel d’un mois. CPC 908 : trois mois pour les conclusions en procédure ordinaire. CPC 641/642 : même quantième, puis prorogation samedi, dimanche ou jour férié.\nCPC 911 : force majeure non imputable et insurmontable; l’ordonnance de caducité ne peut être rapportée. CPC 550 : vérifier tout appel incident survivant. Hypothèses de délai ou de force majeure : scénario contrefactuel AVANT ordonnance uniquement.','statute'),
  ],
  facts:[
    fact('k1','2025-07-01','c5-judgment','Court order','First-instance judgment dismisses carriage claim','déboute la société Trans-Alpine Logistique'),
    fact('k2','2025-07-08','c5-service','Bailiff act','Judgment served — ordinary appeal period starts','signifié le 08 juillet 2025'),
    fact('k3','2025-08-01','c5-declaration','Notice of appeal','Timely notice of ordinary appeal','déclare interjeter appel le 1er août 2025'),
    fact('k4','2025-10-20','c5-email','Email','Counsel awaits expert report — force majeure unproven',"en attente du rapport d'expertise",'q-force-majeure'),
    fact('k5','2025-11-20','c5-submissions','Submissions','Appellant submissions filed after adjusted deadline','remise au greffe le 20 novembre 2025','q-late'),
    fact('k6','2025-12-15','c5-order','Court order','Order records lapse after party observations',"constate la caducité de la déclaration d'appel"),
    fact('k7','2026-01-10','c5-incidental','Exhibits','Authored fixture confirms no surviving incidental appeal','aucun appel incident n’a été formé'),
  ],
  qualifications:[
    qual('q-late','k5',false,'Were appellant submissions filed in time?','Filed in time — pre-order hypothetical','Late — adjusted deadline exceeded','arts. 908, 641, 642 CPC','Raw 1 November 2025 is Saturday and All Saints. Adjusted deadline 3 November; 20 November is 17 days late. Other filing and notification conditions require review.','Submissions filed in time (pre-order hypothetical)'),
    qual('q-force-majeure','k4',false,'Could qualifying force majeure excuse filing before the lapse order?','Potential pre-order judicial disapplication','Force majeure not established','art. 911 CPC','Waiting for an expert report alone does not show an insurmountable circumstance not attributable to the party. A later assertion cannot undo the existing order.','Qualifying force majeure (pre-order hypothetical)','ai_inferred','low'),
  ],
};
export const CASE_CATALOG: CaseDataset[] = [ORIGINAL_CASE, C3, C4, C5];
export function getCase(id: string): CaseDataset {
  const c = CASE_CATALOG.find(c => c.id === id);
  if (!c) throw new Error(`Unknown case ${id}`);
  return c;
}
export function caseQualification(c: CaseDataset, id: string): Qualification {
  const q = c.qualifications.find(q => q.id === id);
  if (!q) throw new Error(`Unknown qualification ${id} for ${c.id}`);
  return q;
}
export function caseDocument(c: CaseDataset, id: string): Doc {
  const d = c.docs.find(d => d.id === id);
  if (!d) throw new Error(`Unknown document ${id} for ${c.id}`);
  return d;
}
