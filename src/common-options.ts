import { github, typescript } from 'projen';
import { deepMerge } from 'projen/lib/util';
import { AutoMergeOptions } from './auto-merge';
import { MergeQueue } from './merge-queue';
import { Private } from './private';

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
   * @default - default options
   */
  readonly ghAutoMergeOptions?: AutoMergeOptions;

  /**
   * Whether to enforce the minNodeVersion via the `engines` field in `package.json`.
   * Set this to `false` if a package did not enforce this previously and we don't want to change this for now.
   *
   * @default true
   */
  readonly setNodeEngineVersion?: boolean;
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
      setNodeEngineVersion: options.setNodeEngineVersion ?? true,
    },
  ]) as T & Required<CdkCommonOptions>;
}

export function configureCommonFeatures(project: typescript.TypeScriptProject, opts: CdkCommonOptions) {
  if (opts.private) {
    new Private(project);
  }

  if (opts.enablePRAutoMerge) {
    new MergeQueue(project, {
      autoMergeOptions: opts.ghAutoMergeOptions,
    });
  }

  if (opts.setNodeEngineVersion === false) {
    project.package.file.addOverride('engines.node', undefined);
  }
}