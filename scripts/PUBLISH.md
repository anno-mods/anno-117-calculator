# Publishing a Release

This guide explains how to publish a new release of the Anno 117 Calculator.

## Prerequisites

- You must be on the `main` branch
- All changes should be committed
- Git Bash or WSL installed (for Windows users)

## Usage

### Option 1: Using npm script
```bash
npm run publish [tag]
```

### Option 2: Direct script execution

**On Linux/Mac/Git Bash:**
```bash
./scripts/publish.sh [tag]
```

**On Windows (Command Prompt):**
```cmd
scripts\publish.bat [tag]
```

### Examples

With tag argument:
```bash
npm run publish 1.6
```

Without tag (will prompt):
```bash
npm run publish
# You'll be prompted: Enter release tag (e.g., 1.6):
```

## What the Script Does

1. **Validates** you're on the `main` branch
2. **Prompts** for release tag if not provided (e.g., "1.6")
3. **Updates** version in:
   - `package.json`
   - `src/util.ts` (versionCalculator)
4. **Collects** all commits since the last merge from `release` branch
5. **Opens** a draft commit message in your default editor:
   ```
   Release 1.6

   - First commit summary
   - Second commit summary
   - ...
   ```
6. **Waits** for you to edit and save the message
7. **Commits** all changes on `main` with message "Release X.Y"
8. **Squash merges** `main` into `release` branch with your full commit message
9. **Pushes** the `release` branch to GitHub
10. **Waits** for GitHub Actions to create the tag (up to 60 seconds)
11. **Merges** `release` back into `main`
12. **Pushes** `main` to GitHub

## The Release Process Flow

```
main → [commit "Release X.Y"] → main
         ↓
      [squash merge]
         ↓
      release → [push] → GitHub Actions creates tag
         ↓
      [merge back]
         ↓
       main
```

## GitHub Actions

The `.github/workflows/auto-release.yml` workflow automatically:
- Detects commits starting with "Release X.Y"
- Creates a GitHub release with tag X.Y
- Uses the full commit message as release notes

## Editor Configuration

The script uses your default editor (from `$EDITOR` environment variable).

**To set your preferred editor:**

**Git Bash/Linux/Mac:**
```bash
export EDITOR=nano  # or vim, code, etc.
```

**Windows (permanent):**
```cmd
setx EDITOR "code --wait"  # VS Code
setx EDITOR "notepad"      # Notepad
```

## Troubleshooting

**"Not on main branch" error:**
- Switch to main: `git checkout main`

**Tag not detected after 60s:**
- The script continues anyway
- Check GitHub Actions status manually
- The tag may be created shortly after

**Editor doesn't open:**
- Set the `EDITOR` environment variable
- Default is `vi` if not set

**Commit message validation fails:**
- The first line MUST start with "Release X.Y"
- Edit the message to match the pattern
