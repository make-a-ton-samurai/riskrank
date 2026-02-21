import mongoose from 'mongoose';
import pc from 'picocolors';

const findingSchema = {
    id: String,
    title: String,
    message: String,
    severity: String,
    explanation: String,
    businessImpact: String,
    remediation: String,
    confidence: String,
    snippet: String,
    path: String,
    startLine: Number,
    rank: Number
};

const scanResultSchema = new mongoose.Schema({
    projectName: { type: String, required: true },
    repositoryUrl: { type: String, default: 'local' },
    branch: { type: String, default: 'main' },
    frameworks: { type: [String], default: [] },
    totalPrioritized: { type: Number, required: true },
    totalRaw: { type: Number, required: true },
    metrics: {
        critical: { type: Number, default: 0 },
        high: { type: Number, default: 0 },
        medium: { type: Number, default: 0 },
        low: { type: Number, default: 0 }
    },
    status: { type: String, default: 'Pending Review', enum: ['Pending Review', 'In Progress', 'Resolved'] },
    topFindings: [findingSchema],
    rawFindings: [findingSchema],
    createdAt: { type: Date, default: Date.now }
});

const ScanResult = mongoose.model('ScanResult', scanResultSchema);

export async function saveToDatabase(context, prioritizedResults, rawResults, uri) {
    try {
        console.log(pc.cyan('\nConnecting to MongoDB Atlas...'));
        await mongoose.connect(uri);

        console.log(pc.cyan('Saving scan results to cloud...'));

        // Calculate dynamic threat metrics based on the raw results
        const metrics = { critical: 0, high: 0, medium: 0, low: 0 };
        rawResults.forEach(r => {
            const sev = (r.severity || '').toLowerCase();
            if (sev === 'critical' || sev === 'error') metrics.critical++;
            else if (sev === 'high') metrics.high++;
            else if (sev === 'warning' || sev === 'medium') metrics.medium++;
            else metrics.low++;
        });

        const scan = new ScanResult({
            projectName: context.name || 'Unknown Project',
            frameworks: context.frameworks || [],
            totalPrioritized: prioritizedResults.length,
            totalRaw: rawResults.length,
            metrics,
            topFindings: prioritizedResults,
            rawFindings: rawResults
        });

        await scan.save();
        console.log(pc.green('✔ Scan results successfully saved to MongoDB Atlas!'));
    } catch (error) {
        console.error(pc.red(`✖ Failed to save results to MongoDB: ${error.message}`));
    } finally {
        // Always close the connection so the CLI can exit
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
    }
}
