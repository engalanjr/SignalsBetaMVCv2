// WhitespaceRenderer - Signal Heat Map Analysis
class WhitespaceRenderer {
    
    /**
     * Main render method for Whitespace view
     */
    static async renderWhitespace(state) {
        try {
            console.log('🎯 Rendering Whitespace heatmap view');
            
            // Get data from Flux store state - handle both array and Map formats
            const signals = Array.isArray(state.signals) ? state.signals : 
                           (state.signals && typeof state.signals[Symbol.iterator] === 'function' ? 
                            Array.from(state.signals.values()) : []);
            
            const accounts = state.accounts || new Map();
            
            console.log(`🔍 Processing ${signals.length} signals`);
            
            // Load signal dimensions for complete whitespace analysis
            const signalDimensionService = new SignalDimensionService();
            await signalDimensionService.loadSignalDimensions();
            
            // Process signals into matrix format with complete signal dimensions
            const { matrix, signalTypes, accountNames, stats, signalPolarities, allSignalDimensions } = this.processSignalsMatrixWithDimensions(signals, accounts, signalDimensionService);
            
            // Debug: Check what's being returned
            console.log('🔍 renderWhitespace - allSignalDimensions:', allSignalDimensions);
            console.log('🔍 renderWhitespace - allSignalDimensions type:', typeof allSignalDimensions);
            console.log('🔍 renderWhitespace - allSignalDimensions keys:', allSignalDimensions ? Array.from(allSignalDimensions.keys()) : 'undefined');
            
            console.log(`📊 Processed ${stats.totalAccounts} accounts, ${stats.totalSignalTypes} signal types, ${stats.totalOccurrences} total occurrences`);
            
            // Get the main content container
            const contentContainer = document.querySelector('.main-content');
            if (!contentContainer) {
                console.error('❌ Main content container not found');
                return;
            }
            
            // Create whitespace tab content
            let whitespaceTab = document.getElementById('whitespace');
            if (!whitespaceTab) {
                whitespaceTab = document.createElement('div');
                whitespaceTab.id = 'whitespace';
                whitespaceTab.className = 'tab-content';
                contentContainer.appendChild(whitespaceTab);
            }
            
            // Render the heatmap content
            whitespaceTab.innerHTML = this.generateWhitespaceHTML(matrix, signalTypes, accountNames, stats, signalPolarities, allSignalDimensions);
            
            // Setup event listeners
            this.setupEventListeners();
            
            console.log('✅ Whitespace view rendered successfully');
            
        } catch (error) {
            console.error('❌ Error rendering Whitespace view:', error);
        }
    }
    
