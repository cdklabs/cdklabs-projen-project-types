import { cdk } from 'projen';
import { CdkCommonOptions, withCommonOptionsDefaults } from './common-options';
import { MergeQueue } from './merge-queue';
import { Private } from './private';

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
    if (this.private) {
      new Private(this);
    }

    if (opts.enablePRAutoMerge) {
      new MergeQueue(this, {
        autoMergeOptions: opts.ghAutoMergeOptions,
      });
    }

    if (opts.setNodeEngineVersion === false) {
      this.package.file.addOverride('engines.node', undefined);
    }
  }
}
