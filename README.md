# DGI Line Card Board

Office television board for **David Gooding, Inc.** — plumbing, heating, and waterworks manufacturers' representative, founded 1980. Motto: **We Care.**

The board features the **New England** line card: a welcome scene, the full logo wall, Heating / Plumbing / Waterworks / Showroom groupings, a spotlight for each line, territory, and contact. Each spotlight adds one short factual sentence about that line. Scenes rotate about every 14 seconds. A clock and Brockton weather sit in the corner. Customer service hours are Monday–Friday, 7AM–5PM.

Logos and product lines come from David Gooding, Inc.'s published line card. Nothing here is a price list, and the board does not advertise after-hours coverage.

## Run it

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8080
```

Designed at 1920×1080 and scaled to the screen. No build step. No external fonts or images. Weather is the current temperature and a three-day outlook for Brockton, Massachusetts, from Open-Meteo (no API key). GitHub Pages serves this repository from `main` at the site root.

The page keeps a single timer, does not grow the document while it runs, and reloads itself about every six hours when the browser is online so a TV can stay up. That timer also refreshes weather every 30 minutes. The last good reading stays in local storage, and the widget hides if a fetch fails and there is nothing saved. A watchdog moves to the next scene if one stays up too long. Logos are preloaded once and drop to the DGI mark if a file fails.
