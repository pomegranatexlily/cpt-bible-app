#!/usr/bin/env python3
"""Reproducibly export approved POM × LILY gold cover to PWA/iPhone brand assets."""
import hashlib
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/"assets/oustory-poster-source.webp"
EXPECTED="e55361a901824981397afff10094992d182310762a9618e14532eae3bd893ace"
assert SOURCE.is_file(),"Oustory poster icon source image is missing"
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==EXPECTED,"Wrong Oustory poster source; refuse regeneration"
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
    path=ROOT/f"assets/oustory-poster-icon-{size}.png"
    scaled.save(path,optimize=True)
    assert Image.open(path).size==(size,size)
print("PASS: Oustory founder-poster icon generated at 180, 192, 256, 512px")
