// PR Guardian - Multi-commit detection feature

function detectCommitCount(document) {
  // Method 1: "wants to merge X commits" in the PR header meta
  const mergeInfo = document.querySelector('.gh-header-meta');
  if (mergeInfo) {
    const match = mergeInfo.textContent.match(/(\d+)\s+commits?/i);
    if (match) return parseInt(match[1], 10);
  }

  // Method 2: commits tab badge/counter
  const commitsTab = document.querySelector('#prs-commits-anchor-tab');
  if (commitsTab) {
    const badge = commitsTab.querySelector('.Counter, [class*="Counter"], [class*="badge"]');
    if (badge) {
      const match = badge.textContent.trim().match(/\d+/);
      if (match) return parseInt(match[0], 10);
    }

    // Fallback: first number in the tab text
    const match = commitsTab.textContent.match(/(\d+)/);
    if (match) return parseInt(match[1], 10);
  }

  return null;
}

function findMergeButton(document) {
  const allButtons = Array.from(document.querySelectorAll('button'));
  return allButtons.find(btn => {
    const text = btn.textContent.trim();
    return text.includes('Merge pull request') ||
           text.includes('Squash and merge') ||
           text.includes('Rebase and merge') ||
           text === 'Merge pull request';
  }) || null;
}

// Returns a result object if this feature should block merge, null otherwise.
// owner and repo are provided by the orchestrator but not needed for this check.
function check(document, owner, repo) {
  const commitCount = detectCommitCount(document);
  if (!commitCount || isNaN(commitCount) || commitCount <= 1) return null;
  return {
    commitCount,
    message: `This PR has ${commitCount} commits. Please squash or rebase to a single commit before merging.`,
    autoSquash: true,
  };
}

// Register in browser context (all content scripts share the same isolated world)
if (typeof window !== 'undefined' && typeof module === 'undefined') {
  window.PRGuardianFeatures = window.PRGuardianFeatures || [];
  window.PRGuardianFeatures.push({ id: 'multi-commit', check });
}

// Dual-mode: also exportable as a Node module for tests
if (typeof module !== 'undefined') {
  module.exports = { detectCommitCount, findMergeButton, check };
}
