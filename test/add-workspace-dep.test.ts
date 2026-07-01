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

  test('dev tsconfig compiles the library source instead of self-referencing the main project', () => {
    // By default the dev tsconfig lives at `test/tsconfig.json` and extends the main
    // `tsconfig.json` with `composite: true`. To type-check tests against the library
    // *source* (so `@internal` members remain visible under `tsc --build`), the dev tsconfig
    // must NOT reference the main project's `stripInternal`'d declarations. Instead it mirrors
    // the main project's `include`/`exclude` patterns, path-adjusted one directory up.
    const ws = new yarn.TypeScriptWorkspace({ parent, name: '@scope/lib' });

    const outdir = Testing.synth(parent);

    const tsconfigDev = outdir['packages/@scope/lib/test/tsconfig.json'];
    // No self-reference to the main project.
    expect(tsconfigDev.references).not.toContainEqual({ path: '..' });
    // The library source is compiled as part of the test program.
    expect(tsconfigDev.include).toContain('../src/**/*.ts');
    // The main project's non-source excludes (e.g. `node_modules`) are NOT mirrored.
    expect(tsconfigDev.exclude).not.toContain('../node_modules');

    // The main tsconfig must NOT reference itself.
    const tsconfig = outdir['packages/@scope/lib/tsconfig.json'];
    expect(tsconfig.references).toEqual([]);
    void ws;
  });

  test('only source-directory excludes are mirrored into the dev tsconfig', () => {
    const ws = new yarn.TypeScriptWorkspace({ parent, name: '@scope/lib' });
    // A source-targeted exclude must be mirrored: the file is not valid standalone TS and
    // should be kept out of both the library and the test build.
    ws.tsconfig!.addExclude('src/init-templates/**/*.template.ts');
    // A test-targeted exclude must NOT be mirrored: the test build owns the test tree, and the
    // library build only excludes it to keep test files out of the library compilation.
    ws.tsconfig!.addExclude('test/language-tests/**/integ.*.ts');

    const outdir = Testing.synth(parent);

    const tsconfigDev = outdir['packages/@scope/lib/test/tsconfig.json'];
    expect(tsconfigDev.exclude).toContain('../src/init-templates/**/*.template.ts');
    expect(tsconfigDev.exclude).not.toContain('../test/language-tests/**/integ.*.ts');
  });

  test('workspace references are kept while the library source is compiled into the dev tsconfig', () => {
    const dep = new yarn.TypeScriptWorkspace({ parent, name: '@scope/dep' });
    const consumer = new yarn.TypeScriptWorkspace({ parent, name: '@scope/consumer' });

    consumer.addWorkspaceDep(dep, DependencyType.BUILD);

    const outdir = Testing.synth(parent);

    const tsconfigDev = outdir['packages/@scope/consumer/test/tsconfig.json'];
    // No self-reference to the main project ...
    expect(tsconfigDev.references).not.toContainEqual({ path: '..' });
    // ... but the workspace dep reference is preserved.
    expect(tsconfigDev.references).toContainEqual({ path: '../../dep' });
    // ... and the library source is compiled into the test program.
    expect(tsconfigDev.include).toContain('../src/**/*.ts');
  });

  test('co-located dev tsconfig does not mirror the library source', () => {
    // When the dev tsconfig lives next to the main tsconfig (workspace root), there is no
    // project boundary to cross: the library source is already part of its file set, so no
    // path-adjusted include/exclude is added and no self-reference exists.
    const ws = new yarn.TypeScriptWorkspace({
      parent,
      name: '@scope/lib',
      tsconfigDevFile: 'tsconfig.dev.json',
    });

    const outdir = Testing.synth(parent);

    const tsconfigDev = outdir['packages/@scope/lib/tsconfig.dev.json'];
    expect(tsconfigDev.references).not.toContainEqual({ path: '' });
    expect(tsconfigDev.references).not.toContainEqual({ path: '.' });
    expect(tsconfigDev.include).not.toContain('../src/**/*.ts');
    void ws;
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
