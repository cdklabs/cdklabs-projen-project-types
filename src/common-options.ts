import { DependencyType, github, javascript, typescript } from 'projen';
import { deepMerge } from 'projen/lib/util';
import { CdkCommonOptions } from './cdk-common-options';
import { Private } from './private';
import { UpgradeCdklabsProjenProjectTypes } from './upgrade-cdklabs-projen-project-types';

export enum OrgTenancy {
  CDKLABS = 'cdklabs',
  AWS = 'aws',
}

type ProjectOptions = CdkCommonOptions & typescript.TypeScriptProjectOptions;
type ConfiguredTypeScriptOptions = Pick<typescript.TypeScriptProjectOptions,
| 'githubOptions'
| 'npmAccess'
| 'autoApproveOptions'
| 'autoApproveUpgrades'
| 'depsUpgrade'
| 'repository'
| 'workflowNodeVersion'
>;
type ConfiguredCommonOptions = Required<CdkCommonOptions &ConfiguredTypeScriptOptions>;

export function withCommonOptionsDefaults<T extends ProjectOptions>(options: T): T & ConfiguredCommonOptions {
  const isPrivate = options.private ?? true;
  const enablePRAutoMerge = options.enablePRAutoMerge ?? isPrivate;
  const ghAutoMergeOptions = options.ghAutoMergeOptions ?? {
    projenCredentials: github.GithubCredentials.fromPersonalAccessToken({ secret: 'PROJEN_GITHUB_TOKEN' }),
  };
  const githubOptions: github.GitHubOptions = {
    mergify: !enablePRAutoMerge,
  };
  const npmAccess = options.npmAccess ?? (isPrivate ? javascript.NpmAccess.RESTRICTED : javascript.NpmAccess.PUBLIC);
  const tenancy = options.tenancy ?? (options.name.startsWith('@aws-cdk/') ? OrgTenancy.AWS : OrgTenancy.CDKLABS);
  const shortname = (options.name.startsWith('@') && options.name.split('/')[1]) || options.name;
  const repository = options.repository ?? `https://github.com/${tenancy}/${shortname}.git`;
  const autoApproveOptions = {
    allowedUsernames: [automationUserForOrg(tenancy), 'dependabot[bot]'],
    secret: 'GITHUB_TOKEN',
  };
  const upgradeRuntimeDepsAsFix = options.upgradeRuntimeDepsAsFix ?? true;

  const common: ConfiguredCommonOptions = {
    private: isPrivate,
    enablePRAutoMerge,
    ghAutoMergeOptions,
    githubOptions,
    setNodeEngineVersion: options.setNodeEngineVersion ?? true,
    npmAccess,
    tenancy,
    autoApproveOptions,
    autoApproveUpgrades: options.autoApproveUpgrades ?? true,
    depsUpgrade: !upgradeRuntimeDepsAsFix,
    upgradeRuntimeDepsAsFix,
    repository,
    upgradeCdklabsProjenProjectTypes:
      options.upgradeCdklabsProjenProjectTypes ?? true,

    // Deviation from upstream projen: upstream projen defaults to minNodeVersion, but we have too many workflows
    // that use tools that want a recent Node version, so default to a reasonable floating version.
    workflowNodeVersion: options.workflowNodeVersion ?? 'lts/*',
  };

  return deepMerge([{}, options, common]) as T & ConfiguredCommonOptions;
}

export function configureCommonComponents(project: typescript.TypeScriptProject, opts: CdkCommonOptions & Pick<javascript.NodeProjectOptions, 'autoApproveUpgrades' | 'autoApproveOptions'>) {
  if (opts.private) {
    new Private(project);
  }

  if (opts.enablePRAutoMerge) {
    new github.MergeQueue(project, {
      autoQueueOptions: opts.ghAutoMergeOptions,
    });
  }

  if (opts.upgradeCdklabsProjenProjectTypes) {
    new UpgradeCdklabsProjenProjectTypes(project);
  }

  if ((opts.upgradeRuntimeDepsAsFix)) {
    const exclude = opts.upgradeCdklabsProjenProjectTypes ? UpgradeCdklabsProjenProjectTypes.deps : [];
    const labels = opts.autoApproveUpgrades ? [opts.autoApproveOptions?.label ?? 'auto-approve'] : [];

    new javascript.UpgradeDependencies(project, {
      taskName: 'upgrade',
      // NOTE: we explicitly do NOT upgrade PEER dependencies. We want the widest range of compatibility possible,
      // and by bumping peer dependencies we force the customer to also unnecessarily upgrade, which they may not want
      // to do. Never mind that peerDependencies are usually also devDependencies, so it doesn't make sense to upgrade
      // them without also upgrading devDependencies.
      types: [DependencyType.RUNTIME, DependencyType.BUNDLED],
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
