import { PrimitiveType } from '@jsii/spec';
import { typescript } from 'projen';
import { COMMON_OPTIONS } from './cdk-common-options';
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
      ...COMMON_OPTIONS,
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
