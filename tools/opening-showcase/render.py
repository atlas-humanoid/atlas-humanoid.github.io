#!/usr/bin/env python3
"""Build the opening showcase assets using Python's standard library + FFmpeg."""

import argparse
import hashlib
import json
import shutil
import struct
import subprocess
import tempfile
from pathlib import Path


REPO = Path(__file__).resolve().parents[2]
MEDIA = REPO / "media"
JOBS = {
    "stairs": {
        "source": "stairs_hero.mp4", "start": 0, "end": 360,
        "poster_frame": 294, "matrix": "bt709", "source_tag": "bt709",
    },
    "nav": {
        "source": "nav_pick_1x.mp4", "start": 24, "end": 951,
        "poster_frame": 159, "matrix": "bt601", "source_tag": "bt470bg",
        "crf": 20, "preset": "slow",
    },
}


def executable(name):
    system = Path("/usr/bin") / name
    found = str(system) if system.is_file() else shutil.which(name)
    if not found:
        raise RuntimeError(f"Install {name} or provide its path with --{name}")
    return found


def run(command, capture=False):
    return subprocess.run(command, check=True, text=True, capture_output=capture)


def sha256(filename):
    digest = hashlib.sha256()
    with filename.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def probe(ffprobe, filename, count=False):
    command = [ffprobe, "-v", "error"]
    if count:
        command.append("-count_frames")
    command += ["-show_streams", "-show_format", "-of", "json", str(filename)]
    return json.loads(run(command, capture=True).stdout)


def boxes(filename):
    data = filename.read_bytes()
    result, offset = [], 0
    while offset + 8 <= len(data):
        size, kind = struct.unpack_from(">I4s", data, offset)
        if size == 1:
            size = struct.unpack_from(">Q", data, offset + 8)[0]
        if size == 0:
            size = len(data) - offset
        if size < 8 or offset + size > len(data):
            raise RuntimeError("Invalid MP4 box")
        result.append(kind.decode("ascii"))
        offset += size
    return result


def verify(ffmpeg, ffprobe, filename, frame_count):
    info = probe(ffprobe, filename, count=True)
    streams = info["streams"]
    if len(streams) != 1 or streams[0]["codec_type"] != "video":
        raise RuntimeError(f"Expected one video stream and no audio: {filename}")
    video = streams[0]
    expected = {
        "codec_name": "h264", "width": 1920, "height": 1080,
        "pix_fmt": "yuv420p", "avg_frame_rate": "30/1",
        "nb_read_frames": str(frame_count), "nb_frames": str(frame_count),
        "color_range": "tv", "color_space": "bt709",
        "color_transfer": "bt709", "color_primaries": "bt709",
    }
    for key, value in expected.items():
        if video.get(key) != value:
            raise RuntimeError(f"{filename}: {key}={video.get(key)!r}, expected {value!r}")
    if abs(float(info["format"]["duration"]) - frame_count / 30) > 0.000001:
        raise RuntimeError(f"Unexpected duration: {filename}")
    if filename.stat().st_size >= 15_000_000:
        raise RuntimeError(f"Video exceeds the 15 MB budget: {filename}")
    atoms = boxes(filename)
    if atoms.index("moov") > atoms.index("mdat"):
        raise RuntimeError(f"Missing Fast Start: {filename}")
    run([ffmpeg, "-v", "error", "-xerror", "-i", str(filename), "-map", "0:v:0", "-f", "null", "-"])
    return {
        "width": video["width"], "height": video["height"],
        "duration": float(info["format"]["duration"]), "frames": frame_count,
        "fps": 30, "codec": "h264", "pixel_format": "yuv420p",
        "color": "BT.709 limited range", "audio_streams": 0,
        "bytes": filename.stat().st_size, "faststart": True,
        "top_level_boxes": atoms, "decode_errors": 0,
    }


