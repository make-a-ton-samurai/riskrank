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
            sevColor = pc.red; // High/Critical = Red
            confDotStr = pc.green('●');
        } else if (sevLower === 'warning' || sevLower === 'medium') {
            sevColor = pc.yellow; // Medium/Warning = Yellow
        } else {
            sevColor = pc.cyan; // Low = Cyan
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

    // --- RAW FINDINGS TABLE (5-COLUMN GRID) ---
    const tableResults = rawResults.length > 0 ? [...rawResults] : [...results];

    // Sort table results by severity (Critical/High -> Medium -> Low)
    const severityScores = { 'critical': 4, 'error': 4, 'high': 3, 'warning': 2, 'medium': 2, 'info': 1, 'low': 1 };
    tableResults.sort((a, b) => {
        const scoreA = severityScores[(a.severity || '').toLowerCase()] || 0;
        const scoreB = severityScores[(b.severity || '').toLowerCase()] || 0;
        return scoreB - scoreA;
    });

    console.log(pc.bold(pc.green(`\n\n  ▼ ADDITIONAL FINDINGS (${tableResults.length})`)));

    // Grid Widths (Total ~ 120 chars)
    const wTitle = 5;
    const wSev = 10;
    const wFile = 35;
    const wLine = 8;
    const wMsg = 53;

    // Draw Top Border
    const tTop = pc.dim(`  ┌${'─'.repeat(wTitle)}┬${'─'.repeat(wSev)}┬${'─'.repeat(wFile)}┬${'─'.repeat(wLine)}┬${'─'.repeat(wMsg)}┐`);
    const tMid = pc.dim(`  ├${'─'.repeat(wTitle)}┼${'─'.repeat(wSev)}┼${'─'.repeat(wFile)}┼${'─'.repeat(wLine)}┼${'─'.repeat(wMsg)}┤`);
    const tBot = pc.dim(`  └${'─'.repeat(wTitle)}┴${'─'.repeat(wSev)}┴${'─'.repeat(wFile)}┴${'─'.repeat(wLine)}┴${'─'.repeat(wMsg)}┘`);
    const v = pc.dim('│');

    console.log(tTop);
    console.log(`  ${v} ${pc.cyan('#'.padEnd(wTitle - 2))} ${v} ${pc.cyan('Severity'.padEnd(wSev - 2))} ${v} ${pc.cyan('File'.padEnd(wFile - 2))} ${v} ${pc.cyan('Line'.padEnd(wLine - 2))} ${v} ${pc.cyan('Message'.padEnd(wMsg - 2))} ${v}`);
    console.log(tMid);

    tableResults.forEach((issue, index) => {
        const idStr = ((index + 1).toString()).padEnd(wTitle - 2, ' ');

        let sevTag = 'LOW';
        let sevColor = pc.blue;
        const sL = (issue.severity || '').toLowerCase();
        if (sL === 'error' || sL === 'critical' || sL === 'high') { sevTag = 'HIGH'; sevColor = pc.red; }
        else if (sL === 'warning' || sL === 'medium') { sevTag = 'MEDIUM'; sevColor = pc.yellow; }

        const sevStr = sevColor(sevTag.padEnd(wSev - 2, ' '));

        const fileStr = (issue.path || 'Unknown').substring(0, wFile - 2).padEnd(wFile - 2, ' ');
        const lineStr = (issue.startLine?.toString() || '?').substring(0, wLine - 2).padEnd(wLine - 2, ' ');

        // Wrap message cleanly
        const rawMsg = issue.message || issue.explanation || 'No message provided';
        const msgLines = wordWrap(rawMsg, wMsg - 4);

        // Print first row with data
        const firstMsgLine = (msgLines[0] || '').padEnd(wMsg - 2, ' ');
        console.log(`  ${v} ${pc.white(idStr)} ${v} ${sevStr} ${v} ${pc.white(fileStr)} ${v} ${pc.white(lineStr)} ${v} ${pc.white(firstMsgLine)} ${v}`);

        // Print remaining message lines (wrapping)
        for (let i = 1; i < msgLines.length; i++) {
            const wrappedMsgStr = msgLines[i].padEnd(wMsg - 2, ' ');
            console.log(`  ${v} ${' '.repeat(wTitle - 2)} ${v} ${' '.repeat(wSev - 2)} ${v} ${' '.repeat(wFile - 2)} ${v} ${' '.repeat(wLine - 2)} ${v} ${pc.white(wrappedMsgStr)} ${v}`);
        }

        // Internal Grid separator
        if (index < tableResults.length - 1) {
            console.log(tMid);
        }
    });

    console.log(tBot);


    console.log(pc.bold(pc.green('✔ Scan & Analysis verified.')));
    console.log(pc.dim(`Total risks prioritized: ${results.length} / ${tableResults.length} raw findings\n`));
}
