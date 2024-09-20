import { DependencyType, github, javascript, typescript } from 'projen';
import { deepMerge } from 'projen/lib/util';
import { CdkCommonOptions } from './cdk-common-options';
import { MergeQueue } from './merge-queue';
import { Private } from './private';
import { UpgradeCdklabsProjenProjectTypes } from './upgrade-cdklabs-projen-project-types';

export enum OrgTenancy {
  CDKLABS = 'cdklabs',
  AWS = 'aws',
}

type CommonOptions = CdkCommonOptions & typescript.TypeScriptProjectOptions;
export function withCommonOptionsDefaults<T extends CommonOptions>(options: T): T & Required<CdkCommonOptions> {
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
  const shortname = (options.name.startsWith('@') && options.name.split('/')[1]) || options.name;
  const repository = options.repository ?? `https://github.com/${tenancy}/${shortname}.git`;
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
      repository,
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
