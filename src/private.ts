import { Component } from 'projen';
import { TypeScriptProject } from 'projen/lib/typescript';

/**
 * The Private component is a one-stop shop for all things
 * related to configuring a private repository. Instead of
 * ensuring that the project options are configured in a
 * "private" way, this component ensures that the output
 * enforces all our rules for private repositories regardless
 * of input.
 */
export class Private extends Component {
  constructor(project: TypeScriptProject) {
    super(project);

    // make sure this is always set
    (project as any).private = true;

    // mark private: true in package.json
    project.addFields({ private: true });

    // private repositories cannot have mergify configured.
    project.tryRemoveFile('.mergify.yml');

    // no need for npmignore file
    project.tryRemoveFile('.npmignore');
  }
}
