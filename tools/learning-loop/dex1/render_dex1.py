"""The learning film's gripper: studio renders of the robot's Dex1-1 gripper from its own CAD meshes, as one RGBA strip of
frames from open to closed. MuJoCo offscreen (EGL), orthographic camera, alpha from the segmentation buffer, supersampled.
Writes dex1_strip.png and dex1_strip.json (frame size, frame count and the anchor: the point between the pads).

  MUJOCO_GL=egl python dex1/render_dex1.py --meshdir <dex1_1/meshes> --out src
"""
import argparse, json, os, numpy as np, mujoco
from PIL import Image

SS = 3
OPEN, CLOSED = -0.02, 0.0245       # slide range of the Dex1-1 fingers (dex1_1.urdf)
XML = """
<mujoco model="dex1">
  <compiler angle="radian" meshdir="{meshdir}"/>
  <visual>
    <global offwidth="{px}" offheight="{px}"/>
    <headlight ambient="0.32 0.32 0.34" diffuse="0.22 0.22 0.22" specular="0.05 0.05 0.05"/>
  </visual>
  <asset>
    <mesh name="base_link" file="base_link.STL"/><mesh name="Link1_1" file="Link1_1.STL"/><mesh name="Link1_2" file="Link1_2.STL"/>
    <mesh name="Link1_3" file="Link1_3.STL"/><mesh name="Link2_1" file="Link2_1.STL"/><mesh name="Link2_2" file="Link2_2.STL"/>
    <mesh name="Link2_3" file="Link2_3.STL"/>
    <material name="body" rgba="0.13 0.135 0.145 1" specular="0.55" shininess="0.55"/>
    <material name="finger" rgba="0.20 0.205 0.215 1" specular="0.6" shininess="0.6"/>
    <material name="pad" rgba="0.06 0.06 0.065 1" specular="0.15" shininess="0.2"/>
  </asset>
  <worldbody>
    <light directional="true" dir="0.4 0.6 -1" diffuse="0.75 0.75 0.75" specular="0.4 0.4 0.4" castshadow="false"/>
    <light directional="true" dir="-0.7 0.3 -0.4" diffuse="0.28 0.28 0.3" specular="0.15 0.15 0.15" castshadow="false"/>
    <light directional="true" dir="0 -1 -0.3" diffuse="0.25 0.25 0.27" specular="0.3 0.3 0.3" castshadow="false"/>
    <body name="gripper" quat="0.7071068 -0.7071068 0 0">
      <geom type="mesh" mesh="base_link" material="body"/>
      <body pos="0.04055 0.0593 0.0152">
        <joint type="slide" axis="-1 0 0"/>
        <geom type="mesh" mesh="Link1_1" material="finger"/>
        <geom pos="-0.013 0.013 0" type="mesh" mesh="Link1_2" material="finger"/>
        <geom name="pad_a" pos="-0.0155165 0.038043 -0.001" type="mesh" mesh="Link1_3" material="pad"/>
      </body>
      <body pos="-0.04055 0.0593 -0.0152">
        <joint type="slide" axis="1 0 0"/>
        <geom type="mesh" mesh="Link2_1" material="finger"/>
        <geom pos="0.013 0.013 0" type="mesh" mesh="Link2_2" material="finger"/>
        <geom name="pad_b" pos="0.0155165 0.038043 0.0294" type="mesh" mesh="Link2_3" material="pad"/>
      </body>
    </body>
    <camera name="cam" pos="{campos}" xyaxes="{xyaxes}" fovy="{extent}" projection="orthographic"/>
  </worldbody>
</mujoco>"""


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--meshdir", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--az", type=float, default=22, help="camera azimuth from the front, degrees")
    p.add_argument("--el", type=float, default=10, help="camera elevation, degrees")
    p.add_argument("--extent", type=float, default=0.24, help="height of the rendered square, metres")
    p.add_argument("--size", type=int, default=720, help="rendered square, pixels")
    p.add_argument("--close-gap", type=float, default=0.032, help="gap between the pads in the last frame, metres")
    p.add_argument("--frames", type=int, default=10)
    a = p.parse_args()
    az, el = np.radians(a.az), np.radians(a.el)
    target = np.array([0.0, 0.0, -0.075])
    campos = target + np.array([np.sin(az) * np.cos(el), -np.cos(az) * np.cos(el), np.sin(el)])
    fwd = (target - campos) / np.linalg.norm(target - campos)
    x = np.cross(fwd, (0, 0, 1)); x /= np.linalg.norm(x); y = np.cross(x, fwd)
    m = mujoco.MjModel.from_xml_string(XML.format(
        meshdir=os.path.abspath(a.meshdir), px=a.size * SS, extent=a.extent,
        campos=" ".join(f"{c:.6f}" for c in campos), xyaxes=" ".join(f"{c:.6f}" for c in np.r_[x, y])))
    d = mujoco.MjData(m)
    pads = m.geom("pad_a").id, m.geom("pad_b").id

    def pose(q):
        d.qpos[:] = q; mujoco.mj_forward(m, d)
        return mujoco.mj_geomDistance(m, d, *pads, 1.0, None)

    qs = np.linspace(OPEN, CLOSED, 2000)
    q_close = float(qs[np.argmax(np.array([pose(q) for q in qs]) <= a.close_gap)])
    pose(OPEN)
    centre = 0.5 * (d.geom_xpos[pads[0]] + d.geom_xpos[pads[1]])
    mpp = a.extent / a.size
    anchor = (a.size / 2 + (centre - campos) @ x / mpp, a.size / 2 - (centre - campos) @ y / mpp)

    r = mujoco.Renderer(m, a.size * SS, a.size * SS)
    frames = []
    for q in np.linspace(OPEN, q_close, a.frames):
        pose(q)
        r.update_scene(d, camera="cam"); rgb = r.render().astype(np.float32)
        r.enable_segmentation_rendering(); r.update_scene(d, camera="cam"); seg = r.render(); r.disable_segmentation_rendering()
        alpha = (seg[..., 1] == mujoco.mjtObj.mjOBJ_GEOM).astype(np.float32) * 255
        frames.append(Image.fromarray(np.dstack([rgb, alpha]).clip(0, 255).astype(np.uint8)).resize((a.size, a.size), Image.LANCZOS))
    boxes = [f.getchannel("A").point(lambda v: 255 if v > 4 else 0).getbbox() for f in frames]
    x0, y0 = min(b[0] for b in boxes) - 2, min(b[1] for b in boxes) - 2
    x1, y1 = max(b[2] for b in boxes) + 2, max(b[3] for b in boxes) + 2
    w, h = x1 - x0, y1 - y0
    strip = Image.new("RGBA", (w * a.frames, h))
    for i, f in enumerate(frames):
        strip.paste(f.crop((x0, y0, x1, y1)), (i * w, 0))
    os.makedirs(a.out, exist_ok=True)
    strip.save(os.path.join(a.out, "dex1_strip.png"), optimize=True)
    meta = {"frame": [w, h], "frames": a.frames, "anchor": [round(anchor[0] - x0, 1), round(anchor[1] - y0, 1)],
            "metres_per_px": mpp, "q": [OPEN, round(q_close, 5)], "camera": {"az": a.az, "el": a.el}}
    with open(os.path.join(a.out, "dex1_strip.json"), "w") as f:
        json.dump(meta, f, indent=1)
    print(json.dumps(meta))


if __name__ == "__main__":
    main()
