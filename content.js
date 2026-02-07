// PR Guardian - Prevents merging PRs with multiple commits

function checkAndHideMergeButton() {
  let commitCount = null;

  // Method 1: Look for "wants to merge X commits" text in the PR header
  // Note: This is language-dependent and may not work in non-English GitHub
  const mergeInfo = document.querySelector(".gh-header-meta");
  if (mergeInfo) {
    const mergeText = mergeInfo.textContent;
    const match = mergeText.match(/(\d+)\s+commits?/i);
    if (match) {
      commitCount = parseInt(match[1], 10);
    }
  }

  // Method 2: Look for commits tab using ID (more stable than href pattern)
  if (!commitCount) {
    const commitsTab = document.querySelector("#prs-commits-anchor-tab");

    if (commitsTab) {
      // Check if there's a badge/counter element with the count
      const badge = commitsTab.querySelector(
        '.Counter, [class*="Counter"], [class*="badge"]',
      );

      if (badge) {
        const badgeText = badge.textContent.trim();
        const match = badgeText.match(/\d+/);
        if (match) {
          commitCount = parseInt(match[0], 10);
        }
      }

      // Fallback: extract first number from tab text
      if (!commitCount) {
        const tabText = commitsTab.textContent;
        const match = tabText.match(/(\d+)/);
        if (match) {
          commitCount = parseInt(match[1], 10);
        }
      }
    }
  }

  if (!commitCount || isNaN(commitCount) || commitCount <= 1) {
    return; // Single commit or invalid count - allow merge
  }

  // Multiple commits detected - hide merge button and show warning
  hideMergeButton(commitCount);
}

function hideMergeButton(commitCount) {
  // Search for merge button by text content
  const allButtons = Array.from(document.querySelectorAll("button"));
  const mergeBtn = allButtons.find((btn) => {
    const text = btn.textContent.trim();
    return (
      text.includes("Merge pull request") ||
      text.includes("Squash and merge") ||
      text.includes("Rebase and merge") ||
      text === "Merge pull request"
    );
  });

  if (mergeBtn) {
    const container =
      mergeBtn.closest('.Box, .TimelineItem, div[class*="merge"]') ||
      mergeBtn.parentElement.parentElement;

    if (container) {
      hideAndWarn(container, commitCount, mergeBtn);
      return;
    }
  }
}

function autoSelectSquashAndMerge(mergeBox) {
  console.log('[PR Guardian] Attempting to auto-select "Squash and merge"');

  // Enhanced dropdown toggle detection with multiple selectors
  const dropdownSelectors = [
    'button[aria-haspopup="true"]',
    "button[aria-expanded]",
    "button[data-toggle-for]",
    "button.btn-with-count",
    '.merge-message button[type="button"]',
    '.BtnGroup button:not([type="submit"])',
    'button[aria-label*="merge"]',
    'button[title*="merge"]',
  ];

  let dropdownToggle = null;
  for (const selector of dropdownSelectors) {
    dropdownToggle = mergeBox.querySelector(selector);
    if (dropdownToggle) {
      console.log(
        `[PR Guardian] Found dropdown toggle using selector: ${selector}`,
      );
      break;
    }
  }

  if (!dropdownToggle) {
    console.warn("[PR Guardian] Could not find dropdown toggle button");
    return;
  }

  // Click to open the dropdown menu
  dropdownToggle.click();
  console.log("[PR Guardian] Clicked dropdown toggle");

  // Poll for dropdown menu to appear
  pollForDropdownMenu(dropdownToggle, mergeBox, 0);
}

