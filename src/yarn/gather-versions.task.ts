import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DependencyType, TaskOptions, TaskStep } from 'projen';
import { TypeScriptWorkspace, VersionType } from './typescript-workspace';

export interface GatherVersionsOptions {
  /**
   * For regular and peer dependencies only, the type of dependency we take on each package
   */
  readonly repoRuntimeDependencies: Record<string, VersionType>;
}

export class GatherVersions implements TaskOptions, TaskStep {
  public receiveArgs = true;

  private readonly options: GatherVersionsOptions;

  public constructor(public readonly project: TypeScriptWorkspace, options: GatherVersionsOptions) {
    this.options = options;
  }

  private get repoDependencies(): Record<string, VersionType> {
    // Build list at access time so lazily-added workspace deps are included
    const wsDeps = new Set(this.project.workspaceDependencies().map(p => p.name));

    const repoDevDependencies = Object.fromEntries(devDeps(this.project)
      .filter(d => wsDeps.has(d.name))
      .map((d) => [d.name, 'exact'] satisfies [string, VersionType]),
    );

    return {
      ...repoDevDependencies,
      ...this.options.repoRuntimeDependencies,
    };
  }

  public get exec(): string {
    // We must resolve paths at runtime to avoid writing '/home/$USER/...' into the `tasks.json` file
    const main = `require(require.resolve('${currentPackageName()}/lib/yarn/gather-versions.exec.js')).cliMain()`;
    return `node -e "${main}" ${Object.entries(this.repoDependencies).map(([d, r]) => `${d}=${r}`).join(' ')}`;
  }

  public toJSON() {
    return {
      exec: this.exec,
      receiveArgs: this.receiveArgs,
    };
  }
}

function devDeps(p: TypeScriptWorkspace) {
  return p.deps.all.filter(d => [DependencyType.BUILD, DependencyType.DEVENV, DependencyType.TEST].includes(d.type));
}

function currentPackageName(): string {
  const pkg = JSON.parse(readFileSync(require.resolve(join(__dirname, '..', '..', 'package.json'))).toString());
  return pkg.name;
}
