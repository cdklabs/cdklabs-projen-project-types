import { Testing } from 'projen/lib/testing';
import * as YAML from 'yaml';
import { yarn } from '../src';

describe('CdkLabsMonorepo', () => {
  describe('with a monorepo with indifferent settings', () => {
    let parent: yarn.CdkLabsMonorepo;
    beforeEach(() => {
      parent = new yarn.CdkLabsMonorepo({
        name: 'monorepo',
        defaultReleaseBranch: 'main',
      });
    });

    test('synthesizes with default settings', () => {
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
      new yarn.TypeScriptWorkspace({
        parent,
        name: '@cdklabs/one',
        // WHEN
        bundledDeps: ['@cdklabs/dep-a', '@cdklabs/dep-b@~1.0.0'],
        deps: ['@cdklabs/dep-c'], // will not show up
      });

      // THEN
      const outdir = Testing.synth(parent);

      expect(outdir['package.json']).toEqual(expect.objectContaining({
        workspaces: expect.objectContaining({
          nohoist: [
            '@cdklabs/one/@cdklabs/dep-a',
            '@cdklabs/one/@cdklabs/dep-a/**',
            '@cdklabs/one/@cdklabs/dep-b',
            '@cdklabs/one/@cdklabs/dep-b/**',
          ],
        }),
      }));
    });

    test('public dependency on a private package errors', () => {
      const privDep = new yarn.TypeScriptWorkspace({
        parent,
        name: '@cdklabs/one',
        private: true,
      });

      expect(() => {
        new yarn.TypeScriptWorkspace({
          parent,
          name: '@cdklabs/two',
          deps: [privDep],
        });
      }).toThrow(/cannot depend on any private packages/);
    });

    test('public dependency on a private package error can be suppressed', () => {
      const privDep = new yarn.TypeScriptWorkspace({
        parent,
        name: '@cdklabs/one',
        private: true,
      });

      new yarn.TypeScriptWorkspace({
        parent,
        name: '@cdklabs/two',
        deps: [privDep],
        allowPrivateDeps: true,
      });

      // THEN: does not throw
    });

    test('public dependency on a private package error cannot be suppressed for peerDeps', () => {
      const privDep = new yarn.TypeScriptWorkspace({
        parent,
        name: '@cdklabs/one',
        private: true,
      });

      expect(() => {
        new yarn.TypeScriptWorkspace({
          parent,
          name: '@cdklabs/two',
          peerDeps: [privDep],
          allowPrivateDeps: true,
        });
      }).toThrow(/cannot depend on any private packages/);
    });

    test('workspace dependencies synthesize to asterisk by default', () => {
      const dep = new yarn.TypeScriptWorkspace({
        parent,
        name: '@cdklabs/one',
      });

      new yarn.TypeScriptWorkspace({
        parent,
        name: '@cdklabs/two',
        deps: [dep],
      });

      // THEN
      const outdir = Testing.synth(parent);

      expect(outdir['packages/@cdklabs/two/package.json']).toEqual(expect.objectContaining({
        dependencies: {
          // This will be replaced with the actual version (which in a workspace is ^0.0.0)
          // in a post-synth step.
          '@cdklabs/one': '*',
        },
      }));
    });
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

  describe('nx integration', () => {
    test('nx can be used', () => {
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

    test('can build with nx', () => {
      const parent = new yarn.CdkLabsMonorepo({
        name: 'monorepo',
        defaultReleaseBranch: 'main',
        nx: true,
        buildWithNx: true,
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
      expect(outdir['.projen/tasks.json'].tasks.build).toMatchSnapshot();
      expect(outdir['.projen/tasks.json'].tasks.release).toMatchSnapshot();

      const buildWorkflow = YAML.parse(outdir['.github/workflows/build.yml']);
      expect(buildWorkflow.jobs.build.env).toHaveProperty('NX_SKIP_NX_CACHE', 'true');
    });
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

    test('npmDistTag works', () => {
      new yarn.TypeScriptWorkspace({
        parent,
        name: '@cdklabs/one',
        npmDistTag: 'foobar',
      });

      Testing.synth(parent);

      expect(parent.github?.tryFindWorkflow('release')?.getJob('cdklabs-one_release_npm'))
        .toMatchObject(expect.objectContaining({
          steps: expect.arrayContaining([expect.objectContaining({
            name: 'Release',
            env: expect.objectContaining({ NPM_DIST_TAG: 'foobar' }),
          })]),
        }));
    });

    test('prerelease is respected for the right workspace package', () => {
      new yarn.TypeScriptWorkspace({
        parent,
        name: '@cdklabs/one',
        prerelease: 'rc',
      });

      new yarn.TypeScriptWorkspace({
        parent,
        name: '@cdklabs/two',
      });

      Testing.synth(parent);

      expect(parent.github?.tryFindWorkflow('release')?.getJob('cdklabs-one_release_github'))
        .toMatchObject(expect.objectContaining({
          steps: expect.arrayContaining([expect.objectContaining({
            name: 'Release',
            run: expect.stringContaining('-p'),
          })]),
        }));

      expect(parent.github?.tryFindWorkflow('release')?.getJob('cdklabs-two_release_github'))
        .toMatchObject(expect.objectContaining({
          steps: expect.arrayContaining([expect.objectContaining({
            name: 'Release',
            run: expect.not.stringContaining('-p'),
          })]),
        }));
    });

    test('will automatically enable npm release provenance', () => {
      const one = new yarn.TypeScriptWorkspace({
        parent,
        name: '@cdklabs/one',
        npmDistTag: 'foobar',
      });

      Testing.synth(parent);

      expect(one.package.npmProvenance).toBe(true);
      expect(parent.github?.tryFindWorkflow('release')?.getJob('cdklabs-one_release_npm'))
        .toMatchObject(expect.objectContaining({
          steps: expect.arrayContaining([expect.objectContaining({
            name: 'Release',
            env: expect.objectContaining({ NPM_CONFIG_PROVENANCE: 'true' }),
          })]),
        }));
    });

    test('workspace dependencies can be made exact', () => {
      const dep = new yarn.TypeScriptWorkspace({
        parent,
        name: '@cdklabs/one',
      });

      new yarn.TypeScriptWorkspace({
        parent,
        name: '@cdklabs/two',
        deps: [dep.customizeReference({ versionType: 'exact' })],
      });

      // THEN
      const outdir = Testing.synth(parent);

      const tasks = outdir['packages/@cdklabs/two/.projen/tasks.json'];
      // Checking for the correct invocation of the gather-versions script
      expect(tasks.tasks['gather-versions'].steps[0].exec).toContain('@cdklabs/one=exact');
    });
  });

  describe('VSCode Workspace', () => {
    test('can include a root workspace', () => {
      const parent = new yarn.CdkLabsMonorepo({
        name: 'monorepo',
        defaultReleaseBranch: 'main',
        vscodeWorkspace: true,
        vscodeWorkspaceOptions: {
          includeRootWorkspace: true,
        },
      });
      new yarn.TypeScriptWorkspace({
        parent,
        name: '@cdklabs/one',
      });

      const outdir = Testing.synth(parent);
      const workspacesFile = parseJsonWithMarker(outdir['monorepo.code-workspace']);
      expect(workspacesFile).toMatchObject({
        folders: [
          {
            name: '<root>',
            path: '.',
          },
          {
            path: 'packages/@cdklabs/one',
          },
        ],
        settings: {
          'files.exclude': {
            packages: true,
          },
        },
      });
    });

    test('can set a custom name for the root workspace', () => {
      const parent = new yarn.CdkLabsMonorepo({
        name: 'monorepo',
        defaultReleaseBranch: 'main',
        vscodeWorkspace: true,
        vscodeWorkspaceOptions: {
          includeRootWorkspace: true,
          rootWorkspaceName: 'foobar',
        },
      });

      const outdir = Testing.synth(parent);
      const workspacesFile = parseJsonWithMarker(outdir['monorepo.code-workspace']);
      expect(workspacesFile).toMatchObject({
        folders: [
          {
            name: 'foobar',
            path: '.',
          },
        ],
      });
    });
  });
});

function parseJsonWithMarker(content: string): any {
  return JSON.parse(content.split('\n').slice(1).join('\n'));
}
