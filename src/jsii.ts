import { cdk } from 'projen';
import { CdkJsiiProjectOptions } from './cdk-jsii-options';
import { configureCommonComponents, withCommonOptionsDefaults } from './common-options';

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