def render(name, job, args):
    source = MEDIA / job["source"]
    original_hash = sha256(source)
    source_info = probe(args.ffprobe, source)["streams"][0]
    if (source_info["width"], source_info["height"], source_info["avg_frame_rate"]) != (1920, 1080, "30/1"):
        raise RuntimeError(f"Unexpected source dimensions or frame rate: {source}")
    if source_info.get("color_space") != job["source_tag"]:
        raise RuntimeError(f"Source color matrix changed: {source}")
    video = MEDIA / f"{name}_showcase.mp4"
    poster = MEDIA / f"{name}_showcase.jpg"
    common = [args.ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-filter_threads", "2"]
    with tempfile.TemporaryDirectory(prefix=".opening-showcase-", dir=MEDIA) as directory:
        temporary = Path(directory)
        video_tmp, poster_tmp = temporary / video.name, temporary / poster.name
        # Frame-based boundaries preserve every selected source frame in order.
        # BT.601 -> BT.709 changes YCbCr coefficients, not the intended RGB look.
        filters = (
            f"trim=start_frame={job['start']}:end_frame={job['end']},setpts=PTS-STARTPTS,"
            f"scale=1920:1080:in_color_matrix={job['matrix']}:out_color_matrix=bt709:"
            "in_range=tv:out_range=tv:flags=lanczos+accurate_rnd,setsar=1,format=yuv420p"
        )
        print(f"Rendering {video.name}…", flush=True)
        run(common + ["-i", str(source), "-map", "0:v:0", "-vf", filters,
            "-an", "-sn", "-dn", "-c:v", "libx264", "-preset", job.get("preset", "medium"),
            "-crf", str(job.get("crf", 19)), "-threads", str(args.threads), "-vsync", "0",
            "-pix_fmt", "yuv420p", "-color_range", "tv", "-colorspace", "bt709",
            "-color_primaries", "bt709", "-color_trc", "bt709",
            "-movflags", "+faststart", "-map_metadata", "-1", str(video_tmp)])
        checked = verify(args.ffmpeg, args.ffprobe, video_tmp, job["end"] - job["start"])
        # JPEG uses full-range BT.601 YCbCr; convert the source matrix explicitly.
        poster_filter = (
            f"select=eq(n\\,{job['poster_frame']}),"
            f"scale=1920:1080:in_color_matrix={job['matrix']}:out_color_matrix=bt601:"
            "in_range=tv:out_range=pc:flags=lanczos+accurate_rnd,format=yuvj444p"
        )
        run(common + ["-i", str(source), "-vf", poster_filter, "-frames:v", "1",
            "-q:v", "2", "-update", "1", str(poster_tmp)])
        if sha256(source) != original_hash:
            raise RuntimeError(f"Source changed during rendering: {source}")
        video_tmp.replace(video)
        poster_tmp.replace(poster)
    checked.update({
        "file": str(video.relative_to(REPO)), "source": str(source.relative_to(REPO)),
        "source_sha256": original_hash, "source_unchanged": True,
        "source_frame_range": [job["start"], job["end"] - 1],
        "source_time_range_seconds": [job["start"] / 30, job["end"] / 30],
        "crf": job.get("crf", 19), "preset": job.get("preset", "medium"),
        "sha256": sha256(video), "poster": str(poster.relative_to(REPO)),
        "poster_source_frame": job["poster_frame"],
        "poster_source_time_seconds": job["poster_frame"] / 30,
        "poster_bytes": poster.stat().st_size,
    })
    if args.preview_dir:
        preview = args.preview_dir
        preview.mkdir(parents=True, exist_ok=True)
        run(common + ["-i", str(poster), "-vf", "scale=960:540", "-frames:v", "1",
            "-q:v", "3", "-update", "1", str(preview / f"{name}-showcase-preview.jpg")])
        run(common + ["-i", str(video), "-vf", "scale=960:540", "-an", "-c:v", "libx264",
            "-preset", "medium", "-crf", "24", "-threads", str(args.threads),
            "-pix_fmt", "yuv420p", "-color_range", "tv", "-colorspace", "bt709",
            "-color_primaries", "bt709", "-color_trc", "bt709", "-movflags", "+faststart",
            str(preview / f"{name}-showcase-preview.mp4")])
    print(json.dumps(checked, indent=2), flush=True)
    return checked


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--only", choices=["all", *JOBS], default="all")
    parser.add_argument("--ffmpeg", help="FFmpeg executable (default: system installation)")
    parser.add_argument("--ffprobe", help="FFprobe executable (default: system installation)")
    parser.add_argument("--threads", type=int, default=8)
    parser.add_argument("--preview-dir", type=Path, help="Optional 960×540 previews and verification JSON")
    args = parser.parse_args()
    if args.threads < 1:
        parser.error("--threads must be positive")
    args.ffmpeg = args.ffmpeg or executable("ffmpeg")
    args.ffprobe = args.ffprobe or executable("ffprobe")
    report = {"ffmpeg": run([args.ffmpeg, "-version"], capture=True).stdout.splitlines()[0],
              "assets": [render(name, job, args) for name, job in JOBS.items()
                         if args.only in ("all", name)]}
    if args.preview_dir:
        (args.preview_dir / "opening-showcase-verification.json").write_text(json.dumps(report, indent=2) + "\n")


if __name__ == "__main__":
    main()
