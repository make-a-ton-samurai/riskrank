export async function fallbackPrioritization(results) {
    // Deterministic fallback if AI is not available

    // High Priority: Injection, Crypto, Secrets, RCE, Auth
    const highPriorityKeywords = [
        'injection', 'sql', 'command', 'exec', 'crypto', 'jwt',
        'auth', 'password', 'secret', 'token', 'xss', 'csrf', 'rce'
    ];

    // Medium Priority: DoS, Config, Information Disclosure
    const mediumPriorityKeywords = [
        'dos', 'regex', 'config', 'disclosure', 'leak', 'ssrf', 'cors'
    ];

    // Score each finding
    const scoredResults = results.map(result => {
        let score = 0;
        const message = (result.message || '').toLowerCase();
        const id = (result.id || '').toLowerCase();
        const searchString = `${message} ${id}`;

        // Base score on Semgrep severity
        const sev = (result.severity || '').toLowerCase();
        if (sev === 'error') score += 50;
        else if (sev === 'warning') score += 20;
        else score += 5;

        // Bonus points for critical keywords
        for (const kw of highPriorityKeywords) {
            if (searchString.includes(kw)) score += 30;
        }

        for (const kw of mediumPriorityKeywords) {
            if (searchString.includes(kw)) score += 15;
        }

        return { ...result, _score: score };
    });

    // Sort by score descending
    scoredResults.sort((a, b) => b._score - a._score);

    // Take Top 10
    const top10 = scoredResults.slice(0, 10);

    return top10.map((result, index) => {
        const rawId = result.id || 'Unknown Vulnerability';
        const title = rawId.split('.').pop().replace(/[-_]/g, ' ').toUpperCase();
        const severity = (result.severity || '').toLowerCase();
        return {
            ...result,
            rank: index + 1,
            title: title,
            explanation: result.message,
            businessImpact: 'Unmitigated vulnerabilities can lead to system compromise, data breaches, or compliance violations.',
            remediation: 'Review the vulnerable code snippet and apply standard security patches or input validation.',
            confidence: (severity === 'error' || severity === 'critical') ? 'High' : 'Medium'
        };
    });
}
