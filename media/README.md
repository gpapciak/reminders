# Photo moments — image files

Photos for the board's occasional "photo moment" overlay live here, same
origin as the page. Add a file, commit it, then add one row to the `Media`
tab in the Sheet (`File`, `Caption`, `Screens`) naming it — see `SETUP.md`.

- Any format `<img>` decodes: `.jpg`, `.png`, `.webp`, `.svg`.
- Filenames only in the Sheet's `File` column (`kathy-summer-2024.jpg`), not
  a path — the board prepends this folder automatically. A full `https://`
  URL also works and is used as-is, but see `SETUP.md` for why a same-origin
  file here is strongly preferred over a hosted link (Google Drive "share"
  links in particular are unreliable for hotlinking on an always-on display).
- `faces/` holds medication mode's headshots (`Greg.png`, `Kai.jpg`, …). The
  names are case-sensitive and must match `FACES_DEFAULT` in `index.html` or
  a row in the Sheet's `Faces` tab. Plain head-and-shoulders, ~600px tall,
  location data removed. See `SETUP.md` §5b.
- `meds-howto-1.png` … `-3.png` (when added): screenshots of her phone for
  medication mode's how-to panel. `demo-howto-1.svg` / `-2.svg` are drawn
  stand-ins used only by `?demo=1`.
- `demo-placeholder.svg` is not a photo — it exists only so `?demo=1` has a
  real, decodable image to preview the feature with, and so the automated
  layout checks exercise the real same-origin fetch path rather than a mock.
  Never referenced by the live board; leave it in place.
