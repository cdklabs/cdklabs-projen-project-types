import { IConstruct, IMixin } from 'constructs';
import { Dependencies, JsonPatch } from 'projen';
import { JsiiBuild, JsiiBuildOptions } from 'projen/lib/cdk';
import { TypeScriptWorkspace } from './typescript-workspace';
import { Rosetta } from '../rosetta';

export type { JsiiBuildOptions } from 'projen/lib/cdk';

export interface WorkspaceJsiiBuildOptions extends JsiiBuildOptions {
  /**
   * Whether to turn on 'strict' mode for Rosetta
   * @default true
   */
  readonly rosettaStrict?: boolean;

  /**
   * Additional example dependencies for Rosetta
   *
   * @see https://github.com/aws/jsii-rosetta?tab=readme-ov-file#dependencies
   * @default []
   */
  readonly rosettaDependencies?: string[];

  /**
   * Whether to turn on composite mode for the TypeScript project
   * @default false
   */
  readonly composite?: boolean;

  /**
   * PyPI classifiers to add to `package.json`.
   * @default none
   */
  readonly pypiClassifiers?: string[];
}

/**
 * A mixin that applies the upstream projen JsiiBuild to a TypeScriptWorkspace,
 * adding monorepo-appropriate defaults (Rosetta, composite, pypiClassifiers).
 */
export class WorkspaceJsiiBuild implements IMixin {
  private readonly options: WorkspaceJsiiBuildOptions;

  constructor(options: WorkspaceJsiiBuildOptions = {}) {
    this.options = options;
  }

  public supports(construct: IConstruct): construct is TypeScriptWorkspace {
    return construct instanceof TypeScriptWorkspace;
  }

  public applyTo(construct: IConstruct): void {
    if (!this.supports(construct)) {
      return;
    }

    // Apply upstream JsiiBuild with the workspace's directory
    new JsiiBuild({
      ...this.options,
      workspaceDirectory: this.options.workspaceDirectory ?? construct.workspaceDirectory,
      workflowNodeVersion: this.options.workflowNodeVersion ?? (construct as any).nodeVersion ?? 'lts/*',
      npmTrustedPublishing: this.options.npmTrustedPublishing ?? true,
    }).applyTo(construct);

    // In a monorepo, only package js (the npm tarball). Other language targets
    // are packaged in separate release workflow jobs, not locally.
    construct.packageTask.reset();
    construct.packageTask.spawn(construct.tasks.tryFind('package:js')!);

    // Composite project references for monorepo
    if (this.options.composite) {
      construct.package.file.addOverride('jsii.projectReferences', true);
    }

    // Rosetta
    const jsiiVersion = (this.options.jsiiVersion === '*' ? undefined : this.options.jsiiVersion) ?? '~5.9.0';
    new Rosetta(construct, {
      strict: this.options.rosettaStrict ?? true,
      version: jsiiVersion,
    });

    // Rosetta example dependencies
    if (this.options.rosettaDependencies?.length) {
      const deps = Object.fromEntries(
        this.options.rosettaDependencies.map(d => Dependencies.parseDependency(d)).map(d => [d.name, d.version ?? '*']),
      );
      construct.package.file.addOverride('jsiiRosetta.exampleDependencies', deps);
    }

    // PyPI classifiers
    if ((this.options.pypiClassifiers ?? []).length > 0) {
      construct.package.file.patch(
        JsonPatch.add('/jsii/targets/python/classifiers', this.options.pypiClassifiers),
      );
    }
  }
}
