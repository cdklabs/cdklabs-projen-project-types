import { awscdk, cdk, typescript } from 'projen';
import { CdkCommonOptions, configureCommonFeatures, withCommonOptionsDefaults } from './common-options';
import { IntegRunner } from './integ-runner';
import { Rosetta, RosettaOptions } from './rosetta';


export interface CdkConstructLibraryOptions extends awscdk.AwsCdkConstructLibraryOptions, CdkCommonOptions {
  /**
   * Options for rosetta:extract task
   */
  readonly rosettaOptions?: RosettaOptions;
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
    if (options.stability === cdk.Stability.STABLE) {
      const errors = CdkConstructLibrary.stabilityRequirements(options);
      if (errors.length > 0) {
        throw new Error(`The project does not pass stability requirements due to the following errors:\n  ${errors.join('\n  ')}`);
      }
    }

    const opts = withCommonOptionsDefaults(options);
    super({
      stability: cdk.Stability.EXPERIMENTAL,
      ...opts,
    });
    this.private = opts.private;

    new Rosetta(this, options.rosettaOptions);
    new IntegRunner(this);

    configureCommonFeatures(this, opts);
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
    const opts = withCommonOptionsDefaults(options);
    super(opts);
    this.private = opts.private;

    configureCommonFeatures(this, opts);
  }
}