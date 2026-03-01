// PR Guardian - Version bump detection feature
//
// For specified repos, checks that the VERSION constant in version.rb has
// actually been changed (not just that the file was touched).
//
// Enable per-repo in config.js:
//   { repo: 'owner/repo', features: ['multi-commit', 'version-bump'] }

// Matches any version.rb file regardless of directory depth
const VERSION_FILE_PATTERN = /(?:^|\/)version\.rb$/;

// Matches: VERSION = '1.2.3' or VERSION = "1.2.3"
const VERSION_STRING_PATTERN = /VERSION\s*=\s*['"]([^'"]+)['"]/;

async function fetchFilesPage(owner, repo, prNumber) {
  try {
    const url = `https://github.com/${owner}/${repo}/pull/${prNumber}/files`;
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) return null;
    return response.text();
  } catch {
    return null;
  }
}

// Returns the DOM element representing the version.rb diff, or null
function findVersionFileElement(doc) {
  return Array.from(doc.querySelectorAll('[data-path]'))
    .find(el => VERSION_FILE_PATTERN.test(el.getAttribute('data-path'))) || null;
}

// Extracts the first VERSION string from an array of code lines
function extractVersion(lines) {
  for (const line of lines) {
    const match = line.match(VERSION_STRING_PATTERN);
    if (match) return match[1];
  }
  return null;
}

async function check(document, owner, repo, prNumber) {
  if (!prNumber) return null;

  const html = await fetchFilesPage(owner, repo, prNumber);
  if (html === null) return null; // fail open on network error

  const parser = new DOMParser();
  const parsedDoc = parser.parseFromString(html, 'text/html');
  const versionFileEl = findVersionFileElement(parsedDoc);

  if (!versionFileEl) {
    return {
      message: 'version.rb has not been updated in this PR. Did you forget to bump the version?',
      autoSquash: false,
    };
  }

  // File was touched — now check whether the VERSION value actually changed
  const deletedLines = Array.from(
    versionFileEl.querySelectorAll('.blob-code-deletion .blob-code-inner')
  ).map(el => el.textContent.trim());

  const addedLines = Array.from(
    versionFileEl.querySelectorAll('.blob-code-addition .blob-code-inner')
  ).map(el => el.textContent.trim());

  const oldVersion = extractVersion(deletedLines);
  const newVersion = extractVersion(addedLines);

  // If we can parse both versions and they're the same, the bump was missed
  if (oldVersion && newVersion && oldVersion === newVersion) {
    return {
      message: `version.rb was changed but VERSION is still ${newVersion}. Did you forget to bump it?`,
      autoSquash: false,
    };
  }

  // Version was bumped, or we can't parse it — fail open
  return null;
}

// Register in browser context
if (typeof window !== 'undefined' && typeof module === 'undefined') {
  window.PRGuardianFeatures = window.PRGuardianFeatures || [];
  window.PRGuardianFeatures.push({ id: 'version-bump', check });
}

if (typeof module !== 'undefined') {
  module.exports = { fetchFilesPage, findVersionFileElement, extractVersion, check };
}
