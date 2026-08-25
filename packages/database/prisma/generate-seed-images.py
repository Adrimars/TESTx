"""
Generates the seed test's imagery into prisma/seed-assets/.

Run once; the output is committed and the seed copies it into the uploads directory. Kept
out of seed.ts because the hand-rolled PNG encoder there can draw a gradient and nothing
else, and a preference test whose options are four flat gradients cannot tell you anything
about a preference.

These are rendered mockups, not photographs. To use real photos instead, drop them in
prisma/seed-assets/custom/ - the seed prefers that folder when it exists.

    python packages/database/prisma/generate-seed-images.py
"""

import math
import os
import random
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1000, 1250  # portrait, matching the card aspect
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "seed-assets")
FONTS = r"C:\Windows\Fonts"


def font(name, size):
    try:
        return ImageFont.truetype(os.path.join(FONTS, name), size)
    except OSError:
        return ImageFont.load_default()


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def gradient(top, bottom, angle=0.0):
    """Linear gradient across the diagonal, so the light has a direction."""
    img = Image.new("RGB", (W, H))
    px = img.load()
    ax, ay = math.cos(angle), math.sin(angle)
    for y in range(H):
        for x in range(0, W, 2):
            t = ((x / W) * ax + (y / H) * ay) / (abs(ax) + abs(ay) or 1)
            c = lerp(top, bottom, min(1.0, max(0.0, t)))
            px[x, y] = c
            if x + 1 < W:
                px[x + 1, y] = c
    return img


def grain(img, amount=7):
    """Film grain. Without it flat fills read as UI, not as a photographed object."""
    noise = Image.effect_noise((W, H), amount).convert("L")
    return Image.blend(img, Image.merge("RGB", (noise, noise, noise)), 0.055)


def vignette(img, strength=0.55):
    mask = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(mask)
    d.ellipse([-W * 0.35, -H * 0.25, W * 1.35, H * 1.25], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(W * 0.18))
    dark = Image.new("RGB", (W, H), (0, 0, 0))
    return Image.composite(img, Image.blend(img, dark, strength), mask)


def soft_shadow(base, box, radius=34, blur=26, opacity=110):
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x0, y0, x1, y1 = box
    d.rounded_rectangle([x0 + 10, y0 + 22, x1 + 10, y1 + 26], radius=radius, fill=(0, 0, 0, opacity))
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    return Image.alpha_composite(base.convert("RGBA"), layer).convert("RGB")


def coffee_bag(name, bg_top, bg_bottom, bag_col, accent, brand, variety, style):
    """A stand-up coffee pouch on a lit backdrop."""
    img = grain(gradient(bg_top, bg_bottom, angle=0.9))
    bw, bh = int(W * 0.56), int(H * 0.62)
    bx, by = (W - bw) // 2, int(H * 0.22)
    box = (bx, by, bx + bw, by + bh)
    img = soft_shadow(img, box)
    d = ImageDraw.Draw(img)

    # Bag body with a subtle vertical sheen so it reads as a curved surface.
    d.rounded_rectangle(box, radius=26, fill=bag_col)
    sheen = Image.new("L", (W, H), 0)
    sd = ImageDraw.Draw(sheen)
    sd.rectangle([bx + int(bw * 0.10), by, bx + int(bw * 0.34), by + bh], fill=70)
    sheen = sheen.filter(ImageFilter.GaussianBlur(38))
    img = Image.composite(Image.new("RGB", (W, H), (255, 255, 255)), img, sheen).convert("RGB")
    d = ImageDraw.Draw(img)
    d.rounded_rectangle(box, radius=26, outline=lerp(bag_col, (0, 0, 0), 0.28), width=3)

    # Crimped top seal.
    d.rounded_rectangle([bx - 6, by - 20, bx + bw + 6, by + 16], radius=8,
                        fill=lerp(bag_col, (0, 0, 0), 0.35))
    for i in range(bx - 2, bx + bw + 2, 14):
        d.line([(i, by - 16), (i, by + 12)], fill=lerp(bag_col, (0, 0, 0), 0.5), width=2)

    cx = bx + bw // 2
    if style == "label":
        lw, lh = int(bw * 0.74), int(bh * 0.40)
        lx, ly = cx - lw // 2, by + int(bh * 0.20)
        d.rounded_rectangle([lx, ly, lx + lw, ly + lh], radius=12, fill=(250, 247, 240))
        d.rounded_rectangle([lx + 10, ly + 10, lx + lw - 10, ly + lh - 10], radius=8,
                            outline=accent, width=3)
        f1, f2, f3 = font("georgiab.ttf", 54), font("georgia.ttf", 27), font("georgia.ttf", 22)
        d.text((cx, ly + int(lh * 0.34)), brand, font=f1, fill=(28, 26, 24), anchor="mm")
        d.text((cx, ly + int(lh * 0.56)), variety.upper(), font=f2, fill=accent, anchor="mm")
        d.text((cx, ly + int(lh * 0.74)), "SINGLE ORIGIN  ·  250g", font=f3,
               fill=(120, 114, 104), anchor="mm")
    elif style == "modern":
        f1, f2, f3 = font("seguibl.ttf", 78), font("segoeuib.ttf", 30), font("segoeui.ttf", 23)
        d.text((bx + 44, by + int(bh * 0.26)), brand.upper(), font=f1, fill=(255, 255, 255))
        d.line([(bx + 48, by + int(bh * 0.40)), (bx + 48 + int(bw * 0.42), by + int(bh * 0.40))],
               fill=accent, width=7)
        d.text((bx + 48, by + int(bh * 0.45)), variety.upper(), font=f2, fill=accent)
        d.text((bx + 48, by + int(bh * 0.53)), "250g  ·  WHOLE BEAN", font=f3, fill=(214, 210, 204))
        d.ellipse([bx + bw - 150, by + bh - 168, bx + bw - 46, by + bh - 64], outline=accent, width=6)
    else:  # stamp
        f1, f2, f3 = font("impact.ttf", 92), font("segoeuib.ttf", 28), font("segoeui.ttf", 22)
        r = int(bw * 0.34)
        d.ellipse([cx - r, by + int(bh * 0.20), cx + r, by + int(bh * 0.20) + 2 * r],
                  outline=accent, width=8)
        d.text((cx, by + int(bh * 0.20) + r - 12), brand.upper(), font=f1, fill=(255, 255, 255), anchor="mm")
        d.text((cx, by + int(bh * 0.20) + r + 44), variety.upper(), font=f2, fill=accent, anchor="mm")
        d.text((cx, by + bh - 66), "ROASTED IN SMALL BATCHES", font=f3, fill=(206, 200, 192), anchor="mm")

    # Loose beans on the surface, for depth near the base.
    random.seed(hash(name) % 9999)
    for _ in range(26):
        ex = random.randint(40, W - 40)
        ey = random.randint(int(H * 0.86), H - 30)
        rr = random.randint(11, 19)
        shade = lerp((78, 52, 34), (44, 28, 18), random.random())
        d.ellipse([ex, ey, ex + rr * 2, ey + int(rr * 1.5)], fill=shade)
        d.arc([ex, ey, ex + rr * 2, ey + int(rr * 1.5)], 250, 290, fill=lerp(shade, (0, 0, 0), 0.5), width=3)

    return vignette(img, 0.45)


