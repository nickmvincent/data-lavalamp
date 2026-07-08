# Data Lava Lamp

A build-free website that turns cached fragments of open text datasets into a drifting AI-literacy installation.

## Included dataset channels

### Pre-training

- `HuggingFaceFW/fineweb-edu`: the softer, more legible stream
- `allenai/dolma3_mix-150B-1025`: a rougher alternate stream based on a cached `education_and_jobs` shard

### Post-training

- `OpenAssistant/oasst1`: a small cached slice of public prompt, reply, and review-style assistant conversation data

All streams are cached locally so the piece stays fast and stable.

## Features

- pre-training/post-training stage switching
- dataset switching between FineWeb and Dolma
- one cached OpenAssistant post-training stream
- optional labels for domain, category, source type, length, and dump/year
- post-training labels for role, review count, and quality-style metadata
- speed and density controls
- palette shuffling
- neon and terminal/hacker-lamp visual views
- explainer modal with dataset cards and background readings
- hideable interface plus browser fullscreen presentation mode
- reduced-motion fallback

## Run it

Serve the folder over HTTP:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

Keyboard shortcuts:

- `i`: toggle the interface chrome
- `f`: enter or exit fullscreen mode

## Cloudflare Pages

This project is configured for Cloudflare Pages Direct Upload through Wrangler.
The app is static today, so the build step only copies the deployable files into
`dist/`.

```bash
npm install
npm run build
npm run pages:dev
npm run pages:deploy
```

The Pages project name is `data-lavalamp`, configured in `wrangler.jsonc`.

For personal/work account switching, prefer project-scoped environment variables
over relying on one global `wrangler login` state:

```bash
export CLOUDFLARE_ACCOUNT_ID="..."
export CLOUDFLARE_API_TOKEN="..."
npm run pages:deploy
```

Good local options are `direnv`, a password-manager CLI, or shell aliases such
as `cf-personal` and `cf-work` that export different account IDs and API tokens.
Do not commit `.env`, `.dev.vars`, or API tokens.

If the future version streams live Hugging Face data, keep this static build as
the fallback and add a Pages Function or Worker endpoint for fetching,
normalizing, and caching random dataset rows.

## Files

- `index.html`: installation layout and controls
- `styles.css`: stage design, theming, and motion
- `app.js`: dataset loading, switching, labels, and spawning
- `wrangler.jsonc`: Cloudflare Pages project configuration
- `scripts/build-pages.mjs`: copies static deploy assets into `dist/`
- `data/fineweb-edu-sample.json`: cached FineWeb excerpts plus curator tags
- `data/dolma-education-sample.json`: cached Dolma excerpts from a safe downloaded shard
- `data/oasst1-post-training-sample.json`: cached OpenAssistant-style post-training excerpts

## Notes

- Labels are a mix of dataset metadata and lightweight curator tags.
- The prototype still uses cached excerpts rather than live row fetching.
- The next natural step is wiring the post-training side to stream random Hugging Face-hosted datasets while keeping this cached mode as the fast fallback.
