import pc from 'picocolors';

export function printResults(results) {
    console.log('\n=======================================');
    console.log(pc.bold('          RiskRank Findings          '));
    console.log('=======================================\n');

    if (!results || results.length === 0) {
        console.log(pc.green('No risks found.'));
        return;
    }

    results.forEach((issue, index) => {
        // Format Top 10 rank if available (from AI)
        const rankStr = issue.rank ? `[Rank #${issue.rank}] ` : '';

        // Choose color based on severity
        let sevColor = pc.white;
        const severityLower = (issue.severity || '').toLowerCase();
        if (severityLower === 'error' || severityLower === 'high' || severityLower === 'critical') sevColor = pc.red;
        else if (severityLower === 'warning' || severityLower === 'medium') sevColor = pc.yellow;
        else if (severityLower === 'info' || severityLower === 'low') sevColor = pc.blue;

        const titleColor = issue.rank <= 3 ? pc.red : pc.magenta;

        console.log(titleColor(`${index + 1}. ${rankStr}${issue.id || 'Unknown Issue'}`));
        console.log(pc.dim('---------------------------------------'));
        console.log(`${pc.bold('File:')}     ${issue.path}:${issue.startLine || '?'}`);
        console.log(`${pc.bold('Severity:')} ${sevColor(issue.severity || 'UNKNOWN')}`);

        if (issue.explanation) {
            // Explanation from AI
            console.log(`\n${pc.bold('Why it is a risk:')}\n${pc.white(issue.explanation)}`);
        } else {
            // Original semgrep message
            console.log(`\n${pc.bold('Message:')}\n${pc.white(issue.message || 'No description provided.')}`);
        }

        if (issue.snippet) {
            console.log(`\n${pc.bold('Code Snippet:')}`);
            console.log(pc.bgBlack(pc.gray(issue.snippet.trim().split('\n').map(l => `  ${l}  `).join('\n'))));
        }
        console.log('\n');
    });

    if (results.length > 0 && results[0].rank) {
        console.log(pc.bold(pc.cyan(`\nTotal prioritized findings displayed: ${results.length} (Max Top 10)`)));
    } else {
        console.log(pc.bold(pc.cyan(`\nTotal findings displayed: ${results.length}`)));
    }
}