    /**
     * Process signals data into heatmap matrix format with complete signal dimensions
     */
    static processSignalsMatrixWithDimensions(signals, accounts, signalDimensionService) {
        console.log('🔄 Processing signals into complete whitespace matrix...');
        
        const matrix = {};
        const signalTypesMap = new Map();
        const accountMap = new Map();
        const signalPolarities = {};
        
        let totalOccurrences = 0;
        
        // First pass: Process all signals to collect account info and actual signal occurrences
        for (let signal of signals) {
            if (!signal || !signal.account_id) {
                continue;
            }
            
            const accountId = signal.account_id;
            
            // Get account name - handle different account data structures
            let accountName = signal.account_name || signal.accountName || `Account ${accountId}`;
            if (accounts) {
                if (accounts.get && typeof accounts.get === 'function') {
                    const account = accounts.get(accountId);
                    if (account) accountName = account.name || accountName;
                } else if (accounts[accountId]) {
                    accountName = accounts[accountId].name || accountName;
                }
            }
            
            // Store account info
            if (!accountMap.has(accountId)) {
                accountMap.set(accountId, accountName);
            }
            
            // Create signal type key - use code if available, otherwise truncate name
            const signalCode = signal.code || signal.signal_code || '';
            const signalName = signal.name || signal.signal_name || 'Unknown';
            const signalKey = signalCode || signalName.substring(0, 20);
            
            // Only track polarity for actual signals - don't add to signalTypesMap here
            const polarity = signal.signal_polarity || signal['Signal Polarity'] || 'Enrichment';
            signalPolarities[signalKey] = polarity;
        }
        
        // Second pass: Add ALL accounts from accounts data (even those with no signals)
        if (accounts) {
            if (accounts.get && typeof accounts.get === 'function') {
                // Handle Map structure
                for (let [accountId, account] of accounts) {
                    if (!accountMap.has(accountId)) {
                        const accountName = account.name || `Account ${accountId}`;
                        accountMap.set(accountId, accountName);
                    }
                }
            } else if (typeof accounts === 'object') {
                // Handle object structure
                for (let accountId in accounts) {
                    if (!accountMap.has(accountId)) {
                        const account = accounts[accountId];
                        const accountName = account.name || `Account ${accountId}`;
                        accountMap.set(accountId, accountName);
                    }
                }
            }
        }
        
        // Third pass: Get ALL signal dimensions from the service and populate signalTypesMap FIRST
        const allSignalDimensions = signalDimensionService.getAllSignalDimensions();
        console.log(`📋 Found ${allSignalDimensions.size} signal dimensions from service`);
        
        // Debug: Check allSignalDimensions right after getting it
        console.log('🔍 allSignalDimensions right after getting it:', allSignalDimensions);
        console.log('🔍 allSignalDimensions type right after getting it:', typeof allSignalDimensions);
        console.log('🔍 allSignalDimensions keys right after getting it:', allSignalDimensions ? Array.from(allSignalDimensions.keys()) : 'undefined');
        
        // Debug: Log all signal codes from dimension service
        console.log('🔍 Signal codes from dimension service:', Array.from(allSignalDimensions.keys()));
        
        // Add all signal dimensions to our signal types map FIRST (before processing actual signals)
        for (let [signalCode, dimension] of allSignalDimensions) {
            signalTypesMap.set(signalCode, {
                code: dimension.code,
                name: dimension.name,
                category: dimension.category
            });
            
            // Store polarity from dimension service
            signalPolarities[signalCode] = dimension.polarity;
        }
        
        console.log('🔍 signalTypesMap after adding dimensions:', Array.from(signalTypesMap.keys()));
        
        // Debug: Log signal codes from actual signals data
        const actualSignalCodes = new Set();
        for (let signal of signals) {
            if (signal && signal.account_id) {
                const signalCode = signal.code || signal.signal_code || '';
                if (signalCode) {
                    actualSignalCodes.add(signalCode);
                }
            }
        }
        console.log('🔍 Signal codes from actual signals data:', Array.from(actualSignalCodes));
        
        // Fourth pass: Process actual signal occurrences
        for (let signal of signals) {
            if (!signal || !signal.account_id) {
                continue;
            }
            
            const accountId = signal.account_id;
            
            // Get account name
            let accountName = signal.account_name || signal.accountName || `Account ${accountId}`;
            if (accounts) {
                if (accounts.get && typeof accounts.get === 'function') {
                    const account = accounts.get(accountId);
                    if (account) accountName = account.name || accountName;
                } else if (accounts[accountId]) {
                    accountName = accounts[accountId].name || accountName;
                }
            }
            
            // Create signal type key
            const signalCode = signal.code || signal.signal_code || '';
            const signalName = signal.name || signal.signal_name || 'Unknown';
            const signalKey = signalCode || signalName.substring(0, 20);
            
            // Initialize matrix structure for this account-signal combination
            if (!matrix[accountName]) {
                matrix[accountName] = {};
            }
            
            if (!matrix[accountName][signalKey]) {
                const polarity = signal.signal_polarity || signal['Signal Polarity'] || 'Enrichment';
                matrix[accountName][signalKey] = {
                    count: 0,
                    polarity: polarity,
                    accountId: accountId,
                    fullSignalName: signalName
                };
            }
            
            // Increment count
            matrix[accountName][signalKey].count++;
            totalOccurrences++;
        }
        
        // Fifth pass: Initialize empty cells (whitespace) for ALL account-signal combinations
        // Use the sorted signal types from the dimension service, not from signalTypesMap
        const allSignalTypes = Array.from(allSignalDimensions.keys()).sort();
        const allAccountNames = Array.from(accountMap.values());
        
        for (let accountName of allAccountNames) {
            if (!matrix[accountName]) {
                matrix[accountName] = {};
            }
            
            for (let signalKey of allSignalTypes) {
                if (!matrix[accountName][signalKey]) {
                    // Create empty cell for whitespace
                    const dimensionInfo = allSignalDimensions.get(signalKey);
                    
                    matrix[accountName][signalKey] = {
                        count: 0,
                        polarity: signalPolarities[signalKey] || (dimensionInfo ? dimensionInfo.polarity : 'enrichment'),
                        accountId: null, // Will be filled when we find the actual account
                        fullSignalName: dimensionInfo ? dimensionInfo.name : signalKey,
                        isWhitespace: true, // Mark as whitespace
                        dimension: dimensionInfo // Store full dimension info
                    };
                }
            }
        }
        
        // Sort accounts and signal types
        const sortedAccounts = allAccountNames.sort();
        const sortedSignalTypes = allSignalTypes; // Already sorted from dimension service
        
        // Debug: Log the final signal types being used
        console.log('🔍 Final sorted signal types:', sortedSignalTypes);
        console.log('🔍 First 5 signal types:', sortedSignalTypes.slice(0, 5));
        console.log('🔍 Last 5 signal types:', sortedSignalTypes.slice(-5));
        
        // Debug: Check signalTypesMap alignment
        console.log('🔍 signalTypesMap keys:', Array.from(signalTypesMap.keys()));
        console.log('🔍 First 5 signalTypesMap entries:', Array.from(signalTypesMap.entries()).slice(0, 5));
        
        // Calculate statistics
        const stats = {
            totalAccounts: sortedAccounts.length,
            totalSignalTypes: sortedSignalTypes.length,
            totalOccurrences,
            avgSignalsPerAccount: sortedAccounts.length > 0 ? (totalOccurrences / sortedAccounts.length).toFixed(1) : 0,
            totalPossibleCells: sortedAccounts.length * sortedSignalTypes.length,
            whitespaceCells: (sortedAccounts.length * sortedSignalTypes.length) - totalOccurrences
        };
        
        console.log(`✅ Complete whitespace matrix processing complete:`, stats);
        console.log(`📊 Showing ${sortedAccounts.length} accounts × ${sortedSignalTypes.length} signal types = ${stats.totalPossibleCells} total cells`);
        console.log(`🔍 ${stats.whitespaceCells} whitespace cells (${((stats.whitespaceCells / stats.totalPossibleCells) * 100).toFixed(1)}%)`);
        
        return {
            matrix,
            signalTypes: sortedSignalTypes,
            accountNames: sortedAccounts,
            stats,
            signalPolarities,
            signalTypesMap
        };
    }

