import { Testing } from 'projen/lib/testing';
import { yarn } from '../src';

describe('WorkspaceJsiiBuild', () => {
  let parent: yarn.CdkLabsMonorepo;
  beforeEach(() => {
    parent = new yarn.CdkLabsMonorepo({
      name: 'monorepo',
      defaultReleaseBranch: 'main',
    });
  });

  test('applies upstream JsiiBuild mixin to a workspace', () => {
    const ws = new yarn.TypeScriptWorkspace({
      parent,
      name: '@cdklabs/my-lib',
      disableTsconfig: true,
    });

    ws.with(new yarn.WorkspaceJsiiBuild({
      publishToMaven: {
        javaPackage: 'io.github.cdklabs.mylib',
        mavenGroupId: 'io.github.cdklabs',
        mavenArtifactId: 'my-lib',
      },
    }));

    const outdir = Testing.synth(parent);
    const pkgJson = outdir['packages/@cdklabs/my-lib/package.json'];

    expect(pkgJson.jsii).toBeDefined();
    expect(pkgJson.jsii.targets.java).toEqual({
      package: 'io.github.cdklabs.mylib',
      maven: {
        groupId: 'io.github.cdklabs',
        artifactId: 'my-lib',
      },
    });
  });

  test('configures all language targets', () => {
    const ws = new yarn.TypeScriptWorkspace({
      parent,
      name: '@cdklabs/my-lib',
      disableTsconfig: true,
    });

    ws.with(new yarn.WorkspaceJsiiBuild({
      publishToMaven: {
        javaPackage: 'io.github.cdklabs.mylib',
        mavenGroupId: 'io.github.cdklabs',
        mavenArtifactId: 'my-lib',
      },
      publishToPypi: {
        distName: 'cdklabs.my-lib',
        module: 'cdklabs.my_lib',
      },
      publishToNuget: {
        dotNetNamespace: 'Cdklabs.MyLib',
        packageId: 'Cdklabs.MyLib',
      },
      publishToGo: {
        moduleName: 'github.com/cdklabs/my-lib-go',
      },
    }));

    const outdir = Testing.synth(parent);
    const pkgJson = outdir['packages/@cdklabs/my-lib/package.json'];

    expect(pkgJson.jsii.targets.java).toBeDefined();
    expect(pkgJson.jsii.targets.python).toEqual({ distName: 'cdklabs.my-lib', module: 'cdklabs.my_lib' });
    expect(pkgJson.jsii.targets.dotnet).toEqual({ namespace: 'Cdklabs.MyLib', packageId: 'Cdklabs.MyLib' });
    expect(pkgJson.jsii.targets.go).toEqual({ moduleName: 'github.com/cdklabs/my-lib-go' });
  });

  test('creates packaging tasks for each target', () => {
    const ws = new yarn.TypeScriptWorkspace({
      parent,
      name: '@cdklabs/my-lib',
      disableTsconfig: true,
    });

    ws.with(new yarn.WorkspaceJsiiBuild({
      publishToMaven: {
        javaPackage: 'io.github.cdklabs.mylib',
        mavenGroupId: 'io.github.cdklabs',
        mavenArtifactId: 'my-lib',
      },
      publishToPypi: {
        distName: 'cdklabs.my-lib',
        module: 'cdklabs.my_lib',
      },
    }));

    const outdir = Testing.synth(parent);
    const tasks = outdir['packages/@cdklabs/my-lib/.projen/tasks.json'];

    expect(tasks.tasks['package:js']).toBeDefined();
    expect(tasks.tasks['package:java']).toBeDefined();
    expect(tasks.tasks['package:python']).toBeDefined();
    expect(tasks.tasks['package-all']).toBeDefined();
  });

  test('registers publish targets with monorepo release publisher', () => {
    const relParent = new yarn.CdkLabsMonorepo({
      name: 'monorepo',
      defaultReleaseBranch: 'main',
      release: true,
      npmTrustedPublishing: true,
    });

    const ws = new yarn.TypeScriptWorkspace({
      parent: relParent,
      name: '@cdklabs/my-lib',
      disableTsconfig: true,
      npmTrustedPublishing: true,
    });

    ws.with(new yarn.WorkspaceJsiiBuild({
      publishToMaven: {
        javaPackage: 'io.github.cdklabs.mylib',
        mavenGroupId: 'io.github.cdklabs',
        mavenArtifactId: 'my-lib',
      },
    }));

    const wsRelease = relParent.monorepoRelease!.workspaceRelease(ws);
    // Publisher should have maven publish job registered
    expect((wsRelease.publisher as any).publishJobs).toHaveProperty('maven');
  });

  test('does not add npm release (handled by MonorepoRelease)', () => {
    const relParent = new yarn.CdkLabsMonorepo({
      name: 'monorepo',
      defaultReleaseBranch: 'main',
      release: true,
      npmTrustedPublishing: true,
    });

    const ws = new yarn.TypeScriptWorkspace({
      parent: relParent,
      name: '@cdklabs/my-lib',
      disableTsconfig: true,
      npmTrustedPublishing: true,
    });

    ws.with(new yarn.WorkspaceJsiiBuild());

    const wsRelease = relParent.monorepoRelease!.workspaceRelease(ws);
    const jobs = (wsRelease.publisher as any).publishJobs;
    // npm is already handled by MonorepoRelease, JsiiBuild should not add a second one
    const npmJobs = Object.keys(jobs).filter((k: string) => k.includes('npm'));
    expect(npmJobs.length).toBeLessThanOrEqual(1);
  });

  test('sets compile task to jsii', () => {
    const ws = new yarn.TypeScriptWorkspace({
      parent,
      name: '@cdklabs/my-lib',
      disableTsconfig: true,
    });

    ws.with(new yarn.WorkspaceJsiiBuild());

    const outdir = Testing.synth(parent);
    const tasks = outdir['packages/@cdklabs/my-lib/.projen/tasks.json'];

    expect(tasks.tasks.compile.steps[0].exec).toContain('jsii');
  });

  test('adds compat task', () => {
    const ws = new yarn.TypeScriptWorkspace({
      parent,
      name: '@cdklabs/my-lib',
      disableTsconfig: true,
    });

    ws.with(new yarn.WorkspaceJsiiBuild({ compat: true }));

    const outdir = Testing.synth(parent);
    const tasks = outdir['packages/@cdklabs/my-lib/.projen/tasks.json'];

    expect(tasks.tasks.compat).toBeDefined();
    expect(tasks.tasks.compat.steps[0].exec).toContain('jsii-diff');
  });

  test('adds rosetta in strict mode by default', () => {
    const ws = new yarn.TypeScriptWorkspace({
      parent,
      name: '@cdklabs/my-lib',
      disableTsconfig: true,
    });

    ws.with(new yarn.WorkspaceJsiiBuild());

    const outdir = Testing.synth(parent);
    const tasks = outdir['packages/@cdklabs/my-lib/.projen/tasks.json'];

    expect(tasks.tasks['rosetta:extract']).toBeDefined();
    expect(tasks.tasks['rosetta:extract'].steps[0].exec).toContain('--strict');
  });

  test('composite adds projectReferences', () => {
    const ws = new yarn.TypeScriptWorkspace({
      parent,
      name: '@cdklabs/my-lib',
      disableTsconfig: true,
    });

    ws.with(new yarn.WorkspaceJsiiBuild({ composite: true }));

    const outdir = Testing.synth(parent);
    const pkgJson = outdir['packages/@cdklabs/my-lib/package.json'];

    expect(pkgJson.jsii.projectReferences).toBe(true);
  });

  test('passes workspaceDirectory to upstream mixin', () => {
    const ws = new yarn.TypeScriptWorkspace({
      parent,
      name: '@cdklabs/my-lib',
      disableTsconfig: true,
    });

    ws.with(new yarn.WorkspaceJsiiBuild());

    // workspaceDirectory should be set on the workspace
    expect(ws.workspaceDirectory).toBe('packages/@cdklabs/my-lib');
  });

  test('adds pypiClassifiers to jsii targets', () => {
    const ws = new yarn.TypeScriptWorkspace({
      parent,
      name: '@cdklabs/my-lib',
      disableTsconfig: true,
    });

    ws.with(new yarn.WorkspaceJsiiBuild({
      publishToPypi: {
        distName: 'cdklabs.my-lib',
        module: 'cdklabs.my_lib',
      },
      pypiClassifiers: [
        'Framework :: AWS CDK',
        'Framework :: AWS CDK :: 2',
      ],
    }));

    const outdir = Testing.synth(parent);
    const pkgJson = outdir['packages/@cdklabs/my-lib/package.json'];

    expect(pkgJson.jsii.targets.python.classifiers).toEqual([
      'Framework :: AWS CDK',
      'Framework :: AWS CDK :: 2',
    ]);
  });

  test('supports() returns true for TypeScriptWorkspace', () => {
    const mixin = new yarn.WorkspaceJsiiBuild();
    const ws = new yarn.TypeScriptWorkspace({
      parent,
      name: '@cdklabs/my-lib',
      disableTsconfig: true,
    });

    expect(mixin.supports(ws)).toBe(true);
  });

  test('supports() returns false for non-workspace', () => {
    const mixin = new yarn.WorkspaceJsiiBuild();
    expect(mixin.supports(parent)).toBe(false);
  });
});
