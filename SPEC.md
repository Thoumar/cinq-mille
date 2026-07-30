# 5000 — carnet de scores mobile

**Dépôt** : `Thoumar/cinq-mille` (public) · **Déploiement** : Vercel · **Rédigé le** 2026-07-30

---

## 1. Ce que c'est, et ce que ce n'est pas

Une application web mobile-first qui sert de **carnet de scores** pour le jeu de dés du
5000, joué à plusieurs autour d'une table.

**Ce n'est pas le jeu.** L'application ne contient aucun dé, aucun tirage aléatoire de
faces, aucun calcul de combinaison. Les joueurs lancent leurs vrais dés, comptent leurs
points comme d'habitude, et l'application ne fait qu'**enregistrer le total de chaque tour
et suivre la progression**. Elle remplace la feuille de papier, pas les dés.

Conséquence directe sur l'architecture : la seule donnée saisie est **un nombre entier par
tour**. Le moteur ne connaît ni faces, ni brelans, ni mains chaudes.

### Contexte d'usage

Un seul téléphone, posé sur la table ou passé de main en main. Aucun compte, aucun
serveur, aucune synchronisation entre appareils. Tout vit dans le `localStorage` du
téléphone, l'app fonctionne hors-ligne.

---

## 2. Les règles du jeu (rappel, pour référence)

Ces règles sont celles que les joueurs appliquent **avec leurs dés**. L'application ne les
vérifie pas — elle est listée ici pour comprendre quels totaux de tour sont plausibles.

- Un `1` vaut **100**, un `5` vaut **50**.
- Trois dés identiques valent le chiffre × 100 : `3×2` = 200, `3×3` = 300, `3×4` = 400,
  `3×5` = 500, `3×6` = 600. **Exception : `3×1` = 1000.**
- Un quatrième (ou cinquième) dé identique s'ajoute à la valeur unitaire :
  `4×1` = 1000 + 100 = **1100**.
- Le joueur garde ses dés scorants et relance les autres. Tant qu'il marque, il peut
  continuer. Si **tous** ses dés sont scorants, il peut tout relancer (main chaude) et
  continuer d'empiler.
- S'il ne marque rien sur un lancer, il perd tout le cumul du tour → tour à **0**.

---

## 3. Les règles que l'application applique (verrouillées en dur)

Aucun écran de réglage. Aucune option au lancement d'une partie. Les quatre règles
ci-dessous sont le cœur testé du produit.

### 3.1 Objectif

**5 000 points, atteints exactement.** Le premier joueur dont le total vaut précisément
5 000 gagne.

### 3.2 Ouverture — seuil de 500

Un joueur commence la partie **« non ouvert »**, à 0 point.

- Tant qu'il n'est pas ouvert, seul un tour valant **500 ou plus** compte. Ce tour l'ouvre
  et son score devient la valeur du tour.
- Un tour inférieur à 500 alors qu'il n'est pas ouvert ne rapporte rien et **ne coûte
  rien** : il reste à 0. Aucune pénalité, jamais de score négatif.
- Le tour est tout de même inscrit au carnet, marqué comme non ouvrant (affiché en grisé
  et barré, avec la valeur tentée), pour garder la trace de la partie.

**500 inclus ouvre la partie** : un tour à exactement 500 ouvre le compteur (confirmé
pendant le cadrage). La constante vit dans `lib/rules.ts` (`OPENING_THRESHOLD`) et le cas
limite est couvert par un test dédié.

### 3.3 Rebond au-dessus de 5 000

Si `total + score du tour > 5000`, le joueur **redescend du surplus** :

```
nouveau total = 5000 − (total + score − 5000)
```

Exemples :

| Total avant | Score du tour | Somme | Surplus | Total après |
| ----------- | ------------- | ----- | ------- | ----------- |
| 4 900       | 300           | 5 200 | 200     | **4 800**   |
| 4 900       | 100           | 5 000 | —       | **5 000** 🏆 |
| 4 900       | 600           | 5 500 | 500     | **4 500**   |
| 4 900       | 2 000         | 6 900 | 1 900   | **3 100**   |

**Plancher à 0** : le rebond ne peut jamais produire un score négatif. Si le calcul donne
un nombre inférieur à 0, le total est ramené à **0** (le joueur perd tout, mais reste
ouvert). Cas rare mais possible puisque la saisie est libre.

### 3.4 Fin de partie

Dès qu'un joueur atteint 5 000 pile, la partie **s'arrête immédiatement**. Pas de tour de
dernière chance. L'écran de victoire s'affiche, la saisie est bloquée.

### 3.5 Score déjà pris — le recul

**Tomber pile sur le total d'un adversaire le renvoie à son score précédent.**

Exemple : je suis à 800, tu marques et t'arrêtes à 800 → je retombe à 500, mon total
d'avant.

Deux garde-fous que la règle n'énonce pas mais sans lesquels elle est injouable :

- **Le zéro ne déclenche rien.** Tout le monde y commence : sans cette exclusion, le
  premier tour raté ferait reculer la table entière. Un joueur non ouvert n'est ni
  tireur ni cible.
- **Pas de réaction en chaîne.** Si mon recul me pose sur le score d'un troisième
  joueur, il ne bouge pas. Seul le joueur qui vient de jouer fait reculer les autres.

Le « score précédent » est lu dans une **trace des totaux réellement occupés, sans
répétition** : un tour raté n'y ajoute rien. Sinon, être à 800, rater son tour, puis se
faire dégommer ramènerait à 800 — c'est-à-dire nulle part.

Plusieurs joueurs peuvent occuper le même total (uniquement par l'effet d'un recul) :
ils reculent alors tous ensemble.

L'évènement est **mis en scène à l'écran** : le chiffre de la victime dégringole
réellement de l'ancien score au nouveau. C'est le seul évènement du jeu qui frappe
quelqu'un qui n'a rien fait — il doit être annoncé, pas seulement apparaître au carnet.

### 3.6 Validation de la saisie

Un score de tour est accepté si et seulement si c'est un **multiple de 50**. C'est le
garde-fou minimal contre les fautes de frappe (`130` refusé, `150` accepté), sans chercher
à valider la combinaison complète — la table peut avoir ses habitudes.

Le tour à zéro se saisit par le bouton dédié **« Raté »**, pas au pavé.

---

## 4. Écrans

### 4.1 Écran de création de partie

L'écran s'organise autour d'**équipes** — des tablées nommées et mémorisées — parcourues
en carrousel horizontal.

- **Les joueurs restent un roster global partagé.** Une équipe ne stocke que des
  identifiants : quelqu'un peut appartenir à « Maison » et « Chalet » sans être
  dupliqué, et le renommer le renomme partout.
- **L'ordre des membres est l'ordre de jeu**, figé au lancement de la partie.
- **La dernière équipe jouée remonte en tête** : c'est presque toujours celle qu'on
  rejoue à la soirée suivante.
- **Créer, modifier, supprimer une équipe** se fait dans une feuille : nom, choix des
  membres dans le roster (l'ordre des taps est l'ordre de passage), création d'un
  nouveau joueur, suppression.
- **Nombre de joueurs : sans limite** (minimum 2). Au-delà de 8, la mise en page reste
  fonctionnelle mais n'est pas optimisée : le classement défile verticalement, le carnet
  horizontalement.

### 4.2 Tirage au sort du premier joueur

Au lancement de la partie, une courte animation désigne aléatoirement le joueur qui
commence. L'ordre de passage suit ensuite la liste, en boucle, à partir de lui.

### 4.3 Écran de jeu — option D validée

Vue principale : le **classement**, plus le **carnet complet dépliable**.

```
┌──────────────────────────────┐
│ OBJECTIF 5 000      Tour 4 ⋮ │
│                              │
│ ▸ 🐻 Thomas          1 450   │  ← joueur courant encadré
│      ▓▓▓▓▓▓▓░░░░░░░░░░░░     │  ← jauge vers 5000
│   🦊 Julie             900   │
│      ▓▓▓▓░░░░░░░░░░░░░░░     │
│   🐸 Max               750   │
│   🦉 Léa                 0   │
│      pas encore ouverte      │
│                              │
│  ┌────────────────────────┐  │
│  │  🐻 Thomas — SAISIR    │  │  ← zone du pouce
│  └────────────────────────┘  │
│  ──────── ▔▔▔▔ ────────      │  ← poignée : tap ou glisser
│      le carnet complet       │
└──────────────────────────────┘
```

- Joueurs **triés par score décroissant**, celui dont c'est le tour mis en évidence
  (bordure accent) quelle que soit sa position.
