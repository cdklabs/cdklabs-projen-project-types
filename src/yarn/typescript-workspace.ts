
import { relative } from 'path';
import { Component, javascript, typescript, TaskStep, SourceCode, DependencyType, Project } from 'projen';
import { Monorepo } from './monorepo';
import { TypeScriptWorkspaceOptions } from './typescript-workspace-options';

/**
 * What kind of semver dependency to take
 *
 * - 'any-minor' corresponds to '^1'
 * - 'future-minor' corresponds to '^1.2.3'
 * - 'any-patch' to '~1.2'
 * - 'future-patch' corresponds to '~1.2.3'
 * - 'exact' corresponds to '1.2.3'
 * - 'any-future' corresponds to '>=1.2.3'
 * - 'any' corresponds to '*'
 */
export type VersionType = 'any-minor' | 'future-minor' | 'any-patch' | 'future-patch' | 'exact' | 'any-future' | 'any';

/**
 * A reference to a workspace in the same monorepo
 *
 * This can be used to reference packages in the same monorepo when declaring
 * `deps` and `devDeps`.
 *
 * By default, all `TypeScriptWorkspace`s implement this interface, representing themselves
 * with a `^` dependency and a restriction that public packages must have public dependencies.
 *
 * The method `.customizeReference({ ... })` can be used to create a workspace reference with
 * different behavior.
 */
export interface IWorkspaceReference {
  /**
   * Whether the referenced workspace package is private
   */
  readonly isPrivatePackage: boolean;

  /**
   * The dependency name of the package
   */
  readonly name: string;

  /**
   * The semver range that should be used to reference this package when it is released
   */
  readonly versionType: VersionType;

  /**
   * The directory that holds this package in the monorepo
   */
  readonly outdir: string;
}

/**
 * A TypeScript workspace in a `yarn.Monorepo`
 */
export class TypeScriptWorkspace extends typescript.TypeScriptProject implements IWorkspaceReference {
  public readonly workspaceDirectory: string;
  public readonly bundledDeps: string[] = [];
  public readonly isPrivatePackage: boolean;
  public readonly versionType = 'future-minor';

  private readonly monorepo: Monorepo;

