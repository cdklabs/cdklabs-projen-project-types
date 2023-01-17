import { Stability } from 'projen/lib/cdk';
import { Testing } from 'projen/lib/testing';
import { expectPrivate, expectNotPrivate } from './private-helpers';
import { CdkConstructLibrary, CdkConstructLibraryOptions, CdkTypeScriptProject, CdkTypeScriptProjectOptions } from '../src/cdk';

describe('CdkConstructLibrary', () => {
  test('synthesizes with default settings', () => {
    const project = new TestCdkConstructLibrary();

    const outdir = Testing.synth(project);

    // defaults to private
    expectPrivate(outdir);

    // defaults to experimental
    expect(outdir['package.json'].stability).toEqual('experimental');

    expect(outdir).toMatchSnapshot();
  });

  test('can be set to public', () => {
    const project = new TestCdkConstructLibrary({ private: false });

    expectNotPrivate(Testing.synth(project));
  });

  describe('when stable,', () => {
    test('throws when publishing not set', () => {
      expect(() => {
        new TestCdkConstructLibrary({
          stability: Stability.STABLE,
        });
      }).toThrowError([
        'The project does not pass stability requirements due to the following errors:',
        '  Publishing Error: project not configured to publish to Python',
        '  Publishing Error: project not configured to publish to Maven',
        '  Publishing Error: project not configured to publish to Nuget',
        '  Publishing Error: project not configured to publish to Go',
      ].join('\n'));
    });

    test('thorws when a publishing to a subset of languages', () => {

    });
  });
});

describe('CdkTypeScriptProject', () => {
  test('synthesizes with default settings', () => {
    const project = new TestCdkTypeScriptProject();

    expect(Testing.synth(project)).toMatchSnapshot();
  });

  test('defaults to private', () => {
    const project = new TestCdkTypeScriptProject();

    expectPrivate(Testing.synth(project));
  });

  test('can be set to public', () => {
    const project = new TestCdkTypeScriptProject({ private: false });

    expectNotPrivate(Testing.synth(project));
  });
});

class TestCdkConstructLibrary extends CdkConstructLibrary {
  constructor(options: Partial<CdkConstructLibraryOptions> = {}) {
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

class TestCdkTypeScriptProject extends CdkTypeScriptProject {
  constructor(options: Partial<CdkTypeScriptProjectOptions> = {}) {
    super({
      name: 'test-node-project',
      defaultReleaseBranch: 'main',
      ...options,
    });
  }
}
