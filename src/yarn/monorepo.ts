import * as pathPosix from 'node:path/posix';
import { JsonFile, Project, javascript, typescript, github, DependencyType } from 'projen';
import { MonorepoOptions } from './monorepo-options';
import { MonorepoRelease } from './monorepo-release';
import { Nx } from './nx';
import { TypeScriptWorkspace } from './typescript-workspace';

const MONOREPO_SYM = Symbol.for('cdklabs-projen-project-types.yarn.Monorepo');

/**
 * A monorepo using yarn workspaces.
 */
export class Monorepo extends typescript.TypeScriptProject {
  public static isMonorepo(x: Project): x is Monorepo {
    return Boolean(x && typeof x === 'object' && MONOREPO_SYM in x);
  }

  public readonly monorepoRelease?: MonorepoRelease;

  /**
   * The URL where the actual code for the package lives.
   */
  public readonly repositoryUrl?: string;

  private projects = new Array<TypeScriptWorkspace>();
  private postInstallDependencies = new Array<() => boolean>();

  constructor(options: MonorepoOptions) {
    super({
      ...options,
      packageManager: javascript.NodePackageManager.YARN_CLASSIC,
      sampleCode: false,
      jest: false,
      eslint: false,
      release: false,
    });

    Object.defineProperty(this, MONOREPO_SYM, { value: true });

    this.repositoryUrl = options.repository;

    /**
     * Prettier formatting
     */
    if (options.prettier) {
      this.addDevDeps('eslint-config-prettier', 'eslint-plugin-prettier');
      new JsonFile(this, '.eslintrc.json', {
        allowComments: true,
        obj: {
          plugins: ['@typescript-eslint', 'prettier'],
          parser: '@typescript-eslint/parser',
          parserOptions: {
            ecmaVersion: 2018,
            sourceType: 'module',
            project: './tsconfig.dev.json',
          },
          ignorePatterns: ['!.projenrc.ts'],
          extends: ['plugin:prettier/recommended'],
        },
      });
      this.tasks.addTask('fmt', { exec: 'eslint --ext .ts --fix --no-error-on-unmatched-pattern projenrc .projenrc.ts' });

      this.vscode?.extensions.addRecommendations('esbenp.prettier-vscode', 'dbaeumer.vscode-eslint');
      this.vscode?.settings.addSetting('editor.defaultFormatter', 'esbenp.prettier-vscode');
      this.vscode?.settings.addSetting('eslint.format.enable', true);
      this.vscode?.settings.addSettings({ 'editor.defaultFormatter': 'dbaeumer.vscode-eslint' }, [
        'javascript',
        'typescript',
      ]);
    }

    /**
     * Create a VSCode Workspace
     */
    if (options.vscodeWorkspace) {
      const workspaceFile = `${this.name}.code-workspace`;
      new JsonFile(this, workspaceFile, {
        allowComments: true,
        obj: () => ({
          folders: () => {
            const folders: Array<{
              path: string;
              name?: string;
            }> = this.projects
              .sort((p1, p2) => p1.name.localeCompare(p2.name))
              .map((p) => ({ path: p.workspaceDirectory }));

            if (options.vscodeWorkspaceOptions?.includeRootWorkspace) {
              folders.unshift({ path: '.', name: options.vscodeWorkspaceOptions?.rootWorkspaceName ?? '<root>' });
            }

            return folders;
          },
          settings: () => {
            const settings = (getObjFromFile(this, '.vscode/settings.json') ?? {}) as any;
            if (options.vscodeWorkspaceOptions?.includeRootWorkspace && this.projects.length) {
              settings['files.exclude'] = this.projects.reduce((excludes, p) => {
                return {
                  ...excludes,
                  [p.workspaceDirectory.split(pathPosix.sep)[0]]: true,
                };
              }, settings['files.exclude'] ?? {});
            }
            return settings;
          },
          extensions: () => getObjFromFile(this, '.vscode/extensions.json'),
        }),
      });
    }

    /**
     * Tasks
     */
    // build task
    this.tasks.removeTask('build');
    const fmtTask = this.tasks.tryFind('fmt');
    const buildTask = this.tasks.addTask('build');
    if (this.defaultTask) {
      buildTask.spawn(this.defaultTask);
    }
    if (fmtTask) {
      buildTask.spawn(fmtTask);
    }
    buildTask.exec('yarn workspaces run build');

    // Run in all workspaces tasks
    this.tasks.tryFind('compile')?.reset('yarn workspaces run compile');
    this.tasks.tryFind('package')?.reset('yarn workspaces run package');
    this.tasks.tryFind('test')?.reset('yarn workspaces run test');
    this.addTask('run', {
      exec: 'yarn workspaces run',
      receiveArgs: true,
    });

    // Upgrade all packages
    this.tasks.removeTask('upgrade');
    this.tasks.addTask('upgrade', {
      env: { CI: '0' },
      description: 'Upgrade dependencies in all workspaces',
      steps: [
        // It is not safe anymore to have 'npm-check-updates' in a Yarn 1 dependency tree, so run it in a separate
        // tree by using npx.
        { exec: 'npx npm-check-updates@16 --dep=dev,optional,peer,prod,bundle --upgrade --target=minor' },
        { exec: 'yarn workspaces run check-for-updates' },
        { exec: 'yarn install --check-files' },
        { exec: 'yarn upgrade' },
        { spawn: 'default' },
        { spawn: 'post-upgrade' },
      ],
    });

    // Clean up tasks not required at top-level
    this.tasks.removeTask('eject');
    this.tasks.removeTask('watch');
    this.tasks.removeTask('pre-compile');
    this.tasks.removeTask('post-compile');

    // Nx
    if (options.nx) {
      new Nx(this, {
        defaultBase: options.defaultReleaseBranch,
      });
    }

    // Release Workflow
    if (options.release) {
      this.monorepoRelease = new MonorepoRelease(this, {
        workflowRunsOn: options.workflowRunsOn,
        ...options.releaseOptions,
      });
    }
  }

