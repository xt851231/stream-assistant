
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

test('Verify CSP meta tag in index.html', async () => {
    const indexPath = path.join(process.cwd(), 'index.html');
    const content = fs.readFileSync(indexPath, 'utf-8');

    // Expected CSP directives
    const expectedDirectives = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://esm.sh",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "connect-src 'self' https://generativelanguage.googleapis.com wss://generativelanguage.googleapis.com",
        "img-src 'self' data: blob:",
        "media-src 'self' blob:",
        "worker-src 'self' blob:"
    ];

    // Check for the meta tag presence
    const cspMetaRegex = /<meta\s+http-equiv=["']Content-Security-Policy["']\s+content=["'](.*?)["']\s*\/?>/i;
    const match = content.match(cspMetaRegex);

    assert.ok(match, 'CSP meta tag not found in index.html');

    const cspContent = match[1];

    // Check for each directive
    for (const directive of expectedDirectives) {
        // Normalize whitespace for comparison
        const normalizedDirective = directive.replace(/\s+/g, ' ').trim();
        const normalizedContent = cspContent.replace(/\s+/g, ' ').trim();

        assert.ok(normalizedContent.includes(normalizedDirective), `CSP directive missing or incorrect: "${directive}"`);
    }
});