- **Jauge de progression** vers 5 000 sous chaque nom, à la couleur du joueur.
- Sous-titre contextuel : « à lui de jouer », « reste 4 100 », « pas encore ouvert ·
  500 requis ».
- **Carnet dépliable** : la poignée en bas ouvre une feuille (bottom sheet) contenant la
  grille complète — une colonne par joueur, une ligne par tour, totaux en pied de
  tableau. Ouverture au tap sur la poignée **et** au glissement vers le haut ; fermeture
  au glissement vers le bas, au tap hors de la feuille, ou par le bouton retour.
- Bouton de saisie plein largeur, ≥ 56 px, portant l'emoji et le nom du joueur courant —
  impossible de saisir pour le mauvais joueur par inattention.

### 4.4 Écran de saisie

Ouvert depuis le bouton principal, en feuille plein écran.

- En-tête : emoji + nom + total actuel du joueur.
- **Montant en très grand** (≈ 60 px), chiffres à largeur fixe (tabular-nums).
- **Rangée de raccourcis** au-dessus du pavé : `50` `100` `150` `500` `1000` — remplissent
  directement le montant.
- **Pavé numérique** : `1`–`9`, `00`, `0`, `⌫`. Cibles ≥ 56 px.
- **Aide contextuelle** sous le montant :
  - au repos : « multiple de 50 » ;
  - si non multiple de 50 : « ✖ doit être un multiple de 50 », validation désactivée ;
  - sinon : aperçu du résultat — *« nouveau total : 4 800 ↰ rebond (surplus 200) »* ou
    *« nouveau total : 5 000 🏆 victoire ! »*. C'est l'information la plus utile de
    l'écran : le joueur voit l'effet du rebond **avant** de valider.
- Deux actions : **« ✖ Raté »** (enregistre 0 et passe au suivant) et **« Valider »**.
- Après validation, retour à l'écran de jeu, joueur courant avancé automatiquement.

### 4.5 Annulation

Après chaque validation, un **toast « Annuler »** reste affiché ~5 secondes en bas de
l'écran. Le menu `⋮` contient également en permanence **« Annuler le dernier score »**.
Un seul niveau d'annulation (le dernier tour saisi) — pas de pile d'undo, pas d'édition
directe des cases du carnet.

L'annulation restaure exactement l'état précédent : total, état d'ouverture, joueur
courant, et statut de victoire si le dernier coup avait terminé la partie.

### 4.6 Menu d'un joueur

Accessible en tapant sur sa ligne dans le classement :

- **Passer son tour** — le joueur est sauté pour ce tour, aucune ligne créée, il revient
  au tour suivant.
- **Le retirer de la partie** — il disparaît du classement ; ses tours déjà joués restent
  visibles dans le carnet (colonne grisée, marquée « parti »).
- **Ajouter un joueur en cours de partie** — depuis le menu principal `⋮`. Il entre à
  **0 point, non ouvert**, et s'insère en fin d'ordre de passage. Ses tours antérieurs
  sont vides dans le carnet.

### 4.7 Écran de victoire

- Emoji + nom du vainqueur, en grand.
- « 5 000 pile · en 9 tours · 12 min ».
- **Courbe de progression** : une ligne par joueur, graduée jusqu'à 5 000, en SVG dessiné
  à la main sans bibliothèque de graphiques. L'axe des abscisses est une **frise commune
  à toute la partie** — un point par tour joué, tous joueurs confondus — et non les tours
  de chaque joueur. C'est ce qui permet de voir un recul à l'instant exact où il se
  produit : indexée sur les tours du joueur, la courbe ne l'aurait montré qu'à son tour
  suivant, alors qu'il subit le coup sans rien faire. Les rebonds et les reculs y
  décrochent vers le bas — les moments les plus drôles d'une partie, autant les rendre
  lisibles.
- **Statistiques de fin** : meilleur tour (valeur + joueur + numéro de tour), moyenne par
  tour du vainqueur, nombre de tours ratés (et par qui), nombre de rebonds au-dessus de
  5 000.
- Bouton **« Revanche · mêmes joueurs »** qui relance une partie avec le même roster (et
  un nouveau tirage au sort du premier joueur).

La courbe de progression est également consultable **pendant** la partie depuis le menu.

---

## 5. Persistance

### 5.1 Un adaptateur, pas un appel direct à `localStorage`

Tout passe par un **port** (`Repository`, dans `lib/storage/types.ts`) dont l'unique
implémentation active aujourd'hui écrit dans le `localStorage`. L'objectif est explicite :
pouvoir basculer sur **Postgres** sans toucher un composant.

