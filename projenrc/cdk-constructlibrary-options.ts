import { PrimitiveType } from '@jsii/spec';
import { typescript } from 'projen';
import { JsiiInterface } from './jsii-extend-interface';

export function generateCdkConstructLibraryOptions(project: typescript.TypeScriptProject) {
  new JsiiInterface(project, {
    name: 'ModifiedProjenCdkConstructLibraryOptions',
    fqn: 'cdklabs-projen-project-types.ModifiedProjenCdkConstructLibraryOptions',
    filePath: 'src/cdk-options.ts',
    extends: 'projen.awscdk.AwsCdkConstructLibraryOptions',
    properties: [
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
}

