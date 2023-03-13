
import { relative } from 'path';
import { Component, javascript, typescript, TaskStep, SourceCode } from 'projen';
import { Monorepo } from './monorepo';

export interface TypeScriptWorkspaceOptions
  extends Omit<
  typescript.TypeScriptProjectOptions,
  | 'parent'
  | 'defaultReleaseBranch'
  | 'release'
  | 'repositoryDirectory'
  | 'autoDetectBin'
  | 'outdir'
  | 'deps'
  | 'devDeps'
  | 'peerDeps'
  | 'depsUpgradeOptions'
  > {
  readonly parent: Monorepo;

  /**
   * The workspace scope the package is located in
   *
   * @default "packages"
   */
  readonly wsScope?: string;

  readonly private?: boolean;

  readonly deps?: Array<string | TypeScriptWorkspace>;
  readonly devDeps?: Array<string | TypeScriptWorkspace>;
  readonly peerDeps?: Array<string | TypeScriptWorkspace>;
  readonly excludeDepsFromUpgrade?: Array<string>;
}


export class TypeScriptWorkspace extends typescript.TypeScriptProject {
  public readonly parent: Monorepo;

  constructor(props: TypeScriptWorkspaceOptions) {
    const remainder = without(
      props,
      'parent',
      'name',
      'description',
      'deps',
      'peerDeps',
      'devDeps',
      'excludeDepsFromUpgrade',
    );

    const useEslint = remainder.eslint ?? true;
    const usePrettier = remainder.prettier ?? true;

    const wsScope = remainder.wsScope ?? 'packages';

    super({
      parent: props.parent,
      name: props.name,
      description: props.description,
      repositoryDirectory: `${wsScope}/${props.name}`,
      outdir: `${wsScope}/${props.name}`,
      defaultReleaseBranch: 'REQUIRED-BUT-SHOULD-NOT-BE',
      release: false,
      package: !props.private,
      eslint: useEslint,
      prettier: usePrettier,
      prettierOptions: usePrettier
        ? {
          overrides: props.parent.prettier?.overrides,
          settings: props.parent.prettier?.settings,
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

      deps: packageNames(props.deps),
      peerDeps: packageNames(props.peerDeps),
      devDeps: packageNames(props.devDeps),

      depsUpgradeOptions: {
        exclude: [
          ...(props.excludeDepsFromUpgrade ?? []),
          ...(packageNames(props.deps?.filter(isTypeScriptWorkspace)) ?? []),
          ...(packageNames(props.peerDeps?.filter(isTypeScriptWorkspace)) ?? []),
          ...(packageNames(props.devDeps?.filter(isTypeScriptWorkspace)) ?? []),
        ],
      },

      ...remainder,
    });
    this.parent = props.parent;

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
    this.tasks.tryFind('default')?.reset(`cd ${relative(this.outdir, this.parent.outdir)} && npx projen default`);
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
            (step) => step.exec && typeof step.exec === 'string' && step.exec?.startsWith('npm-check-updates'),
          );
        },
      } as any,
    });

    // Composite project and references
    const allDeps = [...(props.deps ?? []), ...(props.peerDeps ?? []), ...(props.devDeps ?? [])];

    for (const tsconfig of [this.tsconfig, this.tsconfigDev]) {
      tsconfig?.file.addOverride('compilerOptions.composite', true);
      tsconfig?.file.addOverride(
        'references',
        allDeps.filter(isTypeScriptWorkspace).map((p) => ({ path: relative(this.outdir, p.outdir) })),
      );
    }

    // Install dependencies via the parent project
    (this.package as any).installDependencies = () => {
      this.parent.requestInstallDependencies({ resolveDepsAndWritePackageJson: () => (this.package as any).resolveDepsAndWritePackageJson() });
    };

    // Private package
    if (props.private) {
      this.package.addField('private', true);
    }

    // Fixes
    this.addTsconfigDevFix();
    this.addEslintRcFix();

    props.parent.register(this);
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
   */
  protected addEslintRcFix() {
    const eslintRc = new SourceCode(this, '.eslintrc.js');
    eslintRc.line('var path = require(\'path\');');
    eslintRc.line('var fs = require(\'fs\');');
    eslintRc.line('var contents = fs.readFileSync(\'.eslintrc.json\', { encoding: \'utf-8\' });');
    eslintRc.line('// Strip comments, JSON.parse() doesn\'t like those');
    eslintRc.line('contents = contents.replace(/^\\/\\/.*$/m, \'\');');
    eslintRc.line('var json = JSON.parse(contents);');
    eslintRc.line('// Patch the .json config with something that can only be represented in JS');
    eslintRc.line('json.parserOptions.tsconfigRootDir = __dirname;');
    eslintRc.line('module.exports = json;');
  }
}


function packageNames(xs?: Array<string | TypeScriptWorkspace>): string[] | undefined {
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

function isTypeScriptWorkspace(x: unknown): x is TypeScriptWorkspace {
  return typeof x === 'object' && !!x && x instanceof TypeScriptWorkspace;
}