function pollForDropdownMenu(dropdownToggle, mergeBox, attempt) {
  const maxAttempts = 20; // 2 seconds max (20 * 100ms)

  if (attempt >= maxAttempts) {
    console.warn("[PR Guardian] Timeout waiting for dropdown menu to appear");
    return;
  }

  // Enhanced search for squash option in multiple possible containers
  const searchContainers = [
    document.body, // Global search
    mergeBox, // Local to merge box
    dropdownToggle.parentElement, // Around the toggle
    document.querySelector(".dropdown-menu"), // Standard dropdown class
    document.querySelector('[role="menu"]'), // ARIA menu
  ].filter(Boolean); // Remove null/undefined containers

  let squashOption = null;
  const squashSelectors = [
    'button, [role="menuitem"], [role="menuitemradio"], [role="option"]',
    ".dropdown-item",
    ".SelectMenu-item",
    "label",
  ];

  for (const container of searchContainers) {
    for (const selector of squashSelectors) {
      const elements = Array.from(container.querySelectorAll(selector));
      squashOption = elements.find((elem) => {
        const text = elem.textContent.trim().toLowerCase();
        return (
          text.includes("squash and merge") || text.includes("squash & merge")
        );
      });

      if (squashOption) {
        console.log(
          `[PR Guardian] Found squash option using selector "${selector}" in container:`,
          container,
        );
        break;
      }
    }
    if (squashOption) break;
  }

  if (squashOption) {
    // Found the squash option, click it
    console.log("[PR Guardian] Clicking squash and merge option");
    squashOption.click();

    // Close dropdown and clean up
    setTimeout(() => {
      if (dropdownToggle.blur) dropdownToggle.blur();

      // Try to close dropdown if it's still open
      if (dropdownToggle.getAttribute("aria-expanded") === "true") {
        dropdownToggle.click();
      }

      console.log(
        '[PR Guardian] Successfully auto-selected "Squash and merge"',
      );
    }, 50);
  } else {
    // Squash option not found yet, try again
    setTimeout(() => {
      pollForDropdownMenu(dropdownToggle, mergeBox, attempt + 1);
    }, 100);
  }
}

function hideAndWarn(mergeBox, commitCount, directButton = null) {
  // Check if we've already modified this PR or if user has dismissed the warning
  if (
    document.querySelector(".pr-guardian-warning-box") ||
    mergeBox.dataset.prGuardianProcessed ||
    mergeBox.dataset.prGuardianDismissed
  ) {
    return;
  }

  // Mark this mergeBox as processed to prevent repeated execution
  mergeBox.dataset.prGuardianProcessed = "true";

  // Create a warning element that sits between sections
  const warning = document.createElement("div");
  warning.className = "pr-guardian-warning-box";
  warning.style.cssText = `
    background: #fff8c5;
    border: 1px solid #614700;
    padding: 16px;
    border-radius: 6px;
    margin-bottom: 16px;
  `;

  warning.innerHTML = `
    <div class="pr-guardian-content" style="display: flex; align-items: flex-start; gap: 12px;">
      <svg class="pr-guardian-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="28" height="28" style="flex-shrink: 0; fill: #9a6700; margin-top: 0;">
        <path fill-rule="evenodd" d="M8.22 1.754a.25.25 0 00-.44 0L1.698 13.132a.25.25 0 00.22.368h12.164a.25.25 0 00.22-.368L8.22 1.754zm-1.763-.707c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0114.082 15H1.918a1.75 1.75 0 01-1.543-2.575L6.457 1.047zM9 11a1 1 0 11-2 0 1 1 0 012 0zm-.25-5.25a.75.75 0 00-1.5 0v2.5a.75.75 0 001.5 0v-2.5z"></path>
      </svg>
      <div class="pr-guardian-text" style="flex: 1;">
        <strong style="display: block; color: #614700; margin-bottom: 4px; font-size: 15px; font-weight: 600;">Merge Disabled by PR Guardian</strong>
        <p style="margin: 0; color: #614700; font-size: 14px; line-height: 1.5;">
          This pull request has ${commitCount} commits. Please squash or rebase to a single commit before merging.
        </p>
      </div>
    </div>
  `;

  // Find where to insert the warning - right before the merge button section
  // Walk up from the button to find the direct child of mergeBox that contains it
  let insertionPoint = null;
  if (directButton) {
    let current = directButton;
    while (current.parentElement && current.parentElement !== mergeBox) {
      current = current.parentElement;
    }
    if (current.parentElement === mergeBox) {
      insertionPoint = current;
    }
  }

  // Insert before the merge button's container, or at the end if not found
  if (insertionPoint) {
    mergeBox.insertBefore(warning, insertionPoint);
  } else {
    mergeBox.appendChild(warning);
  }

  // Automatically select "Squash and merge" as the active merge method
  autoSelectSquashAndMerge(mergeBox);
}

// Initial check
checkAndHideMergeButton();

// GitHub is a SPA (Single Page Application), so we need to watch for changes
let lastUrl = location.href;
let checkTimeout;

const observer = new MutationObserver(() => {
  // Check if URL changed (navigation)
  const currentUrl = location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    // URL changed, check after a short delay
    clearTimeout(checkTimeout);
    checkTimeout = setTimeout(checkAndHideMergeButton, 500);
    return;
  }

  // Use debounce to avoid excessive checks
  clearTimeout(checkTimeout);
  checkTimeout = setTimeout(checkAndHideMergeButton, 200);
});

// Start observing
observer.observe(document.body, {
  childList: true,
  subtree: true,
});
