import { extractProjectContext } from './context.js';
import { runSemgrep } from './scanner.js';
import { analyzeWithAI } from './ai.js';
import { fallbackPrioritization } from './fallback.js';
import { printResults } from './formatter.js';
import { saveToDatabase } from './db.js';
import pc from 'picocolors';
import dotenv from 'dotenv';

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

    // If MONGODB_URI is provided, push the results to Atlas
    const mongoUri = process.env.MONGODB_URI;
    if (mongoUri) {
        await saveToDatabase(context, prioritizedResults, mongoUri);
    }
}