Trois décisions rendent cette bascule bon marché, et elles devaient être prises
maintenant :

1. **Le port est asynchrone**, alors que `localStorage` est synchrone. Une base distante
   ne l'est pas. En partant en synchrone, le passage à Postgres imposerait de réécrire
   chaque appelant et d'introduire partout des états de chargement inexistants. L'écran
   d'attente initial existe donc dès le premier jour, pour un stockage qui n'en a pas
   besoin.
2. **Les opérations sont métier, pas clé/valeur.** Un port `get(key)` / `set(key, value)`
   forcerait l'adaptateur Postgres à stocker un blob JSON, ce qui annulerait l'intérêt
   d'une base. Ici chaque méthode se traduit en une requête SQL — le schéma cible est
   déjà écrit dans `db/schema.sql`, requête par requête en commentaire.
3. **Les identifiants sont générés côté client** (`lib/id.ts`), au format UUID v4. Un
   `INSERT` n'a donc pas besoin d'un aller-retour pour connaître son id, et les colonnes
   `uuid` de Postgres restent utilisables.

L'interface en pratique :

```ts
interface Repository {
  listPlayers(): Promise<Player[]>
  upsertPlayer(player: Player): Promise<void>
  deletePlayer(id: string): Promise<void>
  loadGame(): Promise<Game | null>
  saveGame(game: Game): Promise<void>
  deleteGame(id: string): Promise<void>
  loadSettings(): Promise<Settings>
  saveSettings(settings: Settings): Promise<void>
}
```

| Fichier                    | Rôle                                                       |
| -------------------------- | ---------------------------------------------------------- |
| `lib/storage/types.ts`     | Le port et son contrat                                     |
| `lib/storage/codec.ts`     | Sérialisation, validation, migrations de schéma            |
| `lib/storage/local.ts`     | Adaptateur `localStorage` (actif)                          |
| `lib/storage/http.ts`      | Adaptateur HTTP, écrit et prêt, non branché                |
| `lib/storage/index.ts`     | **Le seul point de bascule** (`NEXT_PUBLIC_STORAGE=http`)  |
| `db/schema.sql`            | Schéma Postgres cible                                      |

**Procédure de bascule vers Postgres**, le jour où on la veut : créer les tables,
écrire les huit routes listées dans `http.ts` (trois lignes de SQL chacune), poser
`NEXT_PUBLIC_STORAGE=http`. Aucun composant, aucun hook, aucune fonction métier ne
change.

### 5.2 Robustesse et écriture différée

- Tout ce qui **sort** d'un stockage est traité comme non fiable : le `localStorage` est
  éditable par l'utilisateur, et une version antérieure de l'app a pu y écrire une autre
  forme. Les validateurs de `codec.ts` ne lèvent jamais — une lecture inexploitable rend
  `null` et l'app repart proprement. Une application qui plante au démarrage à cause d'un
  stockage abîmé est irrécupérable pour celui qui l'utilise.
- Les données portent une **enveloppe versionnée** (`SCHEMA_VERSION`) avec un point
  d'accroche pour les migrations. Une version future inconnue est refusée plutôt que
  devinée.
- **L'état en mémoire est la vérité de l'affichage.** Une action met l'état à jour
  immédiatement puis l'écriture part en arrière-plan : l'interface restera aussi vive
  derrière Postgres qu'aujourd'hui.
- Les écritures sont **sérialisées dans une file** : sans cela, deux saisies rapprochées
  pourraient arriver dans le désordre sur un adaptateur réseau, et la dernière écriture
  gagnante ne serait pas la dernière action.
- Un échec d'écriture est signalé dans l'interface sans interrompre la partie.

### 5.3 Ce qui est persisté

- **Une seule partie en cours à la fois**, sauvegardée à chaque mutation. À la réouverture, l'app retombe directement sur la partie en cours, au bon
  joueur, carnet intact.
- Le **roster** (noms + emojis) persiste indépendamment des parties.
- **Pas d'historique des parties terminées.** Une fois l'écran de victoire quitté, la
  partie est effacée. (Le modèle de données conserve tout le journal des tours, donc
  ajouter un historique en v2 ne demandera pas de migration.)
- Les préférences (son, vibration) persistent.

---

## 6. Confort de table

