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
    localPackages: ['@aws-cdk/bla'],
  });

  const outdir = Testing.synth(repo);
  expect(outdir).toMatchSnapshot();
});