# 5000

Carnet de scores mobile pour le jeu de dés du **5000**. Pas le jeu : le carnet. On lance
ses vrais dés, on compte comme d'habitude, et l'application enregistre le total de chaque
tour, applique les règles pénibles à tenir de tête, et suit la progression.

Un seul téléphone, autour de la table. Aucun compte, aucun serveur, fonctionne hors-ligne.

## Les règles appliquées

| Règle        | Comportement                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------ |
| Objectif     | **5 000 pile**. Le premier qui y tombe gagne, la partie s'arrête.                                |
| Ouverture    | Il faut un tour à **500 ou plus** pour ouvrir son compteur. En dessous : rien gagné, rien perdu.  |
| Dépassement  | On **redescend du surplus** : 4 900 + 300 → 4 800. Plancher à 0.                                  |
| Saisie       | Multiples de 50 uniquement. Bouton « Raté » pour un tour à zéro.                                  |

Le détail complet, et les raisons derrière chaque choix, sont dans [`SPEC.md`](./SPEC.md).

## Développement

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # moteur de score + adaptateur de stockage
npm run typecheck
npm run lint
npm run build
```

Pour tester depuis un téléphone sur le réseau local :

```bash
npm run dev -- -H 0.0.0.0
```

À savoir : en HTTP simple sur le réseau local, le navigateur refuse `crypto.randomUUID`
et l'installation PWA — les deux exigent un contexte sécurisé. L'application gère le
premier cas ([`lib/id.ts`](./lib/id.ts)) ; pour le second, il faut du https, donc Vercel.

## Architecture

Deux idées portent tout le reste.

**L'état d'une partie est dérivé d'un journal d'évènements.** Aucun total cumulé n'est
stocké : `lib/engine.ts` rejoue le journal. L'annulation devient un `pop`, la courbe de
progression est gratuite, et le tout est une fonction pure — donc testable sans
navigateur. C'est là que sont les vrais bugs d'un jeu comme celui-ci, d'où des tests
unitaires concentrés à cet endroit.

**La persistance passe par un port, pas par des appels directs.** `Repository`
(`lib/storage/`) est asynchrone dès aujourd'hui, alors que `localStorage` ne l'exige pas,
précisément pour qu'un passage à Postgres ne demande qu'un adaptateur et huit routes.
Voir [`SPEC.md` §5.1](./SPEC.md) et [`db/schema.sql`](./db/schema.sql).

```
app/          layout, aiguillage des écrans, manifest PWA
components/   les écrans + la feuille remontante réutilisable
lib/
  engine.ts   moteur de score pur (+ engine.test.ts)
  rules.ts    les constantes du jeu, verrouillées
  storage/    port, codec, adaptateur local, adaptateur HTTP
  store.tsx   contexte React, écriture différée
db/schema.sql schéma Postgres cible
```

## Pile

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript strict · Tailwind CSS 4 ·
Vitest. Aucune bibliothèque d'état, aucune bibliothèque de graphiques, aucun backend.
