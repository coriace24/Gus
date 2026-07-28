# Gus — ASD grammar site

Two deliverables live in this repo and **both must be produced on every update**.

## 1. The website — `exercices/`

The `/exercices/` subtree of akuetesd.com: a bilingual grammar map plus an
exercise engine.

```
exercices/
├── index.html              hub page (FLE / ESL cards)
├── fle/index.html          French map + engine — curriculum lives in `const D = [...]`
├── esl/index.html          English map + engine — same structure
├── js/exercises-french.js  question bank, defines EXFR
├── js/exercises-english.js question bank, defines EXEN
├── js/grammar-scroll.js    scroll restoration
└── assets/                 favicons
```

A grammar point is an object in the page's `D` array:
`{ name, gn, ge[], pitfall }` — name, grammar note, examples, common pitfall.
**`name` is the join key** into the question bank (`EXFR[name]` / `EXEN[name]`);
changing a name orphans its 40 exercises. Every topic must have a grammar note.
The teacher-facing `steps` arrays were removed from the site (they belong to the
teacher's guide) — the renderer still tolerates them via `(item.steps||[])`.

Each topic has exactly 40 questions: 15 fill (`f`), 10 MCQ (`m`), 4 matching
(`x`), 11 flashcard (`c`), in that order.

### Exercise engine facts that constrain the data

- **Parentheses are stripped from fill questions before display.** Put every cue
  in `[square brackets]`, never `(round ones)`.
- Fill grading: lowercased, trimmed, whitespace collapsed, curly apostrophes
  normalised, trailing `.!?` removed, then compared against the answer
  **split on `/`**. So `a:"don't/do not"` accepts both. **No spaces around the
  slash** — `"a / b"` can never match. Accents and hyphens must be exact.
- MCQ options are shuffled at runtime; keep the correct option first with `a:0`.
- Matching shuffles both columns: no right-hand item may fit two left-hand items.
- Flashcard distractors are drawn from the *other* flashcard answers of the same
  topic, so those 11 answers must not be interchangeable.
- Files are **CRLF**, UTF-8. Preserve that.
- Append new topics at the `// INSERT_NEXT` marker in the bank files.

## 2. The teacher's guide — `teacher-guide/`

```
teacher-guide/
├── build-guide.js          generator — regenerates the guide from exercices/
├── data/steps-fr.json      archived four-step teaching sequences (FLE)
├── data/steps-en.json      archived four-step teaching sequences (ESL)
└── guide-enseignant.html   the guide (generated — never hand-edit)
```

The guide joins the live curriculum (grammar notes, examples, pitfalls, topic
order, exercise counts read straight from `exercices/`) with the archived
teaching sequences, which are no longer in the website itself.

It is an internal working document: it carries `noindex, nofollow` and is **not**
part of the deployed site.

## Required workflow on any change

1. Change the site under `exercices/`.
2. If a topic was added, removed or renamed, add or update its teaching sequence
   in `teacher-guide/data/steps-<lang>.json` under the exact topic name.
3. Regenerate the guide:
   ```
   node teacher-guide/build-guide.js
   ```
4. Verify before shipping — the site and the guide must agree:
   - every curriculum topic has a grammar note and 40 exercises;
   - curriculum names and bank keys cross-match with no orphans either way;
   - both pages parse and the guide reports the expected topic/step counts.
5. **Deliver both files to the user: the site zip and
   `teacher-guide/guide-enseignant.html`.** This is a standing instruction —
   never ship one without the other.
