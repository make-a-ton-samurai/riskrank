import pc from 'picocolors';
import fs from 'fs';

const BOX_WIDTH = 120;

const stripAnsi = (str) => str.replace(/\x1b\[[0-9;]*m/g, '');

function drawLine(text = '', colorFn = pc.white) {
    const rawLength = stripAnsi(text).length;
    let padding = BOX_WIDTH - rawLength - 4;
    if (padding < 0) padding = 0;

    // Exact screenshot styling: left and right lines colored, inside text uncolored by this fn
    return `${colorFn('│ ')} ${text}${' '.repeat(padding)} ${colorFn('│')}`;
}

function wordWrap(text, maxLineLength) {
    const outputLines = [];
    const hardLines = (text || '').split('\n');

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

        // Show context lines just like the screenshot
        const ctxStart = Math.max(0, startLine - 1);
        const ctxEnd = Math.min(lines.length - 1, end);

        return lines.slice(ctxStart, ctxEnd + 1).map((l, i) => {
            const actualLine = ctxStart + i + 1;
            const isTarget = actualLine >= startLine && actualLine <= end;
            // The screenshot highlights the exact vulnerable code differently, we'll redden it
            const targetColor = isTarget ? pc.red : pc.dim;
            const prefix = isTarget ? '>' : ' ';
            return targetColor(`${prefix} ${l}`);
        }).join('\n');
    } catch (e) {
        return null; // File unreadable or snippet failed
    }
}

export function printResults(results, rawResults = []) {
    console.log('\n\n');

    if (!results || results.length === 0) {
        console.log(pc.green('🎉 Great job! No security issues found.\n'));
        return;
    }

    results.forEach((issue, index) => {
        // Screenshot uses distinct colors per risk. Orange and Cyan.

        let sevColor = pc.cyan; // default
        let confDotStr = pc.green('●');

        const sevLower = (issue.severity || '').toLowerCase();
        if (sevLower === 'error' || sevLower === 'critical' || sevLower === 'high') {
            sevColor = pc.yellow; // Orange-ish in picocolors
            confDotStr = pc.green('●');
        } else if (sevLower === 'warning' || sevLower === 'medium') {
            sevColor = pc.cyan;
        } else {
            sevColor = pc.blue;
        }

        // Header Border
        const rankStr = issue.rank ? ` RISK #${issue.rank} ` : ` RISK `;
        const topPadCount = Math.floor((BOX_WIDTH - rankStr.length - 2) / 2);
        const topBorder = `┌${'─'.repeat(topPadCount)}${rankStr}${'─'.repeat(BOX_WIDTH - topPadCount - rankStr.length - 2)}┐`;

        console.log(sevColor(topBorder));
        console.log(drawLine('', sevColor));

        // Title
        const titleText = (issue.title || issue.id || 'UNKNOWN VULNERABILITY').toUpperCase();
        console.log(drawLine(pc.white(pc.bold(titleText)), sevColor));
        console.log(drawLine('', sevColor));

        // Block formatting helper matching the screenshot exact style
        const printBlock = (heading, bodyText, dividerLen) => {
            console.log(drawLine(pc.white(heading), sevColor));
            console.log(drawLine(pc.dim('─'.repeat(dividerLen)), sevColor));
            const wrapped = wordWrap(bodyText, BOX_WIDTH - 8);
            wrapped.forEach(line => {
                console.log(drawLine(pc.white(line), sevColor));
            });
            console.log(drawLine('', sevColor));
        };

        // Reason
        printBlock('REASON', issue.explanation || issue.message, 30);

        // Business Impact
        if (issue.businessImpact) {
            printBlock('BUSINESS IMPACT', issue.businessImpact, 30);
        }

        // Remediation
        if (issue.remediation) {
            printBlock('REMEDIATION', issue.remediation, 30);
        }

        // Snippet
        const snippet = getCodeSnippet(issue.path, issue.startLine, issue.endLine) || issue.snippet;
        if (snippet) {
            console.log(drawLine(pc.white('VULNERABLE CODE'), sevColor));
            console.log(drawLine(pc.dim('──────────────────────────────'), sevColor));
            const snipLines = snippet.split('\n');
            snipLines.forEach(sLine => {
                let safeLine = sLine.length > BOX_WIDTH - 10 ? sLine.substring(0, BOX_WIDTH - 15) + '...' : sLine;
                console.log(drawLine(safeLine, sevColor));
            });
            console.log(drawLine('', sevColor));
        }

        // Location & Confidence footer text
        console.log(drawLine(pc.dim(`─────────────────────────────────────────────────────────────────`), sevColor));
        const locLabel = pc.gray('LOCATION  ');
        const locValue = pc.white(`${issue.path}:${issue.startLine || '?'}`);
        console.log(drawLine(`${locLabel} ${locValue}`, sevColor));

        const confLabel = pc.gray('CONFIDENCE');
        const confValue = pc.white(`${issue.confidence || 'Medium'}`);
        console.log(drawLine(`${confLabel} ${confDotStr} ${confValue}`, sevColor));

        // Footer Border
        console.log(sevColor(`└${'─'.repeat(BOX_WIDTH - 2)}┘\n`));
    });

    // --- RAW FINDINGS TABLE ---
    const tableResults = rawResults.length > 0 ? rawResults : results;
    console.log(pc.white(pc.bold(`  ALL RAW FINDINGS (${tableResults.length})`)));
    console.log(pc.dim('  ┌──────┬──────────┬──────────────────────────────────────────────────────────────────────┐'));
    console.log(pc.dim(`  │ ${pc.white('NO. ')} │ ${pc.white('SEVERITY')} │ ${pc.white('LOCATION / ID')}                                                          │`));
    console.log(pc.dim('  ├──────┼──────────┼──────────────────────────────────────────────────────────────────────┤'));

    tableResults.forEach((issue, index) => {
        const rankStr = ((index + 1).toString()).padEnd(4, ' ');

        let sevTag = 'LOW';
        let sevColor = pc.blue;
        const sL = (issue.severity || '').toLowerCase();
        if (sL === 'error' || sL === 'critical' || sL === 'high') { sevTag = 'HIGH'; sevColor = pc.yellow; }
        else if (sL === 'warning' || sL === 'medium') { sevTag = 'MEDIUM'; sevColor = pc.cyan; }

        const sevStr = sevColor(sevTag.padEnd(8, ' '));
        const locIdStr = `${issue.path}:${issue.startLine || '?'} (${issue.id || 'Unknown'})`.substring(0, 68).padEnd(68, ' ');

        console.log(`  ${pc.dim('│')} ${pc.white(rankStr)} ${pc.dim('│')} ${sevStr} ${pc.dim('│')} ${pc.gray(locIdStr)} ${pc.dim('│')}`);
    });
    console.log(pc.dim('  └──────┴──────────┴──────────────────────────────────────────────────────────────────────┘\n'));


    console.log(pc.bold(pc.green('✔ Scan & Analysis verified.')));
    console.log(pc.dim(`Total risks prioritized: ${results.length} / ${tableResults.length} raw findings\n`));
}
