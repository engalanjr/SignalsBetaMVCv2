// SignalDimensionService - Manages signal dimension data for whitespace analysis
class SignalDimensionService {
    constructor() {
        this.signalDimensions = new Map();
        this.isLoaded = false;
        this.loadPromise = null;
    }

    /**
     * Load signal dimension data from Domo API or fallback CSV
     */
    async loadSignalDimensions() {
        if (this.isLoaded) {
            return this.signalDimensions;
        }

        if (this.loadPromise) {
            return this.loadPromise;
        }

        this.loadPromise = this._loadSignalDimensions();
        return this.loadPromise;
    }

    async _loadSignalDimensions() {
        try {
            console.log('🔄 Loading signal dimensions...');
            
            // Try Domo API first
            if (window.domo && window.domo.get) {
                try {
                    const domoData = await window.domo.get('/data/v1/signaldim');
                    console.log('✅ Loaded signal dimensions from Domo API');
                    this._processSignalDimensions(domoData);
                    this.isLoaded = true;
                    return this.signalDimensions;
                } catch (domoError) {
                    console.warn('⚠️ Domo API failed, falling back to CSV:', domoError);
                }
            }

            // Fallback to CSV
            const csvData = await this._loadFromCSV();
            this._processSignalDimensions(csvData);
            this.isLoaded = true;
            console.log('✅ Loaded signal dimensions from CSV fallback');
            return this.signalDimensions;

        } catch (error) {
            console.error('❌ Failed to load signal dimensions:', error);
            this.isLoaded = false;
            this.loadPromise = null;
            throw error;
        }
    }

    /**
     * Load signal dimensions from CSV file
     */
    async _loadFromCSV() {
        try {
            const response = await fetch('/signaldim.csv');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const csvText = await response.text();
            return this._parseCSV(csvText);
        } catch (error) {
            console.error('❌ Failed to load CSV:', error);
            throw error;
        }
    }

    /**
     * Parse CSV data into structured format
     */
    _parseCSV(csvText) {
        const lines = csvText.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue; // Skip empty lines

            const values = this._parseCSVLine(line);
            if (values.length !== headers.length) {
                console.warn(`⚠️ Skipping malformed CSV line ${i + 1}: expected ${headers.length} columns, got ${values.length}`);
                continue;
            }

            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });
            data.push(row);
        }

        console.log(`📊 Parsed ${data.length} rows from CSV (expected 33)`);
        return data;
    }

    /**
     * Parse a single CSV line handling quoted values with commas
     */
    _parseCSVLine(line) {
        const values = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        values.push(current.trim());
        return values;
    }

    /**
     * Process signal dimension data into structured format
     */
    _processSignalDimensions(data) {
        this.signalDimensions.clear();

        data.forEach(row => {
            const signalCode = row['Signal Code'] || row['signal_code'] || '';
            const signalName = row['Signal Name'] || row['signal_name'] || '';
            const signalCategory = row['Signal Category'] || row['signal_category'] || '';
            const signalDescription = row['Signal Description'] || row['signal_description'] || '';
            const signalPolarity = row['Signal Polarity'] || row['signal_polarity'] || 'Enrichment';

            if (signalCode && signalName) {
                this.signalDimensions.set(signalCode, {
                    code: signalCode,
                    name: signalName,
                    category: signalCategory,
                    description: signalDescription,
                    polarity: this._normalizePolarity(signalPolarity),
                    batchId: row['_BATCH_ID_'] || '',
                    batchLastRun: row['_BATCH_LAST_RUN_'] || ''
                });
            }
        });

        console.log(`📊 Processed ${this.signalDimensions.size} signal dimensions`);
    }

    /**
     * Normalize polarity values
     */
    _normalizePolarity(polarity) {
        if (!polarity) return 'Enrichment';
        
        const normalized = polarity.toLowerCase().trim();
        if (normalized === 'opportunities' || normalized === 'opportunity') {
            return 'Opportunity';
        } else if (normalized === 'risks' || normalized === 'risk') {
            return 'Risk';
        } else {
            return 'Enrichment';
        }
    }

    /**
     * Get all signal dimensions
     */
    getAllSignalDimensions() {
        return this.signalDimensions;
    }

    /**
     * Get signal dimension by code
     */
    getSignalDimension(code) {
        return this.signalDimensions.get(code);
    }

    /**
     * Get signal dimensions by category
     */
    getSignalDimensionsByCategory(category) {
        const result = [];
        for (let [code, dimension] of this.signalDimensions) {
            if (dimension.category === category) {
                result.push(dimension);
            }
        }
        return result;
    }

    /**
     * Get signal dimensions by polarity
     */
    getSignalDimensionsByPolarity(polarity) {
        const normalizedPolarity = this._normalizePolarity(polarity);
        const result = [];
        for (let [code, dimension] of this.signalDimensions) {
            if (dimension.polarity === normalizedPolarity) {
                result.push(dimension);
            }
        }
        return result;
    }

    /**
     * Get all unique categories
     */
    getCategories() {
        const categories = new Set();
        for (let [code, dimension] of this.signalDimensions) {
            if (dimension.category) {
                categories.add(dimension.category);
            }
        }
        return Array.from(categories).sort();
    }

    /**
     * Get all unique polarities
     */
    getPolarities() {
        const polarities = new Set();
        for (let [code, dimension] of this.signalDimensions) {
            if (dimension.polarity) {
                polarities.add(dimension.polarity);
            }
        }
        return Array.from(polarities).sort();
    }

    /**
     * Check if signal dimensions are loaded
     */
    isDataLoaded() {
        return this.isLoaded;
    }

    /**
     * Get statistics about loaded signal dimensions
     */
    getStats() {
        const categories = this.getCategories();
        const polarities = this.getPolarities();
        
        return {
            totalSignals: this.signalDimensions.size,
            categories: categories.length,
            polarities: polarities.length,
            categoryBreakdown: categories.map(cat => ({
                category: cat,
                count: this.getSignalDimensionsByCategory(cat).length
            })),
            polarityBreakdown: polarities.map(pol => ({
                polarity: pol,
                count: this.getSignalDimensionsByPolarity(pol).length
            }))
        };
    }
}

// Export for use in other modules
window.SignalDimensionService = SignalDimensionService;
