import * as path from 'path';
import { DependencyType, github, release as projenRelease, Component, Project, Task } from 'projen';
import { BUILD_ARTIFACT_NAME, PERMISSION_BACKUP_FILE } from 'projen/lib/github/constants';
import { MonorepoReleaseOptions } from './monorepo-release-options';
import { TypeScriptWorkspace } from './typescript-workspace';
import { WorkspaceRelease, WorkspaceReleaseOptions } from './typescript-workspace-release';

// copied from projen/release.ts
const RELEASE_JOBID = 'release';
const GIT_REMOTE_STEPID = 'git_remote';
const LATEST_COMMIT_OUTPUT = 'latest_commit';
const ALL_PACKAGES_INPUT = '*all packages*';

export class MonorepoRelease extends Component {
  /**
   * Returns the `MonorepoReleaseWorkflow` component of a project or `undefined` if the project
   * does not have a MonorepoReleaseWorkflow component.
   */
  public static of(project: Project): MonorepoRelease | undefined {
    const isMonorepoReleaseWorkflow = (c: Component): c is MonorepoRelease => c instanceof MonorepoRelease;
    return project.components.find(isMonorepoReleaseWorkflow);
  }

  private readonly branchName: string;
  private readonly github: github.GitHub;
  private readonly releaseTrigger: projenRelease.ReleaseTrigger;
  private readonly buildWithNx: boolean;
  private readonly wsRun: string;
  private readonly packagesToRelease = new Array<{
    readonly workspaceDirectory: string;
    readonly release: {
      readonly workspace: TypeScriptWorkspace;
      readonly publisher: projenRelease.Publisher;
      readonly options: Partial<projenRelease.BranchOptions>;
    };
  }>();

  private workflow?: github.TaskWorkflow;
  private releaseTask?: Task;
  private readonly workspaceReleases = new Map<TypeScriptWorkspace, WorkspaceRelease>();
  private _releaseSetByChoice = new Map<string, Set<string>>();

  constructor(project: Project, private readonly options: MonorepoReleaseOptions = {}) {
    super(project);

    this.branchName = options.branchName ?? 'main';
    const gh = github.GitHub.of(project);
    if (!gh) {
      throw new Error(`Project is not a GitHub project: ${project}`);
    }
    this.github = gh;
    this.releaseTrigger = options.releaseTrigger ?? projenRelease.ReleaseTrigger.continuous();
    this.buildWithNx = options.buildWithNx ?? false;
    this.wsRun = options.yarnBerry ? 'yarn workspaces foreach --all --exclude . --topological-dev run' : 'yarn workspaces run';
  }

  public workspaceRelease(project: TypeScriptWorkspace) {
    const ret = this.workspaceReleases.get(project);
    if (!ret) {
      throw new Error(`No release for project ${project.name}`);
    }
    return ret;
  }

  public addWorkspace(project: TypeScriptWorkspace, options: WorkspaceReleaseOptions) {
    const workspaceRelease = new WorkspaceRelease(project, {
      publishToNpm: this.options.publishToNpm,
      ...options,
    });

    // Make these publicly accessible
    this.workspaceReleases.set(project, workspaceRelease);

    if (!options.private && workspaceRelease.publisher) {
      this.obtainReleaseTask();

      this.packagesToRelease.push({
        workspaceDirectory: project.workspaceDirectory,
        release: {
          workspace: workspaceRelease.workspace,
          publisher: workspaceRelease.publisher,
          options: {
            // enforced options
            workflowName: this.options.releaseWorkflowName,
            tagPrefix: `${project.name}@`,

            // options that may be override locally
            majorVersion: options.versionBranchOptions.majorVersion ?? this.options.majorVersion,
            minMajorVersion: options.versionBranchOptions.minMajorVersion ?? this.options.minMajorVersion,
            prerelease: options.versionBranchOptions.prerelease ?? this.options.prerelease,
            npmDistTag: options.npmDistTag ?? this.options.npmDistTag,
            environment: options.environment,
          },
        },
      });
    }
  }

  public preSynthesize() {
    if (!this.releaseTask) {
      // We didn't end up adding any packages
      return;
    }

    this.computeReleaseSets();
    this.createPublishingMechanism();
    this.renderPackageUploads();
    this.renderPublishJobs();
    this.renderWorkflowDispatchInput();
  }