- **Écran toujours allumé** pendant une partie via la *Screen Wake Lock API*, relâché à la
  sortie ou à la fin. Repli silencieux si l'API est absente.
- **Vibration** courte à la validation d'un score, plus marquée à la victoire
  (`navigator.vibrate`). Désactivable.
- **Sons** courts à la validation, au rebond et à la victoire. **Désactivés par défaut**,
  activables dans les réglages — pénibles hors du salon.
- **PWA installable et hors-ligne** : `manifest`, icônes, service worker en cache-first
  sur le shell applicatif. L'app s'ouvre en plein écran depuis l'écran d'accueil, sans
  barre de navigateur, et fonctionne sans réseau (elle n'a de toute façon besoin de rien).

---

## 7. Direction artistique — « feutre de table »

L'ambiance d'une vraie table de jeu, pas d'un tableur.

| Rôle                 | Intention                                                      |
| -------------------- | -------------------------------------------------------------- |
| Fond                 | Vert feutre profond, légèrement texturé (grain subtil)         |
| Surfaces / cartes    | Feutre plus clair, bords doux                                   |
| Carnet               | Blanc cassé façon papier, léger grain, chiffres à l'encre       |
| Texte principal      | Blanc cassé chaud                                              |
| Accent               | Laiton / or chaud — jauges, joueur courant, victoire            |
| Alerte               | Rouge brique désaturé (score refusé, tour raté)                 |
| Couleurs de joueurs  | Une palette de 8 teintes lisibles sur le feutre, réutilisée partout : classement, jauges, courbe |

**Densité : équilibrée**, comme la maquette validée. Scores en très gros caractères à
largeur fixe, métadonnées en petit et en retrait. Pas de réglage de taille de texte.

**Thème unique sombre** (le feutre), pas de mode clair.

Le carnet est le seul élément « papier » de l'interface — ce contraste feutre/papier porte
toute l'identité et évite d'avoir à inventer des ornements.

**Langue : français uniquement**, textes écrits directement dans les composants.

---

## 8. Architecture technique

### Stack

- **Next.js 16** (App Router) · **React 19** · **TypeScript strict**
- **Tailwind CSS 4**
- **Vitest** pour les tests du moteur
- Aucune bibliothèque d'état, aucune bibliothèque de graphiques, aucun backend.
- Application 100 % client. Rendu statique, pas de route API.

### Le moteur de score : une fonction pure

Tout l'état d'une partie est **dérivé du journal des tours**. On ne stocke jamais un total
cumulé : on le recalcule. Cela rend l'annulation triviale (retirer la dernière entrée), la
courbe de progression gratuite, et le tout parfaitement testable.

```ts
type Player = { id: string; name: string; emoji: string; color: number }

type Turn = {
  playerId: string
  raw: number          // ce qui a été saisi (0 si raté)
  applied: number      // ce qui a réellement compté
  kind: 'score' | 'miss' | 'no-open' | 'bounce'
}

type Game = {
  players: Player[]    // ordre de jeu
  turns: Turn[]        // journal chronologique
  removed: string[]    // joueurs retirés en cours
  startedAt: number
}

// dérivations pures
standings(game): { playerId; total; opened; rank }[]
currentPlayerId(game): string | null
turnNumber(game): number
winner(game): string | null
progression(game): { playerId; totals: number[] }[]

// mutations pures
applyTurn(game, raw: number): Game
skipTurn(game): Game
undo(game): Game
```

### Cas couverts par les tests unitaires (`lib/engine.test.ts`)

Une trentaine de cas, dont les limites qui cassent en silence :

- ouverture : 450 → reste 0 non ouvert · 500 → ouvre · 550 → ouvre · deux tours à 400 →
  toujours 0 ;
- rebond : 4900 + 300 → 4800 · 4900 + 100 → 5000 victoire · 4900 + 2000 → 3100 ·
  4900 + 5200 → 0 (plancher) ;
- victoire : arrêt immédiat, saisie refusée après ;
- annulation : d'un tour ouvrant (retour à non ouvert), d'un rebond, d'un tour victorieux
  (la partie reprend) ;
- rotation : passer un tour, retirer un joueur pendant que c'est son tour, ajouter un
  joueur en cours, tour complet avec un seul joueur restant ;
- validation : refus des non-multiples de 50, du négatif, du non-entier.

### Arborescence prévue

```
cinq-mille/
├── app/
│   ├── layout.tsx          racine, polices, thème feutre
│   ├── page.tsx            aiguillage : création · partie · victoire
│   ├── globals.css         tokens Tailwind 4, grain, palette joueurs
│   └── manifest.ts         PWA
├── components/
│   ├── SetupScreen.tsx     roster + emojis + démarrage
│   ├── FirstPlayerDraw.tsx tirage au sort animé
│   ├── GameScreen.tsx      classement + poignée du carnet
│   ├── Scoreboard.tsx      lignes de joueurs + jauges
│   ├── ScoreSheet.tsx      carnet dépliable (bottom sheet)
│   ├── NumPad.tsx          saisie : raccourcis + pavé + aperçu
│   ├── PlayerMenu.tsx      passer / retirer
│   ├── UndoToast.tsx
│   ├── ProgressChart.tsx   courbe SVG
│   └── VictoryScreen.tsx   vainqueur + stats + revanche
├── lib/
│   ├── engine.ts           moteur pur ← le cœur testé
│   ├── engine.test.ts
│   ├── rules.ts            constantes : GOAL 5000, OPEN 500, STEP 50
│   ├── store.tsx           contexte React + persistance localStorage
│   ├── feedback.ts         vibration · sons · wake lock
│   └── format.ts           formatage fr-FR des nombres
├── public/
│   ├── sw.js               service worker cache-first
│   └── icons/
└── SPEC.md
```

---

## 9. Hors périmètre (assumé)

Ce qui a été explicitement écarté pendant l'entretien, et pourquoi :

| Écarté                              | Raison                                                    |
| ----------------------------------- | --------------------------------------------------------- |
| Dés dans l'app, faces, combinaisons | L'app est un carnet, pas le jeu                           |
| Multi-appareils, code de partie     | Un seul téléphone à table → aucun backend                 |
| Comptes, authentification           | Sans objet                                                |
| Historique des parties terminées    | Non demandé ; le journal des tours le permettrait en v2   |
| Aide-mémoire des règles dans l'app  | La table connaît les règles                               |
| Réglages de règles (objectif, seuil)| Verrouillés en dur, un écran de moins                     |
| Mode clair                          | Thème feutre unique                                       |
| Anglais / i18n                      | Français uniquement                                       |
| Tour de dernière chance             | Arrêt immédiat à 5 000                                    |
| Édition libre du carnet, undo multi | Une seule annulation suffit à l'usage réel                |
| CI GitHub Actions                   | Tests lancés en local ; Vercel construit à chaque push    |

---

## 10. Décisions issues de l'entretien

| Sujet                | Décision                                                        |
| -------------------- | --------------------------------------------------------------- |
| Nature de l'app      | Carnet de scores, aucun dé                                      |
| Saisie               | Pavé numérique **+** rangée de raccourcis                        |
| Multi-joueur         | Un seul téléphone, localStorage, hors-ligne                     |
| Ouverture ratée      | Aucune pénalité, on reste à 0                                   |
| Dépassement          | Rebond `5000 − surplus`, plancher à 0                           |
| Score déjà pris      | Recul de l'adversaire à son score précédent, sans chaîne ni zéro |
| Équipes              | Tablées nommées, roster de joueurs partagé, dernière jouée en tête |
| Victoire             | 5 000 pile, arrêt immédiat                                      |
| Validation           | Multiples de 50 uniquement                                      |
| Joueurs              | Roster mémorisé + emoji, sans limite de nombre                  |
| Ordre de jeu         | Ordre de sélection, figé · premier joueur tiré au sort           |
| Écran de jeu         | Option **D** : classement + carnet dépliable                    |
| Correction           | Annuler le dernier score                                        |
| Progression          | Jauges + courbe + stats de fin                                  |
| Cas de table         | Passer un tour · retirer · ajouter en cours                     |
| Persistance          | Une partie en cours, reprise automatique                        |
| Stockage             | Adaptateur asynchrone, `localStorage` aujourd'hui, Postgres prêt |
| Confort              | Wake lock · vibration · sons (off par défaut) · PWA hors-ligne  |
| Direction artistique | Feutre de table, thème sombre unique                            |
| Lisibilité           | Densité équilibrée                                              |
| Qualité              | Moteur de score testé unitairement (Vitest)                     |
| Langue               | Français uniquement                                             |
| Hébergement          | Vercel, dépôt public `Thoumar/cinq-mille`                       |
