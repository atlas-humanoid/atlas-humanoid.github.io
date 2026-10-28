# Opening showcase media

Rebuild the website's opening videos from existing public repository media. The
script requires Python 3.8+ and FFmpeg/FFprobe with libx264; it uses no Python
packages and does not modify either source video.

```sh
python3 tools/opening-showcase/render.py
# Optional small review copies and a machine-readable verification report:
python3 tools/opening-showcase/render.py --preview-dir /absolute/path/to/previews
# Rebuild only one asset:
python3 tools/opening-showcase/render.py --only nav
```

| Output | Source | Source interval | Frames | Poster source time |
| --- | --- | --- | --- | --- |
| `media/stairs_showcase.mp4` / `.jpg` | `media/stairs_hero.mp4` | 0–12 s, complete source | 0–359 | 9.8 s, frame 294 |
| `media/nav_showcase.mp4` / `.jpg` | `media/nav_pick_1x.mp4` | 0.8–31.7 s, through the source's end | 24–950 | 5.3 s, frame 159 |

The stair source is the previously approved 12-second edit with variable playback
speed. This export preserves that existing timing and every frame; it must not be
described as an unmodified 1× recording. The navigation excerpt runs at 1.5× the
source's real speed, retaining the full continuous interval with both pickups and
their subsequent disposals through the end of the source recording. Its timestamps
are compressed and frames resampled to 30 fps, with no additional cuts.
No new crop, stabilization, sharpening, or aesthetic color adjustment is applied.
The time intervals use an exclusive end boundary; table frame numbers refer to
the original source.

Both outputs are 1920×1080, 30 fps, silent H.264, yuv420p, and limited-range BT.709,
with Fast Start (`moov` before `mdat`). Stairs uses CRF 19, preset `medium`;
navigation uses CRF 20, preset `slow` to keep the longer clip within the web asset
size budget. The complete stair video is 12 seconds / 360 frames; navigation is
20.6 seconds / 618 frames, from the same 30.9-second source interval.

The stair source already declares BT.709. Navigation declares the `bt470bg`
YCbCr matrix (BT.601 coefficients); its primaries and transfer function are
unspecified. FFmpeg's `scale` filter explicitly converts BT.601 to BT.709 matrix
coefficients while preserving the intended RGB appearance and limited range.
This is a matrix conversion, not simply new metadata and not a guessed gamma or
gamut correction. Output primaries and transfer metadata are BT.709 for consistent
HD web playback. See the official [FFmpeg scale filter documentation](https://ffmpeg.org/ffmpeg-filters.html#scale-1).

Posters come directly from the designated original source frames, converted to
standard full-range JPEG YCbCr at quality 2 with 4:4:4 chroma. The optional review
copies are 960×540; their videos use CRF 24 and are not production assets.

The script checks the source dimensions, fps, and color matrix before rendering;
then checks output dimensions, duration, decoded frame count, codec, pixel format,
BT.709 metadata, absence of audio, full decoding, and Fast Start. Each production
video must be smaller than 15,000,000 bytes. Source SHA-256 checksums must remain
unchanged. Outputs replace existing derived files only after validation.

Use `--ffmpeg`, `--ffprobe`, and `--threads` to override executable paths or the
default eight encoding threads. The script prefers `/usr/bin` binaries when
available to avoid unrelated wrapper scripts on `PATH`.
