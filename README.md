# Film Studio Companion

One workspace for AI filmmaking: a node canvas, a cinema optical stack, short-drama breakdowns, a timeline and a bring-your-own-model hub, with Claude as the "Power Engine".

The site is a static Next.js export, deployed to GitHub Pages by `.github/workflows/pages.yml` on every push to `main`.

## Using Claude without an API key

The Power Engine runs on your own Claude sign-in through Claude Code on your computer, via the local bridge:

1. Install [Claude Code](https://claude.com/claude-code) and sign in once (`claude` in a terminal).
2. Clone this repo and start the bridge (Node 18+): `node bridge/fsc-bridge.mjs` (Windows: `start-bridge.ps1`).
3. Open the site → **Settings → Local bridge**, paste the token the bridge prints, click **Save & check**.

The bridge listens on 127.0.0.1 only and needs its token on every request. You can also save an Anthropic API key in Settings instead. Keys and tokens are stored encrypted in your own browser, never on the site.

## Local development

```bash
npm install
npm run build        # static site in ./out
```

Photos in `public/stock` are free Unsplash images; see `public/stock/CREDITS.md`.
