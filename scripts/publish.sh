#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check if on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo -e "${RED}Error: Not on main branch (current: $CURRENT_BRANCH)${NC}"
    exit 1
fi

echo -e "${GREEN}✓ On main branch${NC}"

# Display latest tag
LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "none")
echo -e "Latest release tag: ${YELLOW}${LATEST_TAG}${NC}"
echo ""

# Step 2: Get release tag
TAG=$1
if [ -z "$TAG" ]; then
    read -p "Enter release tag (e.g., 1.6): " TAG
    if [ -z "$TAG" ]; then
        echo -e "${RED}Error: Release tag is required${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}Release tag: $TAG${NC}"

# Step 3: Update version in package.json and util.ts
echo "Updating version in package.json..."
# Use sed -i with .bak for cross-platform compatibility
sed -i.bak "s/\"version\": \".*\"/\"version\": \"$TAG\"/" package.json && rm package.json.bak

echo "Updating version in src/util.ts..."
sed -i.bak "s/export let versionCalculator = \".*\"/export let versionCalculator = \"$TAG\"/" src/util.ts && rm src/util.ts.bak

echo -e "${GREEN}✓ Updated version to $TAG${NC}"

# Step 4: Get commits since last merge from 'release'
echo "Collecting commits since last merge from 'release'..."

# Find the last merge commit from release branch
LAST_MERGE=$(git log --grep="Merge branch 'release'" --oneline -1 --format="%H" 2>/dev/null || echo "")

if [ -z "$LAST_MERGE" ]; then
    echo -e "${YELLOW}Warning: No previous merge from 'release' found. Using all commits.${NC}"
    COMMITS=$(git log --oneline --no-merges --format="- %s")
else
    COMMITS=$(git log ${LAST_MERGE}..HEAD --oneline --no-merges --format="- %s")
fi

# Step 5: Draft commit message
DRAFT_FILE=$(mktemp)
cat > "$DRAFT_FILE" << EOF
Release $TAG

$COMMITS
EOF

echo -e "${GREEN}✓ Generated commit summary${NC}"
echo ""
echo "Opening draft in editor..."

# Open in default editor (respects EDITOR environment variable)
${EDITOR:-vi} "$DRAFT_FILE"

# Wait for user to finish editing (important for editors like Notepad++ that don't block)
echo ""
echo -e "${YELLOW}Edit the commit message in your editor, save, and close it.${NC}"
read -p "Press Enter when you're done editing..."

# Step 6: Read the updated draft
COMMIT_MESSAGE=$(cat "$DRAFT_FILE")
rm "$DRAFT_FILE"

# Verify the first line starts with "Release"
FIRST_LINE=$(echo "$COMMIT_MESSAGE" | head -n 1)
if [[ ! "$FIRST_LINE" =~ ^Release\ [0-9]+\.[0-9]+ ]]; then
    echo -e "${RED}Error: First line must be 'Release X.Y'${NC}"
    echo "Got: $FIRST_LINE"
    exit 1
fi

echo ""
echo -e "${YELLOW}Commit message:${NC}"
echo "----------------------------------------"
echo "$COMMIT_MESSAGE"
echo "----------------------------------------"
echo ""

# Confirm with user
read -p "Proceed with this commit message? (y/n): " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo -e "${RED}Aborted by user${NC}"
    exit 1
fi

# Step 6.5: Commit version changes on main
echo "Committing version changes on main..."
git add -A
git commit -m "Release $TAG"

echo -e "${GREEN}✓ Committed version changes on main${NC}"

# Step 7: Check if release branch exists, create if not
if ! git show-ref --verify --quiet refs/heads/release; then
    echo -e "${YELLOW}Creating 'release' branch${NC}"
    git branch release
fi

# Step 8: Squash merge from main into release
echo "Switching to release branch..."
git checkout release

echo "Squash merging main into release..."
git merge --squash main

echo "Committing with release message..."
git commit -m "$COMMIT_MESSAGE"

echo -e "${GREEN}✓ Squash merged main into release${NC}"

# Step 9: Push to GitHub
echo "Pushing release branch to GitHub..."
git push anno-mods main

echo -e "${GREEN}✓ Pushed to GitHub${NC}"

# Step 10: Wait for tag to be created
echo "Waiting for GitHub Actions to create tag $TAG..."
MAX_WAIT=60
ELAPSED=0

while [ $ELAPSED -lt $MAX_WAIT ]; do
    if git ls-remote --tags anno-mods | grep -q "refs/tags/$TAG"; then
        echo -e "${GREEN}✓ Tag $TAG created!${NC}"
        break
    fi

    if [ $ELAPSED -eq 0 ]; then
        echo -n "Waiting"
    else
        echo -n "."
    fi

    sleep 2
    ELAPSED=$((ELAPSED + 2))
done

if [ $ELAPSED -ge $MAX_WAIT ]; then
    echo ""
    echo -e "${YELLOW}Warning: Tag not detected after ${MAX_WAIT}s. Continuing anyway...${NC}"
fi

echo ""

# Fetch the tag
echo "Fetching tags from remote..."
git fetch --tags

# Step 11: Merge release into main
echo "Switching back to main..."
git checkout main

echo "Merging release into main..."
git merge release --no-edit

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ Release $TAG published successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Summary:"
echo "  - Version updated in package.json and util.ts"
echo "  - Release branch updated and pushed"
echo "  - Tag $TAG created (or pending)"
echo "  - Main branch updated and pushed"
echo ""
