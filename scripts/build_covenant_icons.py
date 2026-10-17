#!/usr/bin/env python3
"""Reproducibly export approved POM × LILY gold cover to PWA/iPhone brand assets."""
import hashlib
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/"assets/covenant-bible-gold-source.webp"
EXPECTED="8749b88c4612b8729f8b1ff9b67e1fcfd38191ffd7f1e183665f7c099fca006f"
assert SOURCE.is_file(),"Founder-approved gold source image is missing"
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==EXPECTED,"Wrong gold source; do not overwrite approved branding"
im=Image.open(SOURCE).convert("RGBA")
assert im.size==(256,256)
for size in (180,192,256,512):
    scaled=im.resize((size,size),Image.Resampling.LANCZOS)
    if size==180:
        # iOS home icons should not show white exterior corners.
        background=Image.new("RGBA",(size,size),(28,14,8,255))
        background.alpha_composite(scaled)
        scaled=background.convert("RGB")
    else:
        # Keep clean transparent corners for the in-app brand and Android.
        scaled=scaled.convert("RGBA")
    path=ROOT/f"assets/covenant-bible-gold-{size}.png"
    scaled.save(path,optimize=True)
    assert Image.open(path).size==(size,size)
print("PASS: founder-approved Covenant Bible icon generated at 180, 192, 256, 512px")