  private renderPackageUploads() {
    const noNewCommits = `\${{ steps.${GIT_REMOTE_STEPID}.outputs.${LATEST_COMMIT_OUTPUT} == github.sha }}`;

    for (const { workspaceDirectory, release } of this.packagesToRelease) {
      const job = this.workflow?.getJob(RELEASE_JOBID) as github.workflows.Job | undefined;
      job?.steps.push(
        {
          name: `${release.workspace.name}: Backup artifact permissions`,
          if: noNewCommits,
          continueOnError: true,
          run: `cd ${release.workspace.artifactsDirectory} && getfacl -R . > ${PERMISSION_BACKUP_FILE}`,
          workingDirectory: workspaceDirectory,
        },
        github.WorkflowSteps.uploadArtifact({
          name: `${release.workspace.name}: Upload artifact`,
          if: noNewCommits,
          with: {
            // Every artifact must have a unique name
            name: buildArtifactName(release.workspace),
            path: path.join(workspaceDirectory, release.workspace.artifactsDirectory),
          },
        }),
      );
    }
  }

  private renderPublishJobs() {
    const GATE_JOBID = 'release_gate';
    const GATE_OUTPUT_STEP = 'collect';

    // Build the release tree
    const tree = new ReleaseTree(this.packagesToRelease, this.branchName);

    // Render the release_gate job
    const gateSteps: github.workflows.JobStep[] = tree.nodes.map((node) => {
      const packageFilter = `(!github.event.inputs.package || github.event.inputs.package == '${ALL_PACKAGES_INPUT}' || ${shouldReleaseExpression(node.name, this._releaseSetByChoice)})`;
      return {
        name: `${node.name}: Check publish`,
        run: [
          `should_publish="\${{ needs.${RELEASE_JOBID}.outputs.${publishProjectOutputId(node.workspace)} }}"`,
          `package_filter="\${{ ${packageFilter} }}"`,
          'if [[ "$should_publish" != "true" ]]; then',
          `  echo "⏭️ Skipping ${node.name}: release tag already exists"`,
          'elif [[ "$package_filter" != "true" ]]; then',
          `  echo "⏭️ Skipping ${node.name}: not selected for release"`,
          'else',
          `  echo "✅ Will publish ${node.name}"`,
          `  echo "${node.name}" >> publish.txt`,
          'fi',
        ].join('\n'),
      };
    });
    gateSteps.push({
      id: GATE_OUTPUT_STEP,
      name: 'Collect packages to publish',
      run: [
        'if [ -f publish.txt ]; then',
        '  packages=$(jq -Rc \'.\' publish.txt | jq -sc \'.\')',
        'else',
        '  packages=\'[]\'',
        'fi',
        'echo "packages_to_publish=$packages" >> $GITHUB_OUTPUT',
        'echo "Publishing: $packages"',
      ].join('\n'),
    });

    this.workflow?.addJobs({
      [GATE_JOBID]: {
        runsOn: ['ubuntu-latest'],
        needs: [RELEASE_JOBID],
        permissions: {},
        if: `\${{ needs.${RELEASE_JOBID}.outputs.latest_commit == github.sha }}`,
        name: 'Publish gate',
        outputs: {
          packages_to_publish: {
            stepId: GATE_OUTPUT_STEP,
            outputName: 'packages_to_publish',
          },
        },
        steps: gateSteps,
      } as any,
    });

    // Render per-package gate jobs and publish jobs from the tree
    for (const node of tree.nodes) {
      this.workflow?.addJobs({
        [node.gateJobId]: node.renderGateJob(GATE_JOBID),
        ...node.renderPublishJobs(this.options.nodeVersion),
        [node.doneJobId]: node.renderDoneJob(),
      });
    }
  }

  private obtainReleaseTask(): Task {
    if (this.releaseTask) {
      return this.releaseTask;
    }

    const env: Record<string, string> = {
      RELEASE: 'true',
    };

    if (this.options.majorVersion !== undefined) {
      env.MAJOR = this.options.majorVersion.toString();
    }

    if (this.options.minMajorVersion !== undefined) {
      if (this.options.majorVersion !== undefined) {
        throw new Error('minMajorVersion and majorVersion cannot be used together.');
      }

      env.MIN_MAJOR = this.options.minMajorVersion.toString();
    }

    this.releaseTask = this.project.addTask('release', {
      description: 'Prepare a release from all monorepo packages',
      env,
    });
    // Unroll out the 'release' task, and do all the phases for each individual package. We need to 'bump' at the same
    // time so that the dependency versions in all 'package.json's are correct.
    this.releaseTask.exec(`${this.wsRun} shx rm -rf dist`);
    this.releaseTask.exec(`${this.wsRun} bump`);
    if (this.buildWithNx) {
      this.releaseTask.exec('nx run-many -t build');
      this.releaseTask.env('NX_SKIP_NX_CACHE', 'true');
    } else {
      this.releaseTask.exec(`${this.wsRun} build`);
    }
    this.releaseTask.exec(`${this.wsRun} unbump`);
    // anti-tamper check (fails if there were changes to committed files)
    // this will identify any non-committed files generated during build (e.g. test snapshots)
    this.releaseTask.exec(projenRelease.Release.ANTI_TAMPER_CMD);

    return this.releaseTask;
  }

