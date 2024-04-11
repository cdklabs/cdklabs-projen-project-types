import * as path from 'node:path';
import { Component, ReleasableCommits, Task, Version, release } from 'projen';
import { GatherVersions, VersionMatch } from './gather-versions.task';
import { TypeScriptWorkspace } from './typescript-workspace';

export interface WorkspaceReleaseOptions {
  readonly private: boolean;
  readonly workflowNodeVersion?: string;
  readonly publishToNpm?: boolean;
  readonly releasableCommits?: ReleasableCommits;
}

export class WorkspaceRelease extends Component {
  public readonly publisher?: release.Publisher;
  public readonly version?: Version;
  public readonly workspace: TypeScriptWorkspace;

  public constructor(project: TypeScriptWorkspace, options: WorkspaceReleaseOptions) {
    super(project);
    this.workspace = project;

    // The root package is release-aware. Either we create a proper
    // 'yarn release' task here, or we create a fake one that just does
    // a 'build' (will be run in dependency order by the parent release task).
    if (!options.private) {
      this.version = new Version(this.workspace, {
        versionInputFile: 'package.json', // this is where "version" is set after bump
        artifactsDirectory: project.artifactsDirectory,
        versionrcOptions: {
          path: '.', // In a monorepo, we want standard-version to only consider the directory of the workspace
        },
        // This mixes the package name into the tag name,
        // so that we can give packages individual versions.
        // Tags end up looking like this: @scope/package@v1.2.3
        tagPrefix: `${project.name}@`,

        // In a monorepo, only consider changes relevant to the subproject
        // Path is relative to the subproject outdir, so '.' is what we want here
        releasableCommits: options.releasableCommits ?? ReleasableCommits.everyCommit('.'),
      });

      this.publisher = new release.Publisher(this.workspace, {
        artifactName: project.artifactsDirectory,
        condition: 'needs.release.outputs.latest_commit == github.sha',
        buildJobId: 'release',
        workflowNodeVersion: options.workflowNodeVersion,
      });

      this.publisher.publishToGitHubReleases({
        changelogFile: path.posix.join(project.artifactsDirectory, this.version.changelogFileName),
        versionFile: path.posix.join(project.artifactsDirectory, this.version.versionFileName),
        releaseTagFile: path.posix.join(project.artifactsDirectory, this.version.releaseTagFileName),
      });

      // GitHub Releases comes for free with a `Release` component, NPM must be added explicitly
      if (options.publishToNpm ?? true) {
        this.publisher.publishToNpm({
          registry: project.package.npmRegistry,
          npmTokenSecret: project.package.npmTokenSecret,
        });
      }
    }

    // This tasks sets all local dependencies to their current version
    // In the monorepo we call this task in topological order.
    // Therefor it is guaranteed that any local packages a package depends on,
    // already have been bumped.
    const gatherVersions = project.addTask('gather-versions', {
      steps: [new GatherVersions(project, VersionMatch.MAJOR)],
    });
    this.obtainBumpTask().prependSpawn(gatherVersions);

    // After we have unbumped package versions back to 0.0.0,
    // we can run the gather-versions task again which will now replace the to-be-release versions with 0.0.0
    this.obtainUnbumpTask().spawn(gatherVersions);
  }

  /**
   * Get the bump version task
   *
   * If this is a private package, it won't have a bump task yet.
   * So instead we create an empty one that can be called from the monorepo root
   * and serve as a container for other steps that need to occur as part of the release
   */
  private obtainBumpTask(): Task {
    return (
      this.workspace.tasks.tryFind('bump') ??
      this.workspace.addTask('bump', {
        description: 'Bumps versions of local dependencies',
      })
    );
  }

  /**
   * Get the unbump version task
   *.
   * If this is a private package, it won't have a bump task yet
   * So instead we create an empty one that can be called from the monorepo root
   * and serve as a container for other steps that need to occur as part of the release
   */
  private obtainUnbumpTask(): Task {
    return (
      this.workspace.tasks.tryFind('unbump') ??
      this.workspace.addTask('unbump', {
        description: 'Resets versions of local dependencies to 0.0.0',
      })
    );
  }
}
