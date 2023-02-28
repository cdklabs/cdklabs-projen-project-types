import { JsiiProject, JsiiProjectOptions } from 'projen/lib/cdk';
import { CdkCommonOptions } from './cdk';
import { MergeQueue } from './merge-queue';
import { Private } from './private';

export interface CdkJsiiProjectOptions extends JsiiProjectOptions, CdkCommonOptions {}

/**
 * Create a Cdk Jsii Jsii project
 *
 * @pjid cdk-jsii-proj
 */
export class CdkJsiiProject extends JsiiProject {
  public readonly private: boolean;

  constructor(options: CdkJsiiProjectOptions) {
    super(options);
    this.private = options.private ?? true;
    const autoMerge = options.enablePRAutoMerge ?? this.private;

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
