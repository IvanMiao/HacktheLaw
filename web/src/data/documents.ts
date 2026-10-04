import cass2003 from '../../../data/caselaw/Cour de cassation chambre mixte 14 fevrier 2003 - n00-19423.md?raw';
import cass2014 from '../../../data/caselaw/Cour de cassation chambre mixte 12 decembre 2014 - n13-19684.md?raw';
import pdf2003 from '../../../data/caselaw/Cour de cassation chambre mixte 14 fevrier 2003 - n00-19423.pdf?url';
import pdf2014 from '../../../data/caselaw/Cour de cassation chambre mixte 12 decembre 2014 - n13-19684.pdf?url';

export type DocGroup = 'case' | 'caselaw' | 'statute';

export type Doc = {
  id: string;
  group: DocGroup;
  title: string;
  short: string;
  date?: string;
  /** real = provided by the team; mock = synthetic or placeholder for the demo */
  provenance: 'real' | 'mock';
  format: 'text' | 'markdown';
  text: string;
  pdf?: string;
  note?: string;
};

const CASE_NOTE = 'Synthetic case document — fictitious parties.';
const STATUTE_NOTE = 'Excerpt typed for the demo — verify the current version on Légifrance.';

export const DOCS: Doc[] = [
  {
    id: 'contract', group: 'case', provenance: 'mock', format: 'text', date: '2020-11-05',
    title: 'Contrat de fourniture et d’installation', short: 'Contract', note: CASE_NOTE,
    text: `CONTRAT DE FOURNITURE ET D'INSTALLATION

Entre les soussignés :
ATELIER LUMIÈRE SAS, 14 quai des Chartrons, 33000 Bordeaux, RCS Bordeaux 812 345 678, ci-après le « Fournisseur »,
Et :
BÂTISELF SARL, 3 rue du Port, 33130 Bègles, RCS Bordeaux 498 765 432, ci-après le « Client ».

Article 1 – Objet
Le Fournisseur fournit et installe les luminaires du programme « Les Terrasses de Bègles ».

Article 6 – Prix et paiement
Les factures sont payables à trente jours date de facture, par virement.

Article 14 – Conciliation préalable
Tout différend relatif à l'exécution du présent contrat sera soumis, préalablement à toute action judiciaire, à une tentative de conciliation. La partie la plus diligente saisit, par lettre recommandée avec accusé de réception, un conciliateur désigné d'un commun accord ou, à défaut, par le président de la Chambre de commerce et d'industrie de Bordeaux. Les parties disposent d'un délai d'un mois à compter de cette saisine pour parvenir à un accord.

Article 15 – Juridiction
À défaut de conciliation, le litige sera porté devant le tribunal de commerce de Bordeaux.

Fait à Bordeaux, le 5 novembre 2020, en deux exemplaires.`,
  },
  {
    id: 'invoice', group: 'case', provenance: 'mock', format: 'text', date: '2021-02-13',
    title: 'Facture F-2021-034', short: 'Invoice', note: CASE_NOTE,
    text: `ATELIER LUMIÈRE SAS
FACTURE N° F-2021-034

Client : BÂTISELF SARL — chantier « Les Terrasses de Bègles »
Date de facture : 13/02/2021
Date d'échéance : 15/03/2021

Fourniture et pose de 46 luminaires LED          15 333,33 €
TVA 20 %                                          3 066,67 €
TOTAL TTC                                        18 400,00 €

Conditions : paiement à 30 jours, par virement (IBAN FR76 ···· 4410).`,
  },
  {
    id: 'email', group: 'case', provenance: 'mock', format: 'text', date: '2022-06-02',
    title: 'Courriel de M. Delorme (Bâtiself)', short: 'Email', note: CASE_NOTE,
    text: `De : Marc Delorme <m.delorme@batiself.fr>
À : Claire Roux <c.roux@atelier-lumiere.fr>
Date : jeudi 2 juin 2022, 18:42
Objet : RE: Facture F-2021-034 – relance

Bonjour Madame Roux,

Nous avons bien reçu votre relance. Le chantier des Terrasses a pris du retard et plusieurs luminaires font encore l'objet de réserves.
Nous allons étudier votre facture et revenons vers vous.

Cordialement,
Marc Delorme
Gérant — Bâtiself SARL`,
  },
  {
    id: 'notice', group: 'case', provenance: 'mock', format: 'text', date: '2023-02-10',
    title: 'Mise en demeure (LRAR)', short: 'Formal notice', note: CASE_NOTE,
    text: `ATELIER LUMIÈRE SAS
Lettre recommandée avec accusé de réception n° 1A 189 452 7731 2

Bordeaux, le 10 février 2023

Objet : Mise en demeure — facture F-2021-034

Madame, Monsieur,
Malgré nos relances, la facture F-2021-034 d'un montant de 18 400,00 € TTC, échue le 15 mars 2021, demeure impayée.
Nous vous mettons en demeure de nous régler cette somme dans un délai de huit jours à compter de la réception de la présente, faute de quoi nous saisirons la juridiction compétente.

Claire Roux, Directrice administrative et financière

[Accusé de réception — distribué et signé le 13/02/2023]`,
  },
  {
    id: 'writ1', group: 'case', provenance: 'mock', format: 'text', date: '2026-01-12',
    title: 'Assignation n° 1 — tribunal de commerce', short: 'Writ #1', note: CASE_NOTE,
    text: `ASSIGNATION DEVANT LE TRIBUNAL DE COMMERCE DE BORDEAUX

L'an deux mille vingt-six et le douze janvier,
À la requête de : ATELIER LUMIÈRE SAS, 14 quai des Chartrons, 33000 Bordeaux,
Ayant pour avocat Maître Hélène Garnier, avocat au barreau de Bordeaux,
J'ai, Maître Paul Lestrade, commissaire de justice à Bordeaux, soussigné,

DONNÉ ASSIGNATION À : BÂTISELF SARL, 3 rue du Port, 33130 Bègles,

D'avoir à comparaître à l'audience du vendredi 20 février 2026 à 9h30 du tribunal de commerce de Bordeaux, 
siégeant Palais de la Bourse, place de la Bourse, 33000 Bordeaux.

OBJET DE LA DEMANDE
Condamner la société Bâtiself au paiement de la somme de 18 400,00 € au titre de la facture F-2021-034, outre intérêts au taux légal.`,
  },
  {
    id: 'registry', group: 'case', provenance: 'mock', format: 'text', date: '2026-02-16',
    title: 'Tampon du greffe — remise de l’assignation', short: 'Registry stamp', note: CASE_NOTE,
    text: `TRIBUNAL DE COMMERCE DE BORDEAUX — GREFFE

ENRÔLEMENT
Copie de l'assignation remise au greffe le 16 février 2026
RG n° 2026F00412
Demandeur : ATELIER LUMIÈRE SAS
Défendeur : BÂTISELF SARL
Audience : 20/02/2026 — 9h30 — Chambre 2

[cachet du greffe]`,
  },
  {
    id: 'order', group: 'case', provenance: 'mock', format: 'text', date: '2026-02-20',
    title: 'Ordonnance de caducité', short: 'Court order', note: CASE_NOTE,
    text: `TRIBUNAL DE COMMERCE DE BORDEAUX
ORDONNANCE DE CADUCITÉ
RG n° 2026F00412 — Audience du 20 février 2026

Nous, président de la deuxième chambre,
Vu l'article 857 du code de procédure civile ;
Attendu que l'assignation délivrée le 12 janvier 2026 à la requête de la société Atelier Lumière à la société Bâtiself fixait l'audience au 20 février 2026 ;
Attendu que la copie de l'assignation n'a été remise au greffe que le 16 février 2026, soit moins de huit jours avant la date de l'audience ;
PAR CES MOTIFS,
Constatons la caducité de l'assignation.

Fait à Bordeaux, le 20 février 2026.`,
  },
  {
    id: 'writ2', group: 'case', provenance: 'mock', format: 'text', date: '2026-04-08',
    title: 'Assignation n° 2 — tribunal de commerce', short: 'Writ #2', note: CASE_NOTE,
    text: `ASSIGNATION DEVANT LE TRIBUNAL DE COMMERCE DE BORDEAUX

L'an deux mille vingt-six et le huit avril,
À la requête de : ATELIER LUMIÈRE SAS, 14 quai des Chartrons, 33000 Bordeaux,
Ayant pour avocat Maître Hélène Garnier, avocat au barreau de Bordeaux,
J'ai, Maître Paul Lestrade, commissaire de justice à Bordeaux, soussigné,

DONNÉ ASSIGNATION À : BÂTISELF SARL, 3 rue du Port, 33130 Bègles,

D'avoir à comparaître à l'audience du mardi 20 octobre 2026 à 9h30 du tribunal de commerce de Bordeaux.

OBJET DE LA DEMANDE
Condamner la société Bâtiself au paiement de la somme de 18 400,00 € au titre de la facture F-2021-034, outre intérêts au taux légal et 3 000 € au titre de l'article 700 du code de procédure civile.

[Copie remise au greffe le 15 avril 2026 — RG n° 2026F01187]`,
  },
  {
    id: 'pieces', group: 'case', provenance: 'mock', format: 'text', date: '2026-04-08',
    title: 'Bordereau des pièces communiquées (assignation n° 2)', short: 'List of exhibits', note: CASE_NOTE,
    text: `BORDEREAU DES PIÈCES COMMUNIQUÉES
annexé à l'assignation du 8 avril 2026 — Atelier Lumière c/ Bâtiself

Pièce n° 1 : Contrat de fourniture et d'installation du 5 novembre 2020
Pièce n° 2 : Facture F-2021-034 du 13 février 2021
Pièce n° 3 : Courriel de M. Delorme du 2 juin 2022
Pièce n° 4 : Mise en demeure du 10 février 2023 et accusé de réception
Pièce n° 5 : Extrait Kbis de la société Bâtiself
Pièce n° 6 : Décompte des sommes dues`,
  },
  {
    id: 'cass2003', group: 'caselaw', provenance: 'real', format: 'markdown', date: '2003-02-14',
    title: 'Cass. ch. mixte, 14 févr. 2003, n° 00-19.423', short: 'Cass. mixte 2003',
    text: cass2003, pdf: pdf2003,
  },
  {
    id: 'cass2014', group: 'caselaw', provenance: 'real', format: 'markdown', date: '2014-12-12',
    title: 'Cass. ch. mixte, 12 déc. 2014, n° 13-19.684', short: 'Cass. mixte 2014',
    text: cass2014, pdf: pdf2014,
  },
  {
    id: 'cassC1', group: 'caselaw', provenance: 'mock', format: 'text',
    title: 'Cass. 2e civ. — caducité et interruption [à compléter]', short: 'Cass. 2e civ. (placeholder)',
    note: 'Placeholder — the legal team must replace this with a real Cass. 2e civ. decision.',
    text: `JURISPRUDENCE À COMPLÉTER — DOCUMENT FICTIF

Principe recherché :
La caducité de l'assignation la prive rétroactivement de tous ses effets ; elle prive l'assignation de tout effet interruptif de prescription, l'interruption étant regardée comme non avenue (art. 2243 C. civ.).

À distinguer : l'assignation annulée par l'effet d'un vice de procédure conserve son effet interruptif (art. 2241, al. 2, C. civ.).

Référence : [Cass. 2e civ., date, n° de pourvoi — à rechercher sur Judilibre]`,
  },
  {
    id: 'cpc', group: 'statute', provenance: 'mock', format: 'text',
    title: 'Code de procédure civile (extraits)', short: 'CPC', note: STATUTE_NOTE,
    text: `CODE DE PROCÉDURE CIVILE — EXTRAITS

Article 122
Constitue une fin de non-recevoir tout moyen qui tend à faire déclarer l'adversaire irrecevable en sa demande, sans examen au fond, pour défaut de droit d'agir, tel le défaut de qualité, le défaut d'intérêt, la prescription, le délai préfix, la chose jugée.

Article 123
Les fins de non-recevoir peuvent être proposées en tout état de cause, sauf la possibilité pour le juge de condamner à des dommages-intérêts ceux qui se seraient abstenus, dans une intention dilatoire, de les soulever plus tôt.

Article 124
Les fins de non-recevoir doivent être accueillies sans que celui qui les invoque ait à justifier d'un grief et alors même que l'irrecevabilité ne résulterait d'aucune disposition expresse.

Article 126
Dans le cas où la situation donnant lieu à fin de non-recevoir est susceptible d'être régularisée, l'irrecevabilité sera écartée si sa cause a disparu au moment où le juge statue.

Article 857
La juridiction est saisie, à la diligence de l'une ou l'autre partie, par la remise au greffe d'une copie de l'assignation. Cette remise doit avoir lieu au plus tard huit jours avant la date de l'audience, sous peine de caducité de l'assignation constatée d'office par ordonnance du président ou du juge saisi.`,
  },
  {
    id: 'civ', group: 'statute', provenance: 'mock', format: 'text',
    title: 'Code civil & Code de commerce (extraits)', short: 'C. civ. / C. com.', note: STATUTE_NOTE,
    text: `CODE CIVIL — EXTRAITS

Article 2224
Les actions personnelles ou mobilières se prescrivent par cinq ans à compter du jour où le titulaire d'un droit a connu ou aurait dû connaître les faits lui permettant de l'exercer.

Article 2240
La reconnaissance par le débiteur du droit de celui contre lequel il prescrivait interrompt le délai de prescription.

Article 2241
La demande en justice, même en référé, interrompt le délai de prescription ainsi que le délai de forclusion.
Il en est de même lorsqu'elle est portée devant une juridiction incompétente ou lorsque l'acte de saisine de la juridiction est annulé par l'effet d'un vice de procédure.

Article 2242
L'interruption résultant de la demande en justice produit ses effets jusqu'à l'extinction de l'instance.

Article 2243
L'interruption est non avenue si le demandeur se désiste de sa demande ou laisse périmer l'instance, ou si sa demande est définitivement rejetée.

CODE DE COMMERCE — EXTRAIT

Article L110-4
I. Les obligations nées à l'occasion de leur commerce entre commerçants ou entre commerçants et non-commerçants se prescrivent par cinq ans si elles ne sont pas soumises à des prescriptions spéciales plus courtes.`,
  },
];

export const docById = (id: string) => {
  const d = DOCS.find((x) => x.id === id);
  if (!d) throw new Error(`Unknown document ${id}`);
  return d;
};
