import { DependencyType } from 'projen';
import { Testing } from 'projen/lib/testing';
import { yarn } from '../src';

describe('addWorkspaceDep', () => {
  let parent: yarn.CdkLabsMonorepo;
  beforeEach(() => {
    parent = new yarn.CdkLabsMonorepo({
      name: 'monorepo',
      defaultReleaseBranch: 'main',
    });
  });

  test('adds a runtime dependency and tsconfig reference', () => {
    const dep = new yarn.TypeScriptWorkspace({ parent, name: '@scope/dep' });
    const consumer = new yarn.TypeScriptWorkspace({ parent, name: '@scope/consumer' });

    consumer.addWorkspaceDep(dep);

    const outdir = Testing.synth(parent);
    const deps = outdir['packages/@scope/consumer/.projen/deps.json'];
    expect(deps.dependencies).toContainEqual(expect.objectContaining({ name: '@scope/dep', type: 'runtime' }));

    const tsconfig = outdir['packages/@scope/consumer/tsconfig.json'];
    expect(tsconfig.references).toContainEqual({ path: '../dep' });
  });

  test('adds a dev dependency and tsconfig reference', () => {
    const dep = new yarn.TypeScriptWorkspace({ parent, name: '@scope/dep', private: true });
    const consumer = new yarn.TypeScriptWorkspace({ parent, name: '@scope/consumer' });

    consumer.addWorkspaceDep(dep, DependencyType.BUILD);

    const outdir = Testing.synth(parent);
    const deps = outdir['packages/@scope/consumer/.projen/deps.json'];
    expect(deps.dependencies).toContainEqual(expect.objectContaining({ name: '@scope/dep', type: 'build' }));

    const tsconfig = outdir['packages/@scope/consumer/tsconfig.json'];
    expect(tsconfig.references).toContainEqual({ path: '../dep' });
  });

  test('adds a peer dependency and tsconfig reference', () => {
    const dep = new yarn.TypeScriptWorkspace({ parent, name: '@scope/dep' });
    const consumer = new yarn.TypeScriptWorkspace({ parent, name: '@scope/consumer' });

    consumer.addWorkspaceDep(dep, DependencyType.PEER);

    const outdir = Testing.synth(parent);
    const deps = outdir['packages/@scope/consumer/.projen/deps.json'];
    expect(deps.dependencies).toContainEqual(expect.objectContaining({ name: '@scope/dep', type: 'peer' }));

    const tsconfig = outdir['packages/@scope/consumer/tsconfig.json'];
    expect(tsconfig.references).toContainEqual({ path: '../dep' });
  });

  test('is a no-op if dependency already exists', () => {
    const dep = new yarn.TypeScriptWorkspace({ parent, name: '@scope/dep' });
    const consumer = new yarn.TypeScriptWorkspace({ parent, name: '@scope/consumer', deps: [dep] });

    // Should not throw or duplicate
    consumer.addWorkspaceDep(dep);

    const outdir = Testing.synth(parent);
    const deps = outdir['packages/@scope/consumer/.projen/deps.json'];
    const matches = deps.dependencies.filter((d: any) => d.name === '@scope/dep');
    expect(matches).toHaveLength(1);
  });

  test('appends to existing references from constructor deps', () => {
    const dep1 = new yarn.TypeScriptWorkspace({ parent, name: '@scope/dep1' });
    const dep2 = new yarn.TypeScriptWorkspace({ parent, name: '@scope/dep2' });
    const consumer = new yarn.TypeScriptWorkspace({ parent, name: '@scope/consumer', deps: [dep1] });

    consumer.addWorkspaceDep(dep2);

    const outdir = Testing.synth(parent);
    const tsconfig = outdir['packages/@scope/consumer/tsconfig.json'];
    expect(tsconfig.references).toContainEqual({ path: '../dep1' });
    expect(tsconfig.references).toContainEqual({ path: '../dep2' });
  });

  test('preSynthesize catches private dep added via addWorkspaceDep', () => {
    const dep = new yarn.TypeScriptWorkspace({ parent, name: '@scope/dep', private: true });
    const consumer = new yarn.TypeScriptWorkspace({ parent, name: '@scope/consumer' });

    consumer.addWorkspaceDep(dep);

    expect(() => Testing.synth(parent)).toThrow(/cannot depend on private workspace packages/);
  });

  test('allowPrivateDeps suppresses error for runtime deps', () => {
    const dep = new yarn.TypeScriptWorkspace({ parent, name: '@scope/dep', private: true });
    const consumer = new yarn.TypeScriptWorkspace({ parent, name: '@scope/consumer', allowPrivateDeps: true });

    consumer.addWorkspaceDep(dep, DependencyType.RUNTIME);

    // Should not throw
    expect(() => Testing.synth(parent)).not.toThrow();
  });

  test('allowPrivateDeps does not suppress error for peer deps', () => {
    const dep = new yarn.TypeScriptWorkspace({ parent, name: '@scope/dep', private: true });
    const consumer = new yarn.TypeScriptWorkspace({ parent, name: '@scope/consumer', allowPrivateDeps: true });

    consumer.addWorkspaceDep(dep, DependencyType.PEER);

    expect(() => Testing.synth(parent)).toThrow(/cannot depend on private workspace packages/);
  });

  test('lazily added dep is excluded from upgrade task', () => {
    const dep = new yarn.TypeScriptWorkspace({ parent, name: '@scope/dep' });
    const consumer = new yarn.TypeScriptWorkspace({ parent, name: '@scope/consumer' });

    consumer.addWorkspaceDep(dep);

    const outdir = Testing.synth(parent);
    const tasks = outdir['packages/@scope/consumer/.projen/tasks.json'];
    const checkForUpdates = tasks.tasks['check-for-updates'];
    const ncu = checkForUpdates.steps.find((s: any) => s.exec?.includes('npm-check-updates'));
    // @scope/dep should NOT be in the filter (i.e. it's excluded)
    expect(ncu.exec).not.toContain('@scope/dep');
  });

  test('lazily added runtime dep appears in gather-versions task', () => {
    const relParent = new yarn.CdkLabsMonorepo({
      name: 'monorepo',
      defaultReleaseBranch: 'main',
      release: true,
    });
    const dep = new yarn.TypeScriptWorkspace({ parent: relParent, name: '@scope/dep' });
    const consumer = new yarn.TypeScriptWorkspace({ parent: relParent, name: '@scope/consumer' });

    consumer.addWorkspaceDep(dep, DependencyType.RUNTIME);

    const outdir = Testing.synth(relParent);
    const tasks = outdir['packages/@scope/consumer/.projen/tasks.json'];
    const gatherVersions = tasks.tasks['gather-versions'];
    expect(gatherVersions.steps[0].exec).toContain('@scope/dep=future-minor');
  });

  test('tsconfig reference path is relative to the tsconfig file, not the workspace outdir', () => {
    // When a tsconfig lives in a subdirectory of the workspace, the project
    // reference path must be computed relative to that tsconfig file's own
    // directory, otherwise the relative path is missing a `..` segment.
    const dep = new yarn.TypeScriptWorkspace({ parent, name: '@scope/dep' });
    const consumer = new yarn.TypeScriptWorkspace({
      parent,
      name: '@scope/consumer',
      tsconfigDev: { fileName: 'config/tsconfig.dev.json' },
    });

    consumer.addWorkspaceDep(dep);

    const outdir = Testing.synth(parent);

    // Root tsconfig.json sits at the workspace root -> single `..`
    const tsconfig = outdir['packages/@scope/consumer/tsconfig.json'];
    expect(tsconfig.references).toContainEqual({ path: '../dep' });

    // Dev tsconfig sits one directory deeper -> needs an extra `..`
    const tsconfigDev = outdir['packages/@scope/consumer/config/tsconfig.dev.json'];
    expect(tsconfigDev.references).toContainEqual({ path: '../../dep' });
  });

  test('lazily added dev dep appears as exact in gather-versions', () => {
    const relParent = new yarn.CdkLabsMonorepo({
      name: 'monorepo',
      defaultReleaseBranch: 'main',
      release: true,
    });
    const dep = new yarn.TypeScriptWorkspace({ parent: relParent, name: '@scope/dep', private: true });
    const consumer = new yarn.TypeScriptWorkspace({ parent: relParent, name: '@scope/consumer', allowPrivateDeps: true });

    consumer.addWorkspaceDep(dep, DependencyType.BUILD);

    const outdir = Testing.synth(relParent);
    const tasks = outdir['packages/@scope/consumer/.projen/tasks.json'];
    const gatherVersions = tasks.tasks['gather-versions'];
    expect(gatherVersions.steps[0].exec).toContain('@scope/dep=exact');
  });
});
