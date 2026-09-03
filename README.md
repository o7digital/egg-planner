# Gallo Giro Ops Planner

Application de démonstration pour prévoir les ventes des restaurants Gallo Giro et suggérer des commandes fournisseurs. Le projet reprend la maquette HTML/CSS/JavaScript fournie et la transforme en application **Astro + React + TypeScript**.

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

## Parcours de démonstration

1. Choisir un restaurant et une date.
2. Simuler une météo depuis **Dashboard** ou **Sales Forecast**.
3. Modifier le stock dans **Inventory** et vérifier les suggestions.
4. Ajuster les cartons dans **Suggested Orders**.
5. Ouvrir la revue et confirmer la commande de démonstration.
6. Vérifier **Corporate Overview**, **Artimex Consolidation** et **Order History**.
7. Exporter le CSV de planification Artimex si nécessaire.

Une nouvelle confirmation pour le même restaurant et la même date remplace la commande active dans les vues consolidées. Chaque confirmation reste néanmoins visible dans l’historique de démonstration.

## Structure

- `src/pages/index.astro` : point d’entrée Astro.
- `src/components/App.tsx` : navigation, écrans et composants React de l’application.
- `src/lib/types.ts` : types métier TypeScript.
- `src/lib/data.ts` : restaurants, produits et état initial fictifs.
- `src/lib/calculations.ts` : fonctions pures de prévision, stock et commande.
- `src/lib/storage.ts` : persistance locale dans le navigateur.
- `src/styles/global.css` : design global et adaptation mobile.
- `src/lib/calculations.test.ts` : tests des règles métier principales.

## Règles de calcul

- Prévision des ventes = moyenne historique du même jour de semaine × facteur météo × facteur de tendance.
- Météo initiale : chaud −30 %, froid +40 %, doux 0 %. Les valeurs sont modifiables dans **Rules & Settings**.
- Consommation prévue : consommation historique × mêmes facteurs, arrondie au carton supérieur.
- Commande suggérée = `max(0, consommation prévue + stock de sécurité − stock disponible)`.
- Une quantité saisie manuellement prend la priorité sur la suggestion et est conservée localement.

## Persistance et réinitialisation

Stocks, réglages, quantités manuelles et confirmations sont enregistrés dans le `localStorage` du navigateur. Le bouton **Reset demo data** de **Rules & Settings** demande une confirmation avant de supprimer ces données locales.

## Limites de la démonstration

- Toutes les données sont fictives et les restaurants doivent être confirmés.
- Les modes Manager et Corporate facilitent le parcours de démonstration ; ce ne sont pas des permissions.
- Aucun backend, aucune authentification et aucune base de données.
- Aucune connexion à Toast, Aloha, Global Bake, un fournisseur ou une API météo.
- Aucun envoi réel de commande.
- Le CSV exporté sert uniquement à la revue du plan. Il ne constitue pas un format d’import Global Bake validé ou compatible.
- Les prix, historiques, stocks, conditionnements, calendriers de livraison et seuils doivent être remplacés par des données validées avant tout usage opérationnel.
