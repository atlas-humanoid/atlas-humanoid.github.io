# Learning-loop illustration

Reproducible Remotion source for the website's animated learning loop. This is a
**mechanism illustration, not a measurement**: movement, timing and visual traces
explain the process and must not be read as experimental data.

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
and duration. Current targets are `LearningLoop` (1920 × 640) and
`LearningLoopMobile` (960 × 900), both 630 frames at 30 fps (21 seconds).

Default outputs are `media/learning_loop.mp4`, `media/learning_loop.jpg`,
`media/learning_loop_mobile.mp4`, and `media/learning_loop_mobile.jpg` at the repo
root. Videos are silent H.264, CRF 18, yuv420p, with Fast Start metadata verified
before replacing an existing asset. Posters use frame 570 (19 seconds) by default.

Preview a frame without rendering the video:

```sh
npm run render -- --still 300 --poster out/frame-300.png
npm run render -- --composition LearningLoopMobile --still 570 --poster out/mobile-final.jpg
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
No website media is copied into the bundle: the animation consists of local
HTML/SVG and bundled font assets. Build dependencies and intermediate output stay
inside this tool directory or a temporary directory and are not website assets.

The script uses Remotion's documented [bundle](https://www.remotion.dev/docs/bundle),
[selectComposition](https://www.remotion.dev/docs/renderer/select-composition),
[renderMedia](https://www.remotion.dev/docs/renderer/render-media), and
[renderStill](https://www.remotion.dev/docs/renderer/render-still) APIs.
