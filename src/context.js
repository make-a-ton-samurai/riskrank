import fs from 'fs/promises';
import path from 'path';

export async function extractProjectContext(targetDir) {
    const context = {
        name: null,
        version: null,
        dependencies: {},
        devDependencies: {},
        frameworks: []
    };

    try {
        // Resolve the target directory fully to prevent traversal tricks
        const resolvedTargetDir = path.resolve(targetDir);
        const pkgPath = path.join(resolvedTargetDir, 'package.json');

        const pkgData = await fs.readFile(pkgPath, 'utf8');
        const pkg = JSON.parse(pkgData);

        context.name = pkg.name || null;
        context.version = pkg.version || null;
        context.dependencies = pkg.dependencies || {};
        context.devDependencies = pkg.devDependencies || {};

        // Detect frameworks based on dependencies
        const allDeps = { ...context.dependencies, ...context.devDependencies };
        if (allDeps.react) context.frameworks.push('React');
        if (allDeps.next) context.frameworks.push('Next.js');
        if (allDeps.express) context.frameworks.push('Express');
        if (allDeps.vue) context.frameworks.push('Vue');
        if (allDeps.angular) context.frameworks.push('Angular');

    } catch (error) {
        // It's okay if package.json doesn't exist
        if (error.code !== 'ENOENT') {
            console.error(`Warning: Could not read package.json: ${error.message}`);
        }
    }

    // TODO: Add detection for other files like composer.json, requirements.txt, etc if needed later

    return context;
}
