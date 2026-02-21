import mongoose from 'mongoose';
import pc from 'picocolors';

const scanResultSchema = new mongoose.Schema({
    projectName: { type: String, required: true },
    frameworks: { type: [String], default: [] },
    totalFindings: { type: Number, required: true },
    findings: [{
        id: String,
        message: String,
        severity: String,
        explanation: String,
        snippet: String,
        path: String,
        startLine: Number,
        rank: Number
    }],
    createdAt: { type: Date, default: Date.now }
});

const ScanResult = mongoose.model('ScanResult', scanResultSchema);

export async function saveToDatabase(context, prioritizedResults, uri) {
    try {
        console.log(pc.cyan('\nConnecting to MongoDB Atlas...'));
        await mongoose.connect(uri);

        console.log(pc.cyan('Saving scan results to cloud...'));
        const scan = new ScanResult({
            projectName: context.name || 'Unknown Project',
            frameworks: context.frameworks || [],
            totalFindings: prioritizedResults.length,
            findings: prioritizedResults
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
