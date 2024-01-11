import { Construct } from 'constructs';
import { Component, JsonPatch, github, release } from 'projen';

/**
 * Avoids unnecessary attempts to release a package version if that version already exists as a tag on the repo.
 *
 * @internal
 */
export class AvoidReleaseAttempts extends Component {
  public constructor(scope: Construct) {
    super(scope, 'AvoidReleaseAttempts');

    const releaseBranches = release.Release.of(this.project);
    const workflowEngine = github.GitHub.of(this.project);
    if (!releaseBranches || !workflowEngine) {
      return;
    }

    // @ts-ignore
    releaseBranches.publisher.condition = 'needs.release.outputs.tag_exists != \'true\' && needs.release.outputs.latest_commit == github.sha';

    releaseBranches._forEachBranch((branch) => {
      const workflowName = branch === 'main' ? 'release' : `release-${branch}`;
      const workflow = workflowEngine.tryFindWorkflow(workflowName)?.file;
      if (!workflow) {
        return;
      }

      workflow.patch(
        JsonPatch.add('/jobs/release/outputs/tag_exists', '${{ steps.check_tag_exists.outputs.exists }}'),
        JsonPatch.add('/jobs/release/steps/5', {
          name: 'Check if releasetag already exists',
          id: 'check_tag_exists',
          run: [
            'TAG=$(cat dist/dist/releasetag.txt)',
            '([ ! -z "$TAG" ] && git ls-remote -q --exit-code --tags origin $TAG && (echo "exists=true" >> $GITHUB_OUTPUT)) || echo "exists=false" >> $GITHUB_OUTPUT',
            'cat $GITHUB_OUTPUT',
          ].join('\n'),
        }),
      );
    });
  }
}
