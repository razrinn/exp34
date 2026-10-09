# exp34

A browser combat game with turn-based attacks, rhythm inputs, and timed defense.
Win five fights, choose upgrades between encounters, and defeat the Warden.

**[Play exp34](https://exp34.rzrn.dev)**

## Controls

| Key | Action |
| --- | --- |
| Q / W / E | Quickstep / Flurry / Onslaught |
| I / O | Parry / Dodge |
| P | Heal on your turn; restart after a run |

During attacks, press the shown I/O/P key when the marker reaches gold.
On mobile, tap the matching button. Defend just before enemy impact:
yellow attacks allow parry or dodge; red attacks require dodge.
Parries charge your next attack, and a fully parried yellow combo earns a counter.

Help & settings includes a practice timing bar, sound effects, music, and volume.
Audio starts after your first interaction. Progress saves in your browser between
encounters; refreshing during combat restarts that encounter.

## Run locally

Use Node.js 24.16.0 (the version used by Cloudflare builds), npm, and Python 3.

```sh
npm ci
npm start
```

Open [localhost:8034](http://localhost:8034). The server binds to localhost.
WebGL2 renders the 3D scene; unsupported browsers fall back to symbols.

## Checks

```sh
npm test                 # Combat, timing, audio, rendering, and save tests
npm run balance         # Seeded simulations; assumed inputs, not player data
npm run build           # Static files in dist/; checks local module imports
npm run deploy -- --dry-run
```

## Deploy

Cloudflare Workers serves static assets at **exp34.rzrn.dev**, with no server
runtime. Models, textures, Three.js, sound effects, and music all run locally in
the browser. The previous local production server is stopped.

Pushes to `main` in [razrinn/exp34](https://github.com/razrinn/exp34) automatically
run tests and deploy through Cloudflare Workers Builds. Other branches do not
deploy. View build logs in the Worker's **Settings → Builds**.

For a manual deployment:

```sh
npx cf auth login
npm run deploy
```

The pinned `cf` beta uses `cloudflare.config.ts` for the account and domain,
and Wrangler internally with `wrangler.config.ts` to package static assets.
The alternate URL is [exp34.razrinn.workers.dev](https://exp34.razrinn.workers.dev);
browser saves are separate for each origin.

See [CREDITS.md](CREDITS.md) for asset sources and licenses. Development history
is in the Git commits.
