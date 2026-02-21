import { exec } from 'child_process';
import util from 'util';
import path from 'path';

const execAsync = util.promisify(exec);

export async function runSemgrep(targetDir) {
    try {
        // Run semgrep with json output
        // We use `--quiet` to avoid extra log messages parsing issues
        const { stdout, stderr } = await execAsync(`semgrep scan --json --quiet ${targetDir}`, {
            maxBuffer: 10 * 1024 * 1024 // 10MB buffer for large projects
        });

        return parseSemgrepOutput(stdout);
    } catch (error) {
        if (error.stdout) {
            // Semgrep exits with 1 if issues are found, which throws in execAsync
            return parseSemgrepOutput(error.stdout);
        }
        // If it's a real error (e.g. semgrep not installed)
        if (error.message.includes('command not found') || error.message.includes('ENOENT')) {
            throw new Error('Semgrep is not installed or not in PATH. Please install it first: https://semgrep.dev/docs/getting-started/');
        }
        throw error;
    }
}

function parseSemgrepOutput(jsonString) {
    try {
        const data = JSON.parse(jsonString);
        if (!data.results || !Array.isArray(data.results)) {
            return [];
        }

        return data.results.map(result => {
            return {
                id: result.check_id,
                path: result.path,
                startLine: result.start?.line,
                endLine: result.end?.line,
                message: result.extra?.message,
                severity: result.extra?.severity, // INFO, WARNING, ERROR
                snippet: result.extra?.lines,
                metadata: result.extra?.metadata
            };
        });
    } catch (err) {
        if (jsonString.trim() === '') return [];
        throw new Error('Failed to parse semgrep JSON output. It might be corrupted.');
    }
}
