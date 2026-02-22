# RiskRank

**RiskRank** is an AI-powered static code analysis prioritization CLI tool. It runs [Semgrep](https://semgrep.dev/) to scan your codebase for vulnerabilities and then uses an LLM (powered by Groq) to filter out noise, rank the Top 10 critical business risks, and explain exactly why the code is vulnerable in a developer-friendly way.

It features a premium synthwave-style ASCII terminal interface and interactively syncs the sanitized, prioritized scan results directly to a Cloud MongoDB cluster so that web-based UI dashboards can instantly consume the metadata.

---

## Features

- **Automated Scanning**: Executes system-installed `semgrep` to locate static vulnerabilities.
- **Context Awareness**: Analyzes `package.json` to extract frameworks and project identity before scanning.
- **AI Prioritization**: Connects to the **Groq API** (`llama-3.3-70b-versatile`) to force-rank findings by actual business risk, stripping out low-severity noise.
- **Premium ASCII UI**: Features a bespoke, fully-dynamic terminal renderer with a brand block gradient banner, exact severity color-coding, bounding boxes, and an interlocking 5-column Raw Findings data grid.
- **Auto Snippet Extraction**: Automatically captures and highlights the exact vulnerable code lines right inside your terminal.
- **Cloud Dashboard Sync**: Interactively prompts to upload a meticulously structured `metrics` payload to a remote MongoDB cluster for dashboard rendering.
- **Smart Fallbacks**: Automatically falls back to deterministic, semantic keyword prioritization if AI is unavailable or fails.

---

## Prerequisites

1. **System Semgrep**: Ensure Semgrep is installed globally on your machine.
   - Mac: `brew install semgrep`
   - Linux/Windows: `pip install semgrep`
2. **Node.js**: Requires Node > v18.0.0.

---

## Installation & Setup

1. **Clone & Install**:
   ```bash
   git clone <your-repo> riskrank
   cd riskrank
   npm install
   ```

2. **Environment Variables Config**:
   Create a `.env` file in the root directory and add your API keys/connection strings:
   ```env
   # Required for AI Prioritization
   GROQ_API_KEY=your_groq_api_key_here

   # Required for Cloud DB Upload features
   MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/riskrank?retryWrites=true&w=majority
   ```

3. **Global Link (Optional)**:
   ```bash
   npm link
   # You can now run `riskrank scan .` anywhere
   ```

---

## Usage

Simply aim RiskRank at a target directory to begin evaluation:

```bash
node bin/cli.js scan .
```
Or if linked globally:
```bash
riskrank scan /path/to/my-codebase
```

### CLI Options
- `-k, --key <key>`: Explicitly provide a Groq API Key (overrides the `.env` file).
- `-m, --model <model>`: Specify a different Groq model (defaults to `llama-3.3-70b-versatile`).
- `-c, --ci`: Run in non-interactive CI/CD mode (disables prompts).
- `-f, --fail-on <severity>`: Force exit code `1` if vulnerabilities matching or exceeding this severity are found (choices: `critical`, `high`, `medium`, `low`).

---

## 🚀 Usage in CI/CD (GitHub Actions)

RiskRank is designed to easily integrate into CI/CD pipelines to block vulnerable code from being merged.

1. Ensure the `GROQ_API_KEY` is added to your repository's secrets.
2. Add the following file to your repository at `.github/workflows/riskrank.yml`:

```yaml
name: RiskRank Security Scan

on:
  push:
    branches: [ "main", "master" ]
  pull_request:
    branches: [ "main", "master" ]

jobs:
  sast_scan:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4
      
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          
      - name: Install Semgrep
        run: python3 -m pip install semgrep

      - name: Run RiskRank CI
        run: npx -y github:make-a-ton-samurai/riskrank scan . --ci --fail-on high
        env:
          GROQ_API_KEY: ${{ secrets.GROQ_API_KEY }}
```

---

## Technologies Used

- **CLI Engine**: `commander`
- **Output Styling**: `picocolors`, `cfonts`
- **AI Processing**: `groq-sdk`
- **Scanner Engine**: `semgrep`
- **Database ORM**: `mongoose`
