"""Re-create the desktop learning film's sliding video window (commit 8ecae8a, 2026-10-28) on a fresh 21 s Remotion render.

Timeline (30 fps): source frames 0..251, a 0.6 s slide (18 frames) of attempt 1's footage window from card 1 to card 2,
a 0.5 s hold (15 frames) on source frame 252, source 252..401, the same slide from card 2 to card 3, a hold on source
frame 402, source 402..629.  630 + 2 * 33 = 696 frames (23.2 s).

Slide frame k (0..17): the background is the first frame of the next attempt with the next card's footage panel taken
from the last frame of the attempt that just ended (the 'Next attempt' placeholder), so the illustrations stay paused.
The leaving card's 528x396 footage panel moves right by round(640 * easeInOutCubic((k+1)/18)) px under a soft black shadow
(Pillow: rounded rectangle r=10, value 90, 8 px lower, GaussianBlur 14, 30 px canvas margin), clipped to a radius-10
rounded rectangle, and cross-fades to the next card's panel over the last six frames (w = (k-11)/6).
All constants were measured from the 2026-10-28 film itself.
"""
import argparse, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W, H, FPS = 1920, 880, 30
PW, PH, PY, PX0, STEP = 528, 396, 97, 57, 640
PAD, OY, BLUR, SHADOW_V, RADIUS = 30, 8, 14, 90, 10
SLIDE, HOLD = 18, 15
TRANSITIONS = {252: 0, 402: 1}   # first source frame of the next attempt -> index of the card being left

def ease(u):
    return 4 * u ** 3 if u < 0.5 else 1 - (-2 * u + 2) ** 3 / 2

def window_mask():
    m = Image.new('L', (PW, PH), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, PW - 1, PH - 1), radius=RADIUS, fill=255)
    return m

def shadow_mask():
    m = Image.new('L', (PW + 2 * PAD, PH + 2 * PAD), 0)
    ImageDraw.Draw(m).rounded_rectangle((PAD, PAD + OY, PAD + PW - 1, PAD + OY + PH - 1), radius=RADIUS, fill=SHADOW_V)
    return m.filter(ImageFilter.GaussianBlur(BLUR))

def slide_frames(last, first, card, blend_mode):
    bx = PX0 + STEP * card
    nx = bx + STEP
    bg = first.copy()
    bg[PY:PY + PH, nx:nx + PW] = last[PY:PY + PH, nx:nx + PW]
    a = Image.fromarray(np.ascontiguousarray(last[PY:PY + PH, bx:bx + PW]))
    b = Image.fromarray(np.ascontiguousarray(first[PY:PY + PH, nx:nx + PW]))
    wm, sm = window_mask(), shadow_mask()
    black = Image.new('RGB', sm.size, (0, 0, 0))
    out = []
    for k in range(SLIDE):
        x0 = bx + round(STEP * ease((k + 1) / SLIDE))
        w = min(max((k - 11) / 6, 0.0), 1.0)
        if w <= 0:
            win = a
        elif w >= 1:
            win = b
        elif blend_mode == 'pil':
            win = Image.blend(a, b, w)
        else:
            win = Image.fromarray(np.round(np.asarray(a, np.float64) * (1 - w) + np.asarray(b, np.float64) * w).astype(np.uint8))
        im = Image.fromarray(bg)
        im.paste(black, (x0 - PAD, PY - PAD), sm)
        im.paste(win, (x0, PY), wm)
        out.append(np.asarray(im))
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src'); ap.add_argument('dst')
    ap.add_argument('--crf', default='22'); ap.add_argument('--preset', default='slow')
    ap.add_argument('--blend', default='pil', choices=['pil', 'round'])
    ap.add_argument('--frames-only', help='write the composited frame sequence as raw rgb24 here instead of encoding')
    args = ap.parse_args()
    dec = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', args.src, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
    if args.frames_only:
        sink = open(args.frames_only, 'wb'); enc = None
    else:
        enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (W, H), '-r', str(FPS), '-i', '-',
                                '-an', '-c:v', 'libx264', '-preset', args.preset, '-crf', args.crf, '-pix_fmt', 'yuv420p', '-movflags', '+faststart', args.dst],
                               stdin=subprocess.PIPE)
        sink = enc.stdin
    n = W * H * 3
    prev = None
    i = written = 0
    while True:
        buf = dec.stdout.read(n)
        if len(buf) < n:
            break
        cur = np.frombuffer(buf, np.uint8).reshape(H, W, 3)
        if i in TRANSITIONS:
            for fr in slide_frames(prev, cur, TRANSITIONS[i], args.blend):
                sink.write(fr.tobytes()); written += 1
            for _ in range(HOLD):
                sink.write(buf); written += 1
        sink.write(buf); written += 1
        prev = cur
        i += 1
    dec.wait()
    sink.close()
    if enc:
        enc.wait()
        assert enc.returncode == 0
    print('source frames %d -> output frames %d' % (i, written))
    assert i == 630 and written == 696, (i, written)

main()
