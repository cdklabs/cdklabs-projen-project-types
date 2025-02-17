import { Component, github, javascript } from 'projen';

export interface CdkCliIntegTestsWorkflowProps {
  /**
   * Runners for the workflow
   */
  readonly buildRunsOn: string;

  /**
   * Runners for the workflow
   */
  readonly testRunsOn: string;

  /**
   * GitHub environment name for approvals
   *
   * MUST be configured to require manual approval.
   */
  readonly approvalEnvironment: string;

  /**
   * GitHub environment name for running the tests
   *
   * MUST be configured without approvals, and with the following vars and secrets:
   *
   * - vars: AWS_ROLE_TO_ASSUME_FOR_TESTING
   *
   * And the role needs to be configured to allow the AssumeRole operation.
   */
  readonly testEnvironment: string;

  /**
   * Packages that are locally transfered (we will never use the upstream versions)
   */
  readonly localPackages: string[];

  /**
   * Whether or not we expect the new cli-lib version
   *
   * This needs to be `false` for a while in the `aws-cdk-cli-testing`
   * package, until we have had a release of `aws-cdk-cli` with the new
   * version.
   *
   * This needs to be `true` always for the `aws-cdk-cli` repo.
   */
  readonly expectNewCliLibVersion?: boolean;
}

/**
 * Add a workflow for running the tests
 *
 * This MUST be a separate workflow that runs in privileged context. We have a couple
 * of options:
 *
 * - `workflow_run`: we can trigger a privileged workflow run after the unprivileged
 *   `pull_request` workflow finishes and reuse its output artifacts. The
 *   problem is that the second run is disconnected from the PR so we would need
 *   to script in visibility for approvals and success (by posting comments, for
 *   example)
 * - Use only a `pull_request_target` workflow on the PR: this either would run
 *   a privileged workflow on any user code submission (might be fine given the
 *   workflow's `permissions`, but I'm sure this will make our security team uneasy
 *   anyway), OR this would mean any build needs human confirmation which means slow
 *   feedback.
 * - Use a `pull_request` for a regular fast-feedback build, and a separate
 *   `pull_request_target` for the integ tests. This means we're building twice.
 *
 * Ultimately, our build isn't heavy enough to put in a lot of effort deduping
 * it, so we'll go with the simplest solution which is the last one: 2
 * independent workflows.
 *
 * projen doesn't make it easy to copy the relevant parts of the 'build' workflow,
 * so they're unfortunately duplicated here.
 */
