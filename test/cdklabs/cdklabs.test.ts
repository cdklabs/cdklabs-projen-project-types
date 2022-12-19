import { Testing } from 'projen';
import * as YAML from 'yaml';
import { CdklabsConstructLibrary, CdklabsConstructLibraryOptions, CdklabsTypeScriptProject, CdklabsTypeScriptProjectOptions } from '../../src/cdklabs/cdklabs';

describe('CdklabsConstructLibrary', () => {
  test('synthesizes with default settings', () => {
    const project = new TestCdkLabsConstructLibrary();

    const outdir = Testing.synth(project);
    const packageJson = outdir['package.json'];

    // org name
    expect(packageJson.author).toEqual({
      name: 'Amazon Web Services',
      email: 'aws-cdk-dev@amazon.com',
      organization: true,
    });

    // auto approve
    expect(
      YAML.parse(outdir['.github/workflows/auto-approve.yml']).jobs.approve.if.includes('cdklabs-automation'),
    ).toBeTruthy();

    // default main release branch
    expect(
      YAML.parse(outdir['.github/workflows/release.yml']).on.push.branches[0],
    ).toEqual('main');

    // min node version
    expect(packageJson.engines).toEqual({
      node: '>= 14.17.0',
    });

    // jest options
    expect(
      outdir['.projen/tasks.json'].tasks.test.steps[0].exec.includes('--updateSnapshot'),
    ).toBeFalsy();

    expect(outdir).toMatchSnapshot();
  });
});

describe('CdklabsTypeScriptProject', () => {
  test('synthesizes with default settings', () => {
    const project = new TestCdkLabsTypeScriptProject();

    const outdir = Testing.synth(project);
    const packageJson = outdir['package.json'];

    // org name
    expect(packageJson.author).toEqual({
      name: 'Amazon Web Services',
      email: 'aws-cdk-dev@amazon.com',
      organization: true,
    });

    // auto approve
    expect(
      YAML.parse(outdir['.github/workflows/auto-approve.yml']).jobs.approve.if.includes('cdklabs-automation'),
    ).toBeTruthy();

    // default main release branch
    expect(
      YAML.parse(outdir['.github/workflows/release.yml']).on.push.branches[0],
    ).toEqual('main');

    // min node version
    expect(packageJson.engines).toEqual({
      node: '>= 14.17.0',
    });

    // jest options
    expect(
      outdir['.projen/tasks.json'].tasks.test.steps[0].exec.includes('--updateSnapshot'),
    ).toBeFalsy();

    expect(outdir).toMatchSnapshot();
  });
});

class TestCdkLabsConstructLibrary extends CdklabsConstructLibrary {
  constructor(options: Partial<CdklabsConstructLibraryOptions> = {}) {
    super({
      name: 'test-construct-library',
      defaultReleaseBranch: 'main',
      repositoryUrl: 'url',
      author: 'AWS',
      authorAddress: 'aws-cdk-dev@amazon.com',
      cdkVersion: '2.1.0',
      ...options,
    });
  }
}

class TestCdkLabsTypeScriptProject extends CdklabsTypeScriptProject {
  constructor(options: Partial<CdklabsTypeScriptProjectOptions> = {}) {
    super({
      name: 'test-node-project',
      defaultReleaseBranch: 'main',
      ...options,
    });
  }
}