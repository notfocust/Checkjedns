// ==================== TYPEWRITER ANIMATION ====================
// Typewriter animation removed - using static subtitle instead


// ==================== HEADER CHECKER INITIALIZATION ====================
function initHeaderChecker() {
    const inputEl = document.getElementById('header-input');
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const resultsEl = document.getElementById('results');
    const hopsTableBody = document.querySelector('#hops-table tbody');
    const fieldsTableBody = document.querySelector('#fields-table tbody');
    const summaryEl = document.getElementById('summary');
    const modal = document.getElementById('results-modal');
    const dropSquare = document.getElementById('drop-square');
    const previewEmailBtn = document.getElementById('preview-email-btn');

    // Default theme: dark for body class sync
    document.body.classList.add('dark');
    
    // Store current email data for preview
    let currentEmailData = null;

    function parseRawHeaders(raw) {
        // Unfold headers: join wrapped lines (RFC 5322 folding)
        const unfolded = raw.replace(/\r?\n[\t ]+/g, ' ');
        const lines = unfolded.split(/\r?\n/);
        const headers = [];
        let current = null;
        for (const line of lines) {
            if (!line.trim()) continue;
            const sep = line.indexOf(':');
            if (sep > -1) {
                const name = line.slice(0, sep).trim();
                const value = line.slice(sep + 1).trim();
                headers.push({ name, value });
                current = headers[headers.length - 1];
            } else if (current) {
                current.value += ' ' + line.trim();
            }
        }
        return headers;
    }

    function extractReceived(headers) {
        const received = headers.filter(h => /^(received)$/i.test(h.name));
        // RFC order: top-most is last hop; we want chronological
        return received.reverse();
    }

    function parseReceivedLine(value) {
        // Try capture from, by, with, id, for, and the trailing date
        // The date is usually after ';'
        let datePart = null;
        let main = value;
        const semiIdx = value.lastIndexOf(';');
        if (semiIdx !== -1) {
            datePart = value.slice(semiIdx + 1).trim();
            main = value.slice(0, semiIdx).trim();
        }
        const fromMatch = main.match(/\bfrom\s+([^;]+?)\s+(?=by\b|with\b|id\b|for\b|$)/i);
        const byMatch = main.match(/\bby\s+([^;]+?)\s+(?=with\b|id\b|for\b|$)/i);
        const withMatch = main.match(/\bwith\s+([^;]+?)\s+(?=id\b|for\b|$)/i);
        const idMatch = main.match(/\bid\s+([^;]+?)\s+(?=for\b|$)/i);
        const forMatch = main.match(/\bfor\s+([^;]+?)\s*$/i);
        return {
            from: fromMatch ? fromMatch[1].trim() : null,
            by: byMatch ? byMatch[1].trim() : null,
            with: withMatch ? withMatch[1].trim() : null,
            id: idMatch ? idMatch[1].trim() : null,
            for: forMatch ? forMatch[1].trim() : null,
            dateRaw: datePart,
        };
    }

    function parseDateToUtc(dateStr) {
        if (!dateStr) return { date: null, iso: null };
        // Many headers use formats like: Sun, 3 Jul 2011 08:21:06 -0700 (PDT)
        // Remove comments in parentheses to avoid parser confusion
        const cleaned = dateStr.replace(/\([^)]*\)/g, '').trim();
        const d = new Date(cleaned);
        if (isNaN(d.getTime())) return { date: null, iso: null };
        return { date: d, iso: d.toISOString() };
    }

    function computeHopDeltas(hops) {
        let prevTime = null;
        for (const hop of hops) {
            if (hop.time && prevTime) {
                hop.deltaMs = hop.time.getTime() - prevTime.getTime();
            } else {
                hop.deltaMs = null;
            }
            if (hop.time) prevTime = hop.time;
        }
        return hops;
    }

    function humanDelta(ms) {
        if (ms === null || ms === undefined) return '—';
        const sign = ms < 0 ? '-' : '';
        const abs = Math.abs(ms);
        const s = Math.floor(abs / 1000) % 60;
        const m = Math.floor(abs / (60 * 1000)) % 60;
        const h = Math.floor(abs / (60 * 60 * 1000));
        const parts = [];
        if (h) parts.push(`${h}u`);
        if (m || h) parts.push(`${m}m`);
        parts.push(`${s}s`);
        return sign + parts.join(' ');
    }

    function analyze(raw) {
        const headers = parseRawHeaders(raw);
        const receivedLines = extractReceived(headers).map(h => h.value);
        const hopsParsed = receivedLines.map(parseReceivedLine).map((r, idx) => {
            const { date, iso } = parseDateToUtc(r.dateRaw);
            return {
                index: idx + 1,
                from: r.from,
                by: r.by,
                with: r.with,
                id: r.id,
                for: r.for,
                dateRaw: r.dateRaw || '—',
                iso: iso,
                time: date,
            };
        });
        computeHopDeltas(hopsParsed);

        // Compute total span and largest delta
        const times = hopsParsed.map(h => h.time).filter(Boolean).map(d => d.getTime());
        const totalSpan = times.length ? Math.max(...times) - Math.min(...times) : null;
        let maxDelta = -Infinity; let maxIdx = -1;
        for (let i = 0; i < hopsParsed.length; i++) {
            const d = hopsParsed[i].deltaMs;
            if (d !== null && d > maxDelta) { maxDelta = d; maxIdx = i; }
        }

        return { headers, hops: hopsParsed, totalSpan, maxIdx, maxDelta };
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
    }

    function renderAnalysis(model) {
        resultsEl.hidden = false;
        // Summary (English)
        const total = model.totalSpan != null ? humanDelta(model.totalSpan) : '—';
        const maxLabel = model.maxDelta != null && model.maxDelta !== -Infinity ? humanDelta(model.maxDelta) : '—';
        summaryEl.innerHTML = `Total transit time: <strong>${total}</strong> · Largest delay: <strong>${maxLabel}</strong>${model.maxIdx>=0 && model.hops[model.maxIdx]?.by ? ` at <code>${escapeHtml(model.hops[model.maxIdx].by)}</code>` : ''}`;

        // Hops table
        hopsTableBody.innerHTML = '';
        model.hops.forEach((h, i) => {
            const tr = document.createElement('tr');
            if (i === model.maxIdx) tr.classList.add('highlight');
            const deltaClass = h.deltaMs != null && h.deltaMs > 60_000 ? 'delta-warn' : 'delta-ok';
            
            // Make IPs and domains clickable in from/by fields
            let fromHtml = escapeHtml(h.from || '—');
            let byHtml = escapeHtml(h.by || '—');
            
            // Extract and make IPs clickable (only public IPs)
            fromHtml = fromHtml.replace(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g, (match) => {
                if (isPublicIP(match)) {
                    return `<span class="ip-address" data-ip="${match}">${match}</span>`;
                }
                return match;
            });
            byHtml = byHtml.replace(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g, (match) => {
                if (isPublicIP(match)) {
                    return `<span class="ip-address" data-ip="${match}">${match}</span>`;
                }
                return match;
            });
            
            // Extract and make domains clickable (only main domain, not subdomains)
            fromHtml = fromHtml.replace(/\b([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,})\b/g, (match) => {
                // Extract the main domain (last two parts)
                const parts = match.split('.');
                if (parts.length >= 2) {
                    const mainDomain = parts.slice(-2).join('.');
                    return match.replace(mainDomain, `<span class="domain-address" data-domain="${mainDomain}">${mainDomain}</span>`);
                }
                return match;
            });
            byHtml = byHtml.replace(/\b([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,})\b/g, (match) => {
                // Extract the main domain (last two parts)
                const parts = match.split('.');
                if (parts.length >= 2) {
                    const mainDomain = parts.slice(-2).join('.');
                    return match.replace(mainDomain, `<span class="domain-address" data-domain="${mainDomain}">${mainDomain}</span>`);
                }
                return match;
            });
            
            tr.innerHTML = `
                <td>${h.index}</td>
                <td>${fromHtml}</td>
                <td>${byHtml}</td>
                <td>${escapeHtml(h.dateRaw)}${h.iso ? `<br><small>${h.iso}</small>` : ''}</td>
                <td class="${h.deltaMs!=null ? deltaClass : ''}">${h.deltaMs!=null ? humanDelta(h.deltaMs) : '—'}</td>
            `;
            hopsTableBody.appendChild(tr);
        });

        // Fields table: show a subset of key headers with help tooltips
        const wanted = ['From','To','Subject','Date','Message-Id','Return-Path','Reply-To','Delivered-To','Authentication-Results','Received-SPF'];
        const fieldExplanations = {
            'Date': 'When the email was sent (original timezone)',
            'Message-Id': 'Unique identifier for this email message',
            'Return-Path': 'Bounce address for delivery failures',
            'Reply-To': 'Address replies should be sent to',
            'Delivered-To': 'Final recipient address',
            'Authentication-Results': 'SPF, DKIM, and DMARC verification results',
            'Received-SPF': 'SPF authentication status'
        };
        const map = new Map();
        for (const h of model.headers) {
            const key = h.name.trim();
            if (wanted.some(w => w.toLowerCase() === key.toLowerCase())) {
                if (!map.has(key)) map.set(key, []);
                map.get(key).push(h.value);
            }
        }
        
        // Update header title
        const titleEl = document.getElementById('header-fields-title');
        if (titleEl) {
            titleEl.textContent = 'Header Fields';
        }
        
        fieldsTableBody.innerHTML = '';
        for (const [k, values] of map) {
            const tr = document.createElement('tr');
            const explanation = fieldExplanations[k];
            const helpIcon = explanation ? ` <span class="help-icon" title="${escapeHtml(explanation)}">?</span>` : '';
            
            // Color code pass/fail in values and make IPs/domains clickable
            const coloredValues = values.map(v => {
                let colored = escapeHtml(v);
                // Highlight "pass" in green
                colored = colored.replace(/\b(pass)\b/gi, '<span style="color: var(--ok); font-weight: 600;">$1</span>');
                // Highlight "fail" in red
                colored = colored.replace(/\b(fail|failed)\b/gi, '<span style="color: var(--danger); font-weight: 600;">$1</span>');
                // Make IP addresses clickable (only public IPs)
                colored = colored.replace(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g, (match) => {
                    if (isPublicIP(match)) {
                        return `<span class="ip-address" data-ip="${match}">${match}</span>`;
                    }
                    return match;
                });
                // Make domains clickable (only main domain)
                colored = colored.replace(/\b([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,})\b/g, (match) => {
                    const parts = match.split('.');
                    if (parts.length >= 2) {
                        const mainDomain = parts.slice(-2).join('.');
                        return match.replace(mainDomain, `<span class="domain-address" data-domain="${mainDomain}">${mainDomain}</span>`);
                    }
                    return match;
                });
                return `<div>${colored}</div>`;
            }).join('');
            
            tr.innerHTML = `<td>${escapeHtml(k)}${helpIcon}</td><td>${coloredValues}</td>`;
            fieldsTableBody.appendChild(tr);
        }

        // Authentication-Results focus (SPF/DKIM/DMARC)
        const authStatusEl = document.getElementById('auth-status');
        const authBadgesEl = document.getElementById('auth-badges');
        const authDetailsEl = document.getElementById('auth-details');
        const authHeaders = model.headers.filter(h => /^authentication-results$/i.test(h.name));
        if (authHeaders.length) {
            authStatusEl.hidden = false;
            const parsed = parseAuthResults(authHeaders.map(h => h.value));
            authBadgesEl.innerHTML = '';
            const addBadge = (label, status) => {
                const span = document.createElement('span');
                span.className = `badge ${status}`;
                span.textContent = `${label}: ${status.toUpperCase()}`;
                
                // Add tooltip based on label
                let tooltip = '';
                if (label === 'SPF') {
                    tooltip = 'SPF (Sender Policy Framework) verifies that the sending server is authorized to send emails for this domain';
                } else if (label === 'DKIM') {
                    tooltip = 'DKIM (DomainKeys Identified Mail) verifies that the email was not tampered with during transit';
                } else if (label === 'DMARC') {
                    tooltip = 'DMARC (Domain-based Message Authentication) provides policy for handling SPF and DKIM failures';
                }
                
                if (tooltip) {
                    span.setAttribute('title', tooltip);
                }
                
                authBadgesEl.appendChild(span);
            };
            addBadge('SPF', parsed.spf.status);
            addBadge('DKIM', parsed.dkim.overall);
            addBadge('DMARC', parsed.dmarc.status);

            authDetailsEl.innerHTML = '';
        } else {
            authStatusEl.hidden = true;
        }
    }

    function parseAuthResults(values) {
        // Concatenate all auth-results values
        const text = values.join(' \n ');
        // SPF: spf=pass/fail/neutral
        const spfMatch = text.match(/spf=(pass|fail|neutral|softfail|none)/i);
        const spfStatus = spfMatch ? normalizeAuth(spfMatch[1]) : 'neutral';
        // DMARC: dmarc=pass/fail
        const dmarcMatch = text.match(/dmarc=(pass|fail|bestguesspass|none)/i);
        const dmarcStatus = dmarcMatch ? normalizeAuth(dmarcMatch[1]) : 'neutral';
        // DKIM: one or more dkim=pass/fail with domain
        const dkimRegex = /dkim=(pass|fail|neutral|none)(?:\s*\(([^)]*)\))?/ig;
        const signatures = [];
        let m;
        while ((m = dkimRegex.exec(text))) {
            const result = normalizeAuth(m[1]);
            const ctx = m[2] || '';
            const domainMatch = ctx.match(/header\.d=([^;\s)]+)/i);
            signatures.push({ domain: domainMatch ? domainMatch[1] : null, result });
        }
        const overallDkim = signatures.some(s => s.result === 'pass') ? 'pass' : (signatures.some(s => s.result === 'fail') ? 'fail' : 'neutral');
        return { spf: { status: spfStatus }, dmarc: { status: dmarcStatus }, dkim: { overall: overallDkim, signatures } };
    }

    function normalizeAuth(s) {
        s = String(s).toLowerCase();
        if (s === 'bestguesspass') return 'pass';
        if (s === 'softfail') return 'fail';
        return s;
    }

    function handleAnalyze() {
        const raw = inputEl.value.trim();
        if (!raw) { resultsEl.hidden = true; return; }
        const model = analyze(raw);
        renderAnalysis(model);
        openModal();
    }

    function handleFiles(files) {
        if (!files || !files.length) return;
        const file = files[0];
        const reader = new FileReader();
        reader.onload = () => {
            const text = String(reader.result || '');
            const headerBlock = extractHeadersFromEml(text) || text;
            inputEl.value = headerBlock;
            
            // Store email data for preview
            currentEmailData = {
                file: file,
                text: text,
                headerBlock: headerBlock
            };
            
            handleAnalyze();
        };
        reader.readAsText(file);
    }

    function extractHeadersFromEml(emlText) {
        // Headers end at first blank line (CRLF CRLF). Keep folding intact for parseRawHeaders to handle.
        const idx = emlText.search(/\r?\n\r?\n/);
        if (idx === -1) return null;
        return emlText.slice(0, idx).trimEnd();
    }

    function openModal() {
        if (!modal) return;
        modal.classList.add('open');
        modal.classList.add('show');
        modal.setAttribute('aria-hidden', 'false');
    }
    function closeModal() {
        if (!modal) return;
        modal.classList.remove('open');
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
    }

    function isPublicIP(ip) {
        const parts = ip.split('.').map(Number);
        if (parts.length !== 4) return false;
        
        // Private IP ranges
        if (parts[0] === 10) return false; // 10.0.0.0/8
        if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false; // 172.16.0.0/12
        if (parts[0] === 192 && parts[1] === 168) return false; // 192.168.0.0/16
        if (parts[0] === 127) return false; // 127.0.0.0/8 (localhost)
        if (parts[0] === 169 && parts[1] === 254) return false; // 169.254.0.0/16 (link-local)
        if (parts[0] === 0) return false; // 0.0.0.0/8
        if (parts[0] >= 224) return false; // 224.0.0.0/4 (multicast/reserved)
        
        return true;
    }

    // Events
    // Removed Analyze/Clear buttons; analyze automatically on file/paste
    fileInput.addEventListener('change', e => handleFiles(e.target.files));
    
    // Input method toggle
    const methodToggles = document.querySelectorAll('.method-toggle');
    const methodSections = document.querySelectorAll('.method-section');
    const emlToggle = document.getElementById('eml-toggle');
    
    methodToggles.forEach(toggle => {
        toggle.addEventListener('click', () => {
            const method = toggle.getAttribute('data-method');
            
            // If clicking Upload .eml File, open file picker instead of just toggling
            if (method === 'eml' && toggle === emlToggle) {
                fileInput.click();
                return;
            }
            
            // Update active toggle
            methodToggles.forEach(t => t.classList.remove('active'));
            toggle.classList.add('active');
            
            // Show/hide method sections
            methodSections.forEach(section => {
                const sectionMethod = section.getAttribute('data-method');
                if (sectionMethod === method) {
                    section.style.display = sectionMethod === 'eml' ? 'flex' : 'block';
                } else {
                    section.style.display = 'none';
                }
            });
        });
    });
    
    // Analyze when user pastes or types in the textarea
    inputEl.addEventListener('input', () => {
        if (inputEl.value.trim()) {
            currentEmailData = {
                headerBlock: inputEl.value.trim()
            };
            handleAnalyze();
        }
    });

    // Drag and drop support on the entire header content area
    const headerContent = document.getElementById('header-tab');
    headerContent?.addEventListener('dragover', e => { 
        e.preventDefault(); 
        e.dataTransfer.dropEffect = 'copy';
        headerContent.classList.add('dragover');
    });
    headerContent?.addEventListener('dragleave', () => { 
        headerContent.classList.remove('dragover');
    });
    headerContent?.addEventListener('drop', e => { 
        e.preventDefault(); 
        headerContent.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });

    // Modal close handlers
    modal?.addEventListener('click', e => { const t = e.target; if (t && t.getAttribute && t.getAttribute('data-close') === 'modal') closeModal(); });
    const closeBtn = document.querySelector('.modal-close');
    closeBtn?.addEventListener('click', closeModal);
    
    // Preview email button
    previewEmailBtn?.addEventListener('click', () => {
        if (currentEmailData) {
            showEmailPreview(currentEmailData);
        }
    });

    // Check links button
    const checkLinksBtn = document.getElementById('check-links-btn');
    checkLinksBtn?.addEventListener('click', () => {
        if (currentEmailData) {
            showLinkChecker(currentEmailData);
        }
    });

    // Theme switch is handled by EmailSecurityChecker

    // IP address and domain click handler
    document.addEventListener('click', async (e) => {
        if (e.target.classList.contains('ip-address')) {
            const ip = e.target.getAttribute('data-ip');
            showIpInfo(ip);
        } else if (e.target.classList.contains('domain-address')) {
            const domain = e.target.getAttribute('data-domain');
            showDomainInfo(domain);
        }
    });

    // IP info popup functions
    async function showIpInfo(ip) {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'ip-popup-overlay';
        overlay.innerHTML = `
            <div class="ip-popup">
                <button class="close-btn" onclick="this.closest('.ip-popup-overlay').remove()">×</button>
                <h3>IP Information: ${ip}</h3>
                <div class="loading">Loading...</div>
            </div>
        `;
        document.body.appendChild(overlay);

        try {
            const response = await fetch(`https://api.ipapi.is?q=${ip}`);
            const data = await response.json();
            
            const popup = overlay.querySelector('.ip-popup');
            popup.innerHTML = `
                <button class="close-btn" onclick="this.closest('.ip-popup-overlay').remove()">×</button>
                <h3>IP Information: ${ip}</h3>
                <div class="info-item">
                    <span class="info-label">IP:</span>
                    <span class="info-value">${data.ip || ip}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Country:</span>
                    <span class="info-value">${data.country || 'Unknown'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Region:</span>
                    <span class="info-value">${data.region || 'Unknown'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">City:</span>
                    <span class="info-value">${data.city || 'Unknown'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">ISP:</span>
                    <span class="info-value">${data.isp || 'Unknown'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Organization:</span>
                    <span class="info-value">${data.company?.name || 'Unknown'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">ASN:</span>
                    <span class="info-value">${data.asn?.asn || 'Unknown'} - ${data.asn?.name || 'Unknown'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Type:</span>
                    <span class="info-value">${data.asn?.type || 'Unknown'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Hosting:</span>
                    <span class="info-value" style="color: ${data.hosting ? '#ff4444' : '#44ff44'}">${data.hosting ? 'Yes' : 'No'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">VPN:</span>
                    <span class="info-value" style="color: ${data.vpn ? '#ff4444' : '#44ff44'}">${data.vpn ? 'Yes' : 'No'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Proxy:</span>
                    <span class="info-value" style="color: ${data.proxy ? '#ff4444' : '#44ff44'}">${data.proxy ? 'Yes' : 'No'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Tor:</span>
                    <span class="info-value" style="color: ${data.tor ? '#ff4444' : '#44ff44'}">${data.tor ? 'Yes' : 'No'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Abuser:</span>
                    <span class="info-value" style="color: ${data.abuser ? '#ff4444' : '#44ff44'}">${data.abuser ? 'Yes' : 'No'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Latitude:</span>
                    <span class="info-value">${data.latitude || 'Unknown'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Longitude:</span>
                    <span class="info-value">${data.longitude || 'Unknown'}</span>
                </div>
            `;
        } catch (error) {
            const popup = overlay.querySelector('.ip-popup');
            popup.innerHTML = `
                <button class="close-btn" onclick="this.closest('.ip-popup-overlay').remove()">×</button>
                <h3>IP Information: ${ip}</h3>
                <div class="loading">Error loading IP information</div>
            `;
        }

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });
    }

    // Domain info popup functions
    async function showDomainInfo(domain) {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'ip-popup-overlay';
        overlay.innerHTML = `
            <div class="ip-popup">
                <button class="close-btn" onclick="this.closest('.ip-popup-overlay').remove()">×</button>
                <h3>Phishing Check: ${domain}</h3>
                <div class="loading">Analyzing domain...</div>
            </div>
        `;
        document.body.appendChild(overlay);

        try {
            // Analyze domain for phishing indicators
            const analysis = analyzeDomainForPhishing(domain);
            
            const popup = overlay.querySelector('.ip-popup');
            popup.innerHTML = `
                <button class="close-btn" onclick="this.closest('.ip-popup-overlay').remove()">×</button>
                <h3>Phishing Check: ${domain}</h3>
                <div class="info-item">
                    <span class="info-label">Domain:</span>
                    <span class="info-value">${domain}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Risk Level:</span>
                    <span class="info-value" style="color: ${analysis.riskLevel === 'High' ? '#ff4444' : analysis.riskLevel === 'Medium' ? '#ffaa00' : '#44ff44'}">${analysis.riskLevel}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Score:</span>
                    <span class="info-value">${analysis.score}/10</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Analysis:</span>
                    <span class="info-value">${analysis.analysis}</span>
                </div>
                ${analysis.warnings.length > 0 ? `
                <div class="info-item">
                    <span class="info-label">Warnings:</span>
                    <span class="info-value">${analysis.warnings.join(', ')}</span>
                </div>
                ` : ''}
            `;
        } catch (error) {
            const popup = overlay.querySelector('.ip-popup');
            popup.innerHTML = `
                <button class="close-btn" onclick="this.closest('.ip-popup-overlay').remove()">×</button>
                <h3>Phishing Check: ${domain}</h3>
                <div class="info-item">
                    <span class="info-label">Error:</span>
                    <span class="info-value">Unable to analyze domain</span>
                </div>
            `;
        }

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });
    }

    function analyzeDomainForPhishing(domain) {
        const warnings = [];
        let score = 0;
        
        // Check for suspicious TLDs
        const suspiciousTlds = ['.tk', '.ml', '.ga', '.cf', '.pw', '.top', '.click', '.download'];
        const tld = domain.substring(domain.lastIndexOf('.'));
        if (suspiciousTlds.includes(tld.toLowerCase())) {
            warnings.push('Suspicious TLD');
            score += 3;
        }
        
        // Check for typosquatting patterns
        const commonDomains = ['google', 'microsoft', 'apple', 'amazon', 'facebook', 'twitter', 'instagram', 'linkedin', 'paypal', 'ebay', 'netflix', 'spotify', 'youtube', 'github', 'dropbox', 'adobe', 'salesforce', 'slack', 'zoom', 'teams'];
        const domainName = domain.split('.')[0].toLowerCase();
        
        for (const common of commonDomains) {
            if (domainName.includes(common) && domainName !== common) {
                warnings.push('Possible typosquatting');
                score += 4;
                break;
            }
        }
        
        // Check for suspicious subdomains
        const suspiciousSubdomains = ['secure', 'login', 'account', 'verify', 'update', 'confirm', 'support', 'help', 'admin', 'portal'];
        const subdomains = domain.split('.').slice(0, -2);
        for (const subdomain of subdomains) {
            if (suspiciousSubdomains.includes(subdomain.toLowerCase())) {
                warnings.push('Suspicious subdomain');
                score += 2;
            }
        }
        
        // Check domain length (very long domains are suspicious)
        if (domain.length > 30) {
            warnings.push('Unusually long domain');
            score += 1;
        }
        
        // Check for numbers in domain (suspicious)
        if (/\d/.test(domainName)) {
            warnings.push('Contains numbers');
            score += 1;
        }
        
        // Check for hyphens (suspicious)
        if (domain.includes('-')) {
            warnings.push('Contains hyphens');
            score += 1;
        }
        
        // Check for mixed case (suspicious)
        if (domain !== domain.toLowerCase() && domain !== domain.toUpperCase()) {
            warnings.push('Mixed case');
            score += 1;
        }
        
        // Determine risk level
        let riskLevel = 'Low';
        if (score >= 7) {
            riskLevel = 'High';
        } else if (score >= 4) {
            riskLevel = 'Medium';
        }
        
        // Generate analysis text
        let analysis = 'Domain appears legitimate';
        if (score >= 7) {
            analysis = 'High risk of phishing - avoid this domain';
        } else if (score >= 4) {
            analysis = 'Medium risk - exercise caution';
        } else if (score > 0) {
            analysis = 'Low risk - minor concerns detected';
        }
        
        return {
            domain,
            score: Math.min(score, 10),
            riskLevel,
            analysis,
            warnings
        };
    }

    // Link checker functions
    function showLinkChecker(emailData) {
        const urls = extractUrlsFromEmail(emailData.text);
        
        if (urls.length === 0) {
            alert('No URLs found in this email');
            return;
        }

        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'ip-popup-overlay';
        overlay.innerHTML = `
            <div class="ip-popup" style="max-width: 95vw; max-height: 95vh; width: 1200px;">
                <button class="close-btn">×</button>
                <h3>Link Checker: ${urls.length} URLs found</h3>
                <div class="link-checker">
                    <div class="urls-list">
                        ${urls.map((url, index) => `
                            <div class="url-item" data-url="${url}">
                                <div class="url-header">
                                    <span class="url-text">${url}</span>
                                    <button class="check-btn" data-url="${url}" data-index="${index}">Check</button>
                                </div>
                                <div class="url-preview" id="preview-${index}"></div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        // Add event listeners
        const closeBtn = overlay.querySelector('.close-btn');
        closeBtn.addEventListener('click', () => overlay.remove());

        const checkBtns = overlay.querySelectorAll('.check-btn');
        checkBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const url = e.target.getAttribute('data-url');
                const index = parseInt(e.target.getAttribute('data-index'));
                checkSingleUrl(url, index);
            });
        });

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });
    }

    function extractUrlsFromEmail(emailText) {
        // Extract URLs from email content using regex
        const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
        const urls = emailText.match(urlRegex) || [];
        
        // Remove duplicates and filter out common non-web URLs
        const uniqueUrls = [...new Set(urls)].filter(url => {
            // Filter out common email/attachment URLs that aren't web pages
            const lowerUrl = url.toLowerCase();
            return !lowerUrl.includes('mailto:') && 
                   !lowerUrl.includes('tel:') && 
                   !lowerUrl.includes('attachment') &&
                   !lowerUrl.includes('cid:') &&
                   !lowerUrl.includes('data:');
        });
        
        return uniqueUrls;
    }

    async function checkSingleUrl(url, index) {
        const previewEl = document.getElementById(`preview-${index}`);
        if (!previewEl) {
            return;
        }

        previewEl.innerHTML = '<div class="loading">Loading preview. Can take up to 30 seconds...</div>';

        try {
            const response = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}&screenshot=true&meta=true&palette=true`);
            const data = await response.json();

            if (data.status === 'success') {
                previewEl.innerHTML = `
                    <div class="preview-content">
                        <div class="preview-header">
                            <div class="preview-title-section">
                                <h4>${data.data.title || 'No title'}</h4>
                                <div class="preview-controls">
                                    <button class="expand-btn" onclick="expandPreview(${index})" title="Expand preview">⛶</button>
                                    <button class="collapse-btn" onclick="togglePreview(${index})" title="Collapse preview">−</button>
                                </div>
                            </div>
                            <p class="preview-description">${data.data.description || 'No description'}</p>
                        </div>
                        <div class="preview-body" id="preview-body-${index}">
                            ${data.data.image ? `
                                <div class="preview-image">
                                    <img src="${data.data.image.url}" alt="Preview" style="max-width: 100%; max-height: 200px; border-radius: 4px;">
                                </div>
                            ` : ''}
                            ${data.data.screenshot ? `
                                <div class="preview-screenshot">
                                    <img src="${data.data.screenshot.url}" alt="Screenshot" style="max-width: 100%; max-height: 300px; border-radius: 4px; border: 1px solid var(--border);">
                                </div>
                            ` : ''}
                            <div class="preview-meta">
                                <div class="meta-item">
                                    <strong>Domain:</strong> ${data.data.url}
                                </div>
                                ${data.data.author ? `
                                    <div class="meta-item">
                                        <strong>Author:</strong> ${data.data.author}
                                    </div>
                                ` : ''}
                                ${data.data.publisher ? `
                                    <div class="meta-item">
                                        <strong>Publisher:</strong> ${data.data.publisher}
                                    </div>
                                ` : ''}
                                ${data.data.logo ? `
                                    <div class="meta-item">
                                        <strong>Logo:</strong> <img src="${data.data.logo.url}" alt="Logo" style="height: 20px; vertical-align: middle;">
                                    </div>
                                ` : ''}
                            </div>
                            <div class="preview-actions">
                                <a href="${url}" target="_blank" class="visit-btn">Visit Website</a>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                previewEl.innerHTML = `
                    <div class="preview-error">
                        <p>Unable to load preview for this URL</p>
                        <p class="error-detail">${data.message || 'Unknown error'}</p>
                        <a href="${url}" target="_blank" class="visit-btn">Visit Website</a>
                    </div>
                `;
            }
        } catch (error) {
            previewEl.innerHTML = `
                <div class="preview-error">
                    <p>Error loading preview</p>
                    <p class="error-detail">${error.message}</p>
                    <a href="${url}" target="_blank" class="visit-btn">Visit Website</a>
                </div>
            `;
        }
    }

    // Make functions globally available
    window.checkSingleUrl = checkSingleUrl;
    window.togglePreview = togglePreview;
    window.expandPreview = expandPreview;

    function togglePreview(index) {
        const previewBody = document.getElementById(`preview-body-${index}`);
        const collapseBtn = document.querySelector(`#preview-${index} .collapse-btn`);
        
        if (previewBody && collapseBtn) {
            const isCollapsed = previewBody.style.display === 'none';
            previewBody.style.display = isCollapsed ? 'block' : 'none';
            collapseBtn.textContent = isCollapsed ? '−' : '+';
            collapseBtn.title = isCollapsed ? 'Collapse preview' : 'Expand preview';
        }
    }

    function expandPreview(index) {
        const previewEl = document.getElementById(`preview-${index}`);
        if (!previewEl) return;

        // Create fullscreen overlay
        const overlay = document.createElement('div');
        overlay.className = 'ip-popup-overlay';
        overlay.style.zIndex = '20000';
        overlay.innerHTML = `
            <div class="ip-popup" style="max-width: 95vw; max-height: 95vh; width: 95vw; height: 95vh;">
                <button class="close-btn" onclick="this.closest('.ip-popup-overlay').remove()">×</button>
                <h3>Preview: ${previewEl.querySelector('h4')?.textContent || 'Website Preview'}</h3>
                <div class="expanded-preview">
                    ${previewEl.querySelector('.preview-body')?.innerHTML || ''}
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });
    }

    // Email preview functions
    function parseEmailContent(emlText) {
        // Split headers and body
        const headerBodySplit = emlText.split(/\r?\n\r?\n/);
        const headersText = headerBodySplit[0];
        const bodyText = headerBodySplit.slice(1).join('\n\n');
        
        // Parse headers
        const headers = parseRawHeaders(headersText);
        
        // Parse MIME structure
        const mimeParts = parseMimeStructure(bodyText);
        
        return {
            headers: headers,
            body: bodyText,
            mimeParts: mimeParts
        };
    }

    function parseMimeStructure(bodyText) {
        const parts = [];
        
        // Check if it's a multipart message
        const boundaryMatch = bodyText.match(/boundary="?([^"\r\n]+)"?/i);
        if (!boundaryMatch) {
            // Single part message
            parts.push({
                type: 'text/plain',
                content: bodyText,
                encoding: '7bit'
            });
            return parts;
        }
        
        const boundary = '--' + boundaryMatch[1];
        const sections = bodyText.split(boundary);
        
        for (const section of sections) {
            if (!section.trim() || section === '--') continue;
            
            const headerBodySplit = section.split(/\r?\n\r?\n/);
            const partHeaders = headerBodySplit[0];
            const partBody = headerBodySplit.slice(1).join('\n\n');
            
            const contentType = partHeaders.match(/Content-Type:\s*([^;\r\n]+)/i)?.[1] || 'text/plain';
            const encoding = partHeaders.match(/Content-Transfer-Encoding:\s*([^;\r\n]+)/i)?.[1] || '7bit';
            const filename = partHeaders.match(/filename="?([^"\r\n]+)"?/i)?.[1];
            
            parts.push({
                type: contentType,
                content: partBody,
                encoding: encoding,
                filename: filename
            });
        }
        
        return parts;
    }

    function decodeContent(content, encoding) {
        switch (encoding.toLowerCase()) {
            case 'base64':
                try {
                    return atob(content.replace(/\s/g, ''));
                } catch (e) {
                    return content;
                }
            case 'quoted-printable':
                return content.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/g, (match, hex) => 
                    String.fromCharCode(parseInt(hex, 16))
                );
            default:
                return content;
        }
    }

    function showEmailPreview(emailData) {
        const emailContent = parseEmailContent(emailData.text);
        
        // Create preview overlay
        const overlay = document.createElement('div');
        overlay.className = 'ip-popup-overlay';
        overlay.innerHTML = `
            <div class="ip-popup" style="max-width: 90vw; max-height: 90vh; width: 1000px;">
                <button class="close-btn" onclick="this.closest('.ip-popup-overlay').remove()">×</button>
                <h3>Email Preview: ${emailData.file.name}</h3>
                <div class="email-preview">
                    <div class="email-body">
                        <div class="body-content">
                            ${emailContent.mimeParts.map((part, index) => {
                                if (part.type.startsWith('text/html')) {
                                    // Filter out full HTML documents, only show email body content
                                    let htmlContent = decodeContent(part.content, part.encoding);
                                    
                                    // If it contains DOCTYPE, try to extract just the body content
                                    if (htmlContent.includes('<!DOCTYPE') || htmlContent.includes('<!doctype')) {
                                        // Find the body tag and extract everything between body tags
                                        const bodyRegex = /<body[^>]*>([\s\S]*?)<\/body>/i;
                                        const bodyMatch = htmlContent.match(bodyRegex);
                                        
                                        if (bodyMatch && bodyMatch[1]) {
                                            htmlContent = bodyMatch[1];
                                        } else {
                                            // If no body tags, try to find the main content table
                                            const tableRegex = /<table[^>]*class="[^"]*nl-container[^"]*"[^>]*>([\s\S]*?)<\/table>/i;
                                            const tableMatch = htmlContent.match(tableRegex);
                                            
                                            if (tableMatch && tableMatch[1]) {
                                                htmlContent = tableMatch[1];
                                            } else {
                                                // Last resort: find any table that looks like email content
                                                const anyTableRegex = /<table[^>]*>([\s\S]*?)<\/table>/i;
                                                const anyTableMatch = htmlContent.match(anyTableRegex);
                                                
                                                if (anyTableMatch && anyTableMatch[1]) {
                                                    htmlContent = anyTableMatch[1];
                                                } else {
                                                    htmlContent = '';
                                                }
                                            }
                                        }
                                    }
                                    
                                    // Clean up excessive whitespace and line breaks
                                    htmlContent = htmlContent.replace(/\n\s*\n\s*\n+/g, '\n\n'); // Replace 3+ newlines with 2
                                    htmlContent = htmlContent.replace(/\r\n\s*\r\n\s*\r\n+/g, '\r\n\r\n'); // Replace 3+ CRLF with 2
                                    htmlContent = htmlContent.trim();
                                    
                                    return `
                                        <div class="mime-part">
                                            <iframe srcdoc="${escapeHtml(htmlContent)}" 
                                                    style="width: 100%; height: 400px; border: 1px solid var(--border); border-radius: 4px;">
                                            </iframe>
                                        </div>
                                    `;
                                } else if (part.type.startsWith('text/plain')) {
                                    let plainContent = decodeContent(part.content, part.encoding);
                                    // Clean up excessive line breaks in plain text too
                                    plainContent = plainContent.replace(/\n\s*\n\s*\n+/g, '\n\n'); // Replace 3+ newlines with 2
                                    plainContent = plainContent.replace(/\r\n\s*\r\n\s*\r\n+/g, '\r\n\r\n'); // Replace 3+ CRLF with 2
                                    plainContent = plainContent.trim();
                                    
                                    return `
                                        <div class="mime-part">
                                            <pre style="white-space: pre-wrap; background: var(--card); padding: 12px; border-radius: 4px; border: 1px solid var(--border);">${escapeHtml(plainContent)}</pre>
                                        </div>
                                    `;
                                } else if (part.filename) {
                                    return `
                                        <div class="mime-part">
                                            <h5>Attachment: ${escapeHtml(part.filename)}</h5>
                                            <p>Type: ${escapeHtml(part.type)}</p>
                                            <p>Size: ${part.content.length} bytes</p>
                                        </div>
                                    `;
                                }
                                return '';
                            }).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });
    }
}