    /**
     * Process signals data into heatmap matrix format (legacy method)
     */
    static processSignalsMatrix(signals, accounts) {
        console.log('🔄 Processing signals into heatmap matrix...');
        
        const matrix = {};
        const signalTypesMap = new Map(); // Use Map to preserve order and store metadata
        const accountMap = new Map();
        const signalPolarities = {};
        
        let totalOccurrences = 0;
        
        // First pass: Process all signals to collect signal types and account info
        for (let signal of signals) {
            if (!signal || !signal.account_id) {
                continue;
            }
            
            const accountId = signal.account_id;
            
            // Get account name - handle different account data structures
            let accountName = signal.account_name || signal.accountName || `Account ${accountId}`;
            if (accounts) {
                if (accounts.get && typeof accounts.get === 'function') {
                    const account = accounts.get(accountId);
                    if (account) accountName = account.name || accountName;
                } else if (accounts[accountId]) {
                    accountName = accounts[accountId].name || accountName;
                }
            }
            
            // Store account info
            if (!accountMap.has(accountId)) {
                accountMap.set(accountId, accountName);
            }
            
            // Create signal type key - use code if available, otherwise truncate name
            const signalCode = signal.code || signal.signal_code || '';
            const signalName = signal.name || signal.signal_name || 'Unknown';
            const signalKey = signalCode || signalName.substring(0, 20);
            
            // Store full signal info for tooltips
            if (!signalTypesMap.has(signalKey)) {
                signalTypesMap.set(signalKey, {
                    code: signalCode,
                    name: signalName,
                    category: signal.category || 'General'
                });
            }
            
            // Store polarity for this signal type
            const polarity = signal.signal_polarity || signal['Signal Polarity'] || 'Enrichment';
            signalPolarities[signalKey] = polarity;
        }
        
        // Second pass: Add ALL accounts from accounts data (even those with no signals)
        if (accounts) {
            if (accounts.get && typeof accounts.get === 'function') {
                // Handle Map structure
                for (let [accountId, account] of accounts) {
                    if (!accountMap.has(accountId)) {
                        const accountName = account.name || `Account ${accountId}`;
                        accountMap.set(accountId, accountName);
                    }
                }
            } else if (typeof accounts === 'object') {
                // Handle object structure
                for (let accountId in accounts) {
                    if (!accountMap.has(accountId)) {
                        const account = accounts[accountId];
                        const accountName = account.name || `Account ${accountId}`;
                        accountMap.set(accountId, accountName);
                    }
                }
            }
        }
        
        // Third pass: Process signals again to build the matrix with counts
        for (let signal of signals) {
            if (!signal || !signal.account_id) {
                continue;
            }
            
            const accountId = signal.account_id;
            
            // Get account name
            let accountName = signal.account_name || signal.accountName || `Account ${accountId}`;
            if (accounts) {
                if (accounts.get && typeof accounts.get === 'function') {
                    const account = accounts.get(accountId);
                    if (account) accountName = account.name || accountName;
                } else if (accounts[accountId]) {
                    accountName = accounts[accountId].name || accountName;
                }
            }
            
            // Create signal type key
            const signalCode = signal.code || signal.signal_code || '';
            const signalName = signal.name || signal.signal_name || 'Unknown';
            const signalKey = signalCode || signalName.substring(0, 20);
            
            // Initialize matrix structure for this account-signal combination
            if (!matrix[accountName]) {
                matrix[accountName] = {};
            }
            
            if (!matrix[accountName][signalKey]) {
                const polarity = signal.signal_polarity || signal['Signal Polarity'] || 'Enrichment';
                matrix[accountName][signalKey] = {
                    count: 0,
                    polarity: polarity,
                    accountId: accountId,
                    fullSignalName: signalName
                };
            }
            
            // Increment count
            matrix[accountName][signalKey].count++;
            totalOccurrences++;
        }
        
        // Fourth pass: Initialize empty cells (whitespace) for all account-signal combinations
        const allSignalTypes = Array.from(signalTypesMap.keys());
        const allAccountNames = Array.from(accountMap.values());
        
        for (let accountName of allAccountNames) {
            if (!matrix[accountName]) {
                matrix[accountName] = {};
            }
            
            for (let signalKey of allSignalTypes) {
                if (!matrix[accountName][signalKey]) {
                    // Create empty cell for whitespace
                    const signalInfo = signalTypesMap.get(signalKey);
                    matrix[accountName][signalKey] = {
                        count: 0,
                        polarity: signalPolarities[signalKey] || 'Enrichment',
                        accountId: null, // Will be filled when we find the actual account
                        fullSignalName: signalInfo ? signalInfo.name : signalKey
                    };
                }
            }
        }
        
        // Sort accounts and signal types
        const sortedAccounts = allAccountNames.sort();
        const sortedSignalTypes = allSignalTypes.sort();
        
        // Calculate statistics
        const stats = {
            totalAccounts: sortedAccounts.length,
            totalSignalTypes: sortedSignalTypes.length,
            totalOccurrences,
            avgSignalsPerAccount: sortedAccounts.length > 0 ? (totalOccurrences / sortedAccounts.length).toFixed(1) : 0
        };
        
        console.log(`✅ Matrix processing complete with whitespace:`, stats);
        console.log(`📊 Showing ${sortedAccounts.length} accounts × ${sortedSignalTypes.length} signal types = ${sortedAccounts.length * sortedSignalTypes.length} total cells`);
        
        // Debug: Check what we're returning
        console.log('🔍 About to return allSignalDimensions:', allSignalDimensions);
        console.log('🔍 allSignalDimensions type:', typeof allSignalDimensions);
        console.log('🔍 allSignalDimensions keys:', allSignalDimensions ? Array.from(allSignalDimensions.keys()) : 'undefined');
        
        const returnObject = {
            matrix,
            signalTypes: sortedSignalTypes,
            accountNames: sortedAccounts,
            stats,
            signalPolarities,
            allSignalDimensions
        };
        
        console.log('🔍 Return object allSignalDimensions:', returnObject.allSignalDimensions);
        console.log('🔍 Return object allSignalDimensions type:', typeof returnObject.allSignalDimensions);
        console.log('🔍 Return object allSignalDimensions keys:', returnObject.allSignalDimensions ? Array.from(returnObject.allSignalDimensions.keys()) : 'undefined');
        
        return returnObject;
    }
    
