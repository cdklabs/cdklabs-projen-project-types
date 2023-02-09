import { Component, TextFile } from 'projen';
import { TypeScriptProject } from 'projen/lib/typescript';

/**
 * The Rosetta component adds builtin rosetta support
 * for a construct library. Since ConstructHub will run
 * rosetta for real, this just adds a check to the build to
 * ensure that rosetta will run successfully
 */
export class Rosetta extends Component {
  constructor(project: TypeScriptProject) {
    super(project);

    const rosettaTask = project.addTask('rosetta:extract', {
      description: 'Test rosetta extract',
      exec: 'yarn --silent jsii-rosetta extract --strict',
    });
    project.postCompileTask.spawn(rosettaTask);
    project.addGitIgnore('.jsii.tabl.json');

    new TextFile(project, 'rosetta/default.ts-fixture', {
      readonly: false,
      lines: [
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
      ],
      marker: false,
    });
  }
}
