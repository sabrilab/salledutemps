# Salle du temps

Reconstitution navigable de la salle du temps (Dragon Ball Z) en Three.js, avec un rendu poussé : PBR, IBL généré, ombres douces, SSAO (N8AO), bloom, tonemapping ACES, brume, grain, objectif grand angle. Deux ambiances : **nuit** (sombre, orageuse, sol mouillé) et **jour** (le vide blanc éclatant de l'anime).

Toute la géométrie et les textures sont générées dans le code (aucune image de l'anime n'est incluse). Le personnage est un mannequin robot original, monté sur le squelette Mixamo et animé avec les animations de la bibliothèque `mixamo-library` (idle, marche, course, saut).

## Contrôles

ZQSD / WASD (ou flèches) pour se déplacer, Maj pour courir, Espace pour sauter, souris pour la caméra (clic pour capturer le pointeur), molette pour la distance, **N** pour basculer nuit / jour, H pour masquer l'aide. Sur mobile : moitié gauche = joystick, moitié droite = caméra.

Paramètres d'URL : `?mood=jour`, `?q=low` (qualité réduite).

## Développement

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # dist/
```

- `src/world.js` : vide, parvis, bâtiment à coupole, deux tours, intérieur (hall au sablier, chambre, cuisine/réserve, bain), collisions.
- `src/textures.js` : textures procédurales (dalles, enduit, pierre, bois, tissus, tapis).
- `src/mannequin.js` : mannequin robot construit sur le squelette Mixamo.
- `src/main.js` : rendu, post-process, ambiances, contrôle 3e personne.
- `tools/convert.html` + `tools/convert.mjs` : conversion des FBX Mixamo en un GLB compact (squelette + 4 animations, sans maillage).
- `tools/shot.mjs` : captures d'écran de contrôle (`node tools/shot.mjs hall nuit out.png`).
