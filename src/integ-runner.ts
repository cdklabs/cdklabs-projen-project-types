import { awscdk, Component, DependencyType } from 'projen';

/**
 * This component adds support for using `integ-runner` and `integ-tests`
 * in a construct library.
 */
export class IntegRunner extends Component {
  constructor(
    project: awscdk.AwsCdkConstructLibrary | awscdk.AwsCdkTypeScriptApp,
  ) {
    super(project);

    project.deps.addDependency(
      `@aws-cdk/integ-runner@${project.cdkVersion}`,
      DependencyType.DEVENV,
    );
    project.deps.addDependency(
      `@aws-cdk/integ-tests-alpha@${project.cdkVersion}-alpha.0`,
      DependencyType.DEVENV,
    );

    const integSnapshotTask = project.addTask('integ', {
      description: 'Run integration snapshot tests',
      receiveArgs: true,
      exec: 'yarn integ-runner --language typescript',
    });

    project.addTask('integ:update', {
      description: 'Run and update integration snapshot tests',
      exec: 'yarn integ-runner --language typescript --update-on-failed',
      receiveArgs: true,
    });

    project.testTask.spawn(integSnapshotTask);
  }
}
