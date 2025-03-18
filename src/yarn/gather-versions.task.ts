import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DependencyType, TaskOptions, TaskStep } from 'projen';
import { TypeScriptWorkspace, VersionRange } from './typescript-workspace';

export interface GatherVersionsOptions {
  /**
   * For regular and peer dependencies only, the type of dependency we take on each package
   */
  readonly repoRuntimeDependencies: Record<string, VersionRange>;
}

export class GatherVersions implements TaskOptions, TaskStep {
  public receiveArgs = true;

  private repoDependencies: Record<string, VersionRange>;

  public constructor(public readonly project: TypeScriptWorkspace, options: GatherVersionsOptions) {
    // Start by building a list of all repo devdependencies and map them to an 'exact' dependency,
    // then add in the runtime dependencies. Only devs and peers can clash this way, peer will win.
    const wsDeps = new Set(this.project.workspaceDependencies().map(p => p.name));

    const repoDevDependencies = Object.fromEntries(devDeps(this.project)
      .filter(d => wsDeps.has(d.name))
      .map((d) => [d.name, 'exact'] satisfies [string, VersionRange]),
    );

    this.repoDependencies = {
      ...repoDevDependencies,
      ...options.repoRuntimeDependencies,
    };
  }

  public get exec(): string {
    const main = `require(path.join(path.dirname(require.resolve('${currentPackageName()}')), 'yarn', 'gather-versions.exec.js')).cliMain()`;
    return `node -e "${main}" ${Object.entries(this.repoDependencies).map(([d, r]) => `${d}=${r}`)}`;
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