  private createPublishingMechanism() {
    if (this.releaseTrigger.isManual) {
      this.createPublishTask();
    } else {
      this.createPublishWorkflow();
    }
  }

  private createPublishTask() {
    throw new Error('Manual publishing is not supported right now');
  }

  /**
   * Compute the transitive upstream dependencies (runtime + peer) of a workspace.
   */
  private upstreamPackageNames(workspace: TypeScriptWorkspace): Set<string> {
    const result = new Set<string>();
    const visit = (ws: TypeScriptWorkspace) => {
      for (const dep of ws.workspaceDependencies([DependencyType.RUNTIME, DependencyType.PEER])) {
        if (!result.has(dep.name)) {
          result.add(dep.name);
          if (dep instanceof TypeScriptWorkspace) {
            visit(dep);
          }
        }
      }
    };
    visit(workspace);
    return result;
  }

  /**
   * Add workflow_dispatch input with a choice of packages.
   * When a package is selected, only that package and its upstream deps are released.
   */
  private renderWorkflowDispatchInput() {
    if (!this.workflow?.file) {
      return;
    }

    const packageNames = this.packagesToRelease.map(p => p.release.workspace.name);

    this.workflow.file.addOverride('on.workflow_dispatch.inputs.package', {
      description: 'Select specific package to release',
      required: false,
      type: 'choice',
      options: [ALL_PACKAGES_INPUT, ...packageNames],
      default: ALL_PACKAGES_INPUT,
    });
  }

  /**
   * Compute the release set for each package (itself + transitive upstream deps).
   */
  private computeReleaseSets() {
    for (const { release } of this.packagesToRelease) {
      const upstream = this.upstreamPackageNames(release.workspace);
      upstream.add(release.workspace.name);
      this._releaseSetByChoice.set(release.workspace.name, upstream);
    }
  }

