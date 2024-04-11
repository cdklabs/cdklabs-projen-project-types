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
        name: 'nx',
        optional: true,
        type: { primitive: PrimitiveType.Boolean },
        docs: {
          summary: 'Enable the integration with Nx in the monorepo',
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
            { fqn: 'cdklabs-projen-project-types.yarn.TypeScriptWorkspace' },
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
    ],
  });
}
