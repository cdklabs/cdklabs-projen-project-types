import { javascript, Component } from 'projen';
import { AutoMerge, AutoMergeOptions } from './auto-merge';

/**
 * Options for 'MergeQueue'
 */
export interface MergeQueueOptions {
  /**
   * Should pull requests be merged automatically once they pass required checks
   * @default true
   */
  readonly autoMerge?: boolean;

  /**
   * Configure auto merge pull requests
   * @default - see AutoMergeOptions
   */
  readonly autoMergeOptions?: AutoMergeOptions;

  /**
   * The branch to merge to
   *
   * @default main
   */
  readonly mergeBranch?: string;
}

/**
 * Merge pull requests using a merge queue
 */
export class MergeQueue extends Component {
  constructor(project: javascript.NodeProject, options: MergeQueueOptions = {}) {
    super(project);

    const autoMerge = options.autoMerge ?? true;
    const mergeBranch = options.mergeBranch ?? 'main';

    project.github?.tryFindWorkflow('build')?.on({
      mergeGroup: {
        branches: [
          `${mergeBranch}`,
        ],
      },
    });

    if (autoMerge && project.github) {
      new AutoMerge(project.github, options.autoMergeOptions);
    }

    // Do not require PR validation on merge queue
    // Need if the pull-request-lint workflow is a required build check
    const prLintWorkflow = project.github?.tryFindWorkflow('pull-request-lint');
    prLintWorkflow?.on({
      mergeGroup: {
        branches: [
          `${mergeBranch}`,
        ],
      },
    });
    prLintWorkflow?.file?.addOverride(
      'jobs.validate.if',
      "github.event_name == 'pull_request' || github.event_name == 'pull_request_target'",
    );
  }
}
