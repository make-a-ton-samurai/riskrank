import { Groq } from 'groq-sdk';

export async function analyzeWithAI(results, context, apiKey, modelName) {
    const groq = new Groq({ apiKey });

    // If there are too many results, we might blow up the context window.
    // Pre-filter to a manageable chunk if necessary (e.g., top 100 based on fallback logic)
    let analysisChunk = results;
    if (results.length > 50) {
        analysisChunk = results.slice(0, 50); // Take first 50 for now
        // Actually, in a production tool, you'd chunk or pre-filter.
    }

    // Sanitize the input for the LLM
    const sanitizedResults = analysisChunk.map((r, i) => ({
        index: i,
        id: r.id,
        path: r.path,
        message: r.message,
        severity: r.severity,
        snippet: r.snippet ? r.snippet.trim().substring(0, 500) : '' // truncate snippet
    }));

    const systemPrompt = `You are an expert Application Security Engineer. Your job is to review raw static analysis (SAST) findings and prioritize them based on actual business risk.
You will be provided with project context (frameworks, dependencies) and a list of raw findings.

Your task:
1. Filter out noisy, low-impact findings.
2. Rank the remaining findings. Force-rank the TOP 10 most critical, business-breaking risks.
3. For each of the Top 10 findings, provide a clear, concise natural language explanation of WHY this is a risk in the context of the code. (e.g., "This unvalidated parameter allows SQL injection").

OUTPUT FORMAT REQUIRED:
Respond ONLY with a valid JSON array containing the top 10 findings. Each object in the array must have the following keys:
- "originalIndex" (number): The index of the finding from the provided input array.
- "rank" (number): The rank from 1 to 10.
- "explanation" (string): Your natural language explanation of the business risk.
- "severity" (string): Normalized severity: Critical, High, Medium, or Low.

Do not include any markdown formatting like \`\`\`json in your response. Just the raw JSON brackets.`;

    const userPrompt = `Project Context:
Name: ${context.name || 'Unknown'}
Frameworks: ${context.frameworks.join(', ') || 'Unknown'}
Dependencies (keys only): ${Object.keys(context.dependencies).join(', ') || 'None'}

Raw Findings:
${JSON.stringify(sanitizedResults, null, 2)}`;

    const completion = await groq.chat.completions.create({
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        model: modelName,
        temperature: 0.1, // Keep it deterministic
        max_tokens: 4000
    });

    const responseText = completion.choices[0]?.message?.content || '[]';

    // Basic cleanup in case the LLM still returns markdown block
    let jsonString = responseText;
    if (jsonString.startsWith('```json')) {
        jsonString = jsonString.replace(/^```json/, '').replace(/```$/, '').trim();
    }

    let aiRankings;
    try {
        aiRankings = JSON.parse(jsonString);
    } catch (err) {
        throw new Error(`Failed to parse AI response as JSON.\nRaw Response: ${responseText}`);
    }

    // Merge AI rankings with original findings
    const finalResults = aiRankings.map(ranking => {
        const originalFinding = sanitizedResults.find(r => r.index === ranking.originalIndex) || {};
        return {
            ...originalFinding,
            rank: ranking.rank,
            explanation: ranking.explanation,
            severity: ranking.severity
        };
    });

    // Sort them 1 to 10
    finalResults.sort((a, b) => a.rank - b.rank);

    return finalResults.slice(0, 10);
}
