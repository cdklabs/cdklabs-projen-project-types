import { Construct } from 'constructs';
import { Component, Project } from 'projen';
import { GitHub } from 'projen/lib/github';

/**
 * Re-enable automatic AutoMerging of PRs if it gets disabled by sporadically failing a test in the merge queue
 *
 * If automerge gets disabled by a human, we leave it disabled. But if GitHub disables it for us, we re-enable it
 * and try again.
 */
export class RetryAutoMerge extends Component {
  public constructor(scope: Construct) {
    super(scope, 'RetryAutoMerge#');

    const github = GitHub.of(Project.of(this));
    if (!github) {
      throw new Error('RetryAutoMerge only works on a GitHub project');
    }

    const wf = github.addWorkflow('retry-automerge');
    wf.on({
      pullRequest: {
        types: ['auto_merge_disabled' as any],
      },
    });

    // To begin with, we just print the contents of the event, so that we can see what
    // fields are populated how, and to detect the event we're looking for.
    wf.addJob('retry-automerge', {
      permissions: {},
      runsOn: ['ubuntu-latest'],
      steps: [
        {
          // Source: https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#example-printing-context-information-to-the-log
          env: {
            GITHUB_CONTEXT: '${{ toJson(github) }}',
          },
          name: 'Print github context',
          run: 'echo "$GITHUB_CONTEXT"',
        },
        {
          // Source: https://docs.github.com/en/actions/reference/workflows-and-actions/variables
          name: 'Print github event file',
          run: 'jq . "$GITHUB_EVENT_PATH"',
        },
      ],
    });
  }
}
