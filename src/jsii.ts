import * as path from 'node:path/posix';
import { cdk } from 'projen';
import { AvoidReleaseAttempts } from './avoid-release-attempts';
import { CdkCommonOptions, configureCommonFeatures, withCommonOptionsDefaults } from './common-options';

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
    new AvoidReleaseAttempts(this, {
      // need to double up the artifactsDirectory because the jsii package task is doing this as well in CI
      releaseTagPath: path.normalize(path.join(this.artifactsDirectory, this.artifactsDirectory, 'releasetag.txt')),
    });
  }
}
