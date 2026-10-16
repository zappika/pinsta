"""Frame untouched simulator captures for the two iPhone App Store sizes.

Run from the repository root: python3 appstore/frame.py
Requires Pillow. Only the area outside each screen is designed artwork.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
SHOTS = [
    ("01", "map", "Your places, on a map"),
    ("02", "saved", "Keep that place"),
    ("03", "choice", "Pick the right place"),
    ("04", "multi", "Save the whole post"),
    ("05", "what", "Find what you saved"),
    ("06", "card", "Ready when you go"),
]
SIZES = {"6.9": (1320, 2868), "6.3": (1206, 2622)}
FONT = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"


def render(size: str, width: int, height: int) -> None:
    factor = width / 1320
    source_dir = ROOT / "screenshots" / "raw" / size
    output_dir = ROOT / "screenshots" / size
    output_dir.mkdir(parents=True, exist_ok=True)
    for number, source_name, headline in SHOTS:
        with Image.open(source_dir / f"{number}-{source_name}.png") as source:
            assert source.size == (width, height), source.size
            screen = source.convert("RGB")
        canvas = Image.new("RGB", (width, height), "#FAEEE9")
        draw = ImageDraw.Draw(canvas)

        inset = round(width * 0.07)
        screen_width = round(width * 0.86)
        screen_height = round(height * 0.86)
        top = round(height * 0.105)
        frame = screen.resize((screen_width, screen_height), Image.Resampling.LANCZOS)
        mask = Image.new("L", frame.size)
        ImageDraw.Draw(mask).rounded_rectangle(
            (0, 0, screen_width - 1, screen_height - 1),
            radius=round(42 * factor),
            fill=255,
        )
        canvas.paste(frame, (inset, top), mask)

        brand_font = ImageFont.truetype(FONT, round(29 * factor))
        headline_font = ImageFont.truetype(FONT, round(73 * factor))
        draw.text((inset, round(53 * factor)), "V I C O L O", fill="#DF5F7D", font=brand_font)
        draw.text((inset, round(133 * factor)), headline, fill="#211F22", font=headline_font)

        output = output_dir / f"{number}.png"
        canvas.save(output, format="PNG", optimize=True)
        print(output)


if __name__ == "__main__":
    for size, (width, height) in SIZES.items():
        render(size, width, height)
