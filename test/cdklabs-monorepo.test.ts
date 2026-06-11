import { javascript } from 'projen';
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

    test('workspaces dont have their own projen dependency', () => {
      new yarn.TypeScriptWorkspace({
        parent,
        name: '@cdklabs/one',
      });

      const outdir = Testing.synth(parent);
      const deps = outdir['packages/@cdklabs/one/.projen/deps.json'];
      expect(deps.dependencies).not.toContain(expect.objectContaining({
        name: 'projen',
      }));
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

      new yarn.TypeScriptWorkspace({
        parent,
        name: '@cdklabs/two',
        deps: [privDep],
      });

      expect(() => Testing.synth(parent)).toThrow(/cannot depend on private workspace packages/);
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

      new yarn.TypeScriptWorkspace({
        parent,
        name: '@cdklabs/two',
        peerDeps: [privDep],
        allowPrivateDeps: true,
      });

      expect(() => Testing.synth(parent)).toThrow(/cannot depend on private workspace packages/);
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

  describe('workspace inherits config from monorepo', () => {
    test('repository configuration', () => {
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

    test('NPM trusted publishing setting', () => {
      const parent = new yarn.CdkLabsMonorepo({
        name: 'monorepo',
        defaultReleaseBranch: 'main',
        release: true,
        releaseOptions: {
          publishToNpm: true,
        },
        npmTrustedPublishing: true,
      });

      new yarn.TypeScriptWorkspace({
        parent,
        name: '@cdklabs/one',
        workspaceScope: 'packages',
        npmTokenSecret: undefined,
      });

      const outdir = Testing.synth(parent);
      const releaseWorkflow = YAML.parse(outdir['.github/workflows/release.yml']);
      const step = releaseWorkflow.jobs['cdklabs-one_release_npm'].steps.find((s: any) => s.name === 'Release');
      expect(step.env).toMatchObject({ NPM_TRUSTED_PUBLISHER: 'true' });
    });

    test('releaseEnvironment', () => {
      const parent = new yarn.CdkLabsMonorepo({
        name: 'monorepo',
        defaultReleaseBranch: 'main',
        release: true,
        releaseOptions: {
          publishToNpm: true,
        },
        releaseEnvironment: 'asdf',
      });

      new yarn.TypeScriptWorkspace({
        parent,
        name: '@cdklabs/one',
        workspaceScope: 'packages',
        npmTokenSecret: undefined,
      });

      const outdir = Testing.synth(parent);
      const releaseWorkflow = YAML.parse(outdir['.github/workflows/release.yml']);
      expect(releaseWorkflow.jobs['cdklabs-one_release_npm']).toMatchObject({ environment: 'asdf' });
    });

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

    test('workspace nx task uses plain command for yarn classic', () => {
      const parent = new yarn.CdkLabsMonorepo({
        name: 'monorepo',
        defaultReleaseBranch: 'main',
        nx: true,
      });

      new yarn.TypeScriptWorkspace({
        parent,
        name: '@cdklabs/one',
      });

      const outdir = Testing.synth(parent);
      const tasks = outdir['packages/@cdklabs/one/.projen/tasks.json'];
      expect(tasks.tasks.nx).toEqual({
        name: 'nx',
        steps: [{
          exec: 'nx run',
          receiveArgs: true,
        }],
      });
    });

    test('workspaces get nx as a devDependency', () => {
      const parent = new yarn.CdkLabsMonorepo({
        name: 'monorepo',
        defaultReleaseBranch: 'main',
        nx: true,
      });

      new yarn.TypeScriptWorkspace({
        parent,
        name: '@cdklabs/one',
      });

      const outdir = Testing.synth(parent);
      const deps = outdir['packages/@cdklabs/one/.projen/deps.json'];
      expect(deps.dependencies).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'nx', type: 'build' }),
      ]));
    });
    test('nx is added to consistentVersions when yarn berry is used', () => {
      const parent = new yarn.CdkLabsMonorepo({
        name: 'monorepo',
        defaultReleaseBranch: 'main',
        nx: true,
        yarnBerry: true,
      });

      const outdir = Testing.synth(parent);
      expect(outdir['yarn.config.cjs']).toContain('"nx"');
    });
  });

  describe('with monorepo that customizes release options', () => {
    let parent: yarn.CdkLabsMonorepo;
    beforeEach(() => {
      parent = new yarn.CdkLabsMonorepo({
        name: 'monorepo',
        defaultReleaseBranch: 'main',
        release: true,
        releaseOptions: {
          nodeVersion: '24.x',
        },
      });
    });

    test('node version is propagated to release workflow', () => {
      new yarn.TypeScriptWorkspace({
        parent,
        name: '@cdklabs/one',
      });

      const outdir = Testing.synth(parent);
      const releaseWorkflow = YAML.parse(outdir['.github/workflows/release.yml']);

      expect(releaseWorkflow.jobs['cdklabs-one_release_npm'].steps[0].with['node-version']).toStrictEqual('24.x');

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

      expect(releaseWorkflow.jobs['cdklabs-one_release_github'].needs).toEqual('cdklabs-one_release_npm');
      expect(outdir).toMatchSnapshot();
    });

    test('release workflow setup steps for yarn classic', () => {
      new yarn.TypeScriptWorkspace({
        parent,
        name: '@cdklabs/one',
      });

      const outdir = Testing.synth(parent);
      const releaseWorkflow = YAML.parse(outdir['.github/workflows/release.yml']);

      expect(releaseWorkflow.jobs.release.steps).toMatchSnapshot();
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

    test('npmTrustedPublishing and releaseEnvironment are respected', () => {
      new yarn.TypeScriptWorkspace({
        parent,
        name: '@cdklabs/one',
        npmTrustedPublishing: true,
        releaseEnvironment: 'release',
      });

      const outdir = Testing.synth(parent);
      const releaseWorkflow = YAML.parse(outdir['.github/workflows/release.yml']);

      expect(releaseWorkflow.jobs['cdklabs-one_release_npm'].environment).toStrictEqual('release');

      // this also ensures the npm token doens't exist
      expect(releaseWorkflow.jobs['cdklabs-one_release_npm'].steps[3].env).toMatchObject({
        NPM_CONFIG_PROVENANCE: 'true',
        NPM_DIST_TAG: 'latest',
        NPM_REGISTRY: 'registry.npmjs.org',
        NPM_TRUSTED_PUBLISHER: 'true',
      });

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

    test('a package waits for its dependencies to finish publishing before it publishes', () => {
      const dep = new yarn.TypeScriptWorkspace({
        parent,
        name: '@cdklabs/dep',
      });

      new yarn.TypeScriptWorkspace({
        parent,
        name: '@cdklabs/consumer',
        deps: [dep],
      });

      const outdir = Testing.synth(parent);
      const releaseWorkflow = YAML.parse(outdir['.github/workflows/release.yml']);

      // Consumer waits for dep to finish all publishing before starting its own
      expect(releaseWorkflow.jobs['cdklabs-consumer_release_npm'].needs).toContain('cdklabs-dep_release_done');

      // Consumer still needs its own gate to pass
      expect(releaseWorkflow.jobs['cdklabs-consumer_release_npm'].needs).toContain('cdklabs-consumer_release');

      // Dep does not wait for consumer (no circular dependency)
      expect(releaseWorkflow.jobs['cdklabs-dep_release_done'].needs).not.toContain('cdklabs-consumer');
    });

    test('publish jobs are isolated from the release job', () => {
      const dep = new yarn.TypeScriptWorkspace({
        parent,
        name: '@cdklabs/dep',
      });

      new yarn.TypeScriptWorkspace({
        parent,
        name: '@cdklabs/consumer',
        deps: [dep],
      });

      const outdir = Testing.synth(parent);
      const releaseWorkflow = YAML.parse(outdir['.github/workflows/release.yml']);

      // Publish jobs never directly depend on the release or release_gate jobs
      // (all gating is done through the package gate)
      expect(releaseWorkflow.jobs['cdklabs-consumer_release_npm'].needs).not.toEqual(
        expect.arrayContaining(['release']),
      );
      expect(releaseWorkflow.jobs['cdklabs-consumer_release_npm'].needs).not.toEqual(
        expect.arrayContaining(['release_gate']),
      );
    });

    test('a package can still publish even if an unchanged dependency is skipped', () => {
      const dep = new yarn.TypeScriptWorkspace({
        parent,
        name: '@cdklabs/dep',
      });

      new yarn.TypeScriptWorkspace({
        parent,
        name: '@cdklabs/consumer',
        deps: [dep],
      });

      const outdir = Testing.synth(parent);
      const releaseWorkflow = YAML.parse(outdir['.github/workflows/release.yml']);

      // The done job uses !cancelled() && !failure() so it succeeds even when
      // publish jobs are skipped (package has no changes), allowing downstream
      // packages to proceed. But if a publish job fails, the done job is skipped
      // which blocks downstream packages.
      expect(releaseWorkflow.jobs['cdklabs-consumer_release_done'].if).toContain('!cancelled() && !failure()');
      expect(releaseWorkflow.jobs['cdklabs-dep_release_done'].if).toContain('!cancelled() && !failure()');
    });

    test('diamond dependency graph publishes packages in correct order', () => {
      // Diamond: schema <- api, schema <- diff, api <- toolkit, diff <- toolkit
      // Plus: toolkit <- cli, cli <- integ-runner
      const schema = new yarn.TypeScriptWorkspace({ parent, name: '@cdklabs/schema' });
      const api = new yarn.TypeScriptWorkspace({ parent, name: '@cdklabs/api', deps: [schema] });
      const diff = new yarn.TypeScriptWorkspace({ parent, name: '@cdklabs/diff', deps: [schema] });
      const toolkit = new yarn.TypeScriptWorkspace({ parent, name: '@cdklabs/toolkit', deps: [api, diff] });
      const cli = new yarn.TypeScriptWorkspace({ parent, name: '@cdklabs/cli', deps: [toolkit] });
      new yarn.TypeScriptWorkspace({ parent, name: '@cdklabs/integ-runner', deps: [cli] });

      const outdir = Testing.synth(parent);
      const releaseWorkflow = YAML.parse(outdir['.github/workflows/release.yml']);

      // The release_gate decides which packages to publish based on tags and filters
      expect(releaseWorkflow.jobs.release_gate.needs).toEqual('release');
      expect(releaseWorkflow.jobs.release_gate.if).toContain('latest_commit');

      // Each package gate only depends on release_gate (no topological deps on gates)
      // This ensures the "should publish?" decision is independent per package
      expect(releaseWorkflow.jobs['cdklabs-schema_release'].needs).toEqual('release_gate');
      expect(releaseWorkflow.jobs['cdklabs-api_release'].needs).toEqual('release_gate');
      expect(releaseWorkflow.jobs['cdklabs-diff_release'].needs).toEqual('release_gate');

      // Topological ordering happens at the publish level via _release_done
      // Each package waits for its dependencies to finish publishing first
      expect(releaseWorkflow.jobs['cdklabs-api_release_npm'].needs).toContain('cdklabs-schema_release_done');
      expect(releaseWorkflow.jobs['cdklabs-toolkit_release_npm'].needs).toContain('cdklabs-api_release_done');
      expect(releaseWorkflow.jobs['cdklabs-toolkit_release_npm'].needs).toContain('cdklabs-diff_release_done');
      expect(releaseWorkflow.jobs['cdklabs-cli_release_npm'].needs).toContain('cdklabs-toolkit_release_done');
      expect(releaseWorkflow.jobs['cdklabs-integ-runner_release_npm'].needs).toContain('cdklabs-cli_release_done');

      // Each package's publish jobs also need their own gate to pass
      expect(releaseWorkflow.jobs['cdklabs-toolkit_release_npm'].needs).toContain('cdklabs-toolkit_release');
      expect(releaseWorkflow.jobs['cdklabs-cli_release_npm'].needs).toContain('cdklabs-cli_release');

      // The GitHub release job runs after all other publish jobs for the same package
      // (it doesn't need the gate directly since it's transitively satisfied)
      const toolkitGhNeeds = [].concat(releaseWorkflow.jobs['cdklabs-toolkit_release_github'].needs);
      expect(toolkitGhNeeds).toContain('cdklabs-toolkit_release_npm');
      expect(toolkitGhNeeds).not.toEqual(expect.arrayContaining(['cdklabs-toolkit_release']));

      // Publish jobs tolerate skipped dependency ancestors while gating on the package gate
      expect(releaseWorkflow.jobs['cdklabs-toolkit_release_npm'].if).toBe("${{ !cancelled() && !failure() && needs.cdklabs-toolkit_release.result == 'success' }}");
      expect(releaseWorkflow.jobs['cdklabs-integ-runner_release_npm'].if).toBe("${{ !cancelled() && !failure() && needs.cdklabs-integ-runner_release.result == 'success' }}");

      // No publish job directly accesses release job outputs
      // (prevents invalid GitHub Actions context access warnings)
      for (const [jobId, job] of Object.entries(releaseWorkflow.jobs) as [string, any][]) {
        if (jobId === 'release' || jobId === 'release_gate') continue;
        const jobStr = JSON.stringify(job);
        expect(jobStr).not.toContain('needs.release.outputs');
      }

      // Full workflow snapshot for easy inspection
      expect(outdir['.github/workflows/release.yml']).toMatchSnapshot();
    });

    test('devDeps on a workspace do not add release dependency', () => {
      const dep = new yarn.TypeScriptWorkspace({
        parent,
        name: '@cdklabs/dep',
      });

      new yarn.TypeScriptWorkspace({
        parent,
        name: '@cdklabs/consumer',
        devDeps: [dep],
      });

      const outdir = Testing.synth(parent);
      const releaseWorkflow = YAML.parse(outdir['.github/workflows/release.yml']);

      expect(releaseWorkflow.jobs['cdklabs-consumer_release_npm'].needs).not.toContain('cdklabs-dep_release_npm');
    });

    test('peerDeps on a workspace add release dependency', () => {
      const dep = new yarn.TypeScriptWorkspace({
        parent,
        name: '@cdklabs/dep',
      });

      new yarn.TypeScriptWorkspace({
        parent,
        name: '@cdklabs/consumer',
        peerDeps: [dep],
      });

      const outdir = Testing.synth(parent);
      const releaseWorkflow = YAML.parse(outdir['.github/workflows/release.yml']);

      expect(releaseWorkflow.jobs['cdklabs-consumer_release_npm'].needs).toContain('cdklabs-dep_release_done');
    });
  });

  describe('monorepo dependency upgrades', () => {
    test('no cooldown for yarn classic monorepo', () => {
      const parent = new yarn.CdkLabsMonorepo({
        name: 'monorepo',
        defaultReleaseBranch: 'main',
      });

      new yarn.TypeScriptWorkspace({ parent, name: '@cdklabs/one' });

      const outdir = Testing.synth(parent);
      const tasks = outdir['.projen/tasks.json'].tasks;

      expect(tasks.upgrade.steps[0].exec).not.toContain('--cooldown');
      expect(tasks.upgrade.env.YARN_NPM_MINIMAL_AGE_GATE).toBeUndefined();
    });

    test('3 day cooldown for yarn berry monorepo', () => {
      const parent = new yarn.CdkLabsMonorepo({
        name: 'monorepo',
        defaultReleaseBranch: 'main',
        yarnBerry: true,
      });

      new yarn.TypeScriptWorkspace({ parent, name: '@cdklabs/one' });

      const outdir = Testing.synth(parent);
      const tasks = outdir['.projen/tasks.json'].tasks;

      expect(tasks.upgrade.steps[0].exec).toContain('--cooldown=3');
      expect(tasks.upgrade.env.YARN_NPM_MINIMAL_AGE_GATE).toBe('4320');
    });

    test('workspace check-for-updates inherits cooldown env from yarn berry monorepo', () => {
      const parent = new yarn.CdkLabsMonorepo({
        name: 'monorepo',
        defaultReleaseBranch: 'main',
        yarnBerry: true,
      });

      new yarn.TypeScriptWorkspace({ parent, name: '@cdklabs/one' });

      const outdir = Testing.synth(parent);
      const wsTasks = outdir['packages/@cdklabs/one/.projen/tasks.json'].tasks;

      // The env vars from the workspace's UpgradeDependencies are propagated
      expect(wsTasks['check-for-updates'].env).toBeDefined();
      expect(wsTasks['check-for-updates'].env.CI).toBe('0');

      // The cooldown flag is included in the check-for-updates steps
      const ncuStep = wsTasks['check-for-updates'].steps.find((s: any) => s.exec?.includes('npm-check-updates'));
      expect(ncuStep.exec).toContain('--cooldown=3');
    });

    test('workspaces get a check-for-updates task, but not upgrades', () => {
      const parent = new yarn.CdkLabsMonorepo({
        name: 'monorepo',
        defaultReleaseBranch: 'main',
      });

      const workspace = new yarn.TypeScriptWorkspace({
        parent,
        name: '@cdklabs/one',
        workspaceScope: 'packages',
      });

      expect(workspace.tasks.all.find(t => t.name === 'check-for-updates')).toBeDefined();
      expect(workspace.tasks.all.find(t => t.name === 'upgrades')).toBeUndefined();
      expect(workspace.tasks.all.find(t => t.name === 'post-upgrades')).toBeUndefined();
    });

    test('workspaces can have custom upgrades', () => {
      const parent = new yarn.CdkLabsMonorepo({
        name: 'monorepo',
        defaultReleaseBranch: 'main',
      });

      const workspace = new yarn.TypeScriptWorkspace({
        parent,
        name: '@cdklabs/one',
        workspaceScope: 'packages',
      });

      new javascript.UpgradeDependencies(workspace, {
        taskName: 'custom-upgrades',
      });

      expect(workspace.tasks.all.find(t => t.name === 'custom-upgrades')).toBeDefined();
      expect(parent.github?.workflows.find(w => w.name === 'custom-upgrades_cdklabs-one')).toBeDefined();
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

  describe('Yarn Berry', () => {
    test('defaults to Yarn Classic', () => {
      const parent = new yarn.CdkLabsMonorepo({
        name: 'monorepo',
        defaultReleaseBranch: 'main',
      });

      const outdir = Testing.synth(parent);
      expect(outdir['package.json'].packageManager).toBeUndefined();
      expect(outdir['.yarnrc.yml']).toBeUndefined();
    });

    test('can enable Yarn Berry', () => {
      const parent = new yarn.CdkLabsMonorepo({
        name: 'monorepo',
        defaultReleaseBranch: 'main',
        yarnBerry: true,
      });

      const outdir = Testing.synth(parent);
      expect(outdir['package.json'].packageManager).toBeDefined();
      expect(outdir['.yarnrc.yml']).toContain('nodeLinker: node-modules');
    });

    test('nodeLinker defaults to node-modules', () => {
      const parent = new yarn.CdkLabsMonorepo({
        name: 'monorepo',
        defaultReleaseBranch: 'main',
        yarnBerry: true,
      });

      const outdir = Testing.synth(parent);
      expect(outdir['.yarnrc.yml']).toContain('nodeLinker: node-modules');
    });

    test('nodeLinker can be overridden', () => {
      const parent = new yarn.CdkLabsMonorepo({
        name: 'monorepo',
        defaultReleaseBranch: 'main',
        yarnBerry: true,
        yarnBerryOptions: {
          yarnRcOptions: {
            nodeLinker: javascript.YarnNodeLinker.PNPM,
          },
        },
      });

      const outdir = Testing.synth(parent);
      expect(outdir['.yarnrc.yml']).toContain('nodeLinker: pnpm');
    });

    test('yarnBerryOptions are passed through', () => {
      const parent = new yarn.CdkLabsMonorepo({
        name: 'monorepo',
        defaultReleaseBranch: 'main',
        yarnBerry: true,
        yarnBerryOptions: {
          zeroInstalls: true,
        },
      });

      const outdir = Testing.synth(parent);
      expect(outdir['.yarnrc.yml']).toBeDefined();
    });

    test('workspace can configure hoistingLimits', () => {
      const parent = new yarn.CdkLabsMonorepo({
        name: 'monorepo',
        defaultReleaseBranch: 'main',
        yarnBerry: true,
      });

      new yarn.TypeScriptWorkspace({
        parent,
        name: '@cdklabs/one',
        hoistingLimits: 'workspaces',
      });

      const outdir = Testing.synth(parent);
      expect(outdir['packages/@cdklabs/one/package.json'].installConfig).toEqual({
        hoistingLimits: 'workspaces',
      });
    });

    test('bundled deps auto-set hoistingLimits to workspaces', () => {
      const parent = new yarn.CdkLabsMonorepo({
        name: 'monorepo',
        defaultReleaseBranch: 'main',
        yarnBerry: true,
      });

      new yarn.TypeScriptWorkspace({
        parent,
        name: '@cdklabs/one',
        bundledDeps: ['some-dep'],
      });

      new yarn.TypeScriptWorkspace({
        parent,
        name: '@cdklabs/two',
      });

      const outdir = Testing.synth(parent);
      expect(outdir['packages/@cdklabs/one/package.json'].installConfig).toEqual({
        hoistingLimits: 'workspaces',
      });
      expect(outdir['packages/@cdklabs/two/package.json'].installConfig).toBeUndefined();
    });

    test('bundled deps do not produce nohoist on Yarn Berry', () => {
      const parent = new yarn.CdkLabsMonorepo({
        name: 'monorepo',
        defaultReleaseBranch: 'main',
        yarnBerry: true,
      });

      new yarn.TypeScriptWorkspace({
        parent,
        name: '@cdklabs/one',
        bundledDeps: ['some-dep'],
      });

      const outdir = Testing.synth(parent);
      expect(outdir['package.json'].workspaces.nohoist).toBeUndefined();
    });

    test('workspace can configure buildable packages', () => {
      const parent = new yarn.CdkLabsMonorepo({
        name: 'monorepo',
        defaultReleaseBranch: 'main',
        yarnBerry: true,
        buildablePackages: ['esbuild', '@swc/core'],
      });

      new yarn.TypeScriptWorkspace({
        parent,
        name: '@cdklabs/one',
      });

      const outdir = Testing.synth(parent);
      expect(outdir['package.json'].dependenciesMeta).toEqual({
        'esbuild': { built: true },
        '@swc/core': { built: true },
      });
    });

    test('workspace commands run in topological order including devDependencies', () => {
      const parent = new yarn.CdkLabsMonorepo({
        name: 'monorepo',
        defaultReleaseBranch: 'main',
        yarnBerry: true,
      });

      const outdir = Testing.synth(parent);
      const tasks = outdir['.projen/tasks.json'].tasks;

      // Every task step that uses `yarn workspaces foreach` must include `--topological-dev`
      const allSteps = Object.values(tasks).flatMap((t: any) => t.steps ?? []);
      const foreachSteps = allSteps.filter((s: any) => s.exec?.includes('yarn workspaces foreach'));
      expect(foreachSteps.length).toBeGreaterThan(0);
      for (const step of foreachSteps) {
        expect(step.exec).toContain('--topological-dev');
      }
    });

    test('release workflow setup steps for yarn berry', () => {
      const parent = new yarn.CdkLabsMonorepo({
        name: 'monorepo',
        defaultReleaseBranch: 'main',
        yarnBerry: true,
        release: true,
      });

      new yarn.TypeScriptWorkspace({
        parent,
        name: '@cdklabs/one',
      });

      const outdir = Testing.synth(parent);
      const releaseWorkflow = YAML.parse(outdir['.github/workflows/release.yml']);

      expect(releaseWorkflow.jobs.release.steps).toMatchSnapshot();
    });

    test('consistentVersions creates yarn.config.cjs', () => {
      const parent = new yarn.CdkLabsMonorepo({
        name: 'monorepo',
        defaultReleaseBranch: 'main',
        yarnBerry: true,
        devDeps: ['typescript@^5'],
        consistentVersions: ['typescript'],
      });

      const outdir = Testing.synth(parent);
      expect(outdir['yarn.config.cjs']).toContain('["typescript"]');
      expect(outdir['yarn.config.cjs']).toMatchSnapshot();
    });

    test('consistentVersions adds packages as devDeps to workspaces', () => {
      const parent = new yarn.CdkLabsMonorepo({
        name: 'monorepo',
        defaultReleaseBranch: 'main',
        yarnBerry: true,
        devDeps: ['typescript@^5'],
        consistentVersions: ['typescript'],
      });

      new yarn.TypeScriptWorkspace({
        parent,
        name: '@cdklabs/one',
      });

      const outdir = Testing.synth(parent);
      const deps = outdir['packages/@cdklabs/one/.projen/deps.json'];
      expect(deps.dependencies).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'typescript', type: 'build' }),
      ]));
    });

    test('consistentVersions does not add to workspace if already present', () => {
      const parent = new yarn.CdkLabsMonorepo({
        name: 'monorepo',
        defaultReleaseBranch: 'main',
        yarnBerry: true,
        devDeps: ['typescript@^5'],
        consistentVersions: ['typescript'],
      });

      new yarn.TypeScriptWorkspace({
        parent,
        name: '@cdklabs/one',
        devDeps: ['typescript'],
      });

      const outdir = Testing.synth(parent);
      const deps = outdir['packages/@cdklabs/one/.projen/deps.json'];
      const tsDeps = deps.dependencies.filter((d: any) => d.name === 'typescript');
      expect(tsDeps).toHaveLength(1);
    });

    test('consistentVersions adds constraints fix to default task', () => {
      const parent = new yarn.CdkLabsMonorepo({
        name: 'monorepo',
        defaultReleaseBranch: 'main',
        yarnBerry: true,
        devDeps: ['typescript@^5'],
        consistentVersions: ['typescript'],
      });

      const outdir = Testing.synth(parent);
      const defaultTask = outdir['.projen/tasks.json'].tasks.default;
      expect(defaultTask.steps).toEqual(expect.arrayContaining([
        expect.objectContaining({ exec: 'yarn constraints --fix' }),
      ]));
    });

    test('consistentVersions throws if package is not a root dev dep', () => {
      expect(() => {
        const parent = new yarn.CdkLabsMonorepo({
          name: 'monorepo',
          defaultReleaseBranch: 'main',
          yarnBerry: true,
          consistentVersions: ['some-nonexistent-pkg'],
        });
        Testing.synth(parent);
      }).toThrow(/must be declared as a dev dependency/);
    });

    test('no yarn.config.cjs without consistentVersions', () => {
      const parent = new yarn.CdkLabsMonorepo({
        name: 'monorepo',
        defaultReleaseBranch: 'main',
        yarnBerry: true,
      });

      const outdir = Testing.synth(parent);
      expect(outdir['yarn.config.cjs']).toBeUndefined();
    });

    test('consistentVersions is ignored without yarnBerry', () => {
      const parent = new yarn.CdkLabsMonorepo({
        name: 'monorepo',
        defaultReleaseBranch: 'main',
        consistentVersions: ['typescript'],
      });

      const outdir = Testing.synth(parent);
      expect(outdir['yarn.config.cjs']).toBeUndefined();
    });
  });
});

describe('install trigger handling', () => {
  test('workspace skips install for NO_NODE_MODULES reason', () => {
    const parent = new yarn.CdkLabsMonorepo({
      name: 'monorepo',
      defaultReleaseBranch: 'main',
    });

    const ws = new yarn.TypeScriptWorkspace({
      parent,
      name: '@cdklabs/one',
    });

    // Spy on requestInstallDependencies to verify it's NOT called
    const requestSpy = jest.spyOn(parent, 'requestInstallDependencies');

    const pkg: any = ws.package;
    pkg.installDependencies({ reason: javascript.InstallReason.NO_NODE_MODULES });

    expect(requestSpy).not.toHaveBeenCalled();
  });

  test('workspace delegates install for PACKAGE_JSON_CHANGED reason', () => {
    const parent = new yarn.CdkLabsMonorepo({
      name: 'monorepo',
      defaultReleaseBranch: 'main',
    });

    const ws = new yarn.TypeScriptWorkspace({
      parent,
      name: '@cdklabs/one',
    });

    const requestSpy = jest.spyOn(parent, 'requestInstallDependencies');

    const pkg: any = ws.package;
    pkg.installDependencies({ reason: javascript.InstallReason.PACKAGE_JSON_CHANGED });

    expect(requestSpy).toHaveBeenCalledTimes(1);
  });

  test('workspace delegates install for DEPS_RESOLVED reason', () => {
    const parent = new yarn.CdkLabsMonorepo({
      name: 'monorepo',
      defaultReleaseBranch: 'main',
    });

    const ws = new yarn.TypeScriptWorkspace({
      parent,
      name: '@cdklabs/one',
    });

    const requestSpy = jest.spyOn(parent, 'requestInstallDependencies');

    const pkg: any = ws.package;
    pkg.installDependencies({ reason: javascript.InstallReason.DEPS_RESOLVED, resolutions: ['ms: * => ^2.1.3'] });

    expect(requestSpy).toHaveBeenCalledTimes(1);
  });

  test('workspace resolveDepsAndWritePackageJson returns empty array', () => {
    const parent = new yarn.CdkLabsMonorepo({
      name: 'monorepo',
      defaultReleaseBranch: 'main',
    });

    const ws = new yarn.TypeScriptWorkspace({
      parent,
      name: '@cdklabs/one',
    });

    const pkg: any = ws.package;
    expect(pkg.resolveDepsAndWritePackageJson()).toEqual([]);
  });

  test('release workflow has workflow_dispatch input to select a package', () => {
    const parent = new yarn.CdkLabsMonorepo({
      name: 'monorepo',
      defaultReleaseBranch: 'main',
      release: true,
      releaseOptions: {
        publishToNpm: true,
      },
    });

    // @cdklabs/base has no deps
    const base = new yarn.TypeScriptWorkspace({
      parent,
      name: '@cdklabs/base',
    });

    // @cdklabs/mid depends on @cdklabs/base
    const mid = new yarn.TypeScriptWorkspace({
      parent,
      name: '@cdklabs/mid',
      deps: [base],
    });

    // @cdklabs/top depends on @cdklabs/mid (transitively on @cdklabs/base)
    new yarn.TypeScriptWorkspace({
      parent,
      name: '@cdklabs/top',
      deps: [mid],
    });

    const outdir = Testing.synth(parent);
    const releaseWorkflow = YAML.parse(outdir['.github/workflows/release.yml']);

    // Check the workflow_dispatch input
    expect(releaseWorkflow.on.workflow_dispatch.inputs).toEqual({
      dry_run: {
        description: 'Dry run (skip actual publishing)',
        required: false,
        type: 'boolean',
      },
      package: {
        description: 'Select specific package to release',
        required: false,
        type: 'choice',
        options: ['*all packages*', '@cdklabs/base', '@cdklabs/mid', '@cdklabs/top'],
        default: '*all packages*',
      },
    });

    // When @cdklabs/top is selected, all three packages should be released
    // Package filter is now in the gate job's steps
    const gateJob = releaseWorkflow.jobs.release_gate;
    const topGateStep = gateJob.steps.find((s: any) => s.name?.includes('@cdklabs/top'));
    expect(topGateStep.run).toContain('!github.event.inputs.package');
    expect(topGateStep.run).toContain("github.event.inputs.package == '*all packages*'");
    expect(topGateStep.run).toContain('@cdklabs/top');

    const midGateStep = gateJob.steps.find((s: any) => s.name?.includes('@cdklabs/mid'));
    expect(midGateStep.run).toContain('@cdklabs/top');
    expect(midGateStep.run).toContain('@cdklabs/mid');

    const baseGateStep = gateJob.steps.find((s: any) => s.name?.includes('@cdklabs/base'));
    expect(baseGateStep.run).toContain('@cdklabs/top');
    expect(baseGateStep.run).toContain('@cdklabs/mid');
    expect(baseGateStep.run).toContain('@cdklabs/base');

    // When @cdklabs/mid is selected, only base and mid should be released (not top)
    expect(baseGateStep.run).toContain('@cdklabs/mid');
    expect(topGateStep.run).not.toContain('@cdklabs/mid');

    // Full workflow snapshot
    expect(outdir['.github/workflows/release.yml']).toMatchSnapshot();
  });
});

function parseJsonWithMarker(content: string): any {
  return JSON.parse(content.split('\n').slice(1).join('\n'));
}
