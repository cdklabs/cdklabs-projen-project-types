import { Component, Project, github } from 'projen';

/**
 * Options for `SelfMutationOnForks`
 */
export interface SelfMutationOnForksOptions {
  /**
   * The GitHub Actions environment to use for the self-mutation job.
   *
   * @default - the environment of the projen credentials
   */
  readonly environment?: string;
}

/**
 * Apply self-mutations to pull requests from forks.
 *
 * Replaces the self-mutation job of the build workflow with a separate
 * workflow that runs when the build workflow fails on a pull request.
 * If the failed build uploaded a patch, the workflow checks out the
 * pull request branch, applies the patch and pushes the changes back
 * to the pull request using the projen credentials.
 *
 * This also works for pull requests from forks, as long as the fork
 * allows edits from maintainers.
 */
export class SelfMutationOnForks extends Component {
  constructor(project: Project, options: SelfMutationOnForksOptions = {}) {
    super(project, 'self-mutation-on-forks');

    const cicd = github.GitHub.of(project);
    if (!cicd) return;

    const buildWorkflow = cicd.tryFindWorkflow('build');
    if (!buildWorkflow) return;

    // the new workflow handles self-mutation for all pull requests
    buildWorkflow.removeJob('self-mutation');

    const selfMutation = cicd.addWorkflow('self-mutation');
    selfMutation.on({
      workflowRun: {
        workflows: [buildWorkflow.name],
        types: ['completed'],
      },
    });

    selfMutation.addJob('self-mutation', {
      runsOn: ['ubuntu-latest'],
      if: "github.event.workflow_run.conclusion == 'failure' && github.event.workflow_run.event == 'pull_request'",
      permissions: {
        contents: github.workflows.JobPermission.READ,
      },
      environment: options.environment ?? cicd.projenCredentials.environment,
      steps: [
        {
          name: 'Download patch',
          id: 'download_patch',
          continueOnError: true,
          uses: 'dawidd6/action-download-artifact@v27', // immutable tag
          with: {
            run_id: '${{ github.event.workflow_run.id }}',
            name: 'repo.patch',
            path: '${{ runner.temp }}',
          },
        },
        ...conditionalSteps(
          'steps.download_patch.outcome == \'success\'',
          cicd.projenCredentials.setupSteps,
          github.WorkflowSteps.checkout({
            name: 'Checkout PR',
            with: {
              repository: '${{ github.event.workflow_run.head_repository.full_name }}',
              ref: '${{ github.event.workflow_run.head_branch }}',
              token: cicd.projenCredentials.tokenRef,
            },
          }),
          {
            name: 'Apply patch to PR',
            run: [
              'set -e',
              'if [ ! -f "${{ runner.temp }}/repo.patch" ]; then',
              '  echo "Patch file not found"',
              '  exit 1',
              'fi',
              'git config user.name "github-actions[bot]"',
              'git config user.email "41898282+github-actions[bot]@users.noreply.github.com"',
              'if ! git apply --check ${{ runner.temp }}/repo.patch; then',
              '  echo "Patch cannot be applied cleanly"',
              '  exit 1',
              'fi',
              'git apply ${{ runner.temp }}/repo.patch',
              'if [ -z "$(git status --porcelain)" ]; then',
              '  echo "No changes to commit"',
              '  exit 0',
              'fi',
              'git add .',
              'git commit -s -m "chore: self mutation"',
              'git push',
            ].join('\n'),
          },
        ),
      ],
    });
  }
}

/**
 * Run all steps only if the condition is met, unless a step has its own condition.
 */
function conditionalSteps(cond: string, ...steps: Array<github.workflows.JobStep | github.workflows.JobStep[]>): github.workflows.JobStep[] {
  return steps.flat().map(s => ({ ...s, if: s.if ?? cond }));
}
