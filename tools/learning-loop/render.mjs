import {bundle} from '@remotion/bundler';
import {openBrowser, renderMedia, renderStill, selectComposition} from '@remotion/renderer';
import {existsSync} from 'node:fs';
import {copyFile, mkdir, mkdtemp, readFile, rename, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';

const projectDir = path.dirname(fileURLToPath(import.meta.url));
const repoDir = path.resolve(projectDir, '../..');
const {values} = parseArgs({
  options: {
    composition: {type: 'string', default: 'LearningLoop'},
    output: {type: 'string'},
    poster: {type: 'string'},
    'poster-frame': {type: 'string', default: '570'},
    still: {type: 'string'},
    concurrency: {type: 'string', default: '4'},
    browser: {type: 'string'},
    help: {type: 'boolean', short: 'h'},
  },
});

if (values.help) {
  console.log(`Render the ATLAS learning loop with real footage and a mechanism illustration.

  npm run render
  npm run render -- --composition LearningLoopMobile
  npm run render -- --still 570 --poster out/preview.png

Options:
  --composition ID   Registered composition (default: LearningLoop)
  --output PATH      MP4 output (default: ../../media/learning_loop.mp4)
  --poster PATH      JPEG/PNG poster (default: MP4 path with .jpg extension)
  --poster-frame N   Poster frame for a full render (default: 570)
  --still N          Render only frame N to --poster
  --concurrency N    Parallel frame renders (default: 4)
  --browser PATH     Existing Chromium executable

Relative output paths resolve from tools/learning-loop, regardless of cwd.
LearningLoopMobile defaults to ../../media/learning_loop_mobile.mp4.
Dimensions, duration and fps are read from the selected composition.
REMOTION_BROWSER_EXECUTABLE and REMOTION_CHROME_LIBS override browser setup.`);
  process.exit(0);
}

function integer(value, name, minimum = 0) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < minimum) {
    throw new Error(`${name} must be an integer >= ${minimum}; received ${value}`);
  }
  return number;
}

const concurrency = integer(values.concurrency, '--concurrency', 1);
const posterFrame = integer(values.still ?? values['poster-frame'], '--still/--poster-frame');
const defaultStem = values.composition === 'LearningLoopMobile' ? 'learning_loop_mobile' : 'learning_loop';
const output = path.resolve(projectDir, values.output ?? path.join(repoDir, 'media', `${defaultStem}.mp4`));
const poster = path.resolve(projectDir, values.poster ?? output.replace(/\.mp4$/i, '.jpg'));
const posterExt = path.extname(poster).toLowerCase();
if (path.extname(output).toLowerCase() !== '.mp4') throw new Error('--output must end in .mp4');
if (!['.jpg', '.jpeg', '.png'].includes(posterExt)) throw new Error('--poster must end in .jpg, .jpeg or .png');

const cachedBrowser = '/home/rant/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome';
const browserExecutable = values.browser ?? process.env.REMOTION_BROWSER_EXECUTABLE ??
  (existsSync(cachedBrowser) ? cachedBrowser : undefined);
if (browserExecutable && !existsSync(browserExecutable)) {
  throw new Error(`Chromium executable does not exist: ${browserExecutable}`);
}
const cachedLibraries = '/home/rant/.cache/chromelibs/root/usr/lib/x86_64-linux-gnu';
const chromeLibraries = process.env.REMOTION_CHROME_LIBS ??
  (existsSync(cachedLibraries) ? cachedLibraries : undefined);
if (chromeLibraries) {
  process.env.LD_LIBRARY_PATH = [chromeLibraries, process.env.LD_LIBRARY_PATH].filter(Boolean).join(path.delimiter);
}

