import { Testing } from 'projen';
import { Stability } from 'projen/lib/cdk';
import * as YAML from 'yaml';
import { CdklabsConstructLibrary, CdklabsConstructLibraryOptions, CdklabsJsiiProject, CdklabsJsiiProjectOptions, CdklabsTypeScriptProject, CdklabsTypeScriptProjectOptions, JsiiLanguage } from '../src/cdklabs';
import { OrgTenancy } from '../src/common-options';

const publishingTargets = {
  java: {
    package: 'io.github.cdklabs.test.construct.library',
    maven: {
      groupId: 'io.github.cdklabs',
      artifactId: 'test-construct-library',
    },
  },
  python: {
    distName: 'cdklabs.test-construct-library',
    module: 'cdklabs.test_construct_library',
  },
  dotnet: {
    namespace: 'Cdklabs.TestConstructLibrary',
    packageId: 'Cdklabs.TestConstructLibrary',
  },
  go: {
    moduleName: 'github.com/cdklabs/test-construct-library-go',
  },
};

const namespacedPublishingTargets = {
  java: {
    package: 'io.github.cdklabs.test.construct.library',
    maven: {
      groupId: 'io.github.cdklabs',
      artifactId: 'test-construct-library',
    },
  },
  python: {
    distName: 'cdklabs.test-construct-library',
    module: 'cdklabs.test_construct_library',
  },
  dotnet: {
    namespace: 'Cdklabs.TestConstructLibrary',
    packageId: 'Cdklabs.TestConstructLibrary',
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
    expect(
      YAML.parse(outdir['.github/workflows/auto-approve.yml']).jobs.approve.if.includes('dependabot[bot]'),
    ).toBeTruthy();

    // default main release branch
    expect(
      YAML.parse(outdir['.github/workflows/release.yml']).on.push.branches[0],
    ).toEqual('main');

    // upgrade projen
    expect(
      YAML.parse(outdir['.github/workflows/upgrade-cdklabs-projen-project-types-main.yml']).jobs.upgrade.steps,
    ).toEqual(expect.arrayContaining([
      expect.not.objectContaining({
        name: 'Setup Node.js',
        uses: 'actions/setup-node@v3',
      }),
      expect.objectContaining({
        name: 'Install dependencies',
        run: 'yarn install --check-files --frozen-lockfile',
      }),
    ]));

    expect(
      YAML.parse(outdir['.github/workflows/upgrade-cdklabs-projen-project-types-main.yml']).jobs.pr.name,
    ).toEqual('Create Pull Request');

    // min node version
    expect(packageJson.engines).toEqual({
      node: '>= 18.12.0',
    });

    // jest options
    expect(
      outdir['.projen/tasks.json'].tasks.test.steps[0].exec.includes('--updateSnapshot'),
    ).toBeTruthy();

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

    test('works with namespaced package', () => {
      const project = new TestCdkLabsConstructLibrary({
        name: '@cdklabs/test-construct-library',
      });
      const outdir = Testing.synth(project);
      const packageJson = outdir['package.json'];

      // jsii publishing
      expect(packageJson.jsii?.targets).toEqual(namespacedPublishingTargets);
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

    test('sets release environment for every release job', () => {
      const project = new TestCdkLabsConstructLibrary();
      const outdir = Testing.synth(project);
      const releaseWorkflow = outdir['.github/workflows/release.yml'];

      // we have 6 releases: github, npm, python, java, nuget, go
      expect(countOccurrences(releaseWorkflow, 'environment: release')).toBe(6);
    });

    test('enables trusted publishing for supported package registries', () => {
      const project = new TestCdkLabsConstructLibrary();
      const outdir = Testing.synth(project);
      const releaseWorkflow = outdir['.github/workflows/release.yml'];

      // see https://github.com/cdklabs/publib
      expect(releaseWorkflow).toContain('NPM_TRUSTED_PUBLISHER: "true"');
      expect(releaseWorkflow).toContain('PYPI_TRUSTED_PUBLISHER: "true"');
      expect(releaseWorkflow).toContain('NUGET_TRUSTED_PUBLISHER: "true"');
    });
  });

  test('can set tenancy to aws', () => {
    const project = new TestCdkLabsConstructLibrary({
      tenancy: OrgTenancy.AWS,
    });
    const outdir = Testing.synth(project);
    const autoApprove = outdir['.github/workflows/auto-approve.yml'];

    expect(autoApprove).toContain('aws-cdk-automation');
    expect(autoApprove).not.toContain('cdklabs-automation');
    expect(outdir['package.json'].repository.url).toBe('https://github.com/aws/test-construct-library.git');
  });

  test('can set tenancy to cdklabs', () => {
    const project = new TestCdkLabsConstructLibrary({
      tenancy: OrgTenancy.CDKLABS,
    });
    const outdir = Testing.synth(project);
    const autoApprove = outdir['.github/workflows/auto-approve.yml'];

    expect(autoApprove).toContain('cdklabs-automation');
    expect(autoApprove).not.toContain('aws-cdk-automation');
    expect(outdir['package.json'].repository.url).toBe('https://github.com/cdklabs/test-construct-library.git');
  });

  describe('with release=false', () => {
    test('has upgrade-cdklabs-projen-project-types workflow', () => {
      const project = new TestCdkLabsConstructLibrary({
        release: false,
      });
      const outdir = Testing.synth(project);
      const workflow = outdir['.github/workflows/upgrade-cdklabs-projen-project-types.yml'];
      expect(workflow).not.toBeUndefined();
      expect(workflow).toMatchSnapshot();
    });
  });

  test('respects branch configuration with custom upgrade tasks', () => {
    const testBranches = ['branch1/main', 'branch2/main'];

    const project = new TestCdkLabsConstructLibrary({
      depsUpgradeOptions: {
        workflowOptions: {
          branches: testBranches,
        },
      },
    });

    const outdir = Testing.synth(project);
    // Verify upgrade workflows exist in the outdir
    expect(outdir['.github/workflows/upgrade-branch1-main.yml']).toBeDefined();
    expect(outdir['.github/workflows/upgrade-branch2-main.yml']).toBeDefined();
    expect(outdir['.github/workflows/upgrade-dev-deps-branch1-main.yml']).toBeDefined();
    expect(outdir['.github/workflows/upgrade-dev-deps-branch2-main.yml']).toBeDefined();

    // Verify the checkout refs in each workflow
    expect(
      YAML.parse(outdir['.github/workflows/upgrade-branch1-main.yml']).jobs.upgrade.steps
        .find((step: any) => step.uses.startsWith('actions/checkout')).with.ref,
    ).toBe('branch1/main');

    expect(
      YAML.parse(outdir['.github/workflows/upgrade-branch2-main.yml']).jobs.upgrade.steps
        .find((step: any) => step.uses.startsWith('actions/checkout')).with.ref,
    ).toBe('branch2/main');

    expect(
      YAML.parse(outdir['.github/workflows/upgrade-dev-deps-branch1-main.yml']).jobs.upgrade.steps
        .find((step: any) => step.uses.startsWith('actions/checkout')).with.ref,
    ).toBe('branch1/main');

    expect(
      YAML.parse(outdir['.github/workflows/upgrade-dev-deps-branch2-main.yml']).jobs.upgrade.steps
        .find((step: any) => step.uses.startsWith('actions/checkout')).with.ref,
    ).toBe('branch2/main');

    // Verify upgrade-cdklabs-projen-project-types workflows also exist for custom branches
    expect(outdir['.github/workflows/upgrade-cdklabs-projen-project-types-branch1-main.yml']).toBeDefined();
    expect(outdir['.github/workflows/upgrade-cdklabs-projen-project-types-branch2-main.yml']).toBeDefined();

    // Verify the checkout refs in upgrade-cdklabs-projen-project-types workflows
    expect(
      YAML.parse(outdir['.github/workflows/upgrade-cdklabs-projen-project-types-branch1-main.yml']).jobs.upgrade.steps
        .find((step: any) => step.uses.startsWith('actions/checkout')).with.ref,
    ).toBe('branch1/main');

    expect(
      YAML.parse(outdir['.github/workflows/upgrade-cdklabs-projen-project-types-branch2-main.yml']).jobs.upgrade.steps
        .find((step: any) => step.uses.startsWith('actions/checkout')).with.ref,
    ).toBe('branch2/main');
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
    expect(
      YAML.parse(outdir['.github/workflows/auto-approve.yml']).jobs.approve.if.includes('dependabot[bot]'),
    ).toBeTruthy();

    // upgrade projen
    expect(
      YAML.parse(outdir['.github/workflows/upgrade-cdklabs-projen-project-types-main.yml']).jobs.upgrade.steps,
    ).toEqual(expect.arrayContaining([
      expect.not.objectContaining({
        name: 'Setup Node.js',
        uses: 'actions/setup-node@v3',
      }),
      expect.objectContaining({
        name: 'Install dependencies',
        run: 'yarn install --check-files --frozen-lockfile',
      }),
    ]));

    expect(
      YAML.parse(outdir['.github/workflows/upgrade-cdklabs-projen-project-types-main.yml']).jobs.pr.name,
    ).toEqual('Create Pull Request');

    // default main release branch
    expect(
      YAML.parse(outdir['.github/workflows/release.yml']).on.push.branches[0],
    ).toEqual('main');

    // min node version
    expect(packageJson.engines).toEqual({
      node: '>= 18.12.0',
    });

    // jest options
    expect(
      outdir['.projen/tasks.json'].tasks.test.steps[0].exec.includes('--updateSnapshot'),
    ).toBeTruthy();

    expect(outdir).toMatchSnapshot();
  });

  describe('cdklabsPublishingDefaults', () => {
    test('sets release environment for every release job', () => {
      const project = new TestCdkLabsTypeScriptProject({ releaseToNpm: true });
      const outdir = Testing.synth(project);
      const releaseWorkflow = outdir['.github/workflows/release.yml'];

      // we have 2 releases: github, npm
      expect(countOccurrences(releaseWorkflow, 'environment: release')).toBe(2);
    });

    test('enables trusted publishing for supported package registries', () => {
      const project = new TestCdkLabsTypeScriptProject({ releaseToNpm: true });
      const outdir = Testing.synth(project);
      const releaseWorkflow = outdir['.github/workflows/release.yml'];

      // see https://github.com/cdklabs/publib
      expect(releaseWorkflow).toContain('NPM_TRUSTED_PUBLISHER: "true"');
    });
  });
});