  private createPublishWorkflow() {
    const workflowName =
      this.options.releaseWorkflowName ??
      (['master', 'main'].includes(this.branchName) ? 'release' : `release-${this.branchName}`);

    // The arrays are being cloned to avoid accumulating values from previous branches
    const preBuildSteps = [
      ...(this.project as any).renderWorkflowSetup({ mutable: false }),
      ...(this.options.releaseWorkflowSetupSteps ?? []),
    ];
    const postBuildSteps = [...(this.options.postBuildSteps ?? [])];

    // Add an output to the job to indicate if a certain package needs publishing
    const shouldPublishOutputs = Object.fromEntries(
      this.packagesToRelease.map(({ release }) => {
        return [
          publishProjectOutputId(release.workspace),
          {
            stepId: shouldPublishProjectStepId(release.workspace),
            outputName: 'publish',
          },
        ];
      }),
    );

    // Check if the proposed release tag already exists
    // Only if it doesn't exist yet should we publish
    for (const { workspaceDirectory, release } of this.packagesToRelease) {
      postBuildSteps.push({
        id: shouldPublishProjectStepId(release.workspace),
        workingDirectory: workspaceDirectory,
        run: '(git ls-remote -q --exit-code --tags origin $(cat dist/releasetag.txt) && (echo "publish=false" >> $GITHUB_OUTPUT)) || echo "publish=true" >> $GITHUB_OUTPUT',
      });
    }

    // check if new commits were pushed to the repo while we were building.
    // if new commits have been pushed, we will cancel this release
    if (this.options.releaseTrigger?.isContinuous ?? true) {
      postBuildSteps.push({
        name: 'Check for new commits',
        id: GIT_REMOTE_STEPID,
        env: {
          GITHUB_REF: '${{ github.ref }}',
        },
        run: `echo "${LATEST_COMMIT_OUTPUT}=$(git ls-remote origin -h "$GITHUB_REF" | cut -f1)" >> $GITHUB_OUTPUT`,
      });
    } else {
      // For non-continuous builds we'll just put the value there that downstream steps are going to compare against
      postBuildSteps.push({
        name: 'Output the sha value that downstream checks expect',
        id: GIT_REMOTE_STEPID,
        run: `echo "${LATEST_COMMIT_OUTPUT}=\${{ github.sha }}" >> $GITHUB_OUTPUT`,
      });
    }

    this.workflow = new github.TaskWorkflow(this.github, {
      name: workflowName,
      jobId: RELEASE_JOBID,
      outputs: {
        latest_commit: {
          stepId: GIT_REMOTE_STEPID,
          outputName: LATEST_COMMIT_OUTPUT,
        },
        ...shouldPublishOutputs,
      },
      triggers: {
        schedule: this.releaseTrigger.schedule ? [{ cron: this.releaseTrigger.schedule }] : undefined,
        push: this.releaseTrigger.isContinuous ? { branches: [this.branchName] } : undefined,
        workflowDispatch: {},
      },
      container: this.options.workflowContainerImage ? { image: this.options.workflowContainerImage } : undefined,
      env: {
        CI: 'true',
      },
      permissions: {
        contents: 'write' as any,
      },
      checkoutWith: {
        // we must use 'fetch-depth=0' in order to fetch all tags
        // otherwise tags are not checked out
        fetchDepth: 0,
      },
      preBuildSteps,
      task: this.releaseTask!,
      postBuildSteps,
      runsOn: this.options.workflowRunsOn,
    });

    // Override the default empty workflow_dispatch added by TaskWorkflow
    // to include the dry_run input for testing the release pipeline
    this.workflow.on({
      workflowDispatch: {
        inputs: {
          dry_run: {
            description: 'Dry run (skip actual publishing)',
            required: false,
            type: 'boolean',
          },
        },
      },
    });
  }
}

/**
 * A node representing a single publish job (e.g. npm, maven, github).
 */
class PublishJobNode {
  public readonly jobId: string;
  public readonly job: github.workflows.Job;

  constructor(
    public readonly parent: PackageReleaseNode,
    key: string,
    job: github.workflows.Job,
  ) {
    this.jobId = `${parent.prefix}_${key}`;
    this.job = job;
  }

  /**
   * Compute the `needs` for this publish job.
   * Jobs with sibling deps (e.g. github depends on npm) use those;
   * the first job in the chain depends on the gate + upstream done jobs.
   */
  public get needs(): string[] {
    const siblingDeps = (this.job.needs ?? [])
      .filter((dep: string) => dep !== 'release')
      .map((dep: string) => `${this.parent.prefix}_${dep}`);

    if (siblingDeps.length > 0) {
      return siblingDeps;
    }

    // First publish job: depends on gate + upstream packages' done jobs
    return [
      this.parent.gateJobId,
      ...this.parent.upstream.map((n) => n.doneJobId),
    ];
  }
}

/**
 * A node representing a package's release gate, publish jobs, and done signal.
 */
class PackageReleaseNode {
  public readonly name: string;
  public readonly workspace: TypeScriptWorkspace;
  public readonly prefix: string;
  public readonly gateJobId: string;
  public readonly doneJobId: string;
  public readonly publishJobs: PublishJobNode[];
  public readonly upstream: PackageReleaseNode[] = [];

  constructor(workspace: TypeScriptWorkspace, publishJobs: Record<string, github.workflows.Job>) {
    this.name = workspace.name;
    this.workspace = workspace;
    this.prefix = slugify(workspace.name);
    this.gateJobId = `${this.prefix}_release`;
    this.doneJobId = `${this.prefix}_release_done`;
    this.publishJobs = Object.entries(publishJobs).map(
      ([key, job]) => new PublishJobNode(this, key, job),
    );
  }

  /**
   * Render the package gate job — purely checks if this package should publish.
   */
  public renderGateJob(releaseGateJobId: string): any {
    const condition = `contains(fromJSON(needs.${releaseGateJobId}.outputs.packages_to_publish), '${this.name}')`;
    return {
      runsOn: ['ubuntu-latest'],
      needs: [releaseGateJobId],
      permissions: {},
      if: `\${{ ${condition} }}`,
      name: `${this.name}: Release`,
      steps: [{ run: `echo "Releasing ${this.name}..."` }],
    };
  }