  public register(project: TypeScriptWorkspace) {
    this.projects.push(project);
  }

  public synth() {
    this.finalEscapeHatches();
    super.synth();
  }

  /**
   * Allows a sub project to request installation of dependency at the Monorepo root
   * They must provide a function that is executed after dependencies have been installed
   * If this function returns true, the install command is run for a second time after all sub project requests have run.
   * This is used to resolve dependency versions from `*` to a concrete version constraint.
   */
  public requestInstallDependencies(resolver: IDependencyResolver) {
    this.postInstallDependencies.push(resolver.resolveDepsAndWritePackageJson);
  }

  /**
   * Code that needs to run just before synth, but after all other code
   */
  private finalEscapeHatches() {
    // Get the ObjectFile
    this.package.addField('private', true);
    this.package.addField('workspaces', {
      packages: this.projects.map((p) => p.workspaceDirectory),
      ...this.renderNoHoist(),
    });

    this.tsconfig?.file.addOverride('include', []);
    this.tsconfigDev?.file.addOverride('include', ['.projenrc.ts', 'projenrc/**/*.ts']);
    for (const tsconfig of [this.tsconfig, this.tsconfigDev]) {
      tsconfig?.file.addOverride(
        'references',
        this.projects.map((p) => ({ path: p.workspaceDirectory })),
      );
    }

    this.package.addField('jest', {
      projects: this.projects.map((p) => `<rootDir>/${p.workspaceDirectory}`),
    });
  }

  /**
   * Render the 'nohoist' directive
   *
   * Bundled dependencies must be nohoist'ed, otherwise NPM silently won't bundle them.
   *
   * Renders an object that should be mixed into the `workspaces` object.
   */
  private renderNoHoist(): any {
    const nohoist = this.projects.flatMap((p) =>
      p.deps.all
        .filter((dep) => dep.type === DependencyType.BUNDLED)
        .flatMap((dep) => [
          `${p.name}/${dep.name}`,
          `${p.name}/${dep.name}/**`,
        ]),
    );
    return nohoist.length > 0 ? { nohoist } : undefined;
  }

  /**
   * Hooks into the install dependencies cycle
   */
  public postSynthesize() {
    if (this.postInstallDependencies.length) {
      const nodePkg: any = this.package;
      nodePkg.installDependencies();

      const completedRequests = this.postInstallDependencies.map((request) => request());
      if (completedRequests.some(Boolean)) {
        nodePkg.installDependencies();
      }

      this.postInstallDependencies = [];
    }
  }
}

export interface IDependencyResolver {
  resolveDepsAndWritePackageJson(): boolean;
}

function getObjFromFile(project: Project, file: string): object {
  return (project.tryFindObjectFile(file) as any)?.obj;
}

/**
 * Options for CdkLabsMonorepo
 */
export interface CdkLabsMonorepoOptions extends MonorepoOptions {}

/**
 * Opinionated implementation of yarn.Monorepo
 * @pjid cdklabs-yarn-monorepo
 */
export class CdkLabsMonorepo extends Monorepo {
  constructor(options: CdkLabsMonorepoOptions) {
    super({
      projenrcTs: true,

      autoApproveUpgrades: true,
      autoApproveOptions: {
        allowedUsernames: ['github-bot', 'cdklabs-automation', 'dependabot[bot]'],
        secret: 'GITHUB_TOKEN',
      },
      ...options,
      githubOptions: {
        ...options.githubOptions,
        mergify: false,
      },
      // Deviation from upstream projen: upstream projen defaults to minNodeVersion, but we have too many workflows
      // that use tools that want a recent Node version, so default to a reasonable floating version.
      workflowNodeVersion: options.workflowNodeVersion ?? 'lts/*',
    });

    new github.MergeQueue(this, {
      autoQueueOptions: {
        projenCredentials: github.GithubCredentials.fromPersonalAccessToken({ secret: 'PROJEN_GITHUB_TOKEN' }),
      },
    });
  }
}