  constructor(options: TypeScriptWorkspaceOptions) {
    const remainder = without(
      options,
      'parent',
      'name',
      'description',
      'deps',
      'peerDeps',
      'devDeps',
      'excludeDepsFromUpgrade',
      'repository',
      'workflowNodeVersion',
      'allowPrivateDeps',
    );

    const useEslint = remainder.eslint ?? true;
    const usePrettier = remainder.prettier ?? true;

    const wsScope = remainder.workspaceScope ?? 'packages';
    const workspaceDirectory =`${wsScope}/${options.name}`;

    const npmAccess = options.parent.monorepoRelease && !options.private ? javascript.NpmAccess.PUBLIC : undefined;

    super({
      parent: options.parent,
      name: options.name,
      description: options.description,
      repository: options.repository ?? options.parent.repositoryUrl,
      repositoryDirectory: workspaceDirectory,
      outdir: workspaceDirectory,
      defaultReleaseBranch: 'REQUIRED-BUT-SHOULD-NOT-BE',
      release: false,
      package: !options.private,
      eslint: useEslint,
      prettier: usePrettier,
      prettierOptions: usePrettier
        ? {
          overrides: options.parent.prettier?.overrides,
          settings: options.parent.prettier?.settings,
          ...remainder.prettierOptions,
        }
        : undefined,
      eslintOptions: useEslint
        ? {
          dirs: [remainder.srcdir ?? 'src'],
          devdirs: [remainder.testdir ?? 'test', 'build-tools'],
          ...remainder.eslintOptions,
          prettier: usePrettier,
        }
        : undefined,
      sampleCode: false,

      deps: packageNames(options.deps),
      peerDeps: packageNames(options.peerDeps),
      devDeps: packageNames(options.devDeps),
      projenDevDependency: true,

      depsUpgradeOptions: {
        exclude: [
          ...(options.excludeDepsFromUpgrade ?? []),
          ...(packageNames(options.deps?.filter(isWorkspaceReference)) ?? []),
          ...(packageNames(options.peerDeps?.filter(isWorkspaceReference)) ?? []),
          ...(packageNames(options.devDeps?.filter(isWorkspaceReference)) ?? []),
        ],
      },

      npmAccess,

      // Deviation from upstream projen: upstream projen defaults to minNodeVersion, but we have too many workflows
      // that use tools that want a recent Node version, so default to a reasonable floating version.
      workflowNodeVersion: options.workflowNodeVersion ?? 'lts/*',

      ...remainder,
    });

    this.monorepo = options.parent;
    this.isPrivatePackage = options.private ?? false;
    this.workspaceDirectory = workspaceDirectory;

    // If the package is public, all local deps and peer deps must also be public and other TypeScriptWorkspaces
    if (!this.isPrivatePackage) {
      const illegalDeps = [
        // Overridable for deps because this might make sense if we bundle the package.
        ...options.deps?.filter(isWorkspaceReference).filter(w => w.isPrivatePackage && !options.allowPrivateDeps) ?? [],
        // But not for peerDeps, they must always be installed by the user.
        ...options.peerDeps?.filter(isWorkspaceReference).filter(w => w.isPrivatePackage) ?? [],
        // devDeps can be private, we don't care.
      ];

      if (illegalDeps.length) {
        throw new Error([
          `${this.name} is public and cannot depend on any private packages from the workspace.`,
          `Please fix these dependencies:\n    - ${illegalDeps.map((p) => p.name).join('\n    - ')}`,
        ].join('\n'));
      }
    }

    // Register with release workflow
    this.monorepo.monorepoRelease?.addWorkspace(this, {
      private: this.isPrivatePackage,
      workflowNodeVersion: this.nodeVersion,
      npmDistTag: options.npmDistTag,
      releasableCommits: options.releasableCommits,
      nextVersionCommand: options.nextVersionCommand,
      versionBranchOptions: {
        majorVersion: options.majorVersion,
        minMajorVersion: options.minMajorVersion,
        prerelease: options.prerelease,
      },
      repoRuntimeDependencies: Object.fromEntries([
        ...options.deps ?? [],
        ...options.peerDeps ?? [],
      ].filter(isWorkspaceReference).map(w => [w.name, w.versionType])),
    });

    // jest config
    if (this.jest?.config && this.jest.config.preset === 'ts-jest') {
      delete this.jest.config.globals?.['ts-jest'];
      this.jest.config.transform = {
        '^.+\\.tsx?$': [
          'ts-jest',
          {
            tsconfig: this.tsconfigDev.fileName,
          },
        ],
      };
    }

    // Tasks
    this.tasks.tryFind('default')?.reset(`cd ${relative(this.outdir, options.parent.outdir)} && npx projen default`);
    this.tasks.removeTask('clobber');
    this.tasks.removeTask('eject');

    const upgrades: any = this.components.find(
      (c: Component): c is javascript.UpgradeDependencies => c instanceof javascript.UpgradeDependencies,
    );
    this.tasks.removeTask('upgrade');
    this.tasks.removeTask('post-upgrade');
    this.tasks.addTask('check-for-updates', {
      env: { CI: '0' },
      steps: {
        toJSON: () => {
          const steps = upgrades.renderTaskSteps() as TaskStep[];
          return steps.filter(
            (step) => step.exec && typeof step.exec === 'string' && step.exec?.startsWith('npx npm-check-updates'),
          );
        },
      } as any,
    });

    // Composite project and references
    const allDeps = [...(options.deps ?? []), ...(options.peerDeps ?? []), ...(options.devDeps ?? [])];

    for (const tsconfig of [this.tsconfig, this.tsconfigDev]) {
      tsconfig?.file.addOverride('compilerOptions.composite', true);
      tsconfig?.file.addOverride(
        'references',
        allDeps.filter(isWorkspaceReference).map((p) => ({ path: relative(this.outdir, p.outdir) })),
      );
    }

    // Allow passing additional args like `--force` to the compile task
    // Needed because we use composite projects that often need a tsc --build --force
    this.tasks.tryFind('compile')?.reset('tsc --build', {
      receiveArgs: true,
    });

    // Install dependencies via the parent project
    /* @ts-ignore access private method */
    const originalResolve = this.package.resolveDepsAndWritePackageJson;
    /* @ts-ignore access private method */
    this.package.installDependencies = () => {
      options.parent.requestInstallDependencies({ resolveDepsAndWritePackageJson: () => originalResolve.apply(this.package) });
    };
    /* @ts-ignore access private method */
    this.package.resolveDepsAndWritePackageJson = () => {};

    // Private package
    if (options.private) {
      this.package.addField('private', true);
    }

    // Fixes
    this.addTsconfigDevFix();
    this.addEslintRcFix();

    this.bundledDeps.push(...options.bundledDeps ?? []);

    // Individual workspace packages shouldn't depend on "projen", it gets brought in at the monorepo root
    this.deps.removeDependency('projen');

    options.parent.register(this);
  }

