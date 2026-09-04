# Gallo Giro Ops Planner

Application de planification opérationnelle pour prévoir les ventes des restaurants Gallo Giro et préparer les commandes fournisseurs. Le dépôt contient le frontend **Astro + React + TypeScript** destiné à Vercel et l’API **Node.js + TypeScript + PostgreSQL** destinée à Railway.

## Installation et lancement

Prérequis : Node.js 20 ou plus récent.

```bash
npm install
npm run dev
```

Astro indique l’adresse locale, généralement `http://localhost:4321`.

Pour vérifier et produire une version statique :

```bash
npm test
npm run build
npm run preview
```

L’API se lance séparément :

```bash
npm run backend:install
cp backend/.env.example backend/.env
# renseigner les valeurs locales dans backend/.env
npm --prefix backend run migrate
npm --prefix backend run seed
npm run backend:dev
```

Définir `PUBLIC_API_URL=http://localhost:3000` dans `.env` pour activer la connexion sécurisée du frontend. Sans cette variable, le frontend reste volontairement en mode maquette locale, clairement marqué `LOCAL DEMO`.

## Parcours de démonstration

1. Choisir un restaurant et le début de la fenêtre de sept jours.
2. Examiner la météo de démonstration, les quatre jours comparables et la prévision suggérée.
3. Ajuster si nécessaire les prévisions manager, puis cliquer **Validate Sales Forecast**.
4. Cliquer **Calculate Product Needs** pour appliquer les ratios, le stock de sécurité et l’inventaire en unités.
5. Examiner la conversion du besoin net en cartons complets, puis ajuster les commandes par fournisseur.
6. Valider la commande préparée. Aucune commande réelle n’est envoyée.
7. Vérifier que les lignes Artimex validées apparaissent dans **Artimex Consolidation**, séparément du calcul de production.
8. Modifier une prévision validée pour constater l’invalidation des besoins et le retrait de la consolidation jusqu’au recalcul.

Une nouvelle confirmation pour le même restaurant et la même date remplace la commande active dans les vues consolidées. Chaque confirmation reste néanmoins visible dans l’historique de démonstration.

## Structure

- `src/pages/index.astro` : point d’entrée Astro.
- `src/components/App.tsx` : navigation, écrans et composants React de l’application.
- `src/lib/types.ts` : types métier TypeScript.
- `src/lib/data.ts` : restaurants, produits et état initial fictifs.
- `src/lib/calculations.ts` : fonctions pures de prévision, stock et commande.
- `src/lib/storage.ts` : persistance locale dans le navigateur.
- `src/lib/api.ts` : client HTTPS vers l’API Railway.
- `src/styles/global.css` : design global et adaptation mobile.
- `public/brand/el-gallo-giro-logo.png` : logo de marque provenant du site officiel gallogiro.com.
- `src/lib/calculations.test.ts` : tests des règles métier principales.
- `src/components/App.test.tsx` : test d’intégration du parcours Canoga Park et de toutes les routes.
- `backend/src` : API, authentification serveur, météo et permissions.
- `backend/migrations` : schéma PostgreSQL versionné.

## Règles de calcul

- Prévision suggérée = ventes historiques de quatre jours de semaine comparables × ajustement météo.
- Règles initiales : très chaud −30 %, chaud −15 %, doux 0 %, froid +40 %. Elles sont configurables et explicitement présentées comme règles métier provisoires.
- Consommation attendue = prévision manager validée ÷ 1 000 × ratio produit par tranche de 1 000 dollars.
- Besoin net = `max(0, consommation + stock de sécurité − stock disponible − réceptions confirmées)`.
- Cartons requis = `ceil(besoin net ÷ unités par carton)` ; les commandes négatives sont impossibles.
- Une prévision non validée ne crée aucun besoin ni aucune commande fournisseur finale.
- Seules les commandes restaurant validées alimentent la consolidation Artimex. La production Artimex est calculée séparément après marge, stock congelé et production déjà planifiée.

## Persistance et réinitialisation

Stocks, réglages, quantités manuelles et confirmations sont enregistrés dans le `localStorage` du navigateur. Le bouton **Reset demo data** de **Rules & Settings** demande une confirmation avant de supprimer ces données locales.

## Déploiement Vercel et Railway

### Frontend Vercel

Configurer la variable :

```text
PUBLIC_API_URL=https://VOTRE-API.up.railway.app
```

Puis construire avec `npm run build`. Le navigateur ne reçoit jamais `DATABASE_URL` ni la clé météo.

### Backend Railway

Créer un service PostgreSQL, puis un service depuis ce dépôt avec le dossier racine `backend`. Configurer :

```text
DATABASE_URL=${{Postgres.DATABASE_URL}}
FRONTEND_URL=https://egg-planner.vercel.app
SESSION_COOKIE_NAME=gg_session
SESSION_TTL_HOURS=12
OPEN_METEO_BASE_URL=https://customer-api.open-meteo.com/v1
OPEN_METEO_API_KEY=secret-commercial-open-meteo
HF_TOKEN=secret-hugging-face
HF_MODEL=Qwen/Qwen3-32B
HF_API_URL=https://router.huggingface.co/v1/chat/completions
SUPER_ADMIN_EMAIL=secret
SUPER_ADMIN_PASSWORD=secret
SUPER_ADMIN_NAME=Olivier
NODE_ENV=production
```

Build : `npm run build`. Démarrage : `npm start`. Exécuter `npm run migrate`, puis `npm run seed` une seule fois au premier déploiement. Le seed est idempotent et ne remplace pas le mot de passe d’un super admin existant. La route `GET /api/health` vérifie aussi PostgreSQL.

La version gratuite d’Open-Meteo est réservée aux usages non commerciaux. Pour cette application commerciale, configurer un abonnement et le endpoint `customer-api`; l’attribution Open-Meteo doit rester visible à proximité des données météo.

## État fonctionnel et limites

- Les dix restaurants demandés sont référencés, mais leurs adresses et coordonnées ne sont pas inventées : ils restent `Location not configured` jusqu’à validation.
- Le backend fournit le schéma persistant, les sessions, la séparation manager/corporate, la météo avec cache, l’historique des ventes, l’export Artimex approuvé et l’audit super admin.
- Le raccordement complet des feuilles de prévision, imports CSV et mutations de commande du frontend aux modèles PostgreSQL reste à terminer après configuration réelle de Railway.
- Les modes Manager et Corporate facilitent le parcours de démonstration ; ce ne sont pas des permissions.
- Aucune connexion à Toast, Aloha, Global Bake ou un fournisseur.
- Aucun envoi réel de commande.
- Le CSV exporté sert uniquement à la revue du plan. Il ne constitue pas un format d’import Global Bake validé ou compatible.
- Les prix, historiques, stocks, conditionnements, calendriers de livraison et seuils doivent être remplacés par des données validées avant tout usage opérationnel.
