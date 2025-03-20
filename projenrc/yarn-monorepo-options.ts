import { CollectionKind, PrimitiveType } from '@jsii/spec';
import { typescript } from 'projen';
import { JsiiInterface } from './jsii-extend-interface';

export function generateYarnMonorepoOptions(project: typescript.TypeScriptProject) {
  new JsiiInterface(project, {
    name: 'MonorepoOptions',
    fqn: 'cdklabs-projen-project-types.yarn.MonorepoOptions',
    filePath: 'src/yarn/monorepo-options.ts',
    extends: 'projen.typescript.TypeScriptProjectOptions',
    omitProps: [
      'eslint',
      'jest',
      'jestOptions',
      'packageManager',
      'release',
      'sampleCode',
    ],
    properties: [
      {
        name: 'vscodeWorkspace',
        optional: true,
        type: { primitive: PrimitiveType.Boolean },
        docs: {
          summary: 'Create a VSCode multi-root workspace file for all monorepo workspaces',
          default: 'false',
        },
      },
      {
        name: 'vscodeWorkspaceOptions',
        optional: true,
        type: { fqn: 'cdklabs-projen-project-types.yarn.VsCodeWorkspaceOptions' },
        docs: {
          summary: 'Configuration options for the VSCode multi-root workspace file',
          default: '- default configuration',
        },
      },
      {
        name: 'nx',
        optional: true,
        type: { primitive: PrimitiveType.Boolean },
        docs: {
          summary: 'Enable the integration with Nx in the monorepo',
          default: 'false',
        },
      },
      {
        name: 'buildWithNx',
        optional: true,
        type: { primitive: PrimitiveType.Boolean },
        docs: {
          summary: 'When Nx is enabled, always build the monorepo using Nx',
          remarks: 'Will build projects in parallel and can improve build performance',
          default: 'false',
        },
      },
      {
        name: 'release',
        optional: true,
        type: { primitive: PrimitiveType.Boolean },
        docs: {
          summary: 'Whether or not to add release workflows for this repository',
          default: '- No release',
        },
      },
      {
        name: 'releaseOptions',
        optional: true,
        type: { fqn: 'cdklabs-projen-project-types.yarn.MonorepoReleaseOptions' },
        docs: {
          summary: 'Options for the release workflows',
        },
      },
      {
        name: 'minNodeVersion',
        optional: true,
        type: { primitive: PrimitiveType.String },
        docs: {
          summary: 'Minimum Node.js version to require via package.json `engines` (inclusive).',
          remarks: [
            '',
            'Only set this if your package will not work properly on specific (older?)',
            'Node versions.',
            '',
          ].join('\n'),
          default: '- no "engines" specified',
        },
      },
      {
        name: 'workflowNodeVersion',
        optional: true,
        type: { primitive: PrimitiveType.String },
        docs: {
          summary: 'The node version to use in GitHub workflows.',
          default: '\'lts/*\'',
        },
      },
    ],
  });

  new JsiiInterface(project, {
    name: 'MonorepoReleaseOptions',
    fqn: 'cdklabs-projen-project-types.yarn.MonorepoReleaseOptions',
    filePath: 'src/yarn/monorepo-release-options.ts',
    extends: 'projen.release.ReleaseProjectOptions',
    omitProps: [
      'releaseEveryCommit',
      'releaseSchedule',
      'releaseBranches',
      'releaseFailureIssue',
      'releaseFailureIssueLabel',
      'releaseTagPrefix',
      'versionrcOptions',
      'publishTasks',
    ],
    properties: [
      {
        name: 'branchName',
        optional: true,
        type: { primitive: PrimitiveType.String },
        docs: {
          summary: 'Branch name to release from',
          default: '"main"',
        },
      },
      {
        name: 'nodeVersion',
        optional: true,
        type: { primitive: PrimitiveType.String },
        docs: {
          summary: 'Node version to use in the release workflow',
          default: '"lts/*"',
        },
      },
      {
        name: 'publishToNpm',
        optional: true,
        type: { primitive: PrimitiveType.Boolean },
        docs: {
          summary: 'Publish packages to npm',
          default: 'true',
        },
      },
      {
        name: 'buildWithNx',
        optional: true,
        type: { primitive: PrimitiveType.Boolean },
        docs: {
          summary: 'Build the monorepo using Nx during the release.',
          remarks: 'Will build projects in parallel and can improve build performance',
          default: 'false',
        },
      },
    ],
  });

  const dependencyType = {
    collection: {
      kind: CollectionKind.Array,
      elementtype: {
        union: {
          types: [
            { primitive: PrimitiveType.String },
            { fqn: 'cdklabs-projen-project-types.yarn.IWorkspaceReference' },
          ],
        },
      },
    },
  };

  new JsiiInterface(project, {
    name: 'TypeScriptWorkspaceOptions',
    fqn: 'cdklabs-projen-project-types.yarn.TypeScriptWorkspaceOptions',
    filePath: 'src/yarn/typescript-workspace-options.ts',
    extends: 'projen.typescript.TypeScriptProjectOptions',
    omitProps: [
      'autoDetectBin',
      'defaultReleaseBranch',
      'depsUpgradeOptions',
      'parent',
      'release',
      'repositoryDirectory',
      'outdir',
    ],
    updateProps: {
      deps: { type: dependencyType },
      devDeps: { type: dependencyType },
      peerDeps: { type: dependencyType },
    },
    properties: [
      {
        name: 'parent',
        type: { fqn: 'cdklabs-projen-project-types.yarn.Monorepo' },
        docs: {
          summary: 'The parent `yarn.Monorepo` project.',
        },
      },
      {
        name: 'workspaceScope',
        optional: true,
        type: { primitive: PrimitiveType.String },
        docs: {
          summary: 'The workspace scope the package is located in.',
          default: '"packages"',
        },
      },
      {
        name: 'private',
        optional: true,
        type: { primitive: PrimitiveType.Boolean },
        docs: {
          summary: 'Make this a private package.',
          default: 'false',
        },
      },
      {
        name: 'excludeDepsFromUpgrade',
        optional: true,
        type: {
          collection: {
            kind: CollectionKind.Array,
            elementtype: { primitive: PrimitiveType.String },
          },
        },
        docs: {
          summary: 'Dependencies that should be excluded from upgrades.',
          default: '[]',
        },
      },
      {
        name: 'minNodeVersion',
        optional: true,
        type: { primitive: PrimitiveType.String },
        docs: {
          summary: 'Minimum Node.js version to require via package.json `engines` (inclusive).',
          remarks: [
            '',
            'Only set this if your package will not work properly on specific (older?)',
            'Node versions.',
            '',
          ].join('\n'),
          default: '- no "engines" specified',
        },
      },
      {
        name: 'workflowNodeVersion',
        optional: true,
        type: { primitive: PrimitiveType.String },
        docs: {
          summary: 'The node version to use in GitHub workflows.',
          default: '\'lts/*\'',
        },
      },
      {
        name: 'allowPrivateDeps',
        optional: true,
        type: { primitive: PrimitiveType.Boolean },
        docs: {
          summary: [
            'Allow private workspace dependencies in the \'deps\' parameter.',
            '',
            'By default, private dependencies are not allowed as users will not be able to install',
            'your package. It makes sense to relax this check *only* if you are bundling your package.',
          ].join('\n'),
          default: 'false',
        },
      },
    ],
  });

  new JsiiInterface(project, {
    name: 'VsCodeWorkspaceOptions',
    fqn: 'cdklabs-projen-project-types.yarn.VsCodeWorkspaceOptions',
    filePath: 'src/yarn/vscode-workspace-options.ts',
    properties: [
      {
        name: 'includeRootWorkspace',
        optional: true,
        type: { primitive: PrimitiveType.Boolean },
        docs: {
          summary: 'Adds a workspace for the repository root. This can be useful to manage the repository configuration.',
          default: 'false',
        },
      },
      {
        name: 'rootWorkspaceName',
        optional: true,
        type: { primitive: PrimitiveType.String },
        docs: {
          summary: 'The name of the root workspace if included.',
          default: '<root>',
        },
      },
    ],
  });
}
