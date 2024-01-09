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
      name: 'monorepo/one',
    });

    new yarn.TypeScriptWorkspace({
      parent,
      name: 'monorepo/two',
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
      name: 'monorepo/one',
      workspaceScope: 'packages',
    });

    const repository = workspace.package.manifest.repository;
    expect(repository.url).toBe(testRepository);
    expect(repository.directory).toBe('packages/monorepo/one');

    const outdir = Testing.synth(parent);
    expect(outdir).toMatchSnapshot();
  });
});