// ==================== EMAIL SECURITY CHECKER ====================
class EmailSecurityChecker {
    constructor() {
        this.commonSelectors = [
            // Microsoft 365 standaard selectors (hoogste prioriteit)
            'selector1', 'selector2',
            // Apple/iCloud selectors
            'sig1', 'sig2',
            // Google Workspace selectors
            'google', 'google1', 'google2',
            // Nederlandse providers
            'zivver', 'transip', 'transip1', 'transip2', 'hostnet', 'hostnet1', 'hostnet2',
            'antagonist', 'versio', 'versio1', 'versio2', 'mijndomein', 'directadmin',
            'da1', 'da2', 'cpanel', 'cp1', 'cp2', 'plesk', 'plesk1', 'plesk2',
            'vimexx', 'byte', 'yourhosting', 'siteground', 'greenhost', 'true',
            'neostrada', 'argeweb', 'hosting2go', 'combell', 'one', 'serverius',
            'leaseweb', 'nforcenetworks', 'nforce', 'hypernode',
            // Nederlandse overheid en instellingen
            'rijksoverheid', 'overheid', 'gemeente', 'provincie', 'ministerie',
            // Nederlandse bedrijven en organisaties
            'kpn', 'ziggo', 'odido', 'tmobile', 'vodafone', 'xs4all', 'planet',
            'quicknet', 'freedom', 'delta', 'caiway', 'online',
            // Nederlandse banken
            'ing', 'rabobank', 'abn', 'abnamro', 'sns', 'asn', 'regiobank',
            'knab', 'bunq', 'revolut', 'n26', 'triodos',
            // Nederlandse hosting specifiek
            'site', 'sitenl', 'hosting', 'hosting1', 'hosting2', 'webhosting',
            'shared', 'shared1', 'shared2', 'vps', 'vps1', 'vps2',
            'dedicated', 'cloud', 'cloud1', 'cloud2', 'server', 'server1', 'server2',
            'mail', 'mail1', 'mail2', 'mx', 'mx1', 'mx2', 'smtp', 'smtp1', 'smtp2',
            'pop', 'pop3', 'imap', 'imap1', 'imap2',
            // Everlytic (Nederlandse email marketing)
            'everlytickey1', 'everlytickey2', 'eversrv',
            // Global Micro (Nederlandse provider)
            'mxvault',
            // Algemene Nederlandse patronen
            'nl', 'nederland', 'dutch', 'default', 'standaard', 'email', 'e-mail',
            'post', 'postmaster', 'admin', 'beheer', 'beheerder', 'info', 'contact',
            'noreply', 'no-reply', 'nieuwsbrief', 'newsletter', 'marketing', 'promo',
            'service', 'support', 'factuur', 'facturen', 'invoice', 'order',
            'bestelling', 'klant', 'klanten', 'customer', 'webshop', 'shop', 'winkel',
            // MailChimp/Mandrill selectors
            'k1', 'k2', 'mandrill',
            // SendGrid selectors
            'sendgrid', 's1', 's2',
            // Amazon SES selectors
            'amazonses', 'ses', 'aws',
            // Postmark selectors
            'postmark', 'pm',
            // SparkPost selectors
            'sparkpost', 'sp',
            // Hetzner selectors
            'dkim',
            // Algemene selectors
            'key1', 'key2',
            // Provider-specifieke selectors
            'mailgun', 'constantcontact', 'campaignmonitor', 'aweber', 'getresponse',
            'mailerlite', 'sendinblue', 'convertkit', 'drip', 'activecampaign',
            // Outlook/Office365 selectors
            'outlook', 'office365', 'exchange', 'hosted',
            // Numerieke selectors
            'dkim1', 'dkim2', 'sel1', 'sel2', 'dk1', 'dk2',
            // Andere patronen
            'primary', 'secondary', 'main', 'backup', 'prod', 'production',
            // Email marketing platforms
            'klaviyo', 'hubspot', 'salesforce', 'pardot',
            // Security providers
            'proofpoint', 'mimecast', 'barracuda',
            // Additional common selectors
            'dkimChecking', 'test', 'beta', 'staging',
            // Year-based selectors (vaak gebruikt voor rotatie)
            '2023', '2024', '2025',
            // Month-based selectors
            'jan', 'feb', 'mar', 'apr', 'may', 'jun',
            'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
        ];

        this.dnsProviders = [
            'https://cloudflare-dns.com/dns-query',
            'https://dns.google/resolve',
            'https://1.1.1.1/dns-query'
        ];

        // Track highest progress value to avoid regressions on async updates
        this.maxProgress = 0;

        this.lastSpfResult = null;
        this.lastDmarcResult = null;
        this.lastMxResult = null;
        this.lastDomain = null;

        this.init();
        this.initTheme(document.getElementById('themeToggle'));
    }

