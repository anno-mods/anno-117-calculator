# Claude Code Headless Mode Guide

This guide explains how to use Claude Code in headless (non-interactive) mode for automation tasks like batch translations.

## Overview

Headless mode enables programmatic execution of Claude Code without an interactive UI, making it suitable for:
- Command-line scripts
- CI/CD pipelines
- Pre-commit hooks
- Build automation
- Batch processing

## Basic Usage

### Simple Command
```bash
claude -p "Your query here"
```

### With Options
```bash
claude -p "Your query" \
  --output-format json \
  --allowedTools "Read,Write,Edit,Bash" \
  --permission-mode acceptEdits
```

## Command-Line Flags

| Flag | Description | Example |
|------|-------------|---------|
| `-p`, `--print` | Run in non-interactive mode | `claude -p "Hello"` |
| `--output-format` | Output format: `text`, `json`, `stream-json` | `--output-format json` |
| `--resume`, `-r` | Resume conversation by session ID | `--resume abc123` |
| `--continue`, `-c` | Continue most recent conversation | `--continue` |
| `--verbose` | Enable detailed logging | `--verbose` |
| `--allowedTools` | Comma/space-separated tool list | `--allowedTools "Read,Write"` |
| `--disallowedTools` | Deny specific tools | `--disallowedTools "Bash"` |
| `--permission-mode` | Auto-accept edits: `acceptEdits` | `--permission-mode acceptEdits` |
| `--mcp-config` | Load MCP servers from JSON file | `--mcp-config config.json` |

## Output Formats

### Text (Default)
Simple text output without metadata.
```bash
claude -p "What is 2+2?"
# Output: The answer is 4.
```

### JSON
Structured output with metadata (cost, duration, session ID).
```bash
claude -p "What is 2+2?" --output-format json | jq '.result'
```

### Stream JSON
Real-time streaming of each message as separate JSON objects.
```bash
claude -p "Analyze this file" --output-format stream-json
```

## Multi-Turn Conversations

### Resume Specific Session
```bash
# First query
SESSION=$(claude -p "List files" --output-format json | jq -r '.sessionId')

# Follow-up using same session
claude --resume "$SESSION" "Show the first file"
```

### Continue Last Conversation
```bash
claude -p "Initial query"
claude --continue "Follow-up question"
```

## Slash Commands in Headless Mode

**Status**: Supported but with known issues (as of May 2025)

### Basic Usage
```bash
# Execute custom slash command
claude -p "/translate requiredNumberOfBuildings"
```

### Known Limitations
- Some slash commands may have bugs in headless mode
- Related issues: #1048, #1339 on GitHub
- Test thoroughly before relying on automation

## Practical Examples

### 1. Security Audit (Pull Request Diff)
```bash
#!/bin/bash
DIFF=$(gh pr diff 123)
AUDIT=$(claude -p "Review this code for security issues: $DIFF" \
  --output-format json \
  --allowedTools "Read")

echo "$AUDIT" | jq -r '.result' > security-report.txt
```

### 2. Batch Translation
```bash
#!/bin/bash
# Read list of keys to translate
while IFS= read -r key; do
  echo "Translating: $key"
  claude -p "/translate $key" \
    --allowedTools "Read,Edit" \
    --permission-mode acceptEdits

  # Add delay to respect rate limits
  sleep 2
done < translate-list.txt
```

### 3. Code Quality Check
```bash
#!/bin/bash
RESULT=$(claude -p "Type check this project and report errors" \
  --output-format json \
  --allowedTools "Bash,Read")

ERROR_COUNT=$(echo "$RESULT" | jq -r '.errorCount // 0')

if [ "$ERROR_COUNT" -gt 0 ]; then
  echo "Type check failed with $ERROR_COUNT errors"
  exit 1
fi
```

### 4. Documentation Generation
```bash
#!/bin/bash
claude -p "Generate API documentation for all exported functions in src/" \
  --allowedTools "Read,Write,Glob,Grep" \
  --permission-mode acceptEdits
```

## Error Handling

### Check Exit Codes
```bash
if ! claude -p "Your query" --output-format json > result.json; then
  echo "Claude command failed" >&2
  exit 1
fi
```

### Parse JSON for Errors
```bash
RESULT=$(claude -p "Query" --output-format json)
SUCCESS=$(echo "$RESULT" | jq -r '.success // false')

if [ "$SUCCESS" != "true" ]; then
  ERROR=$(echo "$RESULT" | jq -r '.error')
  echo "Error: $ERROR" >&2
  exit 1
fi
```

## Best Practices

### 1. Use JSON Output for Parsing
Always use `--output-format json` when piping to other tools:
```bash
claude -p "Query" --output-format json | jq '.result'
```

### 2. Set Tool Permissions Explicitly
Only allow necessary tools for security:
```bash
--allowedTools "Read,Grep,Glob"  # Read-only operations
--disallowedTools "Bash,Write"   # Prevent modifications
```

### 3. Implement Timeouts
Prevent hanging on long operations:
```bash
timeout 300 claude -p "Long running query"
```

### 4. Respect Rate Limits
Add delays between multiple requests:
```bash
for item in "${items[@]}"; do
  claude -p "Process $item"
  sleep 2  # 2 second delay
done
```

### 5. Session Management
Reuse sessions for related queries to maintain context:
```bash
SESSION=$(claude -p "First query" --output-format json | jq -r '.sessionId')
claude --resume "$SESSION" "Related query"
```

### 6. Logging and Monitoring
```bash
claude -p "Query" --verbose 2> debug.log
```

## Common Use Cases for This Project

### Batch Translation Automation
```bash
#!/bin/bash
# Translate all incomplete keys
npm run check-translations:batch

# Process each command
while IFS= read -r cmd; do
  KEY=$(echo "$cmd" | sed 's|/translate ||')
  echo "Processing: $KEY"

  claude -p "$cmd" \
    --allowedTools "Read,Edit" \
    --permission-mode acceptEdits \
    --output-format json > "logs/translate-$KEY.json"

  sleep 2  # Rate limiting
done < scripts/translate-all.txt

# Verify results
npm run type-check
```

### Pre-Commit Hook for Translations
```bash
#!/bin/bash
# .git/hooks/pre-commit

# Check if i18n.ts was modified
if git diff --cached --name-only | grep -q "src/i18n.ts"; then
  echo "Checking translation completeness..."

  INCOMPLETE=$(npm run check-translations --silent | grep "Incomplete:" | grep -oP '\d+')

  if [ "$INCOMPLETE" -gt 0 ]; then
    echo "Warning: $INCOMPLETE translation keys are incomplete"
    echo "Run: npm run check-translations:batch"
    exit 1
  fi
fi
```

### CI/CD Pipeline Integration
```yaml
# .github/workflows/translations.yml
name: Check Translations

on:
  pull_request:
    paths:
      - 'src/i18n.ts'

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm run check-translations
      - name: Fail if incomplete
        run: |
          INCOMPLETE=$(npm run check-translations --silent | grep -oP 'Incomplete: \K\d+')
          if [ "$INCOMPLETE" -gt 0 ]; then
            echo "::error::Translation incomplete"
            exit 1
          fi
```

## Troubleshooting

### Command Not Found
```bash
# Check Claude installation
which claude

# Install if missing (via npm)
npm install -g @anthropic-ai/claude-code
```

### Permission Errors
```bash
# If edits are rejected, use permission-mode
--permission-mode acceptEdits
```

### Timeout Issues
```bash
# Increase timeout
timeout 600 claude -p "Long query"
```

### Rate Limiting
```bash
# Add delays between requests
sleep 2
```

## References

- [Official Claude Code Docs](https://docs.claude.com/en/docs/claude-code/headless)
- [GitHub Issue #837 - Slash Commands in Headless](https://github.com/anthropics/claude-code/issues/837)
- [Claude Code Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices)
