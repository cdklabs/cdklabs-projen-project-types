import { typescript } from 'projen';
import { COMMON_OPTIONS } from './cdk-common-options';
import { JsiiInterface } from './jsii-extend-interface';

export function generateCdkJsiiOptions(project: typescript.TypeScriptProject) {
  new JsiiInterface(project, {
    name: 'CdkJsiiProjectOptions',
    filePath: 'src/cdk-jsii-options.ts',
    extends: 'projen.cdk.JsiiProjectOptions',
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
    ],
  });
}
