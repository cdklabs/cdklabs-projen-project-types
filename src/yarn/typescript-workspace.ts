
import { dirname, relative } from 'path';
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
  public declare readonly parent: Monorepo | undefined;
  public readonly workspaceDirectory: string;
  public readonly bundledDeps: string[] = [];
  public readonly isPrivatePackage: boolean;
  public readonly versionType = 'future-minor';

  private readonly monorepo: Monorepo;
  private readonly allowPrivateDeps: boolean;
  private readonly excludeFromUpgrade: string[];
  private readonly repoRuntimeDeps: Record<string, VersionType> = {};

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
    const workspaceDirectory = `${wsScope}/${options.name}`;

    const npmAccess = options.parent.monorepoRelease && !options.private ? javascript.NpmAccess.PUBLIC : undefined;

    const releaseEnvironment = options.releaseEnvironment ?? options.parent.settings.releaseEnvironment;

    const excludeFromUpgrade = [
      ...(options.excludeDepsFromUpgrade ?? []),
    ];

    super({
      parent: options.parent,
      name: options.name,
      description: options.description,
      repository: options.repository ?? options.parent.repositoryUrl,
      repositoryDirectory: workspaceDirectory,
      outdir: workspaceDirectory,
      defaultReleaseBranch: 'REQUIRED-BUT-SHOULD-NOT-BE',
      packageManager: options.parent.package.packageManager,
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

      // add non workspace dependencies here
      // workspace refs are added later
      deps: options.deps?.filter(isNotWorkspaceReference),
      peerDeps: options.peerDeps?.filter(isNotWorkspaceReference),
      devDeps: options.devDeps?.filter(isNotWorkspaceReference),

      projenDevDependency: true,
      releaseEnvironment,

      depsUpgrade: options.depsUpgrade ?? true,
      depsUpgradeOptions: {
        workflow: false,
        cooldown: options.parent.settings.depsUpgradeOptions?.cooldown ?? (options.parent.settings.yarnBerry ? 3 : undefined),
        exclude: excludeFromUpgrade,
      },

      npmAccess,

      // Deviation from upstream projen: upstream projen defaults to minNodeVersion, but we have too many workflows
      // that use tools that want a recent Node version, so default to a reasonable floating version.
      workflowNodeVersion: options.workflowNodeVersion ?? 'lts/*',

      ...remainder,
    });

    this.monorepo = options.parent;
    this.isPrivatePackage = options.private ?? false;
    this.allowPrivateDeps = options.allowPrivateDeps ?? false;
    this.excludeFromUpgrade = excludeFromUpgrade;
    this.workspaceDirectory = workspaceDirectory;

    // Register with release workflow
    this.monorepo.monorepoRelease?.addWorkspace(this, {
      private: this.isPrivatePackage,
      workflowNodeVersion: this.nodeVersion,
      npmDistTag: options.npmDistTag,
      // Inherit setting from Monorepo if configured
      npmTrustedPublishing: options.npmTrustedPublishing ?? this.monorepo.settings.npmTrustedPublishing,
      environment: releaseEnvironment,
      releasableCommits: options.releasableCommits,
      nextVersionCommand: options.nextVersionCommand,
      versionBranchOptions: {
        majorVersion: options.majorVersion,
        minMajorVersion: options.minMajorVersion,
        prerelease: options.prerelease,
      },
      repoRuntimeDependencies: this.repoRuntimeDeps,
    });

    // Expose the monorepo publisher as project.release so that other code can find it via project.release?.publisher
    // MUST be called after `this.monorepo.monorepoRelease?.addWorkspace(...)`
    // @ts-ignore - readonly property, but we need to set it for upstream mixin compatibility
    this.release = this.monorepo.monorepoRelease?.workspaceRelease(this);

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
    this.tasks.tryFind('default')?.reset('projen default', { cwd: relative(this.outdir, options.parent.outdir) });
    this.tasks.removeTask('clobber');
    this.tasks.removeTask('eject');

    const upgradeTaskName = 'upgrade';
    const upgrades = this.components.find(
      (c: Component): c is javascript.UpgradeDependencies => (
        c instanceof javascript.UpgradeDependencies && c.upgradeTask.name === upgradeTaskName
      ),
    );

    if (upgrades) {
      this.tasks.removeTask(upgrades.upgradeTask.name);
      this.tasks.removeTask(upgrades.postUpgradeTask.name);
      this.tasks.addTask('check-for-updates', {
        env: { ...upgrades.upgradeTask.envVars },
        steps: {
          toJSON: () => {
            const steps = (upgrades as any).renderTaskSteps() as TaskStep[];
            return steps.filter(
              (step) => step.execArgs && resolveFn(step.execArgs).join(' ').includes('npm-check-updates'),
            );
          },
        } as any,
      });
    }

    // Composite project and references
    for (const tsconfig of [this.tsconfig, this.tsconfigDev]) {
      tsconfig?.file.addOverride('compilerOptions.composite', true);
      tsconfig?.file.addOverride('references', []);
    }


    // Add workspace references
    for (const dep of options.deps?.filter(isWorkspaceReference) ?? []) {
      this.addWorkspaceDep(dep, DependencyType.RUNTIME);
    }
    for (const dep of options.peerDeps?.filter(isWorkspaceReference) ?? []) {
      this.addWorkspaceDep(dep, DependencyType.PEER);
    }
    for (const dep of options.devDeps?.filter(isWorkspaceReference) ?? []) {
      this.addWorkspaceDep(dep, DependencyType.BUILD);
    }

    // Allow passing additional args like `--force` to the compile task
    // Needed because we use composite projects that often need a tsc --build --force
    this.tasks.tryFind('compile')?.reset('tsc --build', {
      receiveArgs: true,
    });

    // We handle dependencies via the parent project

    // Disable workspace resolveDepsAndWritePackageJson
    /* @ts-ignore access private method */
    const originalResolve = this.package.resolveDepsAndWritePackageJson;
    /* @ts-ignore access private method */
    this.package.resolveDepsAndWritePackageJson = () => [];

    // Instead of installing dependencies, request from the parent
    /* @ts-ignore access private method */
    this.package.installDependencies = (trigger: javascript.InstallTrigger) => {
      if (trigger.reason === javascript.InstallReason.NO_NODE_MODULES) {
        // In a monorepo, a workspace node_modules may legitimately not exist due to hoisting. We just skip this case.
        return;
      }
      options.parent.requestInstallDependencies({ resolveDepsAndWritePackageJson: () => originalResolve.apply(this.package) });
    };

    // Fix the install trigger logging to match actual requests
    /* @ts-ignore access private method */
    const originalLogTrigger = this.package.logInstallTrigger;
    /* @ts-ignore access private method */
    this.package.logInstallTrigger = (trigger: InstallTrigger) => {
      if (trigger.reason === javascript.InstallReason.NO_NODE_MODULES) {
        return;
      }
      /* @ts-ignore access private method */
      return originalLogTrigger.apply(this.package, [trigger]);
    };

    // Private package
    if (options.private) {
      this.package.addField('private', true);
    }

    // Yarn Berry installConfig
    if (options.hoistingLimits) {
      this.package.addField('installConfig', { hoistingLimits: options.hoistingLimits });
    }

    // Fixes
    this.addTsconfigDevFix();
    this.addEslintRcFix();

    this.bundledDeps.push(...options.bundledDeps ?? []);

    // Individual workspace packages shouldn't depend on "projen", it gets brought in at the monorepo root
    this.deps.removeDependency('projen');
  }

  /**
   * I don't know why `tsconfig.dev.json` doesn't have an outdir, or where it's used,
   * but it's causing in-place `.js` files to appear.
   */
  protected addTsconfigDevFix() {
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
   * Add a workspace package as a dependency, including tsconfig project references.
   *
   * Use this to add workspace dependencies after construction (e.g. from a mixin).
   * It does the same as passing the workspace in the `deps`/`devDeps`/`peerDeps` constructor option.
   */
  public addWorkspaceDep(ref: IWorkspaceReference, type: DependencyType = DependencyType.RUNTIME): void {
    if (this.deps.tryGetDependency(ref.name)) {
      return;
    }
    switch (type) {
      case DependencyType.RUNTIME:
        this.addDeps(ref.name);
        break;
      case DependencyType.PEER:
        this.addPeerDeps(ref.name);
        break;
      case DependencyType.DEVENV:
      case DependencyType.BUILD:
      case DependencyType.TEST:
        this.addDevDeps(ref.name);
        break;
      default:
        this.addDeps(ref.name);
    }
    for (const tsconfig of [this.tsconfig, this.tsconfigDev]) {
      if (tsconfig) {
        const relativePath = relative(dirname(tsconfig.file.absolutePath), ref.outdir);
        tsconfig?.file.addToArray('references', { path: relativePath });
      }
    }
    this.excludeFromUpgrade.push(ref.name);
    if (type === DependencyType.RUNTIME || type === DependencyType.PEER) {
      this.repoRuntimeDeps[ref.name] = ref.versionType;
    }
  }

  public preSynthesize(): void {
    super.preSynthesize();
    this.typecheckTestsAgainstLibrarySource();
    this.validateNoPrivateWorkspaceDeps();
  }

  /**
   * Type-check tests against the library *source* rather than its emitted declarations.
   *
   * The dev/test tsconfig is a separate `composite` project, so it doesn't see the library
   * source by default. Rather than referencing the main project (which would consume its
   * `stripInternal`'d declarations and hide `@internal` members from tests under `tsc --build`),
   * we mirror the main project's `include` into the test program, path-adjusted to the test dir.
   *
   * Excludes are only mirrored when they target the source dir (`src/...`): a `src/`-prefixed
   * pattern can only match source files, so it can never drop a test file the test build owns
   * (e.g. `test/.../integ.*.ts`, which the library build excludes but the test build must keep).
   *
   * Runs at `preSynthesize` since the main tsconfig's patterns may be modified after construction.
   */
  private typecheckTestsAgainstLibrarySource(): void {
    const mainTsconfig = this.tsconfig;
    const testTsconfig = this.tsconfigDev;

    // When the dev tsconfig is disabled it aliases the main one (`tsconfig === tsconfigDev`),
    // so there is nothing to wire up.
    if (!mainTsconfig || !testTsconfig || mainTsconfig === testTsconfig) {
      return;
    }

    // The relative path from the test tsconfig directory to the main tsconfig directory
    // (e.g. `..`). When the two are co-located there is no project boundary to cross and the
    // library source is already part of the test program's file set, so there is nothing to do.
    const toMain = relative(dirname(testTsconfig.file.absolutePath), dirname(mainTsconfig.file.absolutePath));
    if (toMain === '') {
      return;
    }

    // Compile the same set of library source files as the main build, so `@internal` members
    // remain visible. The main tsconfig's patterns are relative to the package root; the test
    // tsconfig lives one directory deeper, so prefix them with the path back to the main dir.
    const srcPrefix = `${this.srcdir}/`;
    for (const pattern of mainTsconfig.include) {
      testTsconfig.addInclude(`${toMain}/${pattern}`);
    }
    // Only mirror excludes that target the source directory; test-directory excludes belong to
    // the library build alone (see above).
    for (const pattern of mainTsconfig.exclude) {
      if (pattern.startsWith(srcPrefix)) {
        testTsconfig.addExclude(`${toMain}/${pattern}`);
      }
    }
  }

  private validateNoPrivateWorkspaceDeps(): void {
    if (this.isPrivatePackage) return;

    const siblings = new Map(
      this.monorepo.subprojects
        .filter((p): p is TypeScriptWorkspace => p instanceof TypeScriptWorkspace)
        .map((p) => [p.name, p]),
    );

    const illegalDeps = this.deps.all
      .filter((d) => d.type === DependencyType.RUNTIME || d.type === DependencyType.PEER)
      .filter((d) => {
        const ws = siblings.get(d.name);
        if (!ws?.isPrivatePackage) return false;
        if (d.type === DependencyType.RUNTIME && this.allowPrivateDeps) return false;
        return true;
      })
      .map((d) => d.name);

    if (illegalDeps.length) {
      throw new Error([
        `${this.name} is public and cannot depend on private workspace packages.`,
        `Illegal dependencies:\n    - ${illegalDeps.join('\n    - ')}`,
      ].join('\n'));
    }
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

function isNotWorkspaceReference(x: unknown): x is string {
  return !isWorkspaceReference(x);
}

function resolveFn<A>(x: A | (() => A)): A {
  if (typeof x === 'function') {
    return (x as () => A)();
  }
  return x;
}