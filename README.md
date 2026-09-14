# Fortune Cookie

A small, warm interactive fortune cookie. Pick a moment, pick who it's for, then crack the cookie for a short, honest message.

## V2 fortune engine

The visible experience stays simple: **moment -> preference -> crack**. Behind the scenes, each fortune now belongs to an emotional category. The app silently chooses an appropriate category and then a fortune from that pool, so users never have to answer another question.

### Files

```
fortune-cookie/
├── index.html
├── style.css
├── script.js
└── fortunes.json
```

No build step or npm install is required.

## Running locally

Because `script.js` loads `fortunes.json` with `fetch()`, serve the folder over HTTP instead of opening `index.html` directly.

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Fortune data

The data is organized as:

```text
morning / bad_day
    -> male / female / general
        -> emotional category
            -> fortune objects
```

Morning categories: `confidence`, `motivation`, `calm`, `hope`, `curiosity`, `humor`.

Bad-day categories: `comfort`, `hope`, `self_worth`, `calm`, `perspective`, `encouragement`, `humor`.

Each fortune has `text` and `intensity` fields. You can add thousands of entries without changing the UI.

## How selection works

The user never chooses an emotional category. For example, `bad_day + general` silently gets an appropriate category such as `comfort`, `hope`, or `perspective`, then a random fortune from that category. The app also avoids immediately repeating the previous fortune.
