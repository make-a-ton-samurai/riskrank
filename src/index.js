import { extractProjectContext } from './context.js';
import { runSemgrep } from './scanner.js';
import { analyzeWithAI } from './ai.js';
import { fallbackPrioritization } from './fallback.js';
import { printResults } from './formatter.js';
import ora from 'ora';
import pc from 'picocolors';
import dotenv from 'dotenv';

dotenv.config();

export async function runScanner(targetDir, options) {
    const apiKey = options.key || process.env.GROQ_API_KEY;

    const spinner = ora('Analyzing project context...').start();
    const context = await extractProjectContext(targetDir);
    spinner.succeed(`Context extracted: ${context.name ? context.name : 'Unknown project'}`);

    spinner.start('Running Semgrep scanner (this may take a moment)...');
    let semgrepResults;
    try {
        semgrepResults = await runSemgrep(targetDir);
        spinner.succeed(`Scan complete. Found ${semgrepResults.length} raw issues.`);
    } catch (error) {
        spinner.fail('Semgrep scan failed');
        throw error;
    }

    if (semgrepResults.length === 0) {
        console.log(pc.green('\n🎉 Great job! No security issues found.'));
        return;
    }

    let prioritizedResults;
    if (apiKey) {
        spinner.start(`Prioritizing findings with AI (${options.model})...`);
        try {
            prioritizedResults = await analyzeWithAI(semgrepResults, context, apiKey, options.model);
            spinner.succeed('AI analysis complete.');
        } catch (error) {
            spinner.fail('AI analysis failed, falling back to basic prioritization.');
            console.error(pc.yellow(`AI Error: ${error.message}`));
            prioritizedResults = await fallbackPrioritization(semgrepResults);
        }
    } else {
        spinner.info('No Groq API key found. Using fallback logic prioritization.');
        prioritizedResults = await fallbackPrioritization(semgrepResults);
    }

    printResults(prioritizedResults);
}
