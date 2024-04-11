import { Testing } from 'projen/lib/testing';
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

  test('monorepo release', () => {
    const parent = new yarn.CdkLabsMonorepo({
      name: 'monorepo',
      defaultReleaseBranch: 'main',
      release: true,
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
});
