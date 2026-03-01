// PR Guardian Configuration
//
// Rules are evaluated top-to-bottom; the first matching rule wins.
//
// Repo patterns:
//   'owner/repo'  — exact match
//   'owner/*'     — all repos for a given owner
//   '*'           — all repos (catch-all)
//
// Available features: 'multi-commit', 'version-bump'

window.PRGuardianConfig = {
  rules: [
    { repo: '*', features: ['multi-commit'] },
  ],
};

if (typeof module !== 'undefined') {
  module.exports = window.PRGuardianConfig;
}
