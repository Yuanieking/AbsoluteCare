# AbsoluteCare logo assets

The supplied official artwork is currently available as raster files:

- `logo-full-dark.png`: full mark and wordmark, 1080x1080 RGBA.
- `logo-mark.png`: mark only, 1080x1080 RGBA.
- `logo-mark.ico`: supplied 32x32 mark favicon.

`Logo.jsx` is the single frontend integration point. Its light treatment uses a CSS brightness/invert filter on the supplied dark raster because an official light SVG has not been provided yet.

Still needed from the client for production email and social sharing quality:

- `logo-full-light.svg` and `logo-full-dark.svg` with transparent viewBoxes.
- `logo-mark-light.svg` and `logo-mark-dark.svg`.
- 2x/3x PNG exports for email, a true 1200x630 social preview, and a dedicated 512x512 app icon.