export class CdkCliIntegTestsWorkflow extends Component {
  constructor(repo: javascript.NodeProject, props: CdkCliIntegTestsWorkflowProps) {
    super(repo);

    const buildWorkflow = repo.buildWorkflow;
    const runTestsWorkflow = repo.github?.addWorkflow('integ');
    if (!buildWorkflow || !runTestsWorkflow) {
      throw new Error('Expected build and run tests workflow');
    }
    ((buildWorkflow as any).workflow as github.GithubWorkflow);

    runTestsWorkflow.on({
      pullRequestTarget: {
        branches: ['main'],
      },
      // we need to trigger the workflow on the merge group so we can make it a required status check
      // but we don't actually want to run the integ-test on the merge queue,
      // so we later add an if condition to the job to always pass it when run on the merge queue
      mergeGroup: {},
    });
    // The 'build' part runs on the 'integ-approval' environment, which requires
    // approval. The actual runs access the real environment, not requiring approval
    // anymore.
    //
    // This is for 2 reasons:
    // - The build job is the first one that runs. That means you get asked approval
    //   immediately after push, instead of 5 minutes later after the build completes.
    // - The build job is only one job, versus the tests which are a matrix build.
    //   If the matrix test job needs approval, the Pull Request timeline gets spammed
    //   with an approval request for every individual run.
    runTestsWorkflow.addJob('prepare', {
      if: "if: (github.event_name == 'pull_request' || github.event_name == 'pull_request_target')",
      environment: props.approvalEnvironment,
      runsOn: [props.buildRunsOn],
      permissions: {
        contents: github.workflows.JobPermission.READ,
      },
      env: {
        CI: 'true',
      },
      steps: [
        {
          name: 'Checkout',
          uses: 'actions/checkout@v4',
          with: {
            // IMPORTANT! This must be `head.sha` not `head.ref`, otherwise we
            // are vulnerable to a TOCTOU attack.
            'ref': '${{ github.event.pull_request.head.sha }}',
            'repository': '${{ github.event.pull_request.head.repo.full_name }}',
            // This is necessary to fetch tags, otherwise bumping won't work properly.
            'fetch-depth': 0,
          },
        },
        {
          name: 'Setup Node.js',
          uses: 'actions/setup-node@v4',
          with: {
            'node-version': 'lts/*',
          },
        },
        {
          name: 'Install dependencies',
          run: 'yarn install --check-files',
        },
        {
          name: 'Bump to realistic versions',
          run: 'yarn workspaces run bump',
          env: {
            TESTING_CANDIDATE: 'true',
          },
        },
        {
          name: 'build',
          run: 'npx projen build',
          env: {
            // This is necessary to prevent projen from resetting the version numbers to
            // 0.0.0 during its synthesis.
            RELEASE: 'true',
          },
        },
        {
          name: 'Upload artifact',
          uses: 'actions/upload-artifact@v4.4.0',
          with: {
            name: 'build-artifact',
            path: 'packages/**/dist/js/*.tgz',
            overwrite: 'true',
          },
        },
      ],
    });

    const verdaccioConfig = {
      storage: './storage',
      auth: { htpasswd: { file: './htpasswd' } },
      uplinks: { npmjs: { url: 'https://registry.npmjs.org/' } },
      packages: {} as Record<string, unknown>,
    };

    for (const pack of props.localPackages) {
      verdaccioConfig.packages[pack] = {
        access: '$all',
        publish: '$all',
        proxy: 'none',
      };
    };
    verdaccioConfig.packages['**'] = {
      access: '$all',
      proxy: 'npmjs',
    };

    // We create a matrix job for the test.
    // This job will run all the different test suites in parallel.
    const JOB_INTEG_MATRIX = 'integ_matrix';
    runTestsWorkflow.addJob(JOB_INTEG_MATRIX, {
      environment: props.testEnvironment,
      runsOn: [props.testRunsOn],
      needs: ['prepare'],
      permissions: {
        contents: github.workflows.JobPermission.READ,
        idToken: github.workflows.JobPermission.WRITE,
      },
      env: {
        // Otherwise Maven is too noisy
        MAVEN_ARGS: '--no-transfer-progress',
        // This is not actually a canary, but this prevents the tests from making
        // assumptions about the availability of source packages.
        IS_CANARY: 'true',
        CI: 'true',
        // This is necessary because the new versioning of @aws-cdk/cli-lib-alpha
        // matches the CLI and not the framework.
        ...props.expectNewCliLibVersion ? { CLI_LIB_VERSION_MIRRORS_CLI: 'true' } : {},
      },
      strategy: {
        failFast: false,
        matrix: {
          domain: {
            suite: [
              'cli-integ-tests',
              'init-csharp',
              'init-fsharp',
              'init-go',
              'init-java',
              'init-javascript',
              'init-python',
              'init-typescript-app',
              'init-typescript-lib',
              'tool-integrations',
            ],
          },
        },
      },
      steps: [
        {
          name: 'Download build artifacts',
          uses: 'actions/download-artifact@v4',
          with: {
            name: 'build-artifact',
            path: 'packages',
          },
        },
        {
          name: 'Set up JDK 18',
          if: 'matrix.suite == \'init-java\' || matrix.suite == \'cli-integ-tests\'',
          uses: 'actions/setup-java@v4',
          with: {
            'java-version': '18',
            'distribution': 'corretto',
          },
        },
        {
          name: 'Authenticate Via OIDC Role',
          id: 'creds',
          uses: 'aws-actions/configure-aws-credentials@v4',
          with: {
            'aws-region': 'us-east-1',
            'role-duration-seconds': 4 * 60 * 60,
            // Expect this in Environment Variables
            'role-to-assume': '${{ vars.AWS_ROLE_TO_ASSUME_FOR_TESTING }}',
            'role-session-name': 'run-tests@aws-cdk-cli-integ',
            'output-credentials': true,
          },
        },
        // This is necessary for the init tests to succeed, they set up a git repo.
        {
          name: 'Set git identity',
          run: [
            'git config --global user.name "aws-cdk-cli-integ"',
            'git config --global user.email "noreply@example.com"',
          ].join('\n'),
        },
        {
          name: 'Install Verdaccio',
          run: 'npm install -g verdaccio pm2',
        },
        {
          name: 'Create Verdaccio config',
          run: [
            'mkdir -p $HOME/.config/verdaccio',
            `echo '${JSON.stringify(verdaccioConfig)}' > $HOME/.config/verdaccio/config.yaml`,
          ].join('\n'),
        },
        {
          name: 'Start Verdaccio',
          run: [
            'pm2 start verdaccio -- --config $HOME/.config/verdaccio/config.yaml',
            'sleep 5 # Wait for Verdaccio to start',
          ].join('\n'),
        },
        {
          name: 'Configure npm to use local registry',
          run: [
            // This token is a bogus token. It doesn't represent any actual secret, it just needs to exist.
            'echo \'//localhost:4873/:_authToken="MWRjNDU3OTE1NTljYWUyOTFkMWJkOGUyYTIwZWMwNTI6YTgwZjkyNDE0NzgwYWQzNQ=="\' > ~/.npmrc',
            'echo \'registry=http://localhost:4873/\' >> ~/.npmrc',
          ].join('\n'),
        },
        {
          name: 'Find an locally publish all tarballs',
          run: [
            `for pkg in packages/{${props.localPackages.join(',')}}/dist/js/*.tgz; do`,
            '  npm publish $pkg',
            'done',
          ].join('\n'),
        },
        {
          name: 'Download and install the test artifact',
          run: [
            'npm install @aws-cdk-testing/cli-integ',
            // Move the installed files to the current directory, because as
            // currently configured the tests won't run from an installed
            // node_modules directory.
            'mv ./node_modules/@aws-cdk-testing/cli-integ/* .',
          ].join('\n'),
        },
        {
          name: 'Determine latest package versions',
          id: 'versions',
          run: [
            'CLI_VERSION=$(cd ${TMPDIR:-/tmp} && npm view aws-cdk version)',
            'echo "CLI version: ${CLI_VERSION}"',
            'echo "cli_version=${CLI_VERSION}" >> $GITHUB_OUTPUT',
            'LIB_VERSION=$(cd ${TMPDIR:-/tmp} && npm view aws-cdk-lib version)',
            'echo "lib version: ${LIB_VERSION}"',
            'echo "lib_version=${LIB_VERSION}" >> $GITHUB_OUTPUT',
          ].join('\n'),
        },
        {
          name: 'Run the test suite: ${{ matrix.suite }}',
          run: [
            'bin/run-suite --use-cli-release=${{ steps.versions.outputs.cli_version }} --framework-version=${{ steps.versions.outputs.lib_version }} ${{ matrix.suite }}',
          ].join('\n'),
          env: {
            // Concurrency only for long-running cli-integ-tests
            JEST_TEST_CONCURRENT: "${{ matrix.suite == 'cli-integ-tests' && 'true' || 'false' }}",
            JSII_SILENCE_WARNING_DEPRECATED_NODE_VERSION: 'true',
            JSII_SILENCE_WARNING_UNTESTED_NODE_VERSION: 'true',
            JSII_SILENCE_WARNING_KNOWN_BROKEN_NODE_VERSION: 'true',
            DOCKERHUB_DISABLED: 'true',
            AWS_REGIONS: ['us-east-2', 'eu-west-1', 'eu-north-1', 'ap-northeast-1', 'ap-south-1'].join(','),
            CDK_MAJOR_VERSION: '2',
            RELEASE_TAG: 'latest',
            GITHUB_TOKEN: '${{ secrets.GITHUB_TOKEN }}',
          },
        },
      ],
    });

    // Add a job that collates all matrix jobs into a single status
    // This is required so that we can setup required status checks
    // and if we ever change the test matrix, we don't need to update
    // the status check configuration.
    runTestsWorkflow.addJob('integ', {
      permissions: {},
      runsOn: [props.testRunsOn],
      needs: [JOB_INTEG_MATRIX],
      if: 'always()',
      steps: [
        {
          name: 'Integ test result',
          run: `echo \${{ needs.${JOB_INTEG_MATRIX}.result }}`,
        },
        {
          if: `\${{ needs.${JOB_INTEG_MATRIX}.result != 'success' }}`,
          name: 'Set status based on matrix job',
          run: 'exit 1',
        },
      ],
    });
  }
}
