# Installation du front sur `lxc-mtg-front` (192.168.1.144)

Debian 13 trixie, 2 vCPU / 2 Go / 17 Go.

## Étapes root (une seule fois)

```bash
# Le nodejs de Debian 13 est en 20.19.2 et Next 16 exige >= 20.9 : il suffit.
# (Pas besoin de NodeSource — c'est ce que fait déjà lxc-sw-coaching-front.)
sudo apt install -y git nodejs npm

# Le dossier créé s'appelait « mgt-front » (faute de frappe pour « mtg »).
sudo mv /opt/mgt-front /opt/mtg-front
```

## Installation applicative (utilisateur `julien`)

```bash
git clone https://github.com/JulienBourreau23/magic_edh_front.git /opt/mtg-front/magic_edh_front
cd /opt/mtg-front/magic_edh_front
npm ci
```

## `.env.local`

`NEXT_PUBLIC_*` est **figé au moment du build**, pas lu à l'exécution : il faut
donc que le fichier existe *avant* `npm run build`, sinon l'URL de l'API est
gravée en dur avec la valeur de repli.

```
NEXT_PUBLIC_API_URL=https://magic-edh-api.julien-cloud.eu
```

## Build et service

```bash
./deploy.sh        # npm ci, build, recopie des assets, restart
```

Le premier lancement doit se faire avant que l'unit ne soit installée ; poser
l'unit puis lancer :

```bash
sudo cp deploy/magic-edh-front.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now magic-edh-front
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/decks
```

## Notes de dimensionnement (mesuré)

| | |
|---|---|
| `npm run build` | pic **958 Mo** de RAM — c'est ce qui dimensionne le conteneur |
| service `standalone` | **35 Mo** de RSS |
| `.next/standalone` | 57 Mo, contre 797 Mo de `node_modules` |

Le build est donc le seul moment où les 2 Go servent à quelque chose. Les
`cp -r` de `deploy.sh` ne sont pas optionnels : `output: "standalone"` ne
recopie ni `.next/static` ni `public/`, et le site sortirait sans CSS.
