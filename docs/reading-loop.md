# Reading Loop development and verification

Issue #14 adds opt-in source ↔ AI workflows while preserving the native PDF path.
This is a development-branch feature, not a published release.

## Intended acceptance matrix

| Area | Required evidence |
|---|---|
| Physical pages | Compatible fixture targets reached, denominator reported; target ≥95% |
| Quote geometry | Unique, verified, mappable quotes highlighted; target ≥90% |
| Conservative fallback | Repeated/absent quote → page only, model hint → page only, wrong document → failure |
| Isolation | Source + its Reader share state; independent same-URL tabs do not; late responses stay in original session |
| Reading continuity | Return restores zoom/rotation/scroll; repeated evidence clicks reuse Reader |
| Selection | Ask creates draft with zero requests; Translate explicitly calls existing provider; original retained |
| Recovery | Missing permission/expired source/local bytes loss retains analysis and offers reopen/reselect |
| Accessibility | Keyboard page/search/selection actions, Escape, non-hover return, status announcements |
| Layout | 300/360/450px panel, wide Reader, double-column, rotated page, high DPI, dark mode |
| No hidden work | Scroll/select/search/navigation cause zero AI requests; no implicit PDF archive |

## Reproducible fixtures

`python scripts/make-reading-fixtures.py` creates original deterministic PDFs in
`tests/browser/fixtures/`. They contain physical-page labels, unique and repeated
sentences, double-column content, an intrinsic rotation, a landscape page,
internal links and an outline. No real paper or private data is included.

These synthetic fixtures test mechanics, not the full diversity of publisher PDFs
or scientific translation quality. Fix the target set before counting successes;
do not remove failures from the denominator.

## Checks in this execution environment (2026-11-13)

Baseline commit `3984304726766d44071cc2e9cb88f78731235f74`:

- `npm run check`: passed before implementation changes.
- `npm test`: 67/68 passed. Existing Markdown image syntax became a clickable
  link when the image parsing rule was disabled. The fix keeps the parser rule
  and renders only escaped alternative text. Focused 5/5 Markdown tests pass.
- `npm run build`: passed; baseline bundle retained separately during development.

Actual Chromium process launch was attempted with Playwright persistent context,
`/usr/bin/chromium`, headless, `--no-sandbox`, and again with `--no-zygote
--single-process --disable-dev-shm-usage`, including an approved escalation.
All failed before startup with `process_singleton_posix.cc: socket() failed:
Operation not permitted`. Therefore no successful extension browser run is
claimed from those commands. The available managed cloud browser also refuses
`chrome://extensions` under its URL policy; that restriction was not bypassed.

Pending before full acceptance:

- Run the installed-extension smoke on an executor allowing browser sockets.
- Actual desktop Chrome Side Panel focus/open/close and native PDF compatibility.
- Publisher/arXiv/redirect/protected-source matrix and third-party PDF extension.
- Real 3–5-person observation of evidence/translation/return tasks.
- Authorized live-provider translation fidelity evaluation (no credentials or
  private PDFs belong in fixtures, logs, screenshots, or source control).

Do not close Issue #14 or claim its numerical targets met based on unit tests
alone. Report automation and human-observation coverage separately.

## Installed-extension smoke command

After `npm run build`, on a machine with Playwright and Chromium available:

```sh
python scripts/make-reading-fixtures.py
node scripts/browser-smoke.mjs
# Optional: HEADED=1 CHROMIUM_PATH=/path/to/chrome node scripts/browser-smoke.mjs
```

The harness is **written and syntax-checked, but not executed successfully** in
this restricted executor. It loads the unpacked MV3 bundle in a temporary profile
and runs the production Side Panel entrypoint in an inactive extension tab. This
is deliberately **not** a claim to test Chrome's native Side Panel focus/lifecycle.
It seeds dummy BYOK settings only, not workspace/session/anchor records. Synthetic
arXiv HTML/PDF and provider responses are intercepted; other HTTP(S) is blocked.
No live provider is contacted.

Its planned assertions now exercise production source → Reader creation, all 12
target canvases actually rendered near the viewport top (not merely input values),
verified quote/highlight geometry intersection, page-only model hints with no
highlight, return-position/zoom/rotation restoration, original-page protection and
Reader reuse. It drives selection Ask/Translate through real entrypoint handlers,
checks zero/one explicit provider calls, protects an edited draft, delays a mocked
translation while switching to an independent same-URL tab, then checks A's result
stays isolated. It also checks narrow panel overflow and captures dark/high-DPI
screenshots. Selection uses a DOM Range, not a mouse or touch drag. Screenshots and
results are written only after the corresponding steps run; failure reports name
the failing stage. These are intended checks, **not observed passes**.

## Automated integration coverage added

`tests/reader-flows.test.ts` executes the actual Side Panel entrypoint in happy-dom
with mocked Chrome and provider boundaries. It now checks evidence opens Reader
without changing the source URL; selection Ask makes zero model requests and
preserves an edited draft; explicit Translate makes one request and a delayed
answer remains in A while B is active; source/Reader share a draft while an
independent same-URL tab stays separate; an already-consumed selection does not
trigger a duplicate translation in another panel. This is **not** an installed
browser test. `tests/translation.test.ts` checks bounded context, exact selected
text, fidelity instructions and omission of local source paths.

## Adversarial review follow-up

Review found that selection return initially discarded the captured position, and
horizontal scrolling used the window rather than the Reader's overflow container.
Both are corrected: the selected quote now retains page, vertical scroll,
page-container horizontal scroll, zoom and rotation through background validation,
workspace persistence and the explicit Reader return message. Horizontal-only
scroll and rotation/zoom now schedule position checkpoints. The Reader rejects a
return for another document and can defer return during document loading.

After these fixes, strict TypeScript and production build passed; the full **105
Vitest tests in 18 files passed three times consecutively**. Added checks span background
position retention/validation, Side Panel return dispatch, Reader restore and
horizontal-only scrolling. These are deterministic mocked tests, not a replacement
for visual desktop-Chrome verification.

A nondeterministic integration-test failure was reproduced and corrected in the
test driver: it dispatched a submit as soon as the digest DOM rendered, while
the application was still busy saving and the Ask button remained disabled.
The journey now waits for the actual enabled interaction state before submitting;
three subsequent complete suite runs passed without extending timeout limits.
