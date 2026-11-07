"""Build og-image.png, the 1200x630 card shown when a Sthira link is shared.

Run from the site folder: python3 tools/og.py
"""
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
SAFFRON = (232, 116, 59)
FONT = "/System/Library/Fonts/SFNS.ttf"


def font(size: int, weight: str) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(FONT, size)
    try:
        f.set_variation_by_name(weight)
    except (OSError, ValueError):
        pass
    return f


def cover(img: Image.Image) -> Image.Image:
    scale = max(W / img.width, H / img.height)
    img = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    left, top = (img.width - W) // 2, (img.height - H) // 2
    return img.crop((left, top, left + W, top + H))


def main() -> None:
    base = cover(Image.open("media/hero-sunrise-silhouette-poster.jpg").convert("RGB"))
    # Dark wash from the left so the text stays readable over any part of the photo.
    shade = Image.new("L", (W, 1))
    for x in range(W):
        shade.putpixel((x, 0), int(235 * max(0.0, 1 - x / (W * 0.78))))
    shade = shade.resize((W, H))
    base = Image.composite(Image.new("RGB", (W, H), (12, 10, 9)), base, shade)

    d = ImageDraw.Draw(base)
    x = 80
    d.rounded_rectangle((x, 150, x + 64, 158), radius=4, fill=SAFFRON)
    d.text((x, 175), "Sthira", font=font(132, "Bold"), fill="white")
    d.text((x, 335), "Yoga at home, made safe.", font=font(50, "Semibold"), fill="white")
    d.text((x, 410), "89 poses with injury notes. Guided sessions.", font=font(30, "Regular"), fill=(225, 220, 214))
    d.text((x, 452), "A personal plan. Free, with no account.", font=font(30, "Regular"), fill=(225, 220, 214))
    d.text((x, 535), "By Ankur Napa, RYT 500", font=font(26, "Medium"), fill=SAFFRON)
    base.save("og-image.png", optimize=True)
    base.save("og-image.jpg", quality=86, optimize=True)


if __name__ == "__main__":
    main()
