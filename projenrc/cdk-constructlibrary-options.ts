import { PrimitiveType, Property } from '@jsii/spec';
import { typescript } from 'projen';
import { JsiiInterface } from './jsii-extend-interface';

export function generateCdkConstructLibraryOptions(project: typescript.TypeScriptProject) {
  new JsiiInterface(project, {
    name: 'CdkConstructLibraryOptions',
    fqn: 'cdklabs-projen-project-types.CdkConstructLibraryOptions',
    filePath: 'src/cdk-construct-library-options.ts',
    extends: 'projen.awscdk.AwsCdkConstructLibraryOptions',
    updateProps: {
      repositoryUrl: {
        optional: true,
        docs: {
          default: '- generated from org tenancy and package name',
          deprecated: 'use `repository`',
        },
      },
      repository: {
        docs: {
          default: '- generated from org tenancy and package name',
        },
      },
    },
    properties: [
      ...commonOptions,
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
        name: 'rosettaOptions',
        optional: true,
        type: { fqn: 'cdklabs-projen-project-types.RosettaOptions' },
        docs: {
          summary: 'Options for rosetta:extract task',
        },
      },
    ],
  });
}

const commonOptions: Property[] = [
  {
    name: 'private',
    optional: true,
    type: { primitive: PrimitiveType.Boolean },
    docs: {
      summary: 'Whether or not this package is private. ',
      remarks: 'Setting this variable to true means that your project is created with sane defaults for private repositories.',
      default: 'true',
    },
  },
  {
    name: 'enablePRAutoMerge',
    optional: true,
    type: { primitive: PrimitiveType.Boolean },
    docs: {
      summary: 'Whether to enable the auto merge workflow for PRs.',
      remarks: 'This will enable the auto merge workflow as well as the merge queue',
      default: '- true for private projects, false otherwise',
    },
  },
  {
    name: 'ghAutoMergeOptions',
    optional: true,
    type: { fqn: 'cdklabs-projen-project-types.AutoMergeOptions' },
    docs: {
      summary: 'Options for the GitHub auto merge workflow.',
      remarks: 'That is the workflow that turns on auto merge on all PRs.',
      default: '- default options',
    },
  },
  {
    name: 'setNodeEngineVersion',
    optional: true,
    type: { primitive: PrimitiveType.Boolean },
    docs: {
      summary: 'cdklabs-projen-project-types.AutoMergeOptions',
      remarks: "Set this to `false` if a package did not enforce this previously and we don't want to change this for now.",
      default: 'true',
    },
  },
  {
    name: 'upgradeCdklabsProjenProjectTypes',
    optional: true,
    type: { primitive: PrimitiveType.Boolean },
    docs: {
      summary: 'Whether to enable the separate workflow to upgrade the cdklabs-projen-project-types dependencies.',
      default: 'true',
    },
  },
  {
    name: 'upgradeRuntimeDepsAsFix',
    optional: true,
    type: { primitive: PrimitiveType.Boolean },
    docs: {
      summary: 'Whether to have a separate workflow to upgrade runtime deps and mark this PR as fix.',
      default: 'true',
    },
  },
  {
    name: 'tenancy',
    optional: true,
    type: { fqn: 'cdklabs-projen-project-types.OrgTenancy' },
    docs: {
      summary: 'The organization this project is part of.',
      default: '- Auto detected from package name',
    },
  },
];

export function generateCdkCommonOptions(project: typescript.TypeScriptProject) {
  new JsiiInterface(project, {
    name: 'CdkCommonOptions',
    filePath: 'src/cdk-common-options.ts',
    properties: commonOptions,
  });
}