Email Security Checker (DNSCheck)

This is a small static site to check SPF, DMARC, DKIM and MX records for a domain using DNS-over-HTTPS (DoH).

What it does
- Queries public DoH endpoints (Cloudflare, Google, 1.1.1.1) for TXT, MX records.
- Progressive DKIM selector scanning.
- Shows SPF, DMARC, MX and DKIM records in a modal and allows copying records to clipboard.

Caveats (important when publishing)
- CORS: Public DoH endpoints may block cross-origin requests from some origins. If MX/SPF lookups fail in the browser console with CORS errors, the site needs either:
  - To be served from a domain allowed by the DoH provider, or
  - A small server-side proxy (recommended) that performs DoH requests server-side and returns JSON to the client.

- Browser security for clipboard: copying works via navigator.clipboard, which requires a secure context (HTTPS) on most browsers. When testing locally, use a local server.

How to serve locally (quick)
- Use VS Code Live Server extension
- Or run a simple Python static server (Python 3) from the DNSCheck folder:

```pwsh
# from the DNSCheck folder
python -m http.server 8080
# then open http://localhost:8080 in your browser
```

Publishing (recommended)
- GitHub Pages (easy): create a repo, push the DNSCheck folder contents to a branch (`gh-pages` or `main`), and enable GitHub Pages for the repo. Note that DoH CORS restrictions may still apply.
- Static host (Netlify / Vercel): drag-and-drop the site or connect the repo. If you need server-side proxying for DoH, set up a small serverless function.

Server-side proxy example (Node/Express)
- If you plan to publish so the site can reliably query DoH from browsers, add a tiny proxy endpoint that forwards DNS queries server-side (avoids CORS and client DoH blocking). I can add a sample Express function if you want.

Files
- index.html - main page
- script.js - client logic
- styles.css - styles
- favicon.ico - icon

WHOIS (RDAP) support
- The UI includes a WHOIS button next to hostnames (MX entries). Clicking it will call the public RDAP service via `https://rdap.org/domain/<domain>` which is CORS-enabled and does not require an API key.

- RDAP responses are standardized JSON but vary slightly by registry/registrar. The client performs a best-effort normalization to extract:
  - creation/registration date
  - last update date
  - registrar name (from entities with role 'registrar')
  - nameservers

- No proxy or API key is required for RDAP queries. If you prefer a different WHOIS provider later, we can wire it in similarly.

Next steps I can do for you
- Add a tiny Node proxy (single file) and instructions to deploy as a serverless function (Netlify/Vercel).
- Add automated build/publish tasks (GitHub Actions) to deploy to GitHub Pages.
- Polish styles and accessibility.

Tell me which of the next steps you want and I will implement them.