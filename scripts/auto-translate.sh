#!/bin/bash

###############################################################################
# Auto-Translate Script
#
# Automatically translates incomplete i18n keys using Claude Code headless mode
#
# Usage:
#   ./scripts/auto-translate.sh [options]
#
# Options:
#   --dry-run       Show what would be done without executing
#   --key KEY       Translate only a specific key
#   --max N         Translate at most N keys (default: all)
#   --delay N       Delay between translations in seconds (default: 2)
#   --verbose       Enable verbose logging
#
# Examples:
#   ./scripts/auto-translate.sh --dry-run
#   ./scripts/auto-translate.sh --key requiredNumberOfBuildings
#   ./scripts/auto-translate.sh --max 5 --delay 3
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default options
DRY_RUN=false
SPECIFIC_KEY=""
MAX_KEYS=999999
DELAY=2
VERBOSE=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --key)
      SPECIFIC_KEY="$2"
      shift 2
      ;;
    --max)
      MAX_KEYS="$2"
      shift 2
      ;;
    --delay)
      DELAY="$2"
      shift 2
      ;;
    --verbose)
      VERBOSE=true
      shift
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

# Change to project root
cd "$(dirname "$0")/.."

echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Auto-Translate i18n Keys${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo

# Check if Claude is available
if ! command -v claude &> /dev/null; then
    echo -e "${RED}Error: 'claude' command not found${NC}"
    echo "Please ensure Claude Code CLI is installed and in PATH"
    exit 1
fi

# Check if node is available
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: 'node' command not found${NC}"
    exit 1
fi

# Create logs directory
mkdir -p logs

# Run translation check
echo -e "${YELLOW}Checking translation completeness...${NC}"
node scripts/check-translations.js --batch > /dev/null

if [ ! -f "scripts/translate-all.txt" ]; then
    echo -e "${GREEN}✓ All translations are complete!${NC}"
    exit 0
fi

# Count incomplete translations
TOTAL=$(wc -l < scripts/translate-all.txt)
echo -e "${YELLOW}Found $TOTAL incomplete translation keys${NC}"
echo

# Filter for specific key if requested
if [ -n "$SPECIFIC_KEY" ]; then
    grep "/translate $SPECIFIC_KEY" scripts/translate-all.txt > scripts/translate-filtered.txt || {
        echo -e "${RED}Error: Key '$SPECIFIC_KEY' not found in incomplete translations${NC}"
        exit 1
    }
    TRANSLATE_FILE="scripts/translate-filtered.txt"
else
    TRANSLATE_FILE="scripts/translate-all.txt"
fi

# Limit number of keys if requested
if [ "$MAX_KEYS" -lt "$TOTAL" ]; then
    head -n "$MAX_KEYS" "$TRANSLATE_FILE" > scripts/translate-limited.txt
    TRANSLATE_FILE="scripts/translate-limited.txt"
    TOTAL=$MAX_KEYS
fi

# Dry run mode
if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}DRY RUN MODE - No changes will be made${NC}"
    echo
    echo "Would translate the following keys:"
    cat "$TRANSLATE_FILE"
    echo
    echo "To execute, run without --dry-run flag"
    exit 0
fi

# Confirm before proceeding
echo -e "${YELLOW}About to translate $TOTAL keys${NC}"
echo -e "${YELLOW}Delay between translations: ${DELAY}s${NC}"
echo
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted"
    exit 0
fi

echo
echo -e "${BLUE}Starting translation process...${NC}"
echo

# Process each translation command
COUNT=0
SUCCESS=0
FAILED=0

while IFS= read -r cmd; do
    COUNT=$((COUNT + 1))
    KEY=$(echo "$cmd" | sed 's|/translate ||')

    echo -e "${BLUE}[$COUNT/$TOTAL]${NC} Translating: ${GREEN}$KEY${NC}"

    # Build Claude command
    CLAUDE_CMD="claude -p \"$cmd\" \
        --allowedTools \"Read,Edit\" \
        --permission-mode acceptEdits \
        --output-format json"

    if [ "$VERBOSE" = true ]; then
        CLAUDE_CMD="$CLAUDE_CMD --verbose"
    fi

    # Execute translation
    LOG_FILE="logs/translate-$KEY-$(date +%Y%m%d-%H%M%S).json"

    if eval "$CLAUDE_CMD" > "$LOG_FILE" 2>&1; then
        SUCCESS=$((SUCCESS + 1))
        echo -e "  ${GREEN}✓ Success${NC}"
    else
        FAILED=$((FAILED + 1))
        echo -e "  ${RED}✗ Failed${NC} (see $LOG_FILE)"
    fi

    # Rate limiting delay (except for last item)
    if [ "$COUNT" -lt "$TOTAL" ]; then
        if [ "$VERBOSE" = true ]; then
            echo -e "  ${YELLOW}Waiting ${DELAY}s...${NC}"
        fi
        sleep "$DELAY"
    fi

    echo
done < "$TRANSLATE_FILE"

# Summary
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Translation Summary${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "Total:   $TOTAL"
echo -e "${GREEN}Success: $SUCCESS${NC}"
echo -e "${RED}Failed:  $FAILED${NC}"
echo

# Verify TypeScript
if [ "$SUCCESS" -gt 0 ]; then
    echo -e "${YELLOW}Running TypeScript type check...${NC}"
    if npm run type-check; then
        echo -e "${GREEN}✓ Type check passed${NC}"
    else
        echo -e "${RED}✗ Type check failed${NC}"
        echo "Please review the changes and fix any errors"
        exit 1
    fi
fi

# Final status
if [ "$FAILED" -eq 0 ]; then
    echo
    echo -e "${GREEN}✓ All translations completed successfully!${NC}"
    exit 0
else
    echo
    echo -e "${YELLOW}⚠ Some translations failed. Check logs/ for details${NC}"
    exit 1
fi
