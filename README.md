# Data Lava Lamp

A build-free website that turns cached fragments of open text datasets into a drifting installation piece.

## Included dataset channels

- `HuggingFaceFW/fineweb-edu`: the softer, more legible stream
- `allenai/dolma3_mix-150B-1025`: a rougher alternate stream based on a cached `education_and_jobs` shard

Both are cached locally so the piece stays fast and stable.

## Features

- dataset switching between FineWeb and Dolma
- optional labels for domain, category, source type, length, and dump/year
- speed and density controls
- palette shuffling
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

## Files

- `index.html`: installation layout and controls
- `styles.css`: stage design, theming, and motion
- `app.js`: dataset loading, switching, labels, and spawning
- `data/fineweb-edu-sample.json`: cached FineWeb excerpts plus curator tags
- `data/dolma-education-sample.json`: cached Dolma excerpts from a safe downloaded shard

## Notes

- Labels are a mix of dataset metadata and lightweight curator tags.
- The prototype still uses cached excerpts rather than live row fetching.
- If we want the piece to feel even stranger later, the next step is expanding Dolma beyond `education_and_jobs` into a broader filtered multi-category cache.
