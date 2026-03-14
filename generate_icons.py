import os
import base64
from PIL import Image

# Path to the logo file
logo_path = r"c:\Users\Mario\git\BarryGuard-Extension\logo.png"
icons_dir = r"c:\Users\Mario\git\BarryGuard-Extension\icons"

if not os.path.exists(logo_path):
    print("Error: logo.png not found at", logo_path)
    exit(1)

if not os.path.exists(icons_dir):
    os.makedirs(icons_dir)

try:
    img = Image.open(logo_path).convert("RGBA")
except Exception as e:
    print(f"Error opening logo.png: {e}")
    exit(1)

sizes = [16, 32, 48, 128]

for size in sizes:
    # Generate PNG
    resized_img = img.resize((size, size), Image.Resampling.LANCZOS)
    png_filename = f"icon{size}.png"
    png_path = os.path.join(icons_dir, png_filename)
    resized_img.save(png_path, "PNG")
    print(f"Generated {png_filename}")

    # Generate SVG with embedded base64
    with open(png_path, "rb") as f:
        img_data = f.read()
    b64_data = base64.b64encode(img_data).decode('utf-8')
    
    svg_content = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="{size}" height="{size}">
  <image width="{size}" height="{size}" href="data:image/png;base64,{b64_data}" />
</svg>"""
    
    svg_filename = f"icon{size}.svg"
    svg_path = os.path.join(icons_dir, svg_filename)
    with open(svg_path, "w", encoding="utf-8") as f:
        f.write(svg_content)
    print(f"Generated {svg_filename}")

print("All icons generated successfully.")
