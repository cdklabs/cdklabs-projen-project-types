import { Component, Task, typescript } from 'projen';
import { GitHub, GithubWorkflow, WorkflowActions, WorkflowJobs, workflows } from 'projen/lib/github';
import { DEFAULT_GITHUB_ACTIONS_USER } from 'projen/lib/github/constants';
import { JobPermission } from 'projen/lib/github/workflows-model';
import { UpgradeDependenciesSchedule } from 'projen/lib/javascript';
import { Release } from 'projen/lib/release';

const CREATE_PATCH_STEP_ID = 'create_patch';
const PATCH_CREATED_OUTPUT = 'patch_created';

interface PR {
  readonly job: workflows.Job;
  readonly jobId: string;
}
interface Upgrade {
  readonly ref?: string;
  readonly job: workflows.Job;
  readonly jobId: string;
}

/**
 * Fork of projen.javascript.UpgradeDependencies
 *
 * The goal of this workflow is to have a separate workflow that _only_
 * upgrades the cdklabs-projen-project-types dependency. This workflow
 * shouldn't have any dependencies on anything else. This will enable us to push
 * out updates to all of our projects via this workflow
 *
 * @see https://github.com/projen/projen/blob/main/src/javascript/upgrade-dependencies.ts
 */
export class UpgradeCdklabsProjenProjectTypes extends Component {
  constructor(public readonly project: typescript.TypeScriptProject) {
    super(project);

    const upgradeTask = project.addTask('upgrade-cdklabs-projen-project-types', {
      env: { CI: '0' },
      description: 'upgrade cdklabs-projen-project-types',
      steps: [
        // update npm-check-updates before everything else, in case there is a bug
        // in it or one of its dependencies
        {
          exec: this.project.package.renderUpgradePackagesCommand(
            [],
            ['npm-check-updates'],
          ),
        },
        // only update this project
        { exec: 'npm-check-updates --filter=cdklabs-projen-project-types --upgrade' },
        // run "yarn/npm install" to update the lockfile and install any deps (such as projen)
        { exec: this.project.package.installAndUpdateLockfileCommand },
        // run upgrade command to upgrade transitive deps as well
        { exec: this.project.package.renderUpgradePackagesCommand([], ['cdklabs-projen-project-types']) },
        // run "projen" to give projen a chance to update dependencies (it will also run "yarn install")
        { exec: this.project.projenCommand },
      ],
    });
    if (Release.of(project)) {
      const release = Release.of(project)!;
      release._forEachBranch(branch => {
        this.createWorkflow(upgradeTask, project.github!, branch);
      });

    }
  }
  private createWorkflow(
    task: Task,
    github: GitHub,
    branch?: string,
  ): GithubWorkflow {
    const schedule = UpgradeDependenciesSchedule.DAILY;
    const workflowName = `${task.name}${
      branch ? `-${branch.replace(/\//g, '-')}` : ''
    }`;
    const workflow = github.addWorkflow(workflowName);
    const triggers: workflows.Triggers = {
      workflowDispatch: {},
      schedule:
        schedule.cron.length > 0
          ? schedule.cron.map((e) => ({ cron: e }))
          : undefined,
    };
    workflow.on(triggers);

    const upgrade = this.createUpgrade(task, github, branch);
    const pr = this.createPr(workflow, upgrade);

    const jobs: Record<string, workflows.Job> = {};
    jobs[upgrade.jobId] = upgrade.job;
    jobs[pr.jobId] = pr.job;

    workflow.addJobs(jobs);
    return workflow;
  }

  private createUpgrade(task: Task, github: GitHub, branch?: string): Upgrade {
    const with_ = {
      ...(branch ? { ref: branch } : {}),
      ...(github.downloadLfs ? { lfs: true } : {}),
    };

    const steps: workflows.JobStep[] = [
      {
        name: 'Checkout',
        uses: 'actions/checkout@v3',
        with: Object.keys(with_).length > 0 ? with_ : undefined,
      },
      {
        name: 'Setup Node.js',
        uses: 'actions/setup-node@v3',
      },
      {
        name: 'Install dependencies',
        run: this.project.package.installCommand,
      },
      {
        name: 'Upgrade dependencies',
        run: this.project.runTaskCommand(task),
      },
    ];

    steps.push(
      ...WorkflowActions.uploadGitPatch({
        stepId: CREATE_PATCH_STEP_ID,
        outputName: PATCH_CREATED_OUTPUT,
      }),
    );

    return {
      job: {
        name: 'Upgrade',
        container: this.project.upgradeWorkflow?.containerOptions,
        permissions: {
          contents: JobPermission.READ,
        },
        runsOn: ['ubuntu-latest'],
        steps: steps,
        outputs: {
          [PATCH_CREATED_OUTPUT]: {
            stepId: CREATE_PATCH_STEP_ID,
            outputName: PATCH_CREATED_OUTPUT,
          },
        },
      },
      jobId: 'upgrade',
      ref: branch,
    };
  }

  private createPr(workflow: GithubWorkflow, upgrade: Upgrade): PR {
    const credentials = workflow.projenCredentials;

    return {
      job: WorkflowJobs.pullRequestFromPatch({
        patch: {
          jobId: upgrade.jobId,
          outputName: PATCH_CREATED_OUTPUT,
          ref: upgrade.ref,
        },
        workflowName: workflow.name,
        credentials,
        pullRequestTitle: 'chore(deps): upgrade cdklabs-projen-project-types',
        pullRequestDescription: 'Upgrades cdklabs-projen-project-types dependency.',
        gitIdentity: DEFAULT_GITHUB_ACTIONS_USER,
        labels: ['auto-approve'],
        signoff: true,
      }),
      jobId: 'pr',
    };
  }
}
