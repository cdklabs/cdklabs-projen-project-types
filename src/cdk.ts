import { awscdk, typescript } from 'projen';
import { Stability } from 'projen/lib/cdk';
import { Private } from './private';

export interface CdkConstructLibraryOptions extends awscdk.AwsCdkConstructLibraryOptions {
  /**
   * Whether or not this package is private. Setting this variable
   * to true means that your project is created with sane defaults
   * for private repositories.
   *
   * @default true
   */
  readonly private?: boolean;
}

/**
 * Create a Cdk Construct Library Project
 *
 * @pjid cdk-construct-lib
 */
export class CdkConstructLibrary extends awscdk.AwsCdkConstructLibrary {
  private static stabilityRequirements(options: CdkConstructLibraryOptions): string[] {
    const errors: string[] = [];
    if (!options.publishToPypi) {
      errors.push('Publishing Error: project not configured to publish to Python');
    }
    if (!options.publishToMaven) {
      errors.push('Publishing Error: project not configured to publish to Maven');
    }
    if (!options.publishToNuget) {
      errors.push('Publishing Error: project not configured to publish to Nuget');
    }
    if (!options.publishToGo) {
      errors.push('Publishing Error: project not configured to publish to Go');
    }
    return errors;
  }

  public readonly private: boolean;

  constructor(options: CdkConstructLibraryOptions) {
    if (options.stability === Stability.STABLE) {
      const errors = CdkConstructLibrary.stabilityRequirements(options);
      if (errors.length > 0) {
        throw new Error(`The project does not pass stability requirements due to the following errors:\n  ${errors.join('\n  ')}`);
      }
    }

    super({
      stability: Stability.EXPERIMENTAL,
      ...options,
    });

    this.private = options.private ?? true;

    if (this.private) {
      new Private(this);
    }
  }
}

export interface CdkTypeScriptProjectOptions extends typescript.TypeScriptProjectOptions {
  /**
   * Whether or not this module is private. Setting this variable
   * to true means that your project is created with sane defaults
   * for private repositories.
   *
   * @default true
   */
  readonly private?: boolean;
}

/**
 * Create a Cdk TypeScript Project
 *
 * @pjid cdk-ts-proj
 */
export class CdkTypeScriptProject extends typescript.TypeScriptProject {
  public readonly private: boolean;

  constructor(options: CdkTypeScriptProjectOptions) {
    super(options);
    this.private = options.private ?? true;
    if (this.private) {
      new Private(this);
    }
  }
}
