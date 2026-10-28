# DGI Line Card Board

Office television board for **David Gooding, Inc.** — plumbing, heating, and waterworks manufacturers' representative, founded 1980. Motto: **We Care.**

The board features the **New England** line card: a welcome scene, the full logo wall, Heating / Plumbing / Waterworks / Showroom groupings, a spotlight for each line, territory, and contact. Scenes rotate about every 14 seconds. A clock sits in the corner. Customer service hours are Monday–Friday, 7AM–5PM.

Logos and product lines come from David Gooding, Inc.'s published line card. Nothing here is a price list, and the board does not advertise after-hours coverage.

## Run it

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8080
```

Designed at 1920×1080 and scaled to the screen. No build step. No external fonts, images, or network calls. GitHub Pages serves this repository from `main` at the site root.

The page keeps a single timer, does not grow the document while it runs, and reloads itself every four hours so a TV browser can stay up.
