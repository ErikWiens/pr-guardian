const { detectCommitCount, findMergeButton, check } = require('../features/multi-commit');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDocument(html) {
  document.body.innerHTML = html;
  return document;
}

// ---------------------------------------------------------------------------
// detectCommitCount
// ---------------------------------------------------------------------------

describe('detectCommitCount', () => {
  describe('Method 1: .gh-header-meta text', () => {
    test('reads plural "3 commits"', () => {
      const doc = makeDocument(`
        <div class="gh-header-meta">
          <span>user wants to merge <strong>3 commits</strong> into main</span>
        </div>
      `);
      expect(detectCommitCount(doc)).toBe(3);
    });

    test('reads singular "1 commit"', () => {
      const doc = makeDocument(`
        <div class="gh-header-meta">
          <span>user wants to merge <strong>1 commit</strong> into main</span>
        </div>
      `);
      expect(detectCommitCount(doc)).toBe(1);
    });

    test('reads larger counts', () => {
      const doc = makeDocument(`
        <div class="gh-header-meta">
          <span>user wants to merge 12 commits into main</span>
        </div>
      `);
      expect(detectCommitCount(doc)).toBe(12);
    });

    test('is case-insensitive', () => {
      const doc = makeDocument(`
        <div class="gh-header-meta">
          <span>wants to merge 5 COMMITS</span>
        </div>
      `);
      expect(detectCommitCount(doc)).toBe(5);
    });
  });

  describe('Method 2: #prs-commits-anchor-tab', () => {
    test('reads count from .Counter badge', () => {
      const doc = makeDocument(`
        <div id="prs-commits-anchor-tab">
          Commits
          <span class="Counter">4</span>
        </div>
      `);
      expect(detectCommitCount(doc)).toBe(4);
    });

    test('reads count from element with Counter in class name', () => {
      const doc = makeDocument(`
        <div id="prs-commits-anchor-tab">
          Commits
          <span class="Counter--primary">7</span>
        </div>
      `);
      expect(detectCommitCount(doc)).toBe(7);
    });

    test('reads count from element with badge in class name', () => {
      const doc = makeDocument(`
        <div id="prs-commits-anchor-tab">
          Commits
          <span class="badge">2</span>
        </div>
      `);
      expect(detectCommitCount(doc)).toBe(2);
    });

    test('falls back to first number in tab text when no badge', () => {
      const doc = makeDocument(`
        <div id="prs-commits-anchor-tab">Commits 5</div>
      `);
      expect(detectCommitCount(doc)).toBe(5);
    });
  });

  describe('Method 1 takes priority over Method 2', () => {
    test('returns header count when both elements present', () => {
      const doc = makeDocument(`
        <div class="gh-header-meta">wants to merge 3 commits into main</div>
        <div id="prs-commits-anchor-tab">Commits<span class="Counter">9</span></div>
      `);
      expect(detectCommitCount(doc)).toBe(3);
    });
  });

  describe('edge cases', () => {
    test('returns null when neither element is present', () => {
      const doc = makeDocument(`<div class="other-content">nothing here</div>`);
      expect(detectCommitCount(doc)).toBeNull();
    });

    test('returns null when header meta has no commit count text', () => {
      const doc = makeDocument(`
        <div class="gh-header-meta">user wants to merge into main</div>
      `);
      expect(detectCommitCount(doc)).toBeNull();
    });

    test('returns null when commits tab has no number', () => {
      const doc = makeDocument(`
        <div id="prs-commits-anchor-tab">Commits</div>
      `);
      expect(detectCommitCount(doc)).toBeNull();
    });

    test('returns null on empty document', () => {
      const doc = makeDocument('');
      expect(detectCommitCount(doc)).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// findMergeButton
// ---------------------------------------------------------------------------

describe('findMergeButton', () => {
  test('finds "Merge pull request" button', () => {
    const doc = makeDocument(`<button type="button">Merge pull request</button>`);
    expect(findMergeButton(doc)).not.toBeNull();
  });

  test('finds "Squash and merge" button', () => {
    const doc = makeDocument(`<button type="button">Squash and merge</button>`);
    expect(findMergeButton(doc)).not.toBeNull();
  });

  test('finds "Rebase and merge" button', () => {
    const doc = makeDocument(`<button type="button">Rebase and merge</button>`);
    expect(findMergeButton(doc)).not.toBeNull();
  });

  test('returns null when no merge button present', () => {
    const doc = makeDocument(`<button type="button">Close pull request</button>`);
    expect(findMergeButton(doc)).toBeNull();
  });

  test('returns null on empty document', () => {
    const doc = makeDocument('');
    expect(findMergeButton(doc)).toBeNull();
  });

  test('finds button with surrounding whitespace in text', () => {
    const doc = makeDocument(`<button type="button">  Merge pull request  </button>`);
    expect(findMergeButton(doc)).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// check (the public contract used by the orchestrator)
// ---------------------------------------------------------------------------

describe('check', () => {
  test('returns null for single commit', () => {
    const doc = makeDocument(`
      <div class="gh-header-meta">wants to merge 1 commit into main</div>
    `);
    expect(check(doc)).toBeNull();
  });

  test('returns null when commit count cannot be detected', () => {
    const doc = makeDocument('<div>nothing relevant</div>');
    expect(check(doc)).toBeNull();
  });

  test('returns { commitCount } for 2+ commits from header', () => {
    const doc = makeDocument(`
      <div class="gh-header-meta">wants to merge 2 commits into main</div>
    `);
    expect(check(doc)).toMatchObject({ commitCount: 2 });
  });

  test('returns { commitCount } for 2+ commits from tab badge', () => {
    const doc = makeDocument(`
      <div id="prs-commits-anchor-tab">
        Commits <span class="Counter">5</span>
      </div>
    `);
    expect(check(doc)).toMatchObject({ commitCount: 5 });
  });

  test('commitCount in result matches the detected value', () => {
    const doc = makeDocument(`
      <div class="gh-header-meta">wants to merge 8 commits into main</div>
    `);
    const result = check(doc);
    expect(result.commitCount).toBe(8);
  });

  test('result includes a human-readable message', () => {
    const doc = makeDocument(`
      <div class="gh-header-meta">wants to merge 3 commits into main</div>
    `);
    const result = check(doc);
    expect(typeof result.message).toBe('string');
    expect(result.message.length).toBeGreaterThan(0);
  });

  test('result includes autoSquash flag', () => {
    const doc = makeDocument(`
      <div class="gh-header-meta">wants to merge 2 commits into main</div>
    `);
    expect(check(doc)).toMatchObject({ autoSquash: true });
  });
});
