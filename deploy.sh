#!/usr/bin/env bash
# Déploiement du front Magic EDH sur lxc-mtg-front.
# Versionné dans le dépôt (contrairement à sw-coaching où il vivait hors du
# clone, donc hors de tout historique).
set -euo pipefail

cd "$(dirname "$0")"

git pull
npm ci                 # installe exactement le lockfile
npm run build          # set -e arrête ici si le build casse

# `output: "standalone"` ne recopie ni les assets statiques ni public/ :
# c'est à faire à la main, sinon le site sort sans CSS ni images.
cp -r .next/static .next/standalone/.next/
[ -d public ] && cp -r public .next/standalone/

sudo systemctl restart magic-edh-front
echo "✓ Front déployé"
