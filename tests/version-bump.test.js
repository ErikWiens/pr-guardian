const { fetchFilesPage, findVersionFileElement, extractVersion, check } = require('../features/version-bump');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFilesPageHtml(files) {
  // files: [{ path, deletedLines?, addedLines? }]
  // <td> must live inside a valid table structure, otherwise jsdom strips them
  const fileDivs = files.map(({ path, deletedLines = [], addedLines = [] }) => {
    const rows = [
      ...deletedLines.map(l =>
        `<tr><td class="blob-code blob-code-deletion"><span class="blob-code-inner">${l}</span></td></tr>`
      ),
      ...addedLines.map(l =>
        `<tr><td class="blob-code blob-code-addition"><span class="blob-code-inner">${l}</span></td></tr>`
      ),
    ].join('');
    return `<div data-path="${path}"><table><tbody>${rows}</tbody></table></div>`;
  });
  return `<html><body>${fileDivs.join('')}</body></html>`;
}

function mockFetch(html) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(html),
  });
}

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.resetAllMocks();
});

// ---------------------------------------------------------------------------
// findVersionFileElement
// ---------------------------------------------------------------------------

describe('findVersionFileElement', () => {
  function makeDoc(paths) {
    document.body.innerHTML = paths
      .map(p => `<div data-path="${p}"></div>`)
      .join('');
    return document;
  }

  test('finds version.rb at the repo root', () => {
    expect(findVersionFileElement(makeDoc(['version.rb']))).not.toBeNull();
  });

  test('finds version.rb in a subdirectory', () => {
    expect(findVersionFileElement(makeDoc(['lib/my_gem/version.rb']))).not.toBeNull();
  });

  test('finds version.rb nested deeply', () => {
    expect(findVersionFileElement(makeDoc(['a/b/c/version.rb']))).not.toBeNull();
  });

  test('returns null when no version.rb is present', () => {
    expect(findVersionFileElement(makeDoc(['src/app.rb', 'README.md']))).toBeNull();
  });

  test('does not match files that merely contain "version.rb" in a different position', () => {
    expect(findVersionFileElement(makeDoc(['not-version.rb']))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// extractVersion
// ---------------------------------------------------------------------------

describe('extractVersion', () => {
  test('extracts version from single-quoted VERSION constant', () => {
    expect(extractVersion(["  VERSION = '1.2.3'"])).toBe('1.2.3');
  });

  test('extracts version from double-quoted VERSION constant', () => {
    expect(extractVersion(['  VERSION = "2.0.0"'])).toBe('2.0.0');
  });

  test('handles spacing variations around the equals sign', () => {
    expect(extractVersion(['VERSION="0.1.0"'])).toBe('0.1.0');
  });

  test('returns the first match when multiple lines are present', () => {
    expect(extractVersion(['  # comment', "  VERSION = '1.0.0'", "  VERSION = '9.9.9'"])).toBe('1.0.0');
  });

  test('returns null when no VERSION constant is found', () => {
    expect(extractVersion(['  # just a comment', '  SOMETHING_ELSE = 42'])).toBeNull();
  });

  test('returns null for an empty array', () => {
    expect(extractVersion([])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// fetchFilesPage
// ---------------------------------------------------------------------------

describe('fetchFilesPage', () => {
  test('returns HTML string on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('<html>content</html>'),
    });
    const result = await fetchFilesPage('owner', 'repo', '1');
    expect(result).toBe('<html>content</html>');
  });

  test('fetches the correct URL with credentials', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(''),
    });
    await fetchFilesPage('myorg', 'myrepo', '42');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://github.com/myorg/myrepo/pull/42/files',
      expect.objectContaining({ credentials: 'include' })
    );
  });

  test('returns null when response is not ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false });
    expect(await fetchFilesPage('owner', 'repo', '1')).toBeNull();
  });

  test('returns null on network error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
    expect(await fetchFilesPage('owner', 'repo', '1')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// check (integration)
// ---------------------------------------------------------------------------

describe('check', () => {
  test('returns null when version.rb is changed with a new version', async () => {
    mockFetch(makeFilesPageHtml([{
      path: 'lib/app/version.rb',
      deletedLines: ["  VERSION = '1.0.0'"],
      addedLines:   ["  VERSION = '1.0.1'"],
    }]));
    expect(await check(document, 'owner', 'repo', '1')).toBeNull();
  });

  test('warns when version.rb is not in the changed files at all', async () => {
    mockFetch(makeFilesPageHtml([
      { path: 'src/app.rb' },
      { path: 'README.md' },
    ]));
    const result = await check(document, 'owner', 'repo', '1');
    expect(result).not.toBeNull();
    expect(result.message).toMatch(/version\.rb/);
  });

  test('warns when version.rb was touched but VERSION value is unchanged', async () => {
    mockFetch(makeFilesPageHtml([{
      path: 'lib/app/version.rb',
      deletedLines: ["  # old comment", "  VERSION = '1.0.0'"],
      addedLines:   ["  # new comment", "  VERSION = '1.0.0'"],
    }]));
    const result = await check(document, 'owner', 'repo', '1');
    expect(result).not.toBeNull();
    expect(result.message).toMatch(/1\.0\.0/);
  });

  test('warning has autoSquash: false', async () => {
    mockFetch(makeFilesPageHtml([{ path: 'src/app.rb' }]));
    const result = await check(document, 'owner', 'repo', '1');
    expect(result.autoSquash).toBe(false);
  });

  test('returns null on fetch failure (fail open)', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
    expect(await check(document, 'owner', 'repo', '1')).toBeNull();
  });

  test('returns null when prNumber is not provided', async () => {
    expect(await check(document, 'owner', 'repo', null)).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('returns null when VERSION lines cannot be parsed (fail open)', async () => {
    mockFetch(makeFilesPageHtml([{
      path: 'version.rb',
      deletedLines: ['  # removed comment'],
      addedLines:   ['  # added comment'],
    }]));
    expect(await check(document, 'owner', 'repo', '1')).toBeNull();
  });

  test('finds version.rb in a subdirectory', async () => {
    mockFetch(makeFilesPageHtml([{
      path: 'lib/my_gem/version.rb',
      deletedLines: ["  VERSION = '0.9.0'"],
      addedLines:   ["  VERSION = '1.0.0'"],
    }]));
    expect(await check(document, 'owner', 'repo', '1')).toBeNull();
  });
});
