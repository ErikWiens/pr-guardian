// PR Guardian - Prevents merging PRs with multiple commits

function checkAndHideMergeButton() {
  // Find the commits count in the PR navigation tabs
  // GitHub shows it like "Commits" with a badge or "Commits 5"
  const commitsTab = document.querySelector('[data-tab-item="commits"]');

  if (!commitsTab) {
    return; // Not on a PR page or page not fully loaded
  }

  // Try to find the commit count badge
  const countBadge = commitsTab.querySelector('.Counter');

  if (!countBadge) {
    return; // No commit count found
  }

  const commitCount = parseInt(countBadge.textContent.trim(), 10);

  if (isNaN(commitCount) || commitCount <= 1) {
    return; // Single commit or invalid count - allow merge
  }

  // Multiple commits detected - hide merge button and show warning
  hideMergeButton(commitCount);
}

function hideMergeButton(commitCount) {
  // Find the merge button container
  // GitHub's merge box is typically in a div with class "merge-pr"
  const mergeBox = document.querySelector('.merge-pr, .merge-message');

  if (!mergeBox) {
    return; // Merge button not found
  }

  // Check if we've already added our warning
  if (document.querySelector('.pr-guardian-warning')) {
    return;
  }

  // Find and hide the actual merge button
  const mergeButton = mergeBox.querySelector('button[data-details-container=".js-merge-pull-request"]');
  const squashMergeButton = mergeBox.querySelector('button[value="squash"]');
  const rebaseMergeButton = mergeBox.querySelector('button[value="rebase"]');

  // Hide all merge action buttons
  [mergeButton, squashMergeButton, rebaseMergeButton].forEach(btn => {
    if (btn) {
      btn.style.display = 'none';
    }
  });

  // Hide the merge button group
  const mergeButtonGroup = mergeBox.querySelector('.merge-pr-more-options, .BtnGroup');
  if (mergeButtonGroup) {
    mergeButtonGroup.style.display = 'none';
  }

  // Create and insert warning message
  const warning = document.createElement('div');
  warning.className = 'pr-guardian-warning';
  warning.innerHTML = `
    <div class="pr-guardian-content">
      <svg class="pr-guardian-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">
        <path fill-rule="evenodd" d="M8.22 1.754a.25.25 0 00-.44 0L1.698 13.132a.25.25 0 00.22.368h12.164a.25.25 0 00.22-.368L8.22 1.754zm-1.763-.707c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0114.082 15H1.918a1.75 1.75 0 01-1.543-2.575L6.457 1.047zM9 11a1 1 0 11-2 0 1 1 0 012 0zm-.25-5.25a.75.75 0 00-1.5 0v2.5a.75.75 0 001.5 0v-2.5z"></path>
      </svg>
      <div class="pr-guardian-text">
        <strong>Merge Disabled by PR Guardian</strong>
        <p>This pull request has ${commitCount} commits. Please squash or rebase to a single commit before merging.</p>
      </div>
    </div>
  `;

  // Insert warning at the top of the merge box
  mergeBox.insertBefore(warning, mergeBox.firstChild);
}

// Initial check
checkAndHideMergeButton();

// GitHub is a SPA (Single Page Application), so we need to watch for changes
// Use MutationObserver to detect when the page content changes
const observer = new MutationObserver((mutations) => {
  checkAndHideMergeButton();
});

// Start observing the document body for changes
observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Also check when navigation occurs (GitHub uses pushState)
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    // URL changed, check again after a short delay
    setTimeout(checkAndHideMergeButton, 500);
  }
}).observe(document.querySelector('body'), {
  childList: true,
  subtree: true
});