  /**
   * Render all publish job definitions for this package.
   */
  public renderPublishJobs(nodeVersion?: string): Record<string, any> {
    return Object.fromEntries(
      this.publishJobs.map((pubNode) => [
        pubNode.jobId,
        {
          ...pubNode.job,
          // Tolerate skipped dependency ancestors while still requiring this package's gate to pass
          if: `\${{ !cancelled() && !failure() && needs.${this.gateJobId}.result == 'success' }}`,
          tools: {
            ...pubNode.job.tools,
            node: {
              ...pubNode.job.tools?.node ?? {},
              version: nodeVersion ?? pubNode.job.tools?.node?.version ?? 'lts/*',
            },
          },
          needs: pubNode.needs,
          name: `${this.name}: ${pubNode.job.name}`,
        },
      ]),
    );
  }

  /**
   * Render the done job — fan-in that signals all publishing for this package is complete.
   */
  public renderDoneJob(): any {
    return {
      runsOn: ['ubuntu-latest'],
      needs: this.publishJobs.map((p) => p.jobId),
      permissions: {},
      // Use !cancelled() && !failure() so that:
      // - If publish jobs are skipped (package has no changes, gate was skipped), done still succeeds
      //   → allows downstream packages to proceed with their own release
      // - If a publish job fails, done is skipped (failure() is true)
      //   → blocks downstream packages from releasing
      if: '${{ !cancelled() && !failure() }}',
      name: `${this.name}: Release complete`,
      steps: [{ run: 'echo "All publish jobs complete"' }],
    };
  }
}

/**
 * A topological tree of packages to release.
 * Each node knows its upstream dependencies (runtime + peer).
 */
class ReleaseTree {
  public readonly nodes: PackageReleaseNode[];
  private readonly nodesByName = new Map<string, PackageReleaseNode>();

  constructor(
    packagesToRelease: Array<{
      readonly workspaceDirectory: string;
      readonly release: {
        readonly workspace: TypeScriptWorkspace;
        readonly publisher: projenRelease.Publisher;
        readonly options: Partial<projenRelease.BranchOptions>;
      };
    }>,
    branchName: string,
  ) {
    // Create nodes
    for (const { release } of packagesToRelease) {
      const publishJobs = release.publisher._renderJobsForBranch(branchName, release.options);

      // Fix download steps to use artifact name instead of immutable artifact IDs
      for (const job of Object.values(publishJobs)) {
        const downloadStep = job.steps.find((j) => j.uses?.startsWith('actions/download-artifact@'));
        if (!downloadStep) {
          throw new Error(`Could not find downloadStep among steps: ${JSON.stringify(job.steps, undefined, 2)}`);
        }
        if (downloadStep.with) {
          delete downloadStep.with['artifact-ids'];
          downloadStep.with.name = buildArtifactName(release.workspace);
        }
      }

      const node = new PackageReleaseNode(release.workspace, publishJobs);
      this.nodesByName.set(node.name, node);
    }

    // Resolve upstream edges
    for (const node of this.nodesByName.values()) {
      for (const dep of node.workspace.workspaceDependencies([DependencyType.RUNTIME, DependencyType.PEER])) {
        const upstream = this.nodesByName.get(dep.name);
        if (upstream) {
          node.upstream.push(upstream);
        }
      }
    }

    this.nodes = [...this.nodesByName.values()];
  }
}

function slugify(x: string): string {
  return x.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/^[0-9-]+/, '');
}

function buildArtifactName(project: Project) {
  return slugify(`${project.name}_${BUILD_ARTIFACT_NAME}`);
}

function publishProjectOutputId(project: Project) {
  return `publish-${slugify(project.name)}`;
}

function shouldPublishProjectStepId(project: Project) {
  return `check-${publishProjectOutputId(project)}`;
}

/**
 * Returns a GitHub Actions expression that evaluates to true if the given workspace
 * should be released based on the selected package input.
 *
 * A workspace should be released if the selected package is one for which this workspace
 * is in the release set (i.e., the workspace is the selected package itself or an upstream dep).
 */
function shouldReleaseExpression(workspaceName: string, releaseSetByChoice: Map<string, Set<string>>): string {
  // Find all packages whose release set includes this workspace
  const triggeringPackages = Array.from(releaseSetByChoice.entries())
    .filter(([_, releaseSet]) => releaseSet.has(workspaceName))
    .map(([pkg]) => pkg);

  return `contains(fromJSON('${JSON.stringify(triggeringPackages)}'), github.event.inputs.package)`;
}