    /**
     * Generate the HTML structure for the Whitespace view
     */
    static generateWhitespaceHTML(matrix, signalTypes, accountNames, stats, signalPolarities, allSignalDimensions) {
        // Debug: Check if allSignalDimensions is defined
        console.log('🔍 generateWhitespaceHTML - allSignalDimensions:', allSignalDimensions);
        console.log('🔍 generateWhitespaceHTML - allSignalDimensions type:', typeof allSignalDimensions);
        console.log('🔍 generateWhitespaceHTML - allSignalDimensions keys:', allSignalDimensions ? Array.from(allSignalDimensions.keys()) : 'undefined');
        
        return `
            <div class="whitespace-container">
                <div class="whitespace-stats">
                    <div class="whitespace-stat-card">
                        <div class="stat-value">${stats.totalAccounts}</div>
                        <div class="stat-label">TOTAL ACCOUNTS</div>
                    </div>
                    <div class="whitespace-stat-card">
                        <div class="stat-value">${stats.totalSignalTypes}</div>
                        <div class="stat-label">SIGNAL TYPES</div>
                    </div>
                    <div class="whitespace-stat-card">
                        <div class="stat-value">${stats.totalOccurrences}</div>
                        <div class="stat-label">TOTAL SIGNALS</div>
                    </div>
                    <div class="whitespace-stat-card">
                        <div class="stat-value">${stats.avgSignalsPerAccount}</div>
                        <div class="stat-label">AVG PER ACCOUNT</div>
                    </div>
                </div>
                
                <div class="whitespace-table-container">
                    <div class="heatmap-scroll-wrapper">
                        ${this.generateHeatmapTable(matrix, signalTypes, accountNames, signalPolarities, allSignalDimensions)}
                    </div>
                </div>
                
                <div class="whitespace-legend">
                    <div class="legend-group">
                        <span class="legend-label">Opportunity:</span>
                        <div class="legend-items">
                            <span class="legend-item opportunity-1">1</span>
                            <span class="legend-item opportunity-2">2</span>
                            <span class="legend-item opportunity-3">3</span>
                            <span class="legend-item opportunity-4">4</span>
                            <span class="legend-item opportunity-5">5+</span>
                        </div>
                    </div>
                    <div class="legend-group">
                        <span class="legend-label">Risk:</span>
                        <div class="legend-items">
                            <span class="legend-item risk-1">1</span>
                            <span class="legend-item risk-2">2</span>
                            <span class="legend-item risk-3">3</span>
                            <span class="legend-item risk-4">4</span>
                            <span class="legend-item risk-5">5+</span>
                        </div>
                    </div>
                    <div class="legend-group">
                        <span class="legend-label">Enrichment:</span>
                        <div class="legend-items">
                            <span class="legend-item enrichment-1">1</span>
                            <span class="legend-item enrichment-2">2</span>
                            <span class="legend-item enrichment-3">3</span>
                            <span class="legend-item enrichment-4">4</span>
                            <span class="legend-item enrichment-5">5+</span>
                        </div>
                    </div>
                </div>
                
                <div class="whitespace-tooltip" id="whitespaceTooltip"></div>
            </div>
        `;
    }
    
