"""Splits hero photos into parallax layers using monocular depth estimation.

Needs Depth Anything V2 (ONNX) and OpenCV on top of numpy and Pillow, e.g. in a throwaway venv:

    python3 -m venv /tmp/hero-venv
    /tmp/hero-venv/bin/pip install onnxruntime huggingface_hub opencv-python-headless numpy pillow
    /tmp/hero-venv/bin/python scripts/hero-layers.py [scene ...]

Writes static/images/hero/<scene>/{back,mid,front}.webp. Each scene cuts its
depth map (0 = farthest, 1 = nearest) at two thresholds: everything nearer than
`mid` lifts off the sky, everything nearer than `front` becomes the foreground.
The depth map's edges are soft, so GrabCut snaps each cut to the photo's real
edge within a narrow band. Pixels hidden behind a nearer layer are filled by
stretching the pixels above them down, so moving layers never reveal a second
copy of an edge. back.webp gets EXTEND extra sky on top and front.webp EXTEND
extra ground at the bottom.
"""

import os
import sys

import cv2
import numpy as np
import onnxruntime
from huggingface_hub import hf_hub_download
from PIL import Image, ImageFilter

OUTPUT_WIDTH = 2000
EXTEND = 0.12  # keep in sync with --extend in src/components/Hero.svelte
BAND = 0.012  # GrabCut works within this distance of a depth cut, as a fraction of the height
GRABCUT_WIDTH = 1400
DEPTH_HEIGHT = 518 * 2  # the model works in multiples of its 14 px patch size

SCENES = {
    "nepal": {"source": "static/images/nepal.jpg", "mid": 0.004, "front": 0.2},
}


def estimate_depth(image):
    model = hf_hub_download("onnx-community/depth-anything-v2-small", "onnx/model.onnx")
    session = onnxruntime.InferenceSession(model)
    width = round(image.width * DEPTH_HEIGHT / image.height / 14) * 14
    pixels = np.asarray(image.resize((width, DEPTH_HEIGHT), Image.BICUBIC), np.float32) / 255
    pixels = (pixels - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]
    tensor = pixels.transpose(2, 0, 1)[None].astype(np.float32)
    depth = session.run(None, {session.get_inputs()[0].name: tensor})[0][0]
    return (depth - depth.min()) / (depth.max() - depth.min())


def segment(image, depth, threshold):
    """GrabCut on a downscaled copy, seeded from the depth cut; returns a soft alpha at full size."""
    small = image.resize((GRABCUT_WIDTH, round(image.height * GRABCUT_WIDTH / image.width)), Image.LANCZOS)
    small_depth = cv2.resize(depth, small.size, interpolation=cv2.INTER_LINEAR)
    nearer = (small_depth > threshold).astype(np.uint8)
    radius = max(2, round(BAND * small.height))
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * radius + 1, 2 * radius + 1))
    band = cv2.dilate(nearer, kernel) != cv2.erode(nearer, kernel)
    seeds = np.where(nearer, cv2.GC_FGD, cv2.GC_BGD).astype(np.uint8)
    seeds[band & (nearer == 1)] = cv2.GC_PR_FGD
    seeds[band & (nearer == 0)] = cv2.GC_PR_BGD
    background_model = np.zeros((1, 65), np.float64)
    foreground_model = np.zeros((1, 65), np.float64)
    bgr = cv2.cvtColor(np.asarray(small), cv2.COLOR_RGB2BGR)
    cv2.grabCut(bgr, seeds, None, background_model, foreground_model, 5, cv2.GC_INIT_WITH_MASK)
    foreground = np.isin(seeds, (cv2.GC_FGD, cv2.GC_PR_FGD)).astype(np.uint8) * 255
    alpha = Image.fromarray(foreground).filter(ImageFilter.MedianFilter(3)).resize(image.size, Image.LANCZOS)
    return np.asarray(alpha.filter(ImageFilter.GaussianBlur(0.8)))


def fill_hidden(pixels, hidden):
    """Replaces hidden pixels by repeating the last visible pixel above them, per column."""
    filled = pixels.copy()
    for x in np.nonzero(hidden.any(axis=0))[0]:
        last_visible = filled[0, x].copy()
        for y in range(filled.shape[0]):
            if hidden[y, x]:
                filled[y, x] = last_visible
            else:
                last_visible = filled[y, x]
    return filled


def build(name, scene, project_root):
    image = Image.open(os.path.join(project_root, scene["source"])).convert("RGB")
    image = image.resize((OUTPUT_WIDTH, round(image.height * OUTPUT_WIDTH / image.width)), Image.LANCZOS)
    pixels = np.asarray(image)
    extension = round(EXTEND * image.height)

    depth = estimate_depth(image)
    mid_alpha = segment(image, depth, scene["mid"])
    front_alpha = segment(image, depth, scene["front"])

    target = os.path.join(project_root, "static/images/hero", name)
    os.makedirs(target, exist_ok=True)

    back = fill_hidden(pixels, (mid_alpha > 8) | (front_alpha > 8))
    back = np.concatenate([np.repeat(back[:1], extension, axis=0), back])
    Image.fromarray(back).filter(ImageFilter.GaussianBlur(0.4)).save(os.path.join(target, "back.webp"), quality=72)

    mid = fill_hidden(pixels, (front_alpha > 8) & (mid_alpha > 8))
    Image.fromarray(np.dstack([mid, mid_alpha]), "RGBA").save(os.path.join(target, "mid.webp"), quality=78)

    front = np.dstack([pixels, front_alpha])
    front = np.concatenate([front, front[-extension:][::-1]])
    Image.fromarray(front, "RGBA").save(os.path.join(target, "front.webp"), quality=78)

    sizes = {layer: os.path.getsize(os.path.join(target, f"{layer}.webp")) // 1024 for layer in ("back", "mid", "front")}
    print(name, sizes, "KB")


project_root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
for scene_name in sys.argv[1:] or SCENES:
    build(scene_name, SCENES[scene_name], project_root)