describe('CdklabsJsiiProject', () => {
  test('synthesizes with default settings', () => {
    const project = new TestCdklabsJsiiProject();
    const outdir = Testing.synth(project);
    const packageJson = outdir['package.json'];
    expect(packageJson.author).toEqual({
      name: 'Amazon Web Services',
      email: 'aws-cdk-dev@amazon.com',
      organization: true,
    });

    // auto approve
    expect(
      YAML.parse(outdir['.github/workflows/auto-approve.yml']).jobs.approve.if.includes('cdklabs-automation'),
    ).toBeTruthy();
    expect(
      YAML.parse(outdir['.github/workflows/auto-approve.yml']).jobs.approve.if.includes('dependabot[bot]'),
    ).toBeTruthy();

    // upgrade projen
    expect(
      YAML.parse(outdir['.github/workflows/upgrade-cdklabs-projen-project-types-main.yml']).jobs.upgrade.steps,
    ).toEqual(expect.arrayContaining([
      expect.not.objectContaining({
        name: 'Setup Node.js',
        uses: 'actions/setup-node@v3',
      }),
      expect.objectContaining({
        name: 'Install dependencies',
        run: 'yarn install --check-files --frozen-lockfile',
      }),
    ]));

    expect(
      YAML.parse(outdir['.github/workflows/upgrade-cdklabs-projen-project-types-main.yml']).jobs.pr.name,
    ).toEqual('Create Pull Request');

    // default main release branch
    expect(
      YAML.parse(outdir['.github/workflows/release.yml']).on.push.branches[0],
    ).toEqual('main');

    // min node version
    expect(packageJson.engines).toEqual({
      node: '>= 18.12.0',
    });

    // jest options
    expect(
      outdir['.projen/tasks.json'].tasks.test.steps[0].exec.includes('--updateSnapshot'),
    ).toBeTruthy();

    expect(outdir).toMatchSnapshot();

  });

  describe('cdklabsPublishingDefaults', () => {
    test('sets release environment for every release job', () => {
      const project = new TestCdklabsJsiiProject();
      const outdir = Testing.synth(project);
      const releaseWorkflow = outdir['.github/workflows/release.yml'];

      // we have 6 releases: github, npm, python, java, nuget, go
      expect(countOccurrences(releaseWorkflow, 'environment: release')).toBe(6);
    });

    test('enables trusted publishing for supported package registries', () => {
      const project = new TestCdklabsJsiiProject();
      const outdir = Testing.synth(project);
      const releaseWorkflow = outdir['.github/workflows/release.yml'];

      // see https://github.com/cdklabs/publib
      expect(releaseWorkflow).toContain('NPM_TRUSTED_PUBLISHER: "true"');
      expect(releaseWorkflow).toContain('PYPI_TRUSTED_PUBLISHER: "true"');
      expect(releaseWorkflow).toContain('NUGET_TRUSTED_PUBLISHER: "true"');
    });
  });
});

class TestCdkLabsConstructLibrary extends CdklabsConstructLibrary {
  constructor(options: Partial<CdklabsConstructLibraryOptions> = {}) {
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

class TestCdkLabsTypeScriptProject extends CdklabsTypeScriptProject {
  constructor(options: Partial<CdklabsTypeScriptProjectOptions> = {}) {
    super({
      name: '@cdklabs/test-node-project',
      defaultReleaseBranch: 'main',
      ...options,
    });
  }
}

class TestCdklabsJsiiProject extends CdklabsJsiiProject {
  constructor(options: Partial<CdklabsJsiiProjectOptions> = {}) {
    super({
      name: '@cdklabs/test-jsii-project',
      defaultReleaseBranch: 'main',
      author: 'AWS',
      authorAddress: 'aws-cdk-dev@amazon.com',
      ...options,
    });
  }
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}
