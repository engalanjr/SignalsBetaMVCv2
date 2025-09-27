// Shared formatting utilities for views
class FormatUtils {
    
    static formatDate(dateString) {
        if (!dateString) return 'No date';
        
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Invalid date';
        
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            return 'Today';
        } else if (diffDays === 1) {
            return 'Yesterday';
        } else if (diffDays < 7) {
            return `${diffDays} days ago`;
        } else {
            return date.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
            });
        }
    }
    
    static formatDateSimple(dateString) {
        if (!dateString) return 'No date';
        
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Invalid date';
        
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: '2-digit'
        });
    }
    
    static formatCommentTime(timestamp) {
        if (!timestamp) return 'Unknown time';
        
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return 'Invalid time';
        
        const now = new Date();
        const diffMs = now - date;
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffMinutes < 1) {
            return 'Just now';
        } else if (diffMinutes < 60) {
            return `${diffMinutes}m ago`;
        } else if (diffHours < 24) {
            return `${diffHours}h ago`;
        } else if (diffDays < 7) {
            return `${diffDays}d ago`;
        } else {
            return date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric' 
            });
        }
    }
    
    static formatCurrency(amount) {
        if (typeof amount !== 'number') return '$0';
        
        if (amount >= 1000000) {
            return `$${(amount / 1000000).toFixed(1)}M`;
        } else if (amount >= 1000) {
            return `$${(amount / 1000).toFixed(1)}K`;
        } else {
            return `$${amount.toLocaleString('en-US')}`;
        }
    }
    
    static formatCurrencyDetailed(amount) {
        if (typeof amount !== 'number') return '$0';
        
        if (amount >= 1000000) {
            return `$${(amount / 1000000).toFixed(1)}M`;
        } else if (amount >= 1000) {
            return `$${(amount / 1000).toFixed(1)}K`;
        } else {
            return `$${amount.toFixed(0)}`;
        }
    }
    
    static getInitials(name) {
        if (!name || typeof name !== 'string') return 'U';
        
        return name
            .split(' ')
            .map(part => part.charAt(0).toUpperCase())
            .slice(0, 2)
            .join('');
    }
    
    static truncateText(text, maxLength) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength).trim() + '...';
    }
    
    static formatTenure(years) {
        if (years < 1) {
            const months = Math.round(years * 12);
            return `${months}m`;
        } else {
            return `${years.toFixed(1)}y`;
        }
    }
    
    static formatForecastWithDelta(delta) {
        const deltaFormatted = this.formatCurrencyDetailed(Math.abs(delta));
        const sign = delta >= 0 ? '+' : '-';
        const color = delta >= 0 ? 'positive' : 'negative';
        
        return `<span class="delta ${color}">${sign}${deltaFormatted}</span>`;
    }
    
    static formatRationaleText(text) {
        if (!text) return '';
        
        // Check if text contains comma-separated items that would benefit from bullet formatting
        if (text.includes(',') && text.length > 200) {
            // Split on periods to identify sentences
            const sentences = text.split(/\.\s+/).map(s => s.trim()).filter(s => s.length > 0);

            // If we have multiple sentences, format as bullet points
            if (sentences.length > 2) {
                const formattedSentences = sentences.map(sentence => {
                    // Add period back if not already there
                    const finalSentence = sentence.endsWith('.') ? sentence : sentence + '.';
                    return `• ${finalSentence}`;
                }).join('<br>');

                return formattedSentences;
            }
        }

        // For shorter text or single sentences, return as-is
        return text;
    }

    /**
     * Normalize polarity text to canonical keys for logic and CSS
     * @param {string} polarity - The polarity value (can be ANY case)
     * @returns {string} - Canonical key ('risk', 'opportunities', 'enrichment')
     */
    static normalizePolarityKey(polarity) {
        if (!polarity || typeof polarity !== 'string') {
            return 'enrichment';
        }
        
        const normalized = polarity.toLowerCase().trim();
        
        // Map to canonical keys for consistent logic and CSS
        const polarityMap = {
            'risk': 'risk',
            'risks': 'risk',
            'opportunity': 'opportunities', 
            'opportunities': 'opportunities',
            'enrichment': 'enrichment'
        };
        
        return polarityMap[normalized] || 'enrichment';
    }

    /**
     * Normalize polarity text to proper Title Case
     * @param {string} polarity - The polarity value (can be ANY case)
     * @returns {string} - Normalized Title Case polarity
     */
    static normalizePolarityLabel(polarity) {
        if (!polarity || typeof polarity !== 'string') {
            return 'Enrichment';
        }
        
        const normalized = polarity.toLowerCase().trim();
        
        // Map to proper Title Case labels
        const polarityMap = {
            'risk': 'Risk',
            'risks': 'Risk',
            'opportunity': 'Opportunities', 
            'opportunities': 'Opportunities',
            'enrichment': 'Enrichment'
        };
        
        return polarityMap[normalized] || 'Enrichment';
    }
}

// Make globally available
window.FormatUtils = FormatUtils;