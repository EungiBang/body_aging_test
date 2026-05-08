from PIL import Image
import sys

img_path = sys.argv[1]
ico_path = sys.argv[2]
png_path = sys.argv[3]

img = Image.open(img_path).convert("RGBA")
# Save as proper PNG
img.save(png_path, "PNG")

# Resize to standard icon sizes and save as ICO
icon_sizes = [(16, 16), (32, 32), (48, 48), (64,64), (128, 128), (256, 256)]
img.save(ico_path, format="ICO", sizes=icon_sizes)
print("Icon generated successfully!")
