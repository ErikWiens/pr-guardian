# PR Guardian

A Chrome extension that prevents merging GitHub pull requests with multiple commits.

## What it does

When you visit a GitHub PR page with more than one commit, PR Guardian will:
- Hide the merge button
- Display a warning message explaining why
- Encourage you to squash or rebase to a single commit first

## Installation

Since this is an unpacked extension (not published to the Chrome Web Store), you'll need to load it manually:

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in the top-right corner)
3. Click "Load unpacked"
4. Select the `pr-guardian` folder
5. The extension is now installed!

## Testing

### Manual Testing
1. Visit any GitHub pull request with multiple commits
2. You should see a warning message and the merge button will be hidden
3. On PRs with a single commit, everything works normally
4. Verify "Squash and merge" is automatically selected when warning appears

## Development

This extension is designed to work seamlessly with GitHub's dynamic interface and will automatically detect when you navigate to a PR page.

## Files

- `manifest.json` - Extension configuration
- `content.js` - Main logic that runs on GitHub PR pages
- `styles.css` - Styling for the warning message
- `README.md` - This file

## Note about Icons

The manifest references icon files (`icon16.png`, `icon48.png`, `icon128.png`) that aren't included yet. The extension will work fine without them, but Chrome will show a default icon.

You can add custom icons later if desired - they should be square PNG files at the specified dimensions.

## How it works

The extension uses:
- **Content Script**: Runs on all GitHub PR pages (`https://github.com/*/*/pull/*`)
- **DOM Observation**: Watches for changes since GitHub is a single-page application
- **Commit Detection**: Reads the commit count from the PR's "Commits" tab
- **Button Hiding**: Hides merge buttons and displays a custom warning when multiple commits are detected

## Contributing

Found a bug or want to add a feature? Pull requests are welcome! Just remember to squash your commits before merging.