def mood_scene(name, sky, ground, accent, caption):
    """An abstract interior/landscape scene, for the 'which fits the brand' question."""
    img = grain(gradient(sky, ground, angle=1.35))
    d = ImageDraw.Draw(img)
    random.seed(hash(name) % 7777)

    horizon = int(H * random.uniform(0.55, 0.66))
    d.rectangle([0, horizon, W, H], fill=lerp(ground, (0, 0, 0), 0.25))

    # Layered silhouettes, each flatter and darker than the last.
    for layer in range(3):
        col = lerp(ground, (0, 0, 0), 0.32 + layer * 0.18)
        pts = [(0, H)]
        x = 0
        base = horizon + layer * int(H * 0.055)
        while x <= W:
            pts.append((x, base - random.randint(0, int(H * 0.09 - layer * 22))))
            x += random.randint(90, 190)
        pts += [(W, H)]
        d.polygon(pts, fill=col)

    glow = Image.new("RGB", (W, H), (0, 0, 0))
    gd = ImageDraw.Draw(glow)
    sx, sy = int(W * random.uniform(0.25, 0.75)), int(horizon - H * 0.12)
    gd.ellipse([sx - 130, sy - 130, sx + 130, sy + 130], fill=accent)
    glow = glow.filter(ImageFilter.GaussianBlur(90))
    img = Image.blend(img, glow, 0.30)

    d = ImageDraw.Draw(img)
    d.ellipse([sx - 46, sy - 46, sx + 46, sy + 46], fill=lerp(accent, (255, 255, 255), 0.55))

    f = font("segoeuisl.ttf", 34)
    d.rectangle([0, H - 118, W, H], fill=(0, 0, 0))
    d.text((W // 2, H - 60), caption, font=f, fill=(238, 235, 230), anchor="mm")
    return vignette(img, 0.5)


SPECS = [
    ("bag-heritage.png", lambda n: coffee_bag(n, (232, 224, 210), (176, 160, 140), (58, 42, 32), (166, 122, 62), "Alder", "Ethiopia Guji", "label")),
    ("bag-modern.png",   lambda n: coffee_bag(n, (28, 30, 38), (12, 13, 18), (22, 24, 30), (232, 92, 60), "Vertex", "Colombia Huila", "modern")),
    ("bag-stamp.png",    lambda n: coffee_bag(n, (214, 226, 224), (150, 174, 172), (26, 62, 58), (226, 190, 96), "Foundry", "Kenya Nyeri", "stamp")),
    ("bag-blush.png",    lambda n: coffee_bag(n, (244, 228, 226), (206, 168, 168), (150, 74, 78), (244, 226, 214), "Marlow", "Brazil Cerrado", "label")),
    ("bag-forest.png",   lambda n: coffee_bag(n, (222, 232, 218), (146, 168, 142), (34, 58, 40), (206, 168, 88), "Thicket", "Sumatra Aceh", "modern")),
    ("bag-cobalt.png",   lambda n: coffee_bag(n, (222, 230, 244), (148, 164, 198), (26, 44, 96), (240, 176, 64), "Meridian", "Guatemala Antigua", "stamp")),
    ("mood-warm.png",    lambda n: mood_scene(n, (250, 206, 154), (168, 104, 72), (255, 176, 96), "Warm  ·  unhurried  ·  golden hour")),
    ("mood-cool.png",    lambda n: mood_scene(n, (188, 214, 236), (58, 84, 116), (150, 200, 240), "Cool  ·  precise  ·  early morning")),
    ("mood-dark.png",    lambda n: mood_scene(n, (58, 54, 70), (18, 18, 26), (196, 150, 255), "Nocturnal  ·  focused  ·  after hours")),
    ("mood-fresh.png",   lambda n: mood_scene(n, (214, 240, 214), (66, 118, 84), (170, 232, 150), "Fresh  ·  open  ·  first light")),
]


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, build in SPECS:
        path = os.path.join(OUT, name)
        build(name).save(path, "PNG", optimize=True)
        print(f"  {name}  {os.path.getsize(path) // 1024} KB")
    print(f"\n{len(SPECS)} images -> {OUT}")


if __name__ == "__main__":
    main()