// Remotion's H.264 MP4 renderer finalizes Fast Start itself. Check that the
// metadata box precedes video data before replacing the site's existing asset.
async function assertFastStart(filename) {
  const data = await readFile(filename);
  const boxes = [];
  for (let offset = 0; offset + 8 <= data.length;) {
    const length32 = data.readUInt32BE(offset);
    const type = data.toString('ascii', offset + 4, offset + 8);
    const length = length32 === 1 ? Number(data.readBigUInt64BE(offset + 8)) :
      length32 === 0 ? data.length - offset : length32;
    if (length < 8 || offset + length > data.length) throw new Error(`Invalid MP4 box: ${type}`);
    boxes.push(type);
    offset += length;
  }
  if (!boxes.includes('moov') || !boxes.includes('mdat') || boxes.indexOf('moov') > boxes.indexOf('mdat')) {
    throw new Error('Rendered MP4 is missing Fast Start metadata before video data');
  }
}

const scratch = await mkdtemp(path.join(tmpdir(), 'atlas-learning-loop-'));
let browser;
try {
  // Keep the bundle self-contained without copying unrelated website media.
  // These names are the complete staticFile() contract used by the composition.
  const publicDir = path.join(scratch, 'public');
  await mkdir(publicDir);
  for (const filename of ['stairs_run_3x.mp4', 'run_ghost_1.jpg', 'run_ghost_2.jpg', 'run_ghost_3.jpg']) {
    await copyFile(path.join(repoDir, 'media', filename), path.join(publicDir, filename));
  }
  console.log(`Bundling ${values.composition}…`);
  const serveUrl = await bundle({
    entryPoint: path.join(projectDir, 'src/index.tsx'),
    rootDir: projectDir,
    outDir: path.join(scratch, 'bundle'),
    publicDir,
  });
  browser = await openBrowser('chrome', {
    browserExecutable,
    chromeMode: 'chrome-for-testing',
    chromiumOptions: {headless: true},
    logLevel: 'warn',
  });
  const composition = await selectComposition({
    serveUrl,
    id: values.composition,
    puppeteerInstance: browser,
    logLevel: 'warn',
  });
  if (posterFrame >= composition.durationInFrames) {
    throw new Error(`Frame ${posterFrame} is outside ${composition.id} (0–${composition.durationInFrames - 1})`);
  }
  console.log(`${composition.id}: ${composition.width}×${composition.height}, ${composition.fps} fps, ` +
    `${composition.durationInFrames} frames (${composition.durationInFrames / composition.fps}s)`);
  await mkdir(path.dirname(poster), {recursive: true});
  const temporaryPoster = path.join(path.dirname(poster), `.${path.basename(poster)}.${process.pid}${posterExt}`);
  try {
    await renderStill({
      composition,
      serveUrl,
      puppeteerInstance: browser,
      frame: posterFrame,
      output: temporaryPoster,
      imageFormat: posterExt === '.png' ? 'png' : 'jpeg',
      ...(posterExt === '.png' ? {} : {jpegQuality: 95}),
      logLevel: 'warn',
    });
    await rename(temporaryPoster, poster);
  } finally {
    await rm(temporaryPoster, {force: true});
  }
  console.log(`Poster: ${poster} (frame ${posterFrame})`);
  if (values.still === undefined) {
    await mkdir(path.dirname(output), {recursive: true});
    const temporaryVideo = path.join(path.dirname(output), `.${path.basename(output)}.${process.pid}.mp4`);
    let lastProgress = -1;
    try {
      await renderMedia({
        composition,
        serveUrl,
        puppeteerInstance: browser,
        outputLocation: temporaryVideo,
        codec: 'h264',
        pixelFormat: 'yuv420p',
        crf: 18,
        x264Preset: 'medium',
        imageFormat: 'png',
        muted: true,
        enforceAudioTrack: false,
        concurrency,
        logLevel: 'warn',
        onProgress: ({progress}) => {
          const percentage = Math.floor(progress * 10) * 10;
          if (percentage > lastProgress) {
            lastProgress = percentage;
            console.log(`Rendering: ${percentage}%`);
          }
        },
      });
      await assertFastStart(temporaryVideo);
      await rename(temporaryVideo, output);
    } finally {
      await rm(temporaryVideo, {force: true});
    }
    console.log(`Video: ${output} (silent H.264, yuv420p, Fast Start)`);
  }
} finally {
  if (browser) await browser.close({silent: true});
  await rm(scratch, {recursive: true, force: true});
}
