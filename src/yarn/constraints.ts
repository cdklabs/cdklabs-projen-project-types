import { Component, DependencyType, FileBase, IResolver, javascript } from 'projen';
import { Monorepo } from './monorepo';

const DEV_DEP_TYPES = [DependencyType.BUILD, DependencyType.DEVENV, DependencyType.TEST];

export interface ConstraintsOptions {
  /**
   * Package names that must use a consistent version across all workspaces.
   * Each package must already be declared as a dev dependency on the monorepo root.
   * The version is enforced across all workspaces using Yarn Berry constraints.
   */
  readonly consistentVersions: string[];
}

export class Constraints extends Component {
  declare readonly project: Monorepo;

  private readonly packages: string[];

  constructor(project: Monorepo, options: ConstraintsOptions) {
    super(project);

    this.packages = [...options.consistentVersions];

    project.addDevDeps('@yarnpkg/types');

    new ConstraintsFile(project, this.packages);

    // Add constraints fix to the default task
    this.project.defaultTask?.exec('yarn constraints --fix');
  }

  preSynthesize(): void {
    // Validate that all constrained packages are declared as dev deps on root
    for (const pkg of this.packages) {
      const dep = this.project.deps.all.find((d) => d.name === pkg && DEV_DEP_TYPES.includes(d.type));
      if (!dep) {
        throw new Error(`consistentVersions: '${pkg}' must be declared as a dev dependency on the monorepo root`);
      }
    }

    // Add constrained packages as devDeps to all workspaces
    for (const subproject of this.project.subprojects) {
      for (const pkg of this.packages) {
        if (!subproject.deps.all.some((d) => d.name === pkg && DEV_DEP_TYPES.includes(d.type))) {
          subproject.addDevDeps(pkg);
        }
      }
    }
  }
}

class ConstraintsFile extends FileBase {
  private readonly packages: string[];

  constructor(project: javascript.NodeProject, packages: string[]) {
    super(project, 'yarn.config.cjs', { editGitignore: true });
    this.packages = packages;
  }

  protected synthesizeContent(_: IResolver): string | undefined {
    const lines = [
      `// ${this.marker}`,
      '// @ts-check',
      '/** @type {import(\'@yarnpkg/types\')} */',
      'const { defineConfig } = require(`@yarnpkg/types`);',
      '',
      'module.exports = defineConfig({',
      '  async constraints({ Yarn }) {',
      '    const root = Yarn.workspace({ cwd: \'.\' });',
      `    for (const ident of ${JSON.stringify(this.packages)}) {`,
      '      const expected = root.manifest.devDependencies?.[ident];',
      '      if (!expected) continue;',
      '      for (const workspace of Yarn.workspaces()) {',
      '        if (workspace.manifest.devDependencies?.[ident]) {',
      '          workspace.set([\'devDependencies\', ident], expected);',
      '        }',
      '      }',
      '    }',
      '  },',
      '});',
      '',
    ];
    return lines.join('\n');
  }
}
