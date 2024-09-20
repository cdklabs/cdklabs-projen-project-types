import { cdk } from 'projen';
import { CdkCommonOptions } from './cdk-common-options';
import { configureCommonComponents, withCommonOptionsDefaults } from './common-options';

export interface CdkJsiiProjectOptions extends cdk.JsiiProjectOptions, CdkCommonOptions {}

/**
 * Create a Cdk Jsii Jsii project
 *
 * @pjid cdk-jsii-proj
 */
export class CdkJsiiProject extends cdk.JsiiProject {
  public readonly private: boolean;

  constructor(options: CdkJsiiProjectOptions) {
    const opts = withCommonOptionsDefaults({
      ...options,
      // also accept the deprecated repositoryUrl option
      repository: options.repository ?? options.repositoryUrl,
    });
    super({
      ...opts,
      // upstream JsiiProject uses a different name for this
      repositoryUrl: opts.repository,
    });
    this.private = opts.private;

    configureCommonComponents(this, opts);
  }
}
