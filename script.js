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
                document.body.classList.toggle('dark', nowDark);
                localStorage.setItem('theme', nowDark ? 'dark' : 'light');
                themeToggle.textContent = nowDark ? '☀️' : '🌙';
            });
        }
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

// Initialize the checker when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new EmailSecurityChecker();
});
