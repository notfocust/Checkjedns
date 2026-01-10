Email Security Checker (DNSCheck)

This is a small static site to check SPF, DMARC, DKIM, MX, DNSSEC, CAA, MTA-STS, and TLS-RPT records for a domain using DNS-over-HTTPS (DoH).

What it does
- Queries public DoH endpoints (Cloudflare, Google, 1.1.1.1) for TXT, MX, DNSKEY, DS, CAA records.
- Progressive DKIM selector scanning.
- Shows SPF, DMARC, MX, DNSSEC, CAA, MTA-STS, TLS-RPT and DKIM records in a modal and allows copying records to clipboard.
