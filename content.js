// PR Guardian - Orchestrator
// config.js and features/*.js are loaded before this file via the manifest.

// ---------------------------------------------------------------------------
// Pure functions (exported for testing)
// ---------------------------------------------------------------------------

function repoMatchesPattern(pattern, owner, repo) {
  if (pattern === '*') return true;
  const [patOwner, patRepo] = pattern.split('/');
  const ownerMatches = patOwner === '*' || patOwner === owner;
  const repoMatches = !patRepo || patRepo === '*' || patRepo === repo;
  return ownerMatches && repoMatches;
}

function resolveActiveFeatures(config, features, pathname) {
  const match = pathname.match(/^\/([^/]+)\/([^/]+)\//);
  if (!match) return [];
  const [, owner, repo] = match;

  const rule = config.rules.find(r => repoMatchesPattern(r.repo, owner, repo));
  if (!rule) return [];

  return features.filter(f => rule.features.includes(f.id));
}

// ---------------------------------------------------------------------------
// DOM functions
// ---------------------------------------------------------------------------

async function checkAndHideMergeButton() {
  const config = window.PRGuardianConfig || { rules: [{ repo: '*', features: ['multi-commit'] }] };
  const features = window.PRGuardianFeatures || [];

  const activeFeatures = resolveActiveFeatures(config, features, location.pathname);

  const pathMatch = location.pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!pathMatch) return;
  const [, owner, repo, prNumber] = pathMatch;

  const results = (await Promise.all(
    activeFeatures.map(f => f.check(document, owner, repo, prNumber))
  )).filter(Boolean);

  if (results.length === 0) return;

  const allButtons = Array.from(document.querySelectorAll('button'));
  const mergeBtn = allButtons.find(btn => {
    const text = btn.textContent.trim();
    return text.includes('Merge pull request') ||
           text.includes('Squash and merge') ||
           text.includes('Rebase and merge');
  });

  if (!mergeBtn) return;

  const container =
    mergeBtn.closest('.Box, .TimelineItem, div[class*="merge"]') ||
    mergeBtn.parentElement.parentElement;

  if (container) {
    hideAndWarn(container, results, mergeBtn);
  }
}

function autoSelectSquashAndMerge(mergeBox) {
  console.log('[PR Guardian] Attempting to auto-select "Squash and merge"');

  const dropdownSelectors = [
    'button[aria-haspopup="true"]',
    'button[aria-expanded]',
    'button[data-toggle-for]',
    'button.btn-with-count',
    '.merge-message button[type="button"]',
    '.BtnGroup button:not([type="submit"])',
    'button[aria-label*="merge"]',
    'button[title*="merge"]',
  ];

  let dropdownToggle = null;
  for (const selector of dropdownSelectors) {
    dropdownToggle = mergeBox.querySelector(selector);
    if (dropdownToggle) {
      console.log(`[PR Guardian] Found dropdown toggle using selector: ${selector}`);
      break;
    }
  }

  if (!dropdownToggle) {
    console.warn('[PR Guardian] Could not find dropdown toggle button');
    return;
  }

  dropdownToggle.click();
  console.log('[PR Guardian] Clicked dropdown toggle');

  pollForDropdownMenu(dropdownToggle, mergeBox, 0);
}

