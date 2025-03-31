import { Testing } from 'projen';
import { CdkCliIntegTestsWorkflow, yarn } from '../src';

test('snapshot test for the CDK CLI integ tests', () => {
  const repo = new yarn.CdkLabsMonorepo({
    name: 'monorepo',
    defaultReleaseBranch: 'main',
  });

  new CdkCliIntegTestsWorkflow(repo, {
    approvalEnvironment: 'approval',
    testEnvironment: 'test',
    buildRunsOn: 'runsOn',
    testRunsOn: 'testRunsOn',
    localPackages: ['@aws-cdk/bla', '@aws-cdk/bloeh'],
    sourceRepo: 'aws/some-repo',
    allowUpstreamVersions: ['@aws-cdk/bla'],
  });

  const outdir = Testing.synth(repo);
  expect(outdir).toMatchSnapshot();
});

test('throws error if atmosphere enabled with no options', () => {
  const repo = new yarn.CdkLabsMonorepo({
    name: 'monorepo',
    defaultReleaseBranch: 'main',
  });

  expect(() => {
    new CdkCliIntegTestsWorkflow(repo, {
      approvalEnvironment: 'approval',
      testEnvironment: 'test',
      buildRunsOn: 'runsOn',
      testRunsOn: 'testRunsOn',
      localPackages: ['@aws-cdk/bla', '@aws-cdk/bloeh'],
      sourceRepo: 'aws/some-repo',
      allowUpstreamVersions: ['@aws-cdk/bla'],
      atmosphereEnabled: true,
    });
  }).toThrow('\'atmosphereOptions\' must be provided');

});

test('snapshot test for the CDK CLI integ tests using atmosphere', () => {
  const repo = new yarn.CdkLabsMonorepo({
    name: 'monorepo',
    defaultReleaseBranch: 'main',
  });

  new CdkCliIntegTestsWorkflow(repo, {
    approvalEnvironment: 'approval',
    testEnvironment: 'test',
    buildRunsOn: 'runsOn',
    testRunsOn: 'testRunsOn',
    localPackages: ['@aws-cdk/bla', '@aws-cdk/bloeh'],
    sourceRepo: 'aws/some-repo',
    allowUpstreamVersions: ['@aws-cdk/bla'],
    atmosphereEnabled: true,
    atmosphereOptions: {
      endpoint: 'atmosphere.endpoint',
      pool: 'atmosphere.pool',
      oidcRoleArn: 'oidcRoleArn',
    },
  });

  const outdir = Testing.synth(repo);
  expect(outdir).toMatchSnapshot();
});
