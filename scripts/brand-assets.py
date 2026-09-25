# Tach logo.jpg (nen anh) thanh cac file PNG nen trong suot va icon PWA.
#   python scripts/brand-assets.py
import numpy as np
from PIL import Image
from scipy import ndimage

BLUE = np.array([50, 76, 160], dtype=float)
INK = np.array([27, 35, 64], dtype=float)  # mat, mui, mieng

src = np.asarray(Image.open("logo.jpg").convert("RGB")).astype(float)
h, w, _ = src.shape

d = np.sqrt(((src - BLUE) ** 2).sum(axis=2))
alpha = np.clip((150 - d) / 110, 0, 1)

# chi tiet toi (mat, mui, mieng) nam trong dau kangaroo
dark = (src.max(axis=2) < 110)
feat = np.zeros_like(dark)
feat[560:780, 800:1110] = True
dark &= feat
dark = ndimage.binary_dilation(dark, iterations=1)
alpha = np.where(dark, 1.0, alpha)

mask = alpha > 0.5
lab, n = ndimage.label(mask)
objs = ndimage.find_objects(lab)
text = np.zeros_like(mask)
for i, sl in enumerate(objs, start=1):
    ys, xs = sl
    size = (lab[sl] == i).sum()
    if size < 400:  # nhieu le te
        alpha[lab == i] = 0
        continue
    # chu SIEU THI UC: cac manh nho nam gon ben phai, tren banh xe
    if xs.start > 1250 and xs.stop < 1690 and ys.start > 580 and ys.stop < 1345 and size < 20000:
        text |= ndimage.binary_dilation(lab == i, iterations=3)
# bo vien mo quanh vung da loai
alpha = np.where(ndimage.binary_dilation(mask, iterations=4), alpha, 0)

def rgba(color_fn, a):
    out = np.zeros((h, w, 4), dtype=np.uint8)
    out[..., :3] = color_fn
    out[..., 3] = (a * 255).round().astype(np.uint8)
    return Image.fromarray(out, "RGBA")

def trim(img, pad=0):
    bb = img.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    img = img.crop(bb)
    if pad:
        s = max(img.size)
        canvas = Image.new("RGBA", (img.width + 2 * pad, img.height + 2 * pad), (0, 0, 0, 0))
        canvas.paste(img, (pad, pad), img)
        img = canvas
    return img

color = np.where(dark[..., None], INK, BLUE)
full = trim(rgba(color, alpha))
full.save("public/brand/logo.png", optimize=True)

mark_a = np.where(text, 0, alpha)
mark = trim(rgba(color, mark_a))
mark.save("public/brand/logo-mark.png", optimize=True)

# ban sang cho che do toi: than xanh nhat, chi tiet mat mui mau nen toi
LIGHT = np.array([157, 176, 240], dtype=float)
NIGHT = np.array([15, 20, 36], dtype=float)
color_light = np.where(dark[..., None], NIGHT, LIGHT)
trim(rgba(color_light, alpha)).save("public/brand/logo-light.png", optimize=True)
trim(rgba(color_light, mark_a)).save("public/brand/logo-mark-light.png", optimize=True)

# ban trang tren nen xanh: chi tiet toi thanh lo trong
white_a = np.where(dark, 0, alpha)
trim(rgba(np.array([255, 255, 255]), white_a)).save("public/brand/logo-white.png", optimize=True)
trim(rgba(np.array([255, 255, 255]), np.where(text, 0, white_a))).save("public/brand/logo-mark-white.png", optimize=True)

# ban in nhiet: den thuan 1 bit (may in nhiet khong in duoc nua tong, mau xanh chuyen xam se bi cham lam tam)
bw_a = np.where(alpha > 0.5, 1.0, 0.0)
trim(rgba(np.array([0, 0, 0]), np.where(dark, 0, bw_a))).save("public/brand/logo-print.png", optimize=True)

def square_icon(img, size, scale, bg=(255, 255, 255, 255)):
    canvas = Image.new("RGBA", (size, size), bg)
    inner = int(size * scale)
    r = inner / max(img.size)
    im = img.resize((max(1, round(img.width * r)), max(1, round(img.height * r))), Image.LANCZOS)
    canvas.paste(im, ((size - im.width) // 2, (size - im.height) // 2), im)
    return canvas

square_icon(full, 192, 0.86).convert("RGB").save("public/icons/icon-192.png", optimize=True)
square_icon(full, 512, 0.86).convert("RGB").save("public/icons/icon-512.png", optimize=True)
# maskable: noi dung nam trong vung an toan 80%
square_icon(full, 512, 0.68).convert("RGB").save("public/icons/icon-512-maskable.png", optimize=True)
square_icon(full, 180, 0.84).convert("RGB").save("src/app/apple-icon.png", optimize=True)
fav = [square_icon(mark, s, 0.96, (0, 0, 0, 0)) for s in (16, 32, 48)]
fav[2].save("src/app/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)], append_images=fav[:2])
print("full", full.size, "mark", mark.size)
