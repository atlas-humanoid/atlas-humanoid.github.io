# Learning loop: real footage and mechanism illustration

Reproducible Remotion source for the website's integrated learning loop: real
robot footage paired with an animated explanation. The original 21-second source
video, `media/stairs_run_3x.mp4`, retains every frame in order and its existing
playback timing. Completed columns freeze; future columns use ghost placeholders.
These columns show successive stages of the same source timeline, not parallel
trials. The accompanying animation is a **mechanism illustration, not a
measurement**; its positions and visual traces are explanatory rather than data.

Use Node.js 22 or newer. All Remotion packages are pinned to the same version and
the lockfile records the full dependency tree. Geist is bundled locally from
`@fontsource/geist`; rendering does not fetch a remote font.

```sh
cd tools/learning-loop
npm ci
npm run typecheck
npm run render
npm run render -- --composition LearningLoopMobile
```

The registered compositions in `src/index.tsx` determine dimensions, frame rate
and duration. Current targets are `LearningLoop` (1920 × 880) and
`LearningLoopMobile` (960 × 1400), both 630 frames at 30 fps (21 seconds).

Default outputs are `media/learning_loop.mp4`, `media/learning_loop.jpg`,
`media/learning_loop_mobile.mp4`, and `media/learning_loop_mobile.jpg` at the repo
root. Videos are silent H.264, CRF 18, yuv420p, with Fast Start metadata verified
before replacing an existing asset. Posters use frame 570 (19 seconds) by default.

Preview a frame without rendering the video:

```sh
npm run render -- --still 300 --poster out/frame-300.png
npm run render -- --composition LearningLoopMobile --still 570 --poster out/mobile-final.jpg
# Studio already maps the repository's media directory for local preview:
npm run studio
```

Use `--output`, `--poster`, `--poster-frame`, or `--concurrency` to override the
defaults. Relative output paths resolve from this directory, regardless of the
shell's working directory. Run `npm run render -- --help` for all options.

The renderer reuses the workstation's existing Chrome for Testing and shared
libraries when present. Other machines can configure their own browser:

```sh
REMOTION_BROWSER_EXECUTABLE=/absolute/path/to/chrome npm run render
# Optional, when Chromium's shared libraries are outside the system paths:
REMOTION_CHROME_LIBS=/absolute/path/to/lib npm run render
```

Without a configured or cached browser, Remotion manages its browser normally.
Each render creates a temporary public directory containing only four required
files from the website's `media` directory:

- `stairs_run_3x.mp4`
- `run_ghost_1.jpg`
- `run_ghost_2.jpg`
- `run_ghost_3.jpg`

Studio uses `../../media` as its public directory so the same filenames resolve
during interactive preview. This does not change the renderer's four-file bundle.

The component accesses them through `staticFile('stairs_run_3x.mp4')` and
`staticFile('run_ghost_1.jpg')`, etc. Missing inputs fail the render rather than
silently producing empty video panels. No unrelated media is bundled. Build
dependencies and intermediate output stay inside this tool directory or a
temporary directory and are not website assets.

`OffthreadVideo` uses frame extraction during rendering. `Freeze` holds a
completed panel at a specified source-frame position. Keep playback rate at 1
relative to the provided 21-second source, and avoid adding trim offsets to
absolute source-frame positions. Freeze only the footage panel; keep the
explanatory animation outside that wrapper so its timeline can continue.

The script uses Remotion's documented [bundle](https://www.remotion.dev/docs/bundle),
[selectComposition](https://www.remotion.dev/docs/renderer/select-composition),
[renderMedia](https://www.remotion.dev/docs/renderer/render-media), and
[renderStill](https://www.remotion.dev/docs/renderer/render-still) APIs. See also
[OffthreadVideo](https://www.remotion.dev/docs/offthreadvideo) and
[Freeze](https://www.remotion.dev/docs/freeze) for the footage components.
