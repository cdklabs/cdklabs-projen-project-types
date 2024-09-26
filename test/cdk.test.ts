import { Stability } from 'projen/lib/cdk';
import { NpmAccess } from 'projen/lib/javascript';
import { Testing } from 'projen/lib/testing';
import { expectPrivate, expectNotPrivate } from './private-helpers';
import { CdkConstructLibrary, CdkConstructLibraryOptions, CdkJsiiProjectOptions, CdkTypeScriptProject, CdkTypeScriptProjectOptions, CdkJsiiProject } from '../src';

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
    const project = new TestCdkConstructLibrary({
      // use scoped package name here to test public publish config
      name: '@aws-cdk/test-construct-library',
      private: false,
    });

    const snapshot = Testing.synth(project);

    expectNotPrivate(snapshot);
    expect(snapshot['package.json'].publishConfig).toMatchObject({
      access: 'public',
    });
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

    test('throws when a publishing to a subset of languages', () => {
      expect(() => {
        new TestCdkConstructLibrary({
          stability: Stability.STABLE,
          publishToPypi: {
            distName: 'distName',
            module: 'module',
          },
          publishToMaven: {
            javaPackage: 'javaPackage',
            mavenArtifactId: 'mavenArtifactId',
            mavenGroupId: 'mavenGroupId',
          },
          publishToNuget: {
            dotNetNamespace: 'dotNetNamespace',
            packageId: 'packageId',
          },
        });
      }).toThrowError([
        'The project does not pass stability requirements due to the following errors:',
        '  Publishing Error: project not configured to publish to Go',
      ].join('\n'));
    });
  });
});

describe('CdkTypeScriptProject', () => {
  test('synthesizes with default settings', () => {
    const project = new TestCdkTypeScriptProject();

    const snapshot = Testing.synth(project);
    expect(snapshot['package.json'].repository.url).toBe('https://github.com/cdklabs/test-node-project.git');
    expect(snapshot).toMatchSnapshot();
  });

  test('defaults to private', () => {
    const project = new TestCdkTypeScriptProject();

    expectPrivate(Testing.synth(project));
  });

  test('can be set to public', () => {
    const project = new TestCdkTypeScriptProject({
      // use scoped package name here to test public publish config
      name: '@aws-cdk/test-construct-library',
      private: false,
    });

    const snapshot = Testing.synth(project);

    expectNotPrivate(snapshot);
    expect(snapshot['package.json'].repository.url).toBe('https://github.com/aws/test-construct-library.git');
    expect(snapshot['package.json'].publishConfig).toMatchObject({
      access: 'public',
    });
  });

  test('can set a custom repository on ts project', () => {
    const project = new TestCdkTypeScriptProject({
      repository: 'https://github.com/aws-samples/aws-cdk-examples.git',
    });

    const snapshot = Testing.synth(project);
    expect(snapshot['package.json'].repository.url).toBe('https://github.com/aws-samples/aws-cdk-examples.git');
  });

  test('can set a custom repositoryUrl on construct lib project', () => {
    const project = new TestCdkConstructLibrary({
      repositoryUrl: 'https://github.com/aws-samples/aws-cdk-examples.git',
    });

    const snapshot = Testing.synth(project);
    expect(snapshot['package.json'].repository.url).toBe('https://github.com/aws-samples/aws-cdk-examples.git');
  });

  test('can set npm access', () => {
    const project = new TestCdkConstructLibrary({
      npmAccess: NpmAccess.PUBLIC,
    });

    const snapshot = Testing.synth(project);
    expect(snapshot['package.json'].publishConfig.access).toEqual('public');
  });

});

describe('CdkJsiiProject', () => {
  test('synthesizes with default settings', () => {
    const project = new TestCdkJsiiProject();

    expect(Testing.synth(project)).toMatchSnapshot();
  });

  test('defaults to private', () => {
    const project = new TestCdkJsiiProject();

    expectPrivate(Testing.synth(project));
  });

  test('can be set to public', () => {
    const project = new TestCdkJsiiProject({
      // use scoped package name here to test public publish config
      name: '@aws-cdk/test-construct-library',
      private: false,
    });

    const snapshot = Testing.synth(project);

    expectNotPrivate(snapshot);
    expect(snapshot['package.json'].publishConfig).toMatchObject({
      access: 'public',
    });
  });
});

class TestCdkConstructLibrary extends CdkConstructLibrary {
  constructor(options: Partial<CdkConstructLibraryOptions> = {}) {
    super({
      name: '@cdklabs/test-construct-library',
      defaultReleaseBranch: 'main',
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
      name: '@cdklabs/test-node-project',
      defaultReleaseBranch: 'main',
      ...options,
    });
  }
}

class TestCdkJsiiProject extends CdkJsiiProject {
  constructor(options: Partial<CdkJsiiProjectOptions> = {}) {
    super({
      name: '@cdklabs/test-jsii-library',
      defaultReleaseBranch: 'main',
      author: 'AWS',
      authorAddress: 'aws-cdk-dev@amazon.com',
      ...options,
    });
  }
}