  /**
   * I don't know why `tsconfig.dev.json` doesn't have an outdir, or where it's used,
   * but it's causing in-place `.js` files to appear.
   */
  protected addTsconfigDevFix () {
    this.tsconfigDev.file.addOverride('compilerOptions.outDir', 'lib');
  }

  /**
   * Need to hack ESLint config
   *
   * .eslintrc.js will take precedence over the JSON file, it will load the
   * JSON file and patch it with a dynamic directory name that cannot be represented in
   * plain JSON (see https://github.com/projen/projen/issues/2405).
   *
   * Since eslint config is loaded with different cwd's depending on whether it's
   * from the VSCode plugin or from the command line, use absolute paths everywhere.
   */
  protected addEslintRcFix() {
    const eslintRc = new SourceCode(this, '.eslintrc.js');
    eslintRc.line('var path = require(\'path\');');
    eslintRc.line('var fs = require(\'fs\');');
    eslintRc.line('var contents = fs.readFileSync(`${__dirname}/.eslintrc.json`, { encoding: \'utf-8\' });');
    eslintRc.line('// Strip comments, JSON.parse() doesn\'t like those');
    eslintRc.line('contents = contents.replace(/^\\/\\/.*$/m, \'\');');
    eslintRc.line('var json = JSON.parse(contents);');
    eslintRc.line('// Patch the .json config with something that can only be represented in JS');
    eslintRc.line('json.parserOptions.tsconfigRootDir = __dirname;');
    eslintRc.line('module.exports = json;');
  }

  /**
   * Return all Projects in the workspace that are also dependencies.
   *
   * Optionally filter by dependency type.
   */
  public workspaceDependencies(types?: DependencyType[]): Project[] {
    return this.monorepo.subprojects.filter((sibling) =>
      this.deps.all.some((d) => d.name === sibling.name && (!types || types.includes(d.type))),
    );
  }

  /**
   * Return a specialized reference to this workspace
   */
  public customizeReference(refOpts?: ReferenceOptions): IWorkspaceReference {
    return {
      name: this.name,
      outdir: this.outdir,
      isPrivatePackage: this.isPrivatePackage,
      versionType: refOpts?.versionType ?? this.versionType,
    };
  }
}

/**
 * Options for the `workspace.customizeReference()` method
 */
export interface ReferenceOptions {
  /**
   * What type of dependency to take on this package
   *
   * By default, dependencies will be referenced with a `^`, which means that
   * come install time a newer version may be installed.
   *
   * Choose a different range type to take, for example, an `exact` dependency.
   *
   * @default 'future-minor'
   */
  readonly versionType?: VersionType;
}

function packageNames(xs?: Array<string | IWorkspaceReference>): string[] | undefined {
  if (!xs) {
    return undefined;
  }
  return xs.map((x) => (typeof x === 'string' ? x : x.name));
}

function without<A extends object, K extends keyof A>(x: A, ...ks: K[]): Omit<A, K> {
  const ret = { ...x };
  for (const k of ks) {
    delete ret[k];
  }
  return ret;
}

function isWorkspaceReference(x: unknown): x is IWorkspaceReference {
  return typeof x === 'object' && !!x && (['isPrivatePackage', 'versionType', 'name', 'outdir'] satisfies Array<keyof IWorkspaceReference>).every(k => (x as any)[k] !== undefined);
}
