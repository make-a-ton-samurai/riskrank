import { spawn } from 'child_process';
import path from 'path';

export async function runSemgrep(targetDir) {
    return new Promise((resolve, reject) => {
        // We use spawn instead of exec to avoid command injection vulnerabilities
        // when targetDir contains malicious characters (e.g. `; rm -rf /`)
        const semgrep = spawn('semgrep', ['scan', '--json', '--quiet', targetDir], {
            // 10MB buffer buffer max for large JSON string outputs
            maxBuffer: 10 * 1024 * 1024
        });

        let stdoutData = '';
        let stderrData = '';

        semgrep.stdout.on('data', (data) => {
            stdoutData += data.toString();
        });

        semgrep.stderr.on('data', (data) => {
            stderrData += data.toString();
        });

        semgrep.on('error', (error) => {
            if (error.code === 'ENOENT') {
                reject(new Error('Semgrep is not installed or not in PATH. Please install it first: https://semgrep.dev/docs/getting-started/'));
            } else {
                reject(error);
            }
        });

        semgrep.on('close', (code) => {
            // Semgrep returns 0 if valid and no findings.
            // Semgrep returns 1 if valid but findings exist.
            // Semgrep returns >1 on actual critical failures.

            try {
                if (stdoutData.trim() === '') {
                    return resolve([]);
                }
                const parsed = parseSemgrepOutput(stdoutData);
                resolve(parsed);
            } catch (err) {
                if (code > 1) {
                    reject(new Error(`Semgrep failed with code ${code}: ${stderrData}`));
                } else {
                    reject(err);
                }
            }
        });
    });
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
