import { cdk } from 'projen';
import { CdkCommonOptions } from './cdk-common-options';
import { configureCommonFeatures, withCommonOptionsDefaults } from './common-options';

export interface CdkJsiiProjectOptions extends cdk.JsiiProjectOptions, CdkCommonOptions {}

/**
 * Create a Cdk Jsii Jsii project
 *
 * @pjid cdk-jsii-proj
 */
export class CdkJsiiProject extends cdk.JsiiProject {
  public readonly private: boolean;

  constructor(options: CdkJsiiProjectOptions) {
    const opts = withCommonOptionsDefaults(options);
    super(opts);
    this.private = opts.private;

    configureCommonFeatures(this, opts);
  }
}
