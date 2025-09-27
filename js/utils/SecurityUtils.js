// SecurityUtils - Utilities for preventing XSS attacks and sanitizing user input
class SecurityUtils {
    
    /**
     * Sanitize HTML to prevent XSS attacks
     * Escapes dangerous characters in user-generated content
     * @param {string} str - The string to sanitize
     * @return {string} - The sanitized string safe for innerHTML
     */
    static sanitizeHTML(str) {
        if (!str) return '';
        
        // Convert to string if not already
        const text = String(str);
        
        // Define the characters to escape
        const escapeMap = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            '/': '&#x2F;',
            '`': '&#x60;',
            '=': '&#x3D;'
        };
        
        // Replace dangerous characters with their HTML entities
        return text.replace(/[&<>"'`=\/]/g, (char) => escapeMap[char]);
    }
    
    /**
     * Sanitize text for use in HTML attributes
     * @param {string} str - The string to sanitize
     * @return {string} - The sanitized string safe for HTML attributes
     */
    static sanitizeAttribute(str) {
        if (!str) return '';
        
        // Convert to string and escape quotes and other dangerous characters
        return String(str)
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\\/g, '\\\\')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r');
    }
    
    /**
     * Sanitize text for use in JavaScript strings
     * @param {string} str - The string to sanitize
     * @return {string} - The sanitized string safe for JavaScript
     */
    static sanitizeJS(str) {
        if (!str) return '';
        
        // Convert to string and escape characters that could break out of JS strings
        return String(str)
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/"/g, '\\"')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t')
            .replace(/<\//g, '<\\/')
            .replace(/<!--/g, '<\\!--');
    }
    
    /**
     * Sanitize URL to prevent javascript: and data: URLs
     * @param {string} url - The URL to sanitize
     * @return {string} - The sanitized URL or empty string if dangerous
     */
    static sanitizeURL(url) {
        if (!url) return '';
        
        const urlStr = String(url).trim().toLowerCase();
        
        // Block dangerous protocols
        const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
        for (const protocol of dangerousProtocols) {
            if (urlStr.startsWith(protocol)) {
                console.warn(`Blocked dangerous URL: ${url}`);
                return '';
            }
        }
        
        // Allow safe protocols or relative URLs
        return String(url);
    }
    
    /**
     * Create a safe DOM element with text content
     * This is the safest way to add user content when HTML formatting is not needed
     * @param {string} tagName - The HTML tag name
     * @param {string} textContent - The text content
     * @param {Object} attributes - Optional attributes
     * @return {string} - The HTML string
     */
    static createSafeElement(tagName, textContent, attributes = {}) {
        const safeTag = this.sanitizeHTML(tagName);
        const safeText = this.sanitizeHTML(textContent);
        
        let attributeStr = '';
        for (const [key, value] of Object.entries(attributes)) {
            const safeKey = this.sanitizeAttribute(key);
            const safeValue = this.sanitizeAttribute(value);
            attributeStr += ` ${safeKey}="${safeValue}"`;
        }
        
        return `<${safeTag}${attributeStr}>${safeText}</${safeTag}>`;
    }
    
    /**
     * Strip all HTML tags from a string
     * Useful when you want plain text only
     * @param {string} html - The HTML string
     * @return {string} - Plain text without HTML tags
     */
    static stripHTML(html) {
        if (!html) return '';
        
        // Create a temporary element to parse HTML
        const temp = document.createElement('div');
        temp.textContent = html;
        return temp.innerHTML;
    }
    
    /**
     * Validate and sanitize user input based on expected type
     * @param {*} input - The input to validate
     * @param {string} type - The expected type ('string', 'number', 'email', etc.)
     * @return {*} - The validated and sanitized input
     */
    static validateInput(input, type) {
        switch (type) {
            case 'string':
                return this.sanitizeHTML(String(input || ''));
            
            case 'number':
                const num = Number(input);
                return isNaN(num) ? 0 : num;
            
            case 'email':
                const email = String(input || '').toLowerCase().trim();
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                return emailRegex.test(email) ? email : '';
            
            case 'id':
                // IDs should be alphanumeric with dashes/underscores
                return String(input || '').replace(/[^a-zA-Z0-9_-]/g, '');
            
            case 'boolean':
                return Boolean(input);
            
            default:
                return this.sanitizeHTML(String(input || ''));
        }
    }
}

// Make available globally
window.SecurityUtils = SecurityUtils;