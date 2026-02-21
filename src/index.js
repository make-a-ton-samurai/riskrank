import { extractProjectContext } from './context.js';
import { runSemgrep } from './scanner.js';
import { analyzeWithAI } from './ai.js';
import { fallbackPrioritization } from './fallback.js';
import { printResults } from './formatter.js';
import { saveToDatabase } from './db.js';
import pc from 'picocolors';
import dotenv from 'dotenv';
import readline from 'readline';

dotenv.config();
export async function runScanner(targetDir, options) {
    const apiKey = options.key || process.env.GROQ_API_KEY;

    console.log(pc.cyan('Analyzing project context...'));
    const context = await extractProjectContext(targetDir);
    console.log(pc.green(`✔ Context extracted: ${context.name ? context.name : 'Unknown project'}`));

    console.log(pc.cyan('\nRunning Semgrep scanner (this may take a moment)...'));
    let semgrepResults;
    try {
        semgrepResults = await runSemgrep(targetDir);
        console.log(pc.green(`✔ Scan complete. Found ${semgrepResults.length} raw issues.`));
    } catch (error) {
        console.error(pc.red('✖ Semgrep scan failed'));
        throw error;
    }

    if (semgrepResults.length === 0) {
        console.log(pc.green('\n🎉 Great job! No security issues found.'));
        return;
    }

    let prioritizedResults;
    if (apiKey) {
        console.log(pc.cyan(`\nPrioritizing findings with AI (${options.model})...`));
        try {
            prioritizedResults = await analyzeWithAI(semgrepResults, context, apiKey, options.model);
            console.log(pc.green('✔ AI analysis complete.'));
        } catch (error) {
            console.error(pc.red('✖ AI analysis failed, falling back to basic prioritization.'));
            console.error(pc.yellow(`AI Error: ${error.message}`));
            prioritizedResults = await fallbackPrioritization(semgrepResults);
        }
    } else {
        console.log(pc.blue('\nℹ No Groq API key found. Using fallback logic prioritization.'));
        prioritizedResults = await fallbackPrioritization(semgrepResults);
    }

    printResults(prioritizedResults, semgrepResults);

    // If MONGODB_URI is provided, handle cloud upload
    const mongoUri = process.env.MONGODB_URI;
    if (mongoUri) {
        if (options.ci) {
            console.log(pc.cyan('\n[CI Mode] Automatically uploading findings to Cloud...'));
            await saveToDatabase(context, prioritizedResults, semgrepResults, mongoUri);
        } else {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
            const ask = query => new Promise(resolve => rl.question(query, resolve));
            const answer = await ask(pc.cyan('\nUpload findings to the Cloud? (y/N) '));
            rl.close();

            if (answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes') {
                await saveToDatabase(context, prioritizedResults, semgrepResults, mongoUri);
            } else {
                console.log(pc.gray('Cloud upload skipped.\n'));
            }
        }
    }

    if (options.failOn) {
        const threshold = options.failOn.toLowerCase();
        const severityMap = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
        const thresholdScore = severityMap[threshold];

        if (!thresholdScore) {
            console.error(pc.red(`\n✖ Invalid --fail-on severity: ${options.failOn}. Use critical, high, medium, or low.`));
            process.exit(1);
        }

        const shouldFail = prioritizedResults.some(r => {
            const s = (r.severity || '').toLowerCase();
            // Semgrep uses error, warning, info
            let mappedScore = 0;
            if (s === 'critical' || s === 'error') mappedScore = 4;
            else if (s === 'high') mappedScore = 3;
            else if (s === 'medium' || s === 'warning') mappedScore = 2;
            else mappedScore = 1;

            return mappedScore >= thresholdScore;
        });

        if (shouldFail) {
            console.error(pc.red(`\n✖ CI Failure: Found vulnerabilities meeting or exceeding severity threshold '${threshold}'.`));
            process.exit(1);
        } else {
            console.log(pc.green(`\n✔ CI Success: No vulnerabilities met the failure threshold.`));
        }
    }
}
