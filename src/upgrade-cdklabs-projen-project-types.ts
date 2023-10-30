import { Component, JsonPatch, javascript } from 'projen';

/**
 * The goal of this workflow is to have a separate workflow that _only_
 * upgrades the cdklabs-projen-project-types dependency. This will enable
 * us to push out updates to all of our projects via this workflow.
 */
export class UpgradeCdklabsProjenProjectTypes extends Component {
  public static deps: string[] = [
    'cdklabs-projen-project-types',
    'projen',
  ];

  constructor(public readonly project: javascript.NodeProject) {
    super(project, 'UpgradeCdklabsProjenProjectTypes');

    const taskName = 'upgrade-cdklabs-projen-project-types';

    const upgrade = new javascript.UpgradeDependencies(project, {
      taskName,
      target: 'latest',
      pullRequestTitle: 'upgrade cdklabs-projen-project-types',
      include: UpgradeCdklabsProjenProjectTypes.deps,
      workflowOptions: {
        labels: ['auto-approve'],
        schedule: javascript.UpgradeDependenciesSchedule.NEVER,
      },
    });

    for (const workflow of upgrade.workflows) {
      // Remove the explicit workflow node version
      // This upgrade needs to always use the latest Node version, in case the minimum node version changes
      workflow.file?.patch(
        JsonPatch.test('/jobs/upgrade/steps/1/name', 'Setup Node.js'),
        JsonPatch.remove('/jobs/upgrade/steps/1/with'),
      );
    }
  }
}