    /**
     * Generate the heatmap table HTML
     */
    static generateHeatmapTable(matrix, signalTypes, accountNames, signalPolarities, allSignalDimensions) {
        // Create extended array with Account Name at the beginning
        const allColumns = ['Account Name', ...signalTypes];
        let tableHTML = `
<table class="whitespace-heatmap-table">
<thead>
<tr class="heatmap-header-row">
                    ${allColumns.map((column, index) => {
                        if (index === 0) {
                            return `<th class="heatmap-corner-cell">${column}</th>`;
                        }
                        const signalType = column;  // This is now a signal type
                        const sanitizedSignal = SecurityUtils.sanitizeHTML(signalType);
                        const dimensionInfo = allSignalDimensions ? allSignalDimensions.get(signalType) : null;
                        const fullSignalName = dimensionInfo ? dimensionInfo.name : signalType;
                        const sanitizedFullName = SecurityUtils.sanitizeHTML(fullSignalName);
                        return `<th class="heatmap-header-cell"><div class="rotated-header" title="${sanitizedFullName}"><span>${sanitizedSignal}</span></div></th>`;
                    }).join('')}
</tr>
</thead>
<tbody>
    `;
    // Generate rows
    accountNames.forEach(accountName => {
        const sanitizedAccountName = SecurityUtils.sanitizeHTML(accountName);
        tableHTML += `<tr class="heatmap-row">`;
        allColumns.forEach((column, index) => {
            if (index === 0) {
                // Account name column
                tableHTML += `<td class="heatmap-account-cell">${sanitizedAccountName}</td>`;
            } else {
                // Signal data columns
                const signalType = column;
                const cellData = matrix[accountName]?.[signalType];
                const count = cellData?.count || 0;
                const polarity = cellData?.polarity || signalPolarities[signalType] || 'Enrichment';
                const colorClass = this.getColorClass(count, polarity);
                const sanitizedSignalType = SecurityUtils.sanitizeHTML(signalType);
                const fullSignalName = cellData?.fullSignalName || signalType;
                tableHTML += `<td class="heatmap-data-cell ${colorClass}" data-account="${sanitizedAccountName}" data-signal="${sanitizedSignalType}" data-signal-full="${SecurityUtils.sanitizeHTML(fullSignalName)}" data-count="${count}" data-polarity="${polarity}">${count > 0 ? count : ''}</td>`;
            }
        });
        tableHTML += `</tr>`;
    });
    tableHTML += `</tbody></table>`;
    return tableHTML;
    }
    
