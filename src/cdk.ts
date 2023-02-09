import { awscdk, typescript } from 'projen';
import { Stability } from 'projen/lib/cdk';
import { AutoMergeOptions } from './auto-merge';
import { IntegRunner } from './integ-runner';
import { MergeQueue } from './merge-queue';
import { Private } from './private';
import { Rosetta } from './rosetta';

export interface CdkCommonOptions {
  /**
   * Whether or not this package is private. Setting this variable
   * to true means that your project is created with sane defaults
   * for private repositories.
   *
   * @default true
   */
  readonly private?: boolean;

  /**
   * Whether to enable the auto merge workflow for PRs
   * This will enable the auto merge workflow as well as the
   * merge queue
   *
   * @default - true for private projects, false otherwise
   */
  readonly enablePRAutoMerge?: boolean;

  /**
   * Options for the GitHub auto merge workflow (the workflow
   * that turns on auto merge on all PRs)
   *
   * @default default options
   */
  readonly ghAutoMergeOptions?: AutoMergeOptions;
}

export interface CdkConstructLibraryOptions extends awscdk.AwsCdkConstructLibraryOptions, CdkCommonOptions { }

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
    const autoMerge = options.private ?
      options.enablePRAutoMerge ?? true
      : options.enablePRAutoMerge ?? false;
    new Rosetta(this);
    new IntegRunner(this);


    if (this.private) {
      new Private(this);

    }
    if (autoMerge) {
      new MergeQueue(this, {
        autoMergeOptions: {
          secret: 'PROJEN_GITHUB_TOKEN',
        },
      });
    }
  }
}

export interface CdkTypeScriptProjectOptions extends typescript.TypeScriptProjectOptions, CdkCommonOptions { }

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

    const autoMerge = options.private ?
      options.enablePRAutoMerge ?? true
      : options.enablePRAutoMerge ?? false;

    if (this.private) {
      new Private(this);
    }

    if (autoMerge) {
      new MergeQueue(this, {
        autoMergeOptions: {
          secret: 'PROJEN_GITHUB_TOKEN',
        },
      });
    }
  }
}