    init() {
        const checkButton = document.getElementById('checkButton');
        const domainInput = document.getElementById('domain');
    const themeToggle = document.getElementById('themeToggle');
        this.modal = document.getElementById('resultsModal');
        this.modalClose = document.getElementById('modalClose');
        this.modalResults = document.getElementById('modalResults');
        this.modalDomain = document.getElementById('modalDomain');
        this.modalCheck = document.getElementById('modalCheck');
        this.tipsButton = document.getElementById('tipsButton');
        this.tipsEnabled = false;

        checkButton.addEventListener('click', () => this.checkEmailSecurity());
        domainInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.checkEmailSecurity();
            }
        });
        
        // Add event listener for the modal close button
        if (this.modalClose) {
            this.modalClose.addEventListener('click', () => this.closeModal());
        }

        // header analysis removed — replaced by external link in the UI

        if (this.modalCheck) {
            this.modalCheck.addEventListener('click', () => {
                if (this.modalDomain && this.modalDomain.value) {
                    document.getElementById('domain').value = this.modalDomain.value;
                }
                this.checkEmailSecurity();
            });
        }
        if (this.modalDomain) {
            this.modalDomain.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    if (this.modalDomain && this.modalDomain.value) {
                        document.getElementById('domain').value = this.modalDomain.value;
                    }
                    this.checkEmailSecurity();
                }
            });
        }

        domainInput.focus();
        
        // Make instance globally available for inline onclick handlers
        window.emailChecker = this;
        
        // Add event listener for tips button
        if (this.tipsButton) {
            this.tipsButton.addEventListener('click', () => this.toggleTips());
        }
        
        // Initialize theme from persisted preference
        // Initialize theme from persisted preference (handled by initTheme)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeModal();
        });
    }

    nextFrame() {
        return new Promise(resolve => requestAnimationFrame(() => resolve()));
    }

    initTheme(themeToggle) {
        const saved = localStorage.getItem('theme');
        const isDark = saved === 'dark' || saved === null; // Default to dark mode
        document.body.classList.toggle('dark', isDark);
        if (themeToggle) themeToggle.textContent = isDark ? '☀️' : '🌙';
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                const nowDark = !document.body.classList.contains('dark');
                
                // Show warning for IT Nerds when switching to light mode
                if (!nowDark) {
                    this.showLightModeWarning(themeToggle, nowDark);
                    return; // Don't apply theme change yet
                }
                
                // For dark mode, apply immediately
                document.body.classList.toggle('dark', nowDark);
                localStorage.setItem('theme', nowDark ? 'dark' : 'light');
                themeToggle.textContent = nowDark ? '☀️' : '🌙';
            });
        }
    }

    showLightModeWarning(themeToggle, nowDark) {
        // Create a small popup next to the sun icon
        const popup = document.createElement('div');
        popup.style.cssText = `
            position: fixed;
            top: 70px;
            right: 20px;
            background: #303134;
            border: 1px solid #5f6368;
            border-radius: 8px;
            padding: 16px;
            z-index: 9999;
            min-width: 280px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        `;
        
        const message = document.createElement('div');
        message.style.cssText = `
            font-size: 14px;
            color: #e8eaed;
            margin-bottom: 12px;
            font-weight: 500;
        `;
        message.textContent = '⚠️ Are you an IT Nerd?';
        
        const description = document.createElement('div');
        description.style.cssText = `
            font-size: 13px;
            color: #9aa0a6;
            margin-bottom: 12px;
            line-height: 1.4;
        `;
        description.textContent = 'Click below and save yourself from a flashbang!';
        
        const timerContainer = document.createElement('div');
        timerContainer.style.cssText = `
            display: flex;
            gap: 8px;
            margin-bottom: 12px;
        `;
        
        const timer = document.createElement('div');
        timer.style.cssText = `
            flex: 1;
            background: #3c4043;
            color: #8ab4f8;
            padding: 8px;
            border-radius: 4px;
            text-align: center;
            font-weight: bold;
            font-size: 16px;
            border: 1px solid #5f6368;
        `;
        timer.textContent = '3';
        timerContainer.appendChild(timer);
        
        const clickButton = document.createElement('button');
        clickButton.style.cssText = `
            flex: 1;
            background: #1a73e8;
            color: white;
            border: none;
            padding: 8px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 500;
            font-size: 13px;
            transition: background 0.2s;
        `;
        clickButton.textContent = 'Click Me!';
        clickButton.onmouseover = () => clickButton.style.background = '#1557b0';
        clickButton.onmouseout = () => clickButton.style.background = '#1a73e8';
        
        let clicked = false;
        let finished = false;
        
        const applyLightMode = () => {
            if (!finished) {
                finished = true;
                document.body.classList.toggle('dark', nowDark);
                localStorage.setItem('theme', nowDark ? 'dark' : 'light');
                themeToggle.textContent = nowDark ? '☀️' : '🌙';
            }
        };
        
        clickButton.addEventListener('click', () => {
            if (clicked) return;
            clicked = true;
            message.textContent = '✅ SUCCESS!';
            description.textContent = 'You saved yourself from a flashbang!';
            timerContainer.remove();
            
            // Remove popup after showing success (stay in dark mode)
            setTimeout(() => popup.remove(), 2000);
        });
        
        timerContainer.appendChild(clickButton);
        
        popup.appendChild(message);
        popup.appendChild(description);
        popup.appendChild(timerContainer);
        
        document.body.appendChild(popup);
        
        // Countdown timer
        let timeLeft = 3;
        const timerInterval = setInterval(() => {
            timeLeft--;
            if (!clicked && timeLeft > 0) {
                timer.textContent = timeLeft.toString();
            }
            
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                if (!clicked) {
                    // If not clicked, show flashbang
                    popup.remove();
                    this.showFlashbang();
                    applyLightMode(); // Apply light mode after flashbang
                }
            }
        }, 1000);
    }

    showFlashbang() {
        // Silent flashbang - do nothing
    }

    toggleHeaderInput() {
        // header input functionality removed; header check now links to external site
    }

    async analyzeEmailHeader() {
        // Header analysis removed in favor of external tool
    }

    parseEmailHeader(headerText) {
        // header parsing removed
        return {};
    }

    compareRecordsWithHeader(analysis, spfResult, dmarcResult, dkimResults) {
        // header comparison removed
        return {};
    }

    initializeHeaderResultsContainer(analysis) {
        // removed header results container
    }

    displayHeaderInitialResults(analysis, spfResult, dmarcResult, mxResult) {
        // removed header initial results display
    }

    updateHeaderResultsWithComparison(analysis, spfResult, dmarcResult, dkimResults, comparison) {
        // removed header comparison update
    }

    getComparisonStatusClass(status) {
        switch (status) {
            case 'pass': return 'status-pass';
            case 'fail': return 'status-fail';
            case 'no-header': return 'status-warning';
            case 'no-record': return 'status-error';
            default: return 'status-unknown';
        }
    }

    getComparisonStatusText(status, headerResult) {
        switch (status) {
            case 'pass': return `✅ Pass (${headerResult})`;
            case 'fail': return `❌ Fail (${headerResult})`;
            case 'no-header': return '⚠️ No authentication results in header';
            case 'no-record': return '❌ No record found';
            default: return '❓ Unknown';
        }
    }

    async checkEmailSecurity() {
        const domain = document.getElementById('domain').value.trim();
        if (!domain) {
            this.showError('Enter a valid domain');
            return;
        }

        if (!this.isValidDomain(domain)) {
            this.showError('Enter a valid domain (e.g., checkjedns.nl)');
            return;
        }

        this.showLoading();
        this.resetProgress();

        try {
            // Show empty results container immediately in modal
            this.initializeResultsContainer(domain);
            await this.nextFrame();
            
            // Check SPF and DMARC in parallel and render immediately
            this.updateProgress(5, 'Checking SPF and DMARC records...');
            
            const [spfResult, dmarcResult, mxResult, nsResult] = await Promise.all([
                this.checkSPFRecord(domain),
                this.checkDMARCRecord(domain),
                this.checkMXRecord(domain),
                this.checkNSRecord(domain)
            ]);
            
            // Render SPF and DMARC results immediately
            this.displayInitialResults(domain, spfResult, dmarcResult, mxResult, nsResult);
            
            this.updateProgress(20, 'Checking DKIM selectors...');
            
            // Start DKIM checks and update progressively
            await this.checkAllDKIMSelectorsProgressive(domain);
            
        } catch (error) {
            this.hideLoading();
            this.showError('An error occurred while checking email security records: ' + error.message);
        }
    }

    initializeResultsContainer(domain) {
        if (this.modalResults) this.modalResults.innerHTML = `
            <div class="summary">
                <h2>Email Security Check for ${domain}</h2>
                <div id="spf-dmarc-container">
                    <p>Loading SPF and DMARC records...</p>
                </div>
            </div>
            <div id="dkim-container">
                <div id="dkim-accordion" class="dkim-accordion">
                    <div class="dkim-accordion-header" onclick="this.parentElement.classList.toggle('expanded')">
                        <div class="section-header"><h3>DKIM Records</h3></div>
                        <div class="dkim-toggle-indicator" aria-hidden="true">▸</div>
                    </div>
                    <div class="dkim-body">
                        <div class="section-description">
                            Loading DKIM records...
                        </div>
                        <div class="loading loading-progress">
                            <div class="loading-content">
                            <div class="progress-container">
                                <div class="progress-bar" id="progressFill"></div>
                            </div>
                            <div class="progress-text" id="progressText">Preparing...</div>
                            <div class="quote-text" id="quoteText"></div>
                            </div>
                        </div>
                        <div id="dkim-results"></div>
                    </div>
                </div>
            </div>
        `;
        // Modal is opened in showLoading
    }

    generateTips(spfResult, dmarcResult) {
        const tips = [];
        
        if (spfResult.found) {
            if (spfResult.record.includes('~all')) {
                tips.push({ type: 'warning', text: "SPF uses ~all (soft fail) - consider using -all (hard fail) for better protection" });
            } else if (spfResult.record.includes('-all')) {
                tips.push({ type: 'success', text: "SPF uses -all (hard fail) - good for security!" });
            }
        } else {
            tips.push({ type: 'error', text: "No SPF record found - add one to prevent email spoofing" });
        }
        
        if (dmarcResult.found) {
            const dmarcRecord = dmarcResult.record.toLowerCase();
            const pMatch = dmarcRecord.match(/p=([^;]+)/);
            if (pMatch) {
                const policy = pMatch[1];
                if (policy === 'none') {
                    tips.push({ type: 'warning', text: "DMARC policy is 'none' - consider 'quarantine' or 'reject' for enforcement" });
                } else if (policy === 'quarantine') {
                    tips.push({ type: 'success', text: "DMARC policy is 'quarantine' - suspicious emails go to spam" });
                } else if (policy === 'reject') {
                    tips.push({ type: 'success', text: "DMARC policy is 'reject' - suspicious emails are blocked" });
                } else {
                    tips.push({ type: 'warning', text: "Unknown DMARC policy - use 'quarantine' or 'reject'" });
                }
            } else {
                tips.push({ type: 'warning', text: "DMARC record found but no policy (p=) specified" });
            }
        } else {
            tips.push({ type: 'error', text: "No DMARC record found - add one to protect against spoofing" });
        }
        
        return tips;
    }

    toggleTips() {
        this.tipsEnabled = !this.tipsEnabled;
        if (this.tipsButton) {
            this.tipsButton.classList.toggle('active', this.tipsEnabled);
        }
        if (this.lastDomain && this.lastSpfResult && this.lastDmarcResult) {
            this.displayInitialResults(this.lastDomain, this.lastSpfResult, this.lastDmarcResult, this.lastMxResult, this.lastNsResult);
        }
    }

    formatSPFExpanded(spfRecord) {
        // Parse and format SPF record for vertical display with colors
        const parts = spfRecord.split(/\s+/);
        return parts.map(part => {
            if (part) {
                let className = 'spf-param-other';
                if (part.startsWith('v=')) {
                    className = 'spf-param-v';
                } else if (part.startsWith('ip4:') || part.startsWith('ip6:')) {
                    className = 'spf-param-ip';
                } else if (part.startsWith('include:')) {
                    className = 'spf-param-include';
                } else if (part.startsWith('a') || part.startsWith('mx')) {
                    className = 'spf-param-mechanism';
                } else if (part.startsWith('-all')) {
                    className = 'spf-param-fail';
                } else if (part.startsWith('~all')) {
                    className = 'spf-param-softfail';
                } else if (part.startsWith('ptr:')) {
                    className = 'spf-param-ptr';
                }
                return `<div class="spf-part"><span class="${className}">${this.escapeHtml(part)}</span></div>`;
            }
            return '';
        }).filter(x => x).join('');
    }

    formatDMARCExpanded(dmarcRecord) {
        // Parse and format DMARC record for vertical display with colors
        const parts = dmarcRecord.split(/;\s*/);
        return parts.map(part => {
            const trimmedPart = part.trim();
            if (trimmedPart) {
                let className = 'dmarc-param-other';
                if (trimmedPart.startsWith('v=')) {
                    className = 'dmarc-param-v';
                } else if (trimmedPart.startsWith('p=')) {
                    className = 'dmarc-param-p';
                } else if (trimmedPart.startsWith('sp=')) {
                    className = 'dmarc-param-sp';
                } else if (trimmedPart.startsWith('rua=')) {
                    className = 'dmarc-param-rua';
                } else if (trimmedPart.startsWith('ruf=')) {
                    className = 'dmarc-param-ruf';
                }
                return `<div class="dmarc-part"><span class="${className}">${this.escapeHtml(trimmedPart)}</span></div>`;
            }
            return '';
        }).filter(x => x).join('');
    }

    escapeHtml(text) {
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    formatMXRecords(records) {
        // Format MX records with color coding for priority levels
        return records.sort((a, b) => a.priority - b.priority).map(r => {
            let className = 'mx-priority-low';
            if (r.priority <= 10) {
                className = 'mx-priority-high';
            } else if (r.priority <= 20) {
                className = 'mx-priority-medium';
            }
            return `<div class="mx-part"><span class="${className}">${this.escapeHtml(r.exchange)} (priority <span class="mx-priority-value">${r.priority}</span>)</span></div>`;
        }).join('');
    }

    formatNSRecords(records) {
        // Format nameserver records with color coding
        return records.map(ns => {
            return `<div class="ns-part"><span class="ns-param">${this.escapeHtml(ns)}</span></div>`;
        }).join('');
    }

    displayInitialResults(domain, spfResult, dmarcResult, mxResult, nsResult) {
        this.lastDomain = domain;
        this.lastSpfResult = spfResult;
        this.lastDmarcResult = dmarcResult;
        this.lastMxResult = mxResult;
        this.lastNsResult = nsResult;
        const spfDmarcContainer = document.getElementById('spf-dmarc-container');
        
        let tipsHtml = '';
        if (this.tipsEnabled) {
            const tips = this.generateTips(spfResult, dmarcResult);
            if (tips.length > 0) {
                tipsHtml = `
                    <div class="tips-section">
                        <div class="tips-header">
                            <div class="tips-icon">💡</div>
                            <div class="tips-title">
                                <h3>Email Security Tips</h3>
                                <p>Recommendations to improve your domain's email security</p>
                            </div>
                        </div>
                        <ul>
                            ${tips.map(tip => `<li class="tip-${tip.type}">${tip.text}</li>`).join('')}
                        </ul>
                    </div>
                `;
            }
        }
        
        spfDmarcContainer.innerHTML = `
            <div class="security-overview">
                <div class="security-item">
                    <div class="security-item-header">
                        <h3>SPF Record</h3>
                    </div>
                    <div class="security-status ${spfResult.found ? 'status-found' : 'status-not-found'}">
                        ${spfResult.found ? 'Found' : 'Not found'}
                    </div>
                    ${spfResult.found ? `
                        <div class="record-details spf-record expanded" id="spf-record-details">
                            <div class="record-line spf-record-line">
                                <div class="spf-text">${this.formatSPFExpanded(spfResult.record)}</div>
                                <button class="copy-btn" onclick="window.emailChecker.copyToClipboard('${spfResult.record.replace(/'/g, "\\'")}', this)">Copy</button>
                            </div>
                        </div>
                    ` : ''}
                </div>
                <div class="security-item">
                    <div class="security-item-header">
                        <h3>DMARC Record</h3>
                    </div>
                    <div class="security-status ${dmarcResult.found ? 'status-found' : 'status-not-found'}">
                        ${dmarcResult.found ? 'Found' : 'Not found'}
                    </div>
                    ${dmarcResult.found ? `
                        <div class="record-details dmarc-record expanded" id="dmarc-record-details">
                            <div class="record-line dmarc-record-line">
                                <div class="dmarc-text">${this.formatDMARCExpanded(dmarcResult.record)}</div>
                                <button class="copy-btn" onclick="window.emailChecker.copyToClipboard('${dmarcResult.record.replace(/'/g, "\\'")}', this)">Copy</button>
                            </div>
                        </div>
                    ` : ''}
                </div>
                ${mxResult ? `
                <div class="security-item">
                    <div class="security-item-header">
                        <h3>MX Records</h3>
                    </div>
                    <div class="security-status ${mxResult.found ? 'status-found' : 'status-not-found'}">
                        ${mxResult.found ? 'Found' : 'Not found'}
                    </div>
                    ${mxResult.found ? `
                            <div class="record-details mx-records">
                                <div class="record-line mx-record-line">
                                    <div class="mx-text">
                                        ${this.formatMXRecords(mxResult.records)}
                                    </div>
                                    <button class="copy-btn" onclick="window.emailChecker.copyToClipboard('${mxResult.records.sort((a,b)=>a.priority-b.priority).map(r => r.exchange).join(', ').replace(/'/g, "\\'")}', this)">Copy</button>
                                </div>
                            </div>
                        ` : ''}
                </div>
                ` : ''}
                ${nsResult ? `
                <div class="security-item">
                    <div class="security-item-header">
                        <h3>Nameservers</h3>
                    </div>
                    <div class="security-status ${nsResult.found ? 'status-found' : 'status-not-found'}">
                        ${nsResult.found ? 'Found' : 'Not found'}
                    </div>
                    ${nsResult.found ? `
                            <div class="record-details ns-records">
                                <div class="record-line ns-record-line">
                                    <div class="ns-text">
                                        ${this.formatNSRecords(nsResult.records)}
                                    </div>
                                    <button class="copy-btn" onclick="window.emailChecker.copyToClipboard('${nsResult.records.join(', ').replace(/'/g, "\\'")}', this)">Copy</button>
                                </div>
                            </div>
                        ` : ''}
                </div>
                ` : ''}
            </div>
            ${tipsHtml}
        `;
    }



    async checkAllDKIMSelectorsProgressive(domain) {
        const dkimResults = [];
        const dkimResultsContainer = document.getElementById('dkim-results');
        
        // Update section description if it exists
        const sectionDescription = document.querySelector('#dkim-container .section-description');
        if (sectionDescription) {
        sectionDescription.textContent = 'Checking DKIM selectors...';
        }
        
        for (let i = 0; i < this.commonSelectors.length; i++) {
            const selector = this.commonSelectors[i];
            
            // Update progress
            const progressPercentage = 20 + ((i / this.commonSelectors.length) * 75);
            this.updateProgress(progressPercentage, `Checking DKIM selector: ${selector}`);
            
            try {
                const result = await this.checkDKIMRecord(domain, selector);
                if (result.found) {
                    dkimResults.push(result);
                    
                    // Add to results immediately
                    this.addDKIMResultToDOM(result, selector === 'selector1' || selector === 'selector2');
                }
            } catch (error) {
                console.warn(`Error checking selector ${selector}:`, error);
            }
            
            // Small delay to keep UI responsive
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        // Update section description if it exists
        if (sectionDescription) {
        sectionDescription.textContent = `${dkimResults.length} DKIM record(s) found`;
        }
        this.updateProgress(100, 'Check completed');
        this.hideLoading();
        
        return dkimResults;
    }

    addDKIMResultToDOM(result, isMicrosoft = false) {
        const dkimResultsContainer = document.getElementById('dkim-results');
        
        const resultElement = document.createElement('div');
        resultElement.className = `selector-result ${isMicrosoft ? 'microsoft-selector' : ''}`;
        
        resultElement.innerHTML = `
            <div class="selector-header" onclick="this.parentElement.classList.toggle('expanded')">
                <div class="selector-name">
                    ${result.selector}
                    ${isMicrosoft ? '<span class="microsoft-badge">Microsoft</span>' : ''}
                </div>
                <div class="status found">Found</div>
            </div>
            <div class="selector-details">
                <strong>Selector:</strong>
                <div class="record-line">
                    <span class="record-text">${result.selector}</span>
                    <button class="copy-btn" onclick="window.emailChecker.copyToClipboard('${result.selector}', this)">Copy</button>
                </div>
                <strong>DKIM Record:</strong>
                <div class="record-line">
                    <span class="record-text">${result.record}</span>
                    <button class="copy-btn" onclick="window.emailChecker.copyToClipboard('${result.record.replace(/'/g, "\\'")}', this)">Copy</button>
                </div>
            </div>
        `;
        
        dkimResultsContainer.appendChild(resultElement);
    }

    isValidDomain(domain) {
        const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])*$/;
        return domainRegex.test(domain) && domain.includes('.');
    }

    showError(message) {
        if (this.modalResults) {
            this.modalResults.innerHTML = `<div class="error-message">${message}</div>`;
            this.openModal('Error');
            return;
        }
        const resultsContainer = document.getElementById('results');
        if (resultsContainer) resultsContainer.innerHTML = `<div class="error-message">${message}</div>`;
    }

    showLoading() {
        if (this.modalResults) {
            this.modalResults.innerHTML = `
                <div class="loading loading-center">
                    <div class="loading-content">
                    <div class="progress-container">
                        <div class="progress-bar" id="progressFill"></div>
                    </div>
                    <div class="progress-text" id="progressText">Preparing...</div>
                    <div class="quote-text" id="quoteText"></div>
                    </div>
                </div>
            `;
        }
        // keep modal controls in header in sync
        if (this.modalDomain) this.modalDomain.value = document.getElementById('domain').value || '';
        this.openModal('Results');
        this.startQuotes();
    }

    hideLoading() {
        this.stopQuotes();
        
        const scope = this.modalResults || document;
        const loader = scope.querySelector('.loading');
        if (loader) loader.style.display = 'none';
    }

    resetProgress() {
        this.maxProgress = 0;
        this.updateProgress(0, 'Preparing...');
    }

    updateProgress(percentage, text) {
        const scope = this.modalResults || document;
        const progressFill = scope.querySelector('#progressFill');
        const progressText = scope.querySelector('#progressText');
        const clamped = Math.max(0, Math.min(100, Math.round(percentage)));
        const next = Math.max(this.maxProgress, clamped);
        this.maxProgress = next;
        
        if (progressFill) progressFill.style.width = next + '%';
        if (progressText && typeof text === 'string') progressText.textContent = text;
    }

    openModal(title) {
        const titleEl = document.getElementById('modalTitle');
        if (titleEl) titleEl.textContent = title || 'Results';
        if (this.modal) this.modal.classList.add('open');
        if (this.modal) this.modal.setAttribute('aria-hidden', 'false');
    }

    closeModal() {
        if (this.modal) {
            this.modal.classList.add('closing');
            this.modal.classList.remove('open');
            
            // Wait for animation to complete before hiding the modal
            setTimeout(() => {
                if (this.modal) {
                    this.modal.classList.remove('closing');
                    this.modal.setAttribute('aria-hidden', 'true');
                }
            }, 200); // Match the animation duration
        }
    }

    startQuotes() {
        const scope = this.modalResults || document;
        const el = scope.querySelector('#quoteText');
        if (!el) return;
        
        const quotes = [
            "Woah, that's fast, right?",
            "Warming up the DNS engines...",
            "Asking the internet politely...",
            "Compiling selector magic...",
            "Hold tight, packets in transit...",
            "Blink and you'll miss it!",
            "Summoning DKIM spirits...",
            "Fetching SPF goodness...",
            "DMARCing our territory..."
        ];
        let i = 0;
        
        el.textContent = quotes[i % quotes.length];
        this.quoteTimer = setInterval(() => {
            i += 1;
            el.textContent = quotes[i % quotes.length];
        }, 1800);
    }

    stopQuotes() {
        if (this.quoteTimer) {
            clearInterval(this.quoteTimer);
            this.quoteTimer = null;
        }
    }

    async checkSPFRecord(domain) {
        try {
            const response = await this.queryDNS(domain, 'TXT');
            const spfRecord = response.Answer?.find(record => 
                record.data.includes('v=spf1')
            );
            
            return {
                found: !!spfRecord,
                record: spfRecord ? spfRecord.data.replace(/"/g, '') : null
            };
        } catch (error) {
            console.warn('SPF check failed:', error);
            return { found: false, record: null };
        }
    }

    async checkDMARCRecord(domain) {
        try {
            const dmarcDomain = `_dmarc.${domain}`;
            const response = await this.queryDNS(dmarcDomain, 'TXT');
            const dmarcRecord = response.Answer?.find(record => 
                record.data.includes('v=DMARC1')
            );
            
            return {
                found: !!dmarcRecord,
                record: dmarcRecord ? dmarcRecord.data.replace(/"/g, '') : null
            };
        } catch (error) {
            console.warn('DMARC check failed:', error);
            return { found: false, record: null };
        }
    }

    async checkMXRecord(domain) {
        try {
            const response = await this.queryDNS(domain, 'MX');
            const answers = response.Answer || response.Answers || [];

            // Some DNS-over-HTTPS responses put MX data in Answer with 'data' like "10 mail.example.com." or may include 'exchange' and 'priority'
            const records = answers.map(a => {
                // try to parse common formats
                const data = a.data || a.rdata || '';
                const mxMatch = data.match(/^(\d+)\s+(.+)\.?$/);
                if (mxMatch) {
                    return { priority: parseInt(mxMatch[1], 10), exchange: mxMatch[2].replace(/\.$/, '') };
                }
                // fallback: if provider uses json fields
                if (a.exchange) {
                    return { priority: a.preference || a.priority || 0, exchange: a.exchange.replace(/\.$/, '') };
                }
                return { priority: a.preference || a.priority || 0, exchange: data.replace(/\.$/, '') };
            }).filter(r => r.exchange);

            return {
                found: records.length > 0,
                records
            };
        } catch (error) {
            console.warn('MX check failed:', error);
            return { found: false, records: [] };
        }
    }

    async checkNSRecord(domain) {
        try {
            const response = await this.queryDNS(domain, 'NS');
            const answers = response.Answer || response.Answers || [];

            const records = answers.map(a => {
                const data = a.data || a.rdata || '';
                return data.replace(/\.$/, '');
            }).filter(r => r);

            return {
                found: records.length > 0,
                records
            };
        } catch (error) {
            console.warn('NS check failed:', error);
            return { found: false, records: [] };
        }
    }

    async checkDKIMRecord(domain, selector) {
        try {
            const dkimDomain = `${selector}._domainkey.${domain}`;
            const response = await this.queryDNS(dkimDomain, 'TXT');
            
            if (response.Answer && response.Answer.length > 0) {
                const dkimRecord = response.Answer.find(record => 
                    record.data.includes('v=DKIM1') || record.data.includes('k=rsa') || record.data.includes('p=')
                );
                
                if (dkimRecord) {
                    return {
                        found: true,
                        selector: selector,
                        record: dkimRecord.data.replace(/"/g, ''),
                        domain: dkimDomain
                    };
                }
            }
            
            return { found: false, selector: selector };
        } catch (error) {
            return { found: false, selector: selector };
        }
    }

    async queryDNS(domain, type) {
        const errors = [];
        
        for (const provider of this.dnsProviders) {
            try {
                const url = `${provider}?name=${encodeURIComponent(domain)}&type=${type}`;
                const response = await fetch(url, {
                    headers: {
                        'Accept': 'application/dns-json'
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                const data = await response.json();
                return data;
            } catch (error) {
                errors.push(`${provider}: ${error.message}`);
                continue;
            }
        }
        
    throw new Error(`All DNS providers failed: ${errors.join(', ')}`);
    }

    copyToClipboard(text, btn) {
        navigator.clipboard.writeText(text).then(() => {
            try {
                if (btn && btn instanceof Element) {
                    const originalText = btn.textContent;
                    btn.textContent = 'Copied!';
                    btn.classList.add('copied');
                    setTimeout(() => {
                        btn.textContent = originalText;
                        btn.classList.remove('copied');
                    }, 2000);
                }
            } catch (e) {
                // ignore UI update errors
            }
        }).catch(err => {
            console.error('Copy failed:', err);
        });
    }






}

// ==================== TAB SWITCHING ====================
// Handle tab switching functionality
function initTabSwitching() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const dnsTab = document.getElementById('dns-tab');
    const headerTab = document.getElementById('header-tab');

    // Function to switch to a tab
    function switchTab(tabName) {
        // Remove active class from all buttons
        tabButtons.forEach(btn => btn.classList.remove('active'));
        // Add active class to the correct button
        const activeButton = document.querySelector(`.tab-button[data-tab="${tabName}"]`);
        if (activeButton) activeButton.classList.add('active');

        // Fade out current content
        dnsTab.style.opacity = '0';
        headerTab.style.opacity = '0';

        // After fade out, switch tabs with slight delay
        setTimeout(() => {
            dnsTab.style.display = 'none';
            headerTab.style.display = 'none';

            // Show selected tab
            if (tabName === 'dns') {
                dnsTab.style.display = 'flex';
            } else if (tabName === 'header') {
                headerTab.style.display = 'flex';
            }

            // Fade in new content
            setTimeout(() => {
                if (tabName === 'dns') {
                    dnsTab.style.opacity = '1';
                } else if (tabName === 'header') {
                    headerTab.style.opacity = '1';
                }
            }, 10);
        }, 200);

        // Save current tab to localStorage
        localStorage.setItem('activeTab', tabName);
    }

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');
            switchTab(tabName);
        });
    });

    // Restore tab from localStorage or default to 'dns'
    const savedTab = localStorage.getItem('activeTab') || 'dns';
    switchTab(savedTab);
}

// Initialize the checkers when the page loads
document.addEventListener('DOMContentLoaded', () => {
    initTabSwitching();
    new EmailSecurityChecker();
    initHeaderChecker();
    
    // Initialize Learn button and modal
    initLearnModal();
});

// Learn Modal Handler
function initLearnModal() {
    const learnBtn = document.getElementById('learnBtn');
    const learnModal = document.getElementById('learnModal');
    const learnModalClose = document.getElementById('learnModalClose');
    
    if (!learnBtn || !learnModal) return;
    
    // Open modal when Learn button is clicked
    learnBtn.addEventListener('click', () => {
        learnModal.classList.add('open');
        learnModal.classList.add('show');
        learnModal.setAttribute('aria-hidden', 'false');
    });
    
    // Close modal when close button is clicked
    learnModalClose?.addEventListener('click', () => {
        learnModal.classList.remove('open');
        learnModal.classList.remove('show');
        learnModal.setAttribute('aria-hidden', 'true');
    });
    
    // Close modal when clicking outside
    learnModal.addEventListener('click', (e) => {
        if (e.target === learnModal) {
            learnModal.classList.remove('open');
            learnModal.classList.remove('show');
            learnModal.setAttribute('aria-hidden', 'true');
        }
    });
}