    /**
     * Get CSS color class based on count and polarity
     */
    static getColorClass(count, polarity) {
        if (count === 0) return 'empty-cell';
        
        const intensity = Math.min(count, 5);
        const polarityClass = (polarity || 'enrichment').toLowerCase();
        
        // Normalize polarity variations
        let normalizedPolarity = polarityClass;
        if (polarityClass === 'opportunities' || polarityClass === 'opportunity') {
            normalizedPolarity = 'opportunity';
        } else if (polarityClass === 'risks' || polarityClass === 'risk') {
            normalizedPolarity = 'risk';
        } else {
            normalizedPolarity = 'enrichment';
        }
        
        return `${normalizedPolarity}-${intensity}`;
    }
    
    /**
     * Normalize polarity to a safe whitelist value for CSS classes
     * This prevents XSS attacks through class attribute injection
     */
    static normalizePolarity(polarity) {
        if (!polarity) return 'enrichment';
        
        const polarityLower = String(polarity).toLowerCase();
        
        // Strict whitelist - only return one of these three values
        if (polarityLower === 'opportunity' || polarityLower === 'opportunities') {
            return 'opportunity';
        } else if (polarityLower === 'risk' || polarityLower === 'risks') {
            return 'risk';
        } else {
            return 'enrichment';
        }
    }
    
