import { github } from 'projen';
import { Testing } from 'projen/lib/testing';
import * as YAML from 'yaml';
import { CdklabsConstructLibrary, CdklabsJsiiProject, CdklabsTypeScriptProject, yarn } from '../src';

const commonOptions = {
  name: '@cdklabs/test',
  defaultReleaseBranch: 'main',
};

const jsiiOptions = {
  ...commonOptions,
  author: 'AWS',
  authorAddress: 'aws-cdk-dev@amazon.com',
};

const projectTypes = {
  CdklabsConstructLibrary: (selfMutationOnForks?: boolean) => new CdklabsConstructLibrary({
    ...jsiiOptions,
    cdkVersion: '2.1.0',
    selfMutationOnForks,
  }),
  CdklabsJsiiProject: (selfMutationOnForks?: boolean) => new CdklabsJsiiProject({
    ...jsiiOptions,
    selfMutationOnForks,
  }),
  CdklabsTypeScriptProject: (selfMutationOnForks?: boolean) => new CdklabsTypeScriptProject({
    ...commonOptions,
    selfMutationOnForks,
  }),
  CdkLabsMonorepo: (selfMutationOnForks?: boolean) => new yarn.CdkLabsMonorepo({
    ...commonOptions,
    selfMutationOnForks,
  }),
};

describe.each(Object.entries(projectTypes))('%s', (_, createProject) => {
  test('keeps self-mutation in the build workflow by default', () => {
    const outdir = Testing.synth(createProject());

    expect(outdir['.github/workflows/self-mutation.yml']).toBeUndefined();
    expect(YAML.parse(outdir['.github/workflows/build.yml']).jobs['self-mutation']).toBeDefined();
  });

  test('moves self-mutation into a separate workflow when enabled', () => {
    const outdir = Testing.synth(createProject(true));

    const selfMutation = YAML.parse(outdir['.github/workflows/self-mutation.yml']);
    expect(selfMutation.on.workflow_run.workflows).toEqual(['build']);
    expect(YAML.parse(outdir['.github/workflows/build.yml']).jobs['self-mutation']).toBeUndefined();
  });
});

test('uses the environment of the projen credentials', () => {
  const project = new CdklabsTypeScriptProject({
    ...commonOptions,
    selfMutationOnForks: true,
    githubOptions: {
      projenCredentials: github.GithubCredentials.fromPersonalAccessToken({
        secret: 'PROJEN_GITHUB_TOKEN',
        environment: 'automation',
      }),
    },
  });

  const outdir = Testing.synth(project);

  const selfMutation = YAML.parse(outdir['.github/workflows/self-mutation.yml']);
  expect(selfMutation.jobs['self-mutation'].environment).toEqual('automation');
});
