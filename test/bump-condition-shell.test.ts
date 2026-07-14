import { Testing } from 'projen/lib/testing';
import { yarn } from '../src';

// The per-package `bump` task keeps projen's `CHANGES_SINCE_LAST_RELEASE`
// condition (`git log --oneline -1 | grep -qv "chore(release):"`). projen
// evaluates that condition with the task's resolved shell (projen
// cli/task-runtime.js:261). Under projen's built-in dax shell the pipe is racy
// and can spuriously skip the task, leaving a 0.0.0 placeholder that dependents
// then publish as a broken `^0.0.0` range. Running the task through the system
// shell evaluates the condition reliably. These tests assert the generated task
// manifests carry the system shell.
describe('bump/release tasks run under the system shell', () => {
  test('a release-enabled workspace bump task keeps the release condition and uses the system shell', () => {
    const parent = new yarn.CdkLabsMonorepo({ name: 'monorepo', defaultReleaseBranch: 'main', release: true });
    new yarn.TypeScriptWorkspace({ parent, name: '@cdklabs/one' });

    const outdir = Testing.synth(parent);
    const bump = outdir['packages/@cdklabs/one/.projen/tasks.json'].tasks.bump;

    // Still gated by the release condition (we did not remove it) ...
    expect(bump.condition).toMatch(/grep -qv "chore\(release\):"/);
    // ... but the condition is now evaluated by the system shell, not dax.
    expect(bump.shell).toEqual('system');
  });

  test('the monorepo root release task uses the system shell', () => {
    const parent = new yarn.CdkLabsMonorepo({ name: 'monorepo', defaultReleaseBranch: 'main', release: true });
    new yarn.TypeScriptWorkspace({ parent, name: '@cdklabs/one' });

    const outdir = Testing.synth(parent);
    const release = outdir['.projen/tasks.json'].tasks.release;

    expect(release.shell).toEqual('system');
  });
});