function pollForDropdownMenu(dropdownToggle, mergeBox, attempt) {
  const maxAttempts = 20;

  if (attempt >= maxAttempts) {
    console.warn('[PR Guardian] Timeout waiting for dropdown menu to appear');
    return;
  }

  const searchContainers = [
    document.body,
    mergeBox,
    dropdownToggle.parentElement,
    document.querySelector('.dropdown-menu'),
    document.querySelector('[role="menu"]'),
  ].filter(Boolean);

  let squashOption = null;
  const squashSelectors = [
    'button, [role="menuitem"], [role="menuitemradio"], [role="option"]',
    '.dropdown-item',
    '.SelectMenu-item',
    'label',
  ];

  for (const container of searchContainers) {
    for (const selector of squashSelectors) {
      const elements = Array.from(container.querySelectorAll(selector));
      squashOption = elements.find(elem => {
        const text = elem.textContent.trim().toLowerCase();
        return text.includes('squash and merge') || text.includes('squash & merge');
      });
      if (squashOption) break;
    }
    if (squashOption) break;
  }

  if (squashOption) {
    console.log('[PR Guardian] Clicking squash and merge option');
    squashOption.click();
    setTimeout(() => {
      if (dropdownToggle.blur) dropdownToggle.blur();
      if (dropdownToggle.getAttribute('aria-expanded') === 'true') {
        dropdownToggle.click();
      }
      console.log('[PR Guardian] Successfully auto-selected "Squash and merge"');
    }, 50);
  } else {
    setTimeout(() => {
      pollForDropdownMenu(dropdownToggle, mergeBox, attempt + 1);
    }, 100);
  }
}

function hideAndWarn(mergeBox, results, directButton = null) {
  if (
    document.querySelector('.pr-guardian-warning-box') ||
    mergeBox.dataset.prGuardianProcessed ||
    mergeBox.dataset.prGuardianDismissed
  ) {
    return;
  }

  mergeBox.dataset.prGuardianProcessed = 'true';

  const warning = document.createElement('div');
  warning.className = 'pr-guardian-warning-box';
  warning.style.cssText = `
    background: #fff8c5;
    border: 1px solid #614700;
    padding: 16px;
    border-radius: 6px;
    margin-bottom: 16px;
  `;

  const body = results.length === 1
    ? `<p style="margin: 0; color: #614700; font-size: 14px; line-height: 1.5;">${results[0].message}</p>`
    : `<ul style="margin: 0; padding-left: 20px; color: #614700; font-size: 14px; line-height: 1.5;">
        ${results.map(r => `<li>${r.message}</li>`).join('')}
       </ul>`;

  warning.innerHTML = `
    <div class="pr-guardian-content" style="display: flex; align-items: flex-start; gap: 12px;">
      <svg class="pr-guardian-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="28" height="28" style="flex-shrink: 0; fill: #9a6700; margin-top: 0;">
        <path fill-rule="evenodd" d="M8.22 1.754a.25.25 0 00-.44 0L1.698 13.132a.25.25 0 00.22.368h12.164a.25.25 0 00.22-.368L8.22 1.754zm-1.763-.707c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0114.082 15H1.918a1.75 1.75 0 01-1.543-2.575L6.457 1.047zM9 11a1 1 0 11-2 0 1 1 0 012 0zm-.25-5.25a.75.75 0 00-1.5 0v2.5a.75.75 0 001.5 0v-2.5z"></path>
      </svg>
      <div class="pr-guardian-text" style="flex: 1;">
        <strong style="display: block; color: #614700; margin-bottom: 4px; font-size: 15px; font-weight: 600;">Merge Disabled by PR Guardian</strong>
        ${body}
      </div>
    </div>
  `;

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

  if (insertionPoint) {
    mergeBox.insertBefore(warning, insertionPoint);
  } else {
    mergeBox.appendChild(warning);
  }

  if (results.some(r => r.autoSquash)) {
    autoSelectSquashAndMerge(mergeBox);
  }
}

// ---------------------------------------------------------------------------
// Browser initialisation (skipped when imported as a Node module in tests)
// ---------------------------------------------------------------------------

if (typeof module === 'undefined') {
  checkAndHideMergeButton();

  let lastUrl = location.href;
  let checkTimeout;

  const observer = new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      clearTimeout(checkTimeout);
      checkTimeout = setTimeout(checkAndHideMergeButton, 500);
      return;
    }
    clearTimeout(checkTimeout);
    checkTimeout = setTimeout(checkAndHideMergeButton, 200);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

if (typeof module !== 'undefined') {
  module.exports = { repoMatchesPattern, resolveActiveFeatures };
}
