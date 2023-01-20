import { Testing } from 'projen';
import { Stability } from 'projen/lib/cdk';
import * as YAML from 'yaml';
import { CdklabsConstructLibrary, CdklabsConstructLibraryOptions, CdklabsTypeScriptProject, CdklabsTypeScriptProjectOptions, JsiiLanguage } from '../src/cdklabs';

const publishingTargets = {
  java: {
    package: 'io.github.cdklabs.test.construct.library',
    maven: {
      groupId: 'io.github.cdklabs',
      artifactId: 'test-construct-library',
    },
  },
  python: {
    distName: 'test-construct-library',
    module: 'test_construct_library',
  },
  dotnet: {
    namespace: 'CdklabsTestConstructLibrary',
    packageId: 'CdklabsTestConstructLibrary',
  },
  go: {
    moduleName: 'github.com/cdklabs/test-construct-library-go',
  },
};

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
      node: '>= 14.18.0',
    });

    // jest options
    expect(
      outdir['.projen/tasks.json'].tasks.test.steps[0].exec.includes('--updateSnapshot'),
    ).toBeFalsy();

    expect(outdir).toMatchSnapshot();
  });

  describe('cdklabsPublishingDefaults', () => {
    test('created by default', () => {
      const project = new TestCdkLabsConstructLibrary();
      const outdir = Testing.synth(project);
      const packageJson = outdir['package.json'];

      // jsii publishing
      expect(packageJson.jsii?.targets).toEqual(publishingTargets);
    });

    describe('limiting publishing to a subset of languages', () => {
      test('can be done in experimental modules', () => {
        const project = new TestCdkLabsConstructLibrary({
          stability: Stability.EXPERIMENTAL,
          jsiiTargetLanguages: [JsiiLanguage.JAVA, JsiiLanguage.PYTHON],
        });
        const outdir = Testing.synth(project);
        const packageJson = outdir['package.json'];

        // jsii publishing
        expect(packageJson.jsii?.targets).toEqual({
          ...{ java: publishingTargets.java },
          ...{ python: publishingTargets.python },
        });
      });

      test('throws if done in stable modules', () => {
        expect(() => {
          new TestCdkLabsConstructLibrary({
            stability: Stability.STABLE,
            jsiiTargetLanguages: [JsiiLanguage.JAVA, JsiiLanguage.PYTHON],
          });
        }).toThrowError([
          'The project does not pass stability requirements due to the following errors:',
          '  Publishing Error: project not configured to publish to Nuget',
          '  Publishing Error: project not configured to publish to Go',
        ].join('\n'));
      });

      test('does not throw if custom publishing set', () => {
        expect(() => {
          new TestCdkLabsConstructLibrary({
            stability: Stability.STABLE,
            jsiiTargetLanguages: [JsiiLanguage.JAVA, JsiiLanguage.PYTHON],
            publishToNuget: {
              dotNetNamespace: 'custom-namespace',
              packageId: 'custom-package',
            },
            publishToGo: {
              moduleName: 'github.com/custom-name',
            },
          });
        }).not.toThrow();
      });

      test('ignored if cdklabsPublishingDefaults is false', () => {
        const project = new TestCdkLabsConstructLibrary({
          cdklabsPublishingDefaults: false,
          jsiiTargetLanguages: [JsiiLanguage.JAVA, JsiiLanguage.PYTHON],
        });
        const outdir = Testing.synth(project);
        const packageJson = outdir['package.json'];

        // jsii publishing
        expect(packageJson.jsii?.targets).toEqual({});
      });
    });
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
      node: '>= 14.18.0',
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
