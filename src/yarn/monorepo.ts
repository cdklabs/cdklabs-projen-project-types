import { JsonFile, Project, typescript } from 'projen';
import { NodePackageManager } from 'projen/lib/javascript';
import { MonorepoOptions } from './monorepo-options';
import { TypeScriptWorkspace } from './typescript-workspace';
import { MergeQueue } from '../merge-queue';

/**
 * A monorepo using yarn workspaces.
 */
export class Monorepo extends typescript.TypeScriptProject {
  private projects = new Array<TypeScriptWorkspace>();
  private postInstallDependencies = new Array<() => boolean>();

  constructor(options: MonorepoOptions) {
    super({
      ...options,
      packageManager: NodePackageManager.YARN,
      sampleCode: false,
      jest: false,
      eslint: false,
      release: false,
    });

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
      this.tasks.addTask('fmt', { exec: 'eslint --ext .ts --fix projenrc .projenrc.ts' });

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
          folders: this.projects
            .sort((p1, p2) => p1.name.localeCompare(p2.name))
            .map((p) => ({ path: `packages/${p.name}` })),
          settings: () => getObjFromFile(this, '.vscode/settings.json'),
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
        { exec: 'yarn upgrade npm-check-updates' },
        { exec: 'npm-check-updates --dep=dev,optional,peer,prod,bundle --upgrade --target=minor' },
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
      packages: this.projects.map((p) => `packages/${p.name}`),
    });

    this.tsconfig?.file.addOverride('include', []);
    this.tsconfigDev?.file.addOverride('include', ['.projenrc.ts', 'projenrc/**/*.ts']);
    for (const tsconfig of [this.tsconfig, this.tsconfigDev]) {
      tsconfig?.file.addOverride(
        'references',
        this.projects.map((p) => ({ path: `packages/${p.name}` })),
      );
    }

    this.package.addField('jest', {
      projects: this.projects.map((p) => `<rootDir>/packages/${p.name}`),
    });
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
 */
export class CdkLabsMonorepo extends Monorepo {
  constructor(options: CdkLabsMonorepoOptions) {
    super({
      projenrcTs: true,

      autoApproveUpgrades: true,
      autoApproveOptions: {
        allowedUsernames: ['github-bot', 'cdklabs-automation'],
        secret: 'GITHUB_TOKEN',
      },
      ...options,
      githubOptions: {
        ...options.githubOptions,
        mergify: false,
      },
    });

    new MergeQueue(this, {
      autoMergeOptions: {
        secret: 'PROJEN_GITHUB_TOKEN',
      },
    });
  }
}
