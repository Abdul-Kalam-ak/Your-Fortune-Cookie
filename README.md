# Fortune Cookie

A small, warm interactive fortune cookie. Pick a moment, pick who it's for, then crack the cookie for a short, honest message.

## Files

Put these four files together in the **same folder**:

```
fortune-cookie/
├── index.html
├── style.css
├── script.js
└── fortunes.json
```

Nothing else is required — no build step, no npm install.

## Running it locally

`script.js` loads `fortunes.json` with `fetch()`, and browsers block `fetch()` on `file://` pages for security. So you need to serve the folder over a local server rather than double-clicking `index.html`. Pick whichever you have installed:

**Python (built in on most machines)**
```bash
cd fortune-cookie
python3 -m http.server 8000
```
Then open **http://localhost:8000** in your browser.

**Node**
```bash
cd fortune-cookie
npx serve .
```

**VS Code**
Install the "Live Server" extension, right-click `index.html`, choose "Open with Live Server."

## Editing the fortunes

Open `fortunes.json`. It's organized like this:

```json
{
  "morning":  { "male": [...], "female": [...], "general": [...] },
  "bad_day":  { "male": [...], "female": [...], "general": [...] }
}
```

Add, remove, or rewrite any string in any of the six arrays — the site doesn't care how many there are, from a handful to several thousand. Just keep each entry a plain string in quotes, separated by commas.

## Notes

- Nothing is ever the *same* fortune twice in a row within a category ("Crack Another Cookie" and reopening the same choice both avoid an immediate repeat).
- "Share This Fortune" uses the native share sheet on phones; on desktop it falls back to copying the fortune to the clipboard.
- The app remembers your last "who it's for" choice in `localStorage` — nothing is sent anywhere, and no account or login is ever required.
- Animations respect `prefers-reduced-motion`; the app is fully usable with motion off.
