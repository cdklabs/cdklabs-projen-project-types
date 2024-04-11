import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TaskOptions, TaskStep } from 'projen';
import { TypeScriptWorkspace } from './typescript-workspace';

export enum VersionMatch {
  MAJOR = 'MAJOR',
  MINOR = 'MINOR',
  EXACT = 'EXACT',
}

export class GatherVersions implements TaskOptions, TaskStep {
  public get exec(): string {
    const main = `require(path.join(path.dirname(require.resolve('${currentPackageName()}')), 'yarn', 'gather-versions.exec.js'))`;
    return `node -e "${main}" ${this.project.name} ${this.versionMatch} --deps ${this.project
      .workspaceDependencies()
      .map((d) => d.name)
      .join(' ')}`;
  }
  public receiveArgs = true;

  public constructor(public readonly project: TypeScriptWorkspace, public readonly versionMatch: VersionMatch) {}

  public toJSON() {
    return {
      exec: this.exec,
      receiveArgs: this.receiveArgs,
    };
  }
}

function currentPackageName(): string {
  const pkg = JSON.parse(readFileSync(require.resolve(join(__dirname, '..', '..', 'package.json'))).toString());
  return pkg.name;
}
