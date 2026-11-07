# AURALIS Originals

A small catalog of original, calm music (piano, violin, cello, strings, celesta)
generated entirely in code, with matching cover art. Licensed **CC BY 4.0**, so
anyone can use and remix the tracks, including in the Mixing Studio's merge tool.

| File | What it does |
|---|---|
| `synth.ts` | Additive piano, bowed strings, string pad, celesta/bell, Freeverb reverb, mastering |
| `compose.ts` | Chord parsing, voice leading, arpeggio/waltz/block accompaniment, motif-based melodies |
| `tracks.ts` | The 8 pieces (key, tempo, form, instruments) and their metadata; 2 albums |
| `covers.ts` | SVG cover art, rendered to PNG with `sharp` |
| `publish.ts` | Uploads everything to a running server through the public API |

Everything is deterministic (seeded), so the files don't need to live in git.

```bash
npx tsx scripts/originals/generate.ts      # → .data/originals/*.wav (~30 s per track)
npx tsx scripts/originals/covers.ts        # → .data/originals/*.png
ORIGINALS_EMAIL=you@example.com ORIGINALS_PASSWORD='…' \
  npx tsx scripts/originals/publish.ts https://music.example.com
```

`publish.ts` signs in (or creates) the artist account, creates the albums
"Winter Tales" and "Still Waters", uploads the tracks with covers and analysis,
and builds the public playlist "Calm Melodies". Re-running skips
tracks that already exist.
