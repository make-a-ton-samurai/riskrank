import pc from 'picocolors';
import fs from 'fs';

const BOX_WIDTH = 120;

const stripAnsi = (str) => str.replace(/\x1b\[[0-9;]*m/g, '');

function drawLine(text = '', colorFn = pc.white) {
    const rawLength = stripAnsi(text).length;
    let padding = BOX_WIDTH - rawLength - 4; // 2 for left border, 2 for right
    if (padding < 0) padding = 0;

    // We only color the borders and let the text retain its own color
    return `${colorFn(' │ ')} ${text}${' '.repeat(padding)}${colorFn(' │')}`;
}

function wordWrap(text, maxLineLength) {
    const outputLines = [];
    const hardLines = text.split('\n');

    for (const line of hardLines) {
        const words = line.split(' ');
        let currentLine = '';

        for (const word of words) {
            if (stripAnsi(currentLine + word).length > maxLineLength) {
                outputLines.push(currentLine.trim());
                currentLine = word + ' ';
            } else {
                currentLine += word + ' ';
            }
        }
        outputLines.push(currentLine.trim());
    }
    return outputLines;
}

function getCodeSnippet(filePath, startLine, endLine) {
    try {
        if (!startLine) return null;
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        const end = endLine ? endLine : startLine;

        // Show 1 line before and 1 line after for context
        const ctxStart = Math.max(0, startLine - 2);
        const ctxEnd = Math.min(lines.length - 1, end);

        return lines.slice(ctxStart, ctxEnd + 1).map((l, i) => {
            const actualLine = ctxStart + i + 1;
            const isTarget = actualLine >= startLine && actualLine <= end;
            const targetColor = isTarget ? pc.red : pc.dim;
            const prefix = isTarget ? '>>' : '  ';
            return targetColor(`${prefix} ${actualLine.toString().padEnd(3, ' ')} │ ${l}`);
        }).join('\n');
    } catch (e) {
        return null; // File unreadable or snippet failed
    }
}

export function printResults(results) {
    console.log('\n\n');

    if (!results || results.length === 0) {
        console.log(pc.green('🎉 Great job! No security issues found.\n'));
        return;
    }

    results.forEach((issue, index) => {
        // Evaluate Severity
        let sevColor = pc.white;
        let severityTag = 'UNKNOWN';
        const sevLower = (issue.severity || '').toLowerCase();

        if (sevLower === 'error' || sevLower === 'critical' || sevLower === 'high') {
            sevColor = pc.red; severityTag = 'High';
        } else if (sevLower === 'warning' || sevLower === 'medium') {
            sevColor = pc.yellow; severityTag = 'Medium';
        } else {
            sevColor = pc.blue; severityTag = 'Low';
        }

        // Header
        const rankStr = issue.rank ? ` RISK #${issue.rank} ` : ` RISK `;
        const topPadCount = Math.floor((BOX_WIDTH - rankStr.length - 2) / 2);
        const topBorder = ` ╭${'─'.repeat(topPadCount)}${rankStr}${'─'.repeat(BOX_WIDTH - topPadCount - rankStr.length - 2)}╮`;

        console.log(sevColor(topBorder));
        console.log(drawLine('', sevColor));

        // Title
        const titleText = (issue.id || 'Unknown Vulnerability').toUpperCase();
        console.log(drawLine(pc.bold(sevColor(`  ${titleText}`)), sevColor));
        console.log(drawLine('', sevColor));

        // Reason/Explanation
        console.log(drawLine(pc.dim('   REASON'), sevColor));
        console.log(drawLine(pc.dim('   ──────────────────────────────────────────────────'), sevColor));

        const explanationText = issue.explanation || issue.message || 'No description available.';
        const wrappedExpl = wordWrap(explanationText, BOX_WIDTH - 10);
        wrappedExpl.forEach(line => {
            console.log(drawLine(`   ${pc.white(line)}`, sevColor));
        });
        console.log(drawLine('', sevColor));

        // Snippet
        const snippet = getCodeSnippet(issue.path, issue.startLine, issue.endLine);
        if (snippet) {
            console.log(drawLine(pc.dim('   VULNERABLE CODE'), sevColor));
            console.log(drawLine(pc.dim('   ──────────────────────────────────────────────────'), sevColor));
            const snipLines = snippet.split('\n');
            snipLines.forEach(sLine => {
                // Truncate massively long lines so box doesn't break
                let safeLine = sLine.length > BOX_WIDTH - 10 ? sLine.substring(0, BOX_WIDTH - 15) + '...' : sLine;
                console.log(drawLine(`   ${safeLine}`, sevColor));
            });
            console.log(drawLine('', sevColor));
        }

        // Location & Confidence Footer
        console.log(drawLine(pc.dim(`   ${'─'.repeat(BOX_WIDTH - 12)}`), sevColor));
        console.log(drawLine(`   ${pc.dim('LOCATION')}     ${pc.cyan(issue.path)}:${pc.cyan(issue.startLine || '?')}`, sevColor));
        console.log(drawLine(`   ${pc.dim('SEVERITY')}     ${sevColor('●')} ${pc.bold(severityTag)}`, sevColor));
        console.log(drawLine('', sevColor));

        // Footer
        console.log(sevColor(` ╰${'─'.repeat(BOX_WIDTH - 2)}╯\n\n`));
    });

    console.log(pc.bold(pc.green('✔ Scan & Analysis verified.')));
    console.log(pc.dim(`Total risks generated: ${results.length}\n`));
}
