import { Testing } from 'projen/lib/testing';
import * as YAML from 'yaml';
import { yarn } from '../src';

describe('CdkLabsMonorepo', () => {
  test('synthesizes with default settings', () => {
    const parent = new yarn.CdkLabsMonorepo({
      name: 'monorepo',
      defaultReleaseBranch: 'main',
    });

    new yarn.TypeScriptWorkspace({
      parent,
      name: '@cdklabs/one',
    });

    new yarn.TypeScriptWorkspace({
      parent,
      name: '@cdklabs/two',
    });

    const outdir = Testing.synth(parent);

    expect(outdir).toMatchSnapshot();
  });

  test('bundled dependencies lead to a nohoist directive', () => {
    // GIVEN
    const parent = new yarn.CdkLabsMonorepo({
      name: 'monorepo',
      defaultReleaseBranch: 'main',
    });

    new yarn.TypeScriptWorkspace({
      parent,
      name: '@cdklabs/one',
      // WHEN
      bundledDeps: ['jsonschema'],
    });

    // THEN
    const outdir = Testing.synth(parent);

    expect(outdir['package.json']).toEqual(expect.objectContaining({
      workspaces: expect.objectContaining({
        nohoist: [
          '@cdklabs/one/jsonschema',
          '@cdklabs/one/jsonschema/**',
        ],
      })
    }));
  });

  test('workspaces get monorepo repository configuration', () => {
    const testRepository = 'https://github.com/cdklabs/cdklabs-projen-project-types';
    const parent = new yarn.CdkLabsMonorepo({
      name: 'monorepo',
      defaultReleaseBranch: 'main',
      repository: testRepository,
    });

    const workspace = new yarn.TypeScriptWorkspace({
      parent,
      name: '@cdklabs/one',
      workspaceScope: 'packages',
    });

    const repository = workspace.package.manifest.repository;
    expect(repository.url).toBe(testRepository);
    expect(repository.directory).toBe('packages/@cdklabs/one');

    const outdir = Testing.synth(parent);
    expect(outdir).toMatchSnapshot();
  });

  test('nx integration', () => {
    const parent = new yarn.CdkLabsMonorepo({
      name: 'monorepo',
      defaultReleaseBranch: 'main',
      nx: true,
    });

    new yarn.TypeScriptWorkspace({
      parent,
      name: '@cdklabs/one',
    });

    new yarn.TypeScriptWorkspace({
      parent,
      name: '@cdklabs/two',
    });

    const outdir = Testing.synth(parent);
    expect(outdir['nx.json']).toMatchSnapshot();
    expect(outdir['.gitignore']).toContain('/.nx');
    expect(outdir['.npmignore']).toContain('/.nx');
  });

  describe('with monorepo that releases', () => {
    let parent: yarn.CdkLabsMonorepo;
    beforeEach(() => {
      parent = new yarn.CdkLabsMonorepo({
        name: 'monorepo',
        defaultReleaseBranch: 'main',
        release: true,
      });
    });

    test('monorepo release', () => {
      new yarn.TypeScriptWorkspace({
        parent,
        name: '@cdklabs/one',
      });

      new yarn.TypeScriptWorkspace({
        parent,
        name: '@cdklabs/two',
      });

      const outdir = Testing.synth(parent);
      const releaseWorkflow = YAML.parse(outdir['.github/workflows/release.yml']);

      expect(releaseWorkflow.jobs['cdklabs-one_release_github'].needs).toStrictEqual(['release', 'cdklabs-one_release_npm']);
      expect(outdir).toMatchSnapshot();
    });

    test('monorepo release with nextVersionCommand', () => {
      new yarn.TypeScriptWorkspace({
        parent,
        name: '@cdklabs/one',
        nextVersionCommand: 'asdf',
      });

      const outdir = Testing.synth(parent);
      const tasks = outdir['packages/@cdklabs/one/.projen/tasks.json'];

      expect(tasks.tasks.bump.env.NEXT_VERSION_COMMAND).toStrictEqual('asdf');
    });

    test('minMajorVersion is respected', () => {
      new yarn.TypeScriptWorkspace({
        parent,
        name: '@cdklabs/one',
        minMajorVersion: 3,
      });

      const outdir = Testing.synth(parent);
      const tasks = outdir['packages/@cdklabs/one/.projen/tasks.json'];
      expect(tasks.tasks.bump.env).toEqual(expect.objectContaining({
        MIN_MAJOR: '3',
      }));
    });
  });
});
