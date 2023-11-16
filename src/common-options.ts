import { DependencyType, github, javascript, typescript } from 'projen';
import { deepMerge } from 'projen/lib/util';
import { AutoMergeOptions } from './auto-merge';
import { MergeQueue } from './merge-queue';
import { Private } from './private';
import { SaferUpgrades } from './safer-upgrades';
import { UpgradeCdklabsProjenProjectTypes } from './upgrade-cdklabs-projen-project-types';

export enum OrgTenancy {
  CDKLABS = 'cdklabs',
  AWS = 'aws',
}

export interface CdkCommonOptions {
  /**
   * Whether or not this package is private. Setting this variable
   * to true means that your project is created with sane defaults
   * for private repositories.
   *
   * @default true
   */
  readonly private?: boolean;

  /**
   * Whether to enable the auto merge workflow for PRs
   * This will enable the auto merge workflow as well as the
   * merge queue
   *
   * @default - true for private projects, false otherwise
   */
  readonly enablePRAutoMerge?: boolean;

  /**
   * Options for the GitHub auto merge workflow (the workflow
   * that turns on auto merge on all PRs)
   *
   * @default - default options
   */
  readonly ghAutoMergeOptions?: AutoMergeOptions;

  /**
   * Whether to enforce the minNodeVersion via the `engines` field in `package.json`.
   * Set this to `false` if a package did not enforce this previously and we don't want to change this for now.
   *
   * @default true
   */
  readonly setNodeEngineVersion?: boolean;

  /**
   * Whether to enable the separate workflow to upgrade the cdklabs-projen-project-types dep
   *
   * @default true
   */
  readonly upgradeCdklabsProjenProjectTypes?: boolean;

  /**
   * Whether to have a separate workflow to upgrade runtime deps and mark this PR as fix
   *
   * @default true
   */
  readonly upgradeRuntimeDepsAsFix?: boolean;

  /**
   * The org this project is part of.
   *
   * @default - Auto detected from package name
   */
  readonly tenancy?: OrgTenancy;
}

export function withCommonOptionsDefaults<T extends CdkCommonOptions & github.GitHubProjectOptions>(options: T): T & Required<CdkCommonOptions> {
  const isPrivate = options.private ?? true;
  const enablePRAutoMerge = options.enablePRAutoMerge ?? isPrivate;
  const ghAutoMergeOptions = options.ghAutoMergeOptions ?? {
    secret: 'PROJEN_GITHUB_TOKEN',
  };
  const githubOptions: github.GitHubOptions = {
    mergify: !enablePRAutoMerge,
  };
  const npmAccess = isPrivate ? undefined : javascript.NpmAccess.PUBLIC;
  const tenancy = options.tenancy ?? (options.name.startsWith('@aws-cdk/') ? OrgTenancy.AWS : OrgTenancy.CDKLABS);
  const autoApproveOptions = {
    allowedUsernames: [automationUserForOrg(tenancy), 'dependabot[bot]'],
    secret: 'GITHUB_TOKEN',
  };
  const upgradeRuntimeDepsAsFix = options.upgradeRuntimeDepsAsFix ?? true;

  return deepMerge([
    {},
    options,
    {
      private: isPrivate,
      enablePRAutoMerge,
      ghAutoMergeOptions,
      githubOptions,
      setNodeEngineVersion: options.setNodeEngineVersion ?? true,
      npmAccess,
      tenancy,
      autoApproveOptions,
      depsUpgrade: !upgradeRuntimeDepsAsFix,
      upgradeRuntimeDepsAsFix,
    },
  ]) as T & Required<CdkCommonOptions>;
}

export function configureCommonFeatures(project: typescript.TypeScriptProject, opts: CdkCommonOptions & Pick<javascript.NodeProjectOptions, 'autoApproveUpgrades' | 'autoApproveOptions'>) {
  if (opts.private) {
    new Private(project);
  }

  if (opts.enablePRAutoMerge) {
    new MergeQueue(project, {
      autoMergeOptions: opts.ghAutoMergeOptions,
    });
  }

  if ((opts.upgradeCdklabsProjenProjectTypes ?? true)) {
    new UpgradeCdklabsProjenProjectTypes(project);
  }

  if ((opts.upgradeRuntimeDepsAsFix)) {
    const exclude = opts.upgradeCdklabsProjenProjectTypes ? UpgradeCdklabsProjenProjectTypes.deps : [];
    const labels = opts.autoApproveUpgrades ? [opts.autoApproveOptions?.label ?? 'auto-approve'] : [];

    new javascript.UpgradeDependencies(project, {
      taskName: 'upgrade',
      types: [DependencyType.RUNTIME, DependencyType.BUNDLED, DependencyType.PEER],
      exclude,
      semanticCommit: 'fix',
      workflowOptions: {
        labels,
        schedule: javascript.UpgradeDependenciesSchedule.expressions(['0 18 * * *']),
      },
    });

    new javascript.UpgradeDependencies(project, {
      taskName: 'upgrade-dev-deps',
      types: [DependencyType.BUILD, DependencyType.DEVENV, DependencyType.TEST],
      exclude,
      semanticCommit: 'chore',
      pullRequestTitle: 'upgrade dev dependencies',
      workflowOptions: {
        labels,
      },
    });
  }

  if (opts.setNodeEngineVersion === false) {
    project.package.file.addOverride('engines.node', undefined);
  }

  // If cdklabs-projen-project-types is not added explicitly, add it now
  if (!project.deps.all.some(dep => dep.name === 'cdklabs-projen-project-types')) {
    project.addDevDeps('cdklabs-projen-project-types');
  }

  // Use a different (safer) approach to running upgrades
  // If this proves to be stable we should backport it to projen
  new SaferUpgrades(project);
}

function automationUserForOrg(tenancy: OrgTenancy) {
  switch (tenancy) {
    case OrgTenancy.AWS:
      return 'aws-cdk-automation';
    case OrgTenancy.CDKLABS:
    default:
      return 'cdklabs-automation';
  }
}
