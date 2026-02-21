#!/usr/bin/env node

import { Command } from 'commander';
import pc from 'picocolors';
import cfonts from 'cfonts';
import { runScanner } from '../src/index.js';

const program = new Command();

program
  .name('riskrank')
  .description('AI-Powered Static Code Analysis Prioritization CLI')
  .version('1.0.0');

program
  .command('scan')
  .description('run a static analysis scan and prioritize findings')
  .argument('[directory]', 'directory to scan', '.')
  .option('-k, --key <key>', 'Groq API Key (overrides GROQ_API_KEY env var)')
  .option('-m, --model <model>', 'Groq Model', 'llama-3.3-70b-versatile')
  .action(async (directory, options) => {
    try {
      cfonts.say('RISKRANK', {
        font: 'block',
        align: 'left',
        gradient: ['cyan', 'yellow'],
        transitionGradient: true,
        maxLength: 120,
      });
      console.log(pc.cyan(`Starting RiskRank on directory: ${directory}\n`));
      await runScanner(directory, options);
    } catch (error) {
      console.error(pc.red(`\nError: ${error.message}\n`));
      process.exit(1);
    }
  });

program.parse();
