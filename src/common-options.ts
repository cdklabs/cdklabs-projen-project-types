import { github } from 'projen';
import { deepMerge } from 'projen/lib/util';
import { AutoMergeOptions } from './auto-merge';

export interface CdkCommonOptions {
  /**
     * Whether or not this package is private. Setting this variable
     * to true means that your project is created with sane defaults
     * for private repositories.
     *
     * @default true
     */
  readonly private?: boolean;

  /**
     * Whether to enable the auto merge workflow for PRs
     * This will enable the auto merge workflow as well as the
     * merge queue
     *
     * @default - true for private projects, false otherwise
     */
  readonly enablePRAutoMerge?: boolean;

  /**
     * Options for the GitHub auto merge workflow (the workflow
     * that turns on auto merge on all PRs)
     *
     * @default default options
     */
  readonly ghAutoMergeOptions?: AutoMergeOptions;
}

export function withCommonOptionsDefaults<T extends CdkCommonOptions & github.GitHubProjectOptions>(options: T): T & Required<CdkCommonOptions> {
  const isPrivate = options.private ?? true;
  const enablePRAutoMerge = options.enablePRAutoMerge ?? isPrivate;
  const ghAutoMergeOptions = options.ghAutoMergeOptions ?? {
    secret: 'PROJEN_GITHUB_TOKEN',
  };
  const githubOptions: github.GitHubOptions = {
    mergify: !enablePRAutoMerge,
  };

  return deepMerge([
    {},
    options,
    {
      private: isPrivate,
      enablePRAutoMerge,
      ghAutoMergeOptions,
      githubOptions,
    },
  ]) as T & Required<CdkCommonOptions>;
}
