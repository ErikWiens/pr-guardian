const { repoMatchesPattern, resolveActiveFeatures } = require('../content');

// ---------------------------------------------------------------------------
// repoMatchesPattern
// ---------------------------------------------------------------------------

describe('repoMatchesPattern', () => {
  test('"*" matches any owner and repo', () => {
    expect(repoMatchesPattern('*', 'acme', 'frontend')).toBe(true);
    expect(repoMatchesPattern('*', 'anything', 'whatever')).toBe(true);
  });

  test('"owner/*" matches any repo under that owner', () => {
    expect(repoMatchesPattern('acme/*', 'acme', 'frontend')).toBe(true);
    expect(repoMatchesPattern('acme/*', 'acme', 'backend')).toBe(true);
  });

  test('"owner/*" does not match a different owner', () => {
    expect(repoMatchesPattern('acme/*', 'other', 'frontend')).toBe(false);
  });

  test('"owner/repo" exact match succeeds', () => {
    expect(repoMatchesPattern('acme/frontend', 'acme', 'frontend')).toBe(true);
  });

  test('"owner/repo" does not match different repo', () => {
    expect(repoMatchesPattern('acme/frontend', 'acme', 'backend')).toBe(false);
  });

  test('"owner/repo" does not match different owner', () => {
    expect(repoMatchesPattern('acme/frontend', 'other', 'frontend')).toBe(false);
  });

  test('"*/repo" matches any owner for that specific repo', () => {
    expect(repoMatchesPattern('*/frontend', 'acme', 'frontend')).toBe(true);
    expect(repoMatchesPattern('*/frontend', 'other', 'frontend')).toBe(true);
  });

  test('"*/repo" does not match a different repo', () => {
    expect(repoMatchesPattern('*/frontend', 'acme', 'backend')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// resolveActiveFeatures
// ---------------------------------------------------------------------------

describe('resolveActiveFeatures', () => {
  const featureA = { id: 'feature-a', check: jest.fn() };
  const featureB = { id: 'feature-b', check: jest.fn() };
  const allFeatures = [featureA, featureB];

  test('returns features listed in the matching rule', () => {
    const config = { rules: [{ repo: '*', features: ['feature-a'] }] };
    const result = resolveActiveFeatures(config, allFeatures, '/acme/frontend/pull/1');
    expect(result).toEqual([featureA]);
  });

  test('returns multiple features when rule lists several', () => {
    const config = { rules: [{ repo: '*', features: ['feature-a', 'feature-b'] }] };
    const result = resolveActiveFeatures(config, allFeatures, '/acme/frontend/pull/1');
    expect(result).toEqual([featureA, featureB]);
  });

  test('first matching rule wins', () => {
    const config = {
      rules: [
        { repo: 'acme/frontend', features: ['feature-b'] },
        { repo: '*',             features: ['feature-a'] },
      ],
    };
    const result = resolveActiveFeatures(config, allFeatures, '/acme/frontend/pull/1');
    expect(result).toEqual([featureB]);
  });

  test('returns empty array when no rule matches', () => {
    const config = { rules: [{ repo: 'acme/frontend', features: ['feature-a'] }] };
    const result = resolveActiveFeatures(config, allFeatures, '/other/repo/pull/1');
    expect(result).toEqual([]);
  });

  test('returns empty array for a non-PR path', () => {
    const config = { rules: [{ repo: '*', features: ['feature-a'] }] };
    const result = resolveActiveFeatures(config, allFeatures, '/acme/frontend');
    expect(result).toEqual([]);
  });

  test('features not listed in the rule are excluded', () => {
    const config = { rules: [{ repo: '*', features: ['feature-a'] }] };
    const result = resolveActiveFeatures(config, allFeatures, '/acme/frontend/pull/1');
    expect(result).not.toContain(featureB);
  });

  test('returns empty array when matched rule lists no features', () => {
    const config = { rules: [{ repo: '*', features: [] }] };
    const result = resolveActiveFeatures(config, allFeatures, '/acme/frontend/pull/1');
    expect(result).toEqual([]);
  });

  test('unknown feature ids in rule are silently ignored', () => {
    const config = { rules: [{ repo: '*', features: ['feature-a', 'nonexistent'] }] };
    const result = resolveActiveFeatures(config, allFeatures, '/acme/frontend/pull/1');
    expect(result).toEqual([featureA]);
  });

  test('extracts owner and repo correctly from pathname', () => {
    const config = { rules: [{ repo: 'myorg/myrepo', features: ['feature-a'] }] };
    const result = resolveActiveFeatures(config, allFeatures, '/myorg/myrepo/pull/42');
    expect(result).toEqual([featureA]);
  });
});
