import { Component, SampleFile, cdk } from 'projen';

export interface RosettaOptions {
  /**
   * Enable or disable strict mode.
   *
   * @default true
   */
  readonly strict?: boolean;

  /**
   * Set an explicit version of rosetta.
   *
   * @default - no version is set, use automatic detection
   */
  readonly version?: string;
}

/**
 * The Rosetta component adds builtin rosetta support
 * for a construct library. Since ConstructHub will run
 * rosetta for real, this just adds a check to the build to
 * ensure that rosetta will run successfully
 */
export class Rosetta extends Component {
  constructor(project: cdk.JsiiProject, options: RosettaOptions = {}) {
    super(project);

    const strict = options.strict ?? true;

    if (!strict) {
      project.logger.warn('Rosetta is NOT operating in strict mode. We are going to enforce this soon.\nPlease fix any examples.');
    }

    // Add DevDep
    const rosettaDep = options.version ? `jsii-rosetta@${options.version}` : 'jsii-rosetta';
    project.addDevDeps(rosettaDep);

    const rosettaTask = project.addTask('rosetta:extract', {
      description: 'Test rosetta extract',
      exec: `yarn --silent jsii-rosetta extract ${strict ? '--strict' : ''}`.trim(),
    });
    project.postCompileTask.spawn(rosettaTask);
    project.addGitIgnore('.jsii.tabl.json');
    new SampleFile(project, 'rosetta/default.ts-fixture', {
      contents: [
        '// Fixture with packages imported, but nothing else',
        "import { Construct } from 'constructs';",
        'import {',
        '  Stack,',
        "} from 'aws-cdk-lib';",
        '',
        'class Fixture extends Stack {',
        '  constructor(scope: Construct, id: string) {',
        '    super(scope, id);',
        '',
        '    /// here',
        '  }',
        '}',
      ].join('\n'),
    });
    project.addGitIgnore('!/rosetta/default.ts-fixture');
  }
}