    /**
     * Setup event listeners for interactivity
     */
    static setupEventListeners() {
        // Add hover effects for data cells
        const dataCells = document.querySelectorAll('.heatmap-data-cell');
        dataCells.forEach(cell => {
            cell.addEventListener('mouseenter', (e) => this.showTooltip(e));
            cell.addEventListener('mouseleave', () => this.hideTooltip());
            cell.addEventListener('click', (e) => this.handleCellClick(e));
        });
    }
    
    /**
     * Show enhanced tooltip on cell hover
     */
    static showTooltip(event) {
        const tooltip = document.getElementById('whitespaceTooltip');
        const cell = event.target;
        
        const account = cell.dataset.account;
        const signal = cell.dataset.signal;
        const signalFull = cell.dataset.signalFull;
        const count = cell.dataset.count;
        const polarity = cell.dataset.polarity;
        
        // Show tooltip for both populated and empty cells
        const normalizedPolarity = this.normalizePolarity(polarity);
        const isWhitespace = !count || count === '0';
        
        // Format signal display with code and name
        const signalCode = signal; // This is the signal key (e.g., "ARCH-02")
        const signalName = signalFull || signal; // This is the full name (e.g., "CDW Identified")
        const signalDisplay = signalCode && signalName && signalCode !== signalName ? 
            `${SecurityUtils.sanitizeHTML(signalCode)}: ${SecurityUtils.sanitizeHTML(signalName)}` :
            SecurityUtils.sanitizeHTML(signalName);
        
        tooltip.innerHTML = `
            <div class="tooltip-content">
                <div class="tooltip-header">${SecurityUtils.sanitizeHTML(account)}</div>
                <div class="tooltip-signal">${signalDisplay}</div>
                <div class="tooltip-stats">
                    ${isWhitespace ? 
                        `<span class="tooltip-whitespace">No signals detected</span>` :
                        `<span class="tooltip-count">Count: ${count}</span>`
                    }
                    <span class="tooltip-polarity ${normalizedPolarity}">${SecurityUtils.sanitizeHTML(polarity)}</span>
                </div>
                ${isWhitespace ? 
                    `<div class="tooltip-opportunity">💡 Opportunity for engagement</div>` : 
                    ''
                }
            </div>
        `;
        
        // Improved positioning with viewport awareness
        const rect = cell.getBoundingClientRect();
        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;
        
        tooltip.style.display = 'block';
        tooltip.style.left = (rect.left + rect.width / 2 + scrollX) + 'px';
        tooltip.style.top = (rect.top + scrollY - 10) + 'px';
    }
    
    /**
     * Hide tooltip
     */
    static hideTooltip() {
        const tooltip = document.getElementById('whitespaceTooltip');
        if (tooltip) {
            tooltip.style.display = 'none';
        }
    }
    
    /**
     * Handle cell click for drill-down functionality
     */
    static handleCellClick(event) {
        const cell = event.target;
        const count = cell.dataset.count;
        
        if (count && count !== '0') {
            const account = cell.dataset.account;
            const signal = cell.dataset.signalFull || cell.dataset.signal;
            console.log(`Cell clicked: ${account} - ${signal} (${count} signals)`);
            // Future: Navigate to filtered signal view
        }
    }
    
}