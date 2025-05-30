import { basename } from 'path';
import { UpdateSnapshot } from 'projen/lib/javascript';
import { deepMerge } from 'projen/lib/util';

export enum JsiiLanguage {
  PYTHON,
  JAVA,
  DOTNET,
  GO,
};

import {
  CdkConstructLibrary,
  CdkTypeScriptProject,
  CdkTypeScriptProjectOptions,
} from './cdk';
import { CdkConstructLibraryOptions } from './cdk-construct-library-options';
import { CdkJsiiProjectOptions } from './cdk-jsii-options';
import { CdkJsiiProject } from './jsii';
// eslint-disable-next-line import/order
import { ReleasableCommits } from 'projen';

// override these properties no matter what values are given client-side
const cdklabsForcedProps = {
  author: 'Amazon Web Services',
  authorName: 'Amazon Web Services',
  authorAddress: 'aws-cdk-dev@amazon.com',
  authorEmail: 'aws-cdk-dev@amazon.com',
  authorOrganization: true,
};

const cdklabsDefaultProps: Partial<CdklabsConstructLibraryOptions> = {
  autoApproveUpgrades: true,
  minNodeVersion: '18.12.0',
  workflowNodeVersion: 'lts/*',
  jestOptions: {
    updateSnapshot: UpdateSnapshot.ALWAYS,
  },
  defaultReleaseBranch: 'main',
  // Default is to release only features and fixes. If we don't do this, every projen
  // project will basically release every day, because it will see devDependencies updates
  // every day, even though those are not interesting.
  releasableCommits: ReleasableCommits.featuresAndFixes(),
  jsiiVersion: '~5.7',
};

function createCdklabsPublishingDefaults(npmPackageName: string, langs?: JsiiLanguage[]) {
  const packageBasename = basename(npmPackageName);

  return createPublishingDefaults('cdklabs', packageBasename, Boolean(packageBasename !== npmPackageName), langs);
};

function createPublishingDefaults(namespace: string, packageBasename: string, alwaysUseNamespace = true, langs?: JsiiLanguage[]) {
  const piPyPrefix = alwaysUseNamespace ? `${namespace}.` : '';
  const nugetPrefix = alwaysUseNamespace ? `${upperCaseName(namespace)}.` : `${upperCaseName(namespace)}`;

  return {
    ...publishLanguageWrapper(JsiiLanguage.PYTHON, {
      publishToPypi: {
        distName: `${piPyPrefix}${packageBasename}`,
        module: `${piPyPrefix}${changeDelimiter(packageBasename, '_')}`,
      },
    }),
    ...publishLanguageWrapper(JsiiLanguage.JAVA, {
      publishToMaven: {
        javaPackage: `io.github.${namespace}.${changeDelimiter(packageBasename, '.')}`,
        mavenGroupId: `io.github.${namespace}`,
        mavenArtifactId: packageBasename,
        mavenServerId: 'central-ossrh',
      },
    }),
    ...publishLanguageWrapper(JsiiLanguage.DOTNET, {
      publishToNuget: {
        dotNetNamespace: `${nugetPrefix}${upperCaseName(packageBasename)}`,
        packageId: `${nugetPrefix}${upperCaseName(packageBasename)}`,
      },
    }),
    ...publishLanguageWrapper(JsiiLanguage.GO, {
      publishToGo: {
        moduleName: `github.com/${namespace}/${packageBasename}-go`,
      },
    }),
  };

  function publishLanguageWrapper(lang: JsiiLanguage, obj: Record<string, any>) {
    return publishLanguage(lang) ? obj : {};
  }

  function publishLanguage(lang: JsiiLanguage): boolean {
    // langs not specified === all languages published
    if (!langs) { return true; }
    if (langs.includes(lang)) { return true; }
    return false;
  }

  function upperCaseName(str: string) {
    let words = str.split('-');
    words = words.map((w) => w[0].toUpperCase() + w.substring(1));
    return words.join('');
  }

  function changeDelimiter(str: string, delim: string) {
    return str.split('-').join(delim);
  }
};

export interface CdklabsPublishingProjectOptions {
  /**
   * Set default publishing properties. Setting this property guarantees
   * that your project will have reasonable publishing names. You can choose
   * to modify them however you wish with the traditional `publishToPypi`,
   * `publishToMaven`, `publishToNuget`, and `publishToGo` properties, and
   * your configuration will be respected.
   *
   * This should be set to false only if you do not plan on releasing the package.
   *
   * @default true
   */
  readonly cdklabsPublishingDefaults?: boolean;

  /**
   * Specify specific languages to publish to. This can be used when the library
   * is experimental only, because stable libraries must publish to all jsii languages.
   * This should be used in conjunction with `cdklabsPublishingDefaults: true`; otherwise
   * it is a no-op.
   *
   * @default - all jsii target languages
   */
  readonly jsiiTargetLanguages?: JsiiLanguage[];
}

export interface CdklabsConstructLibraryOptions extends CdkConstructLibraryOptions, CdklabsPublishingProjectOptions { }

/**
 * Create a Cdklabs Construct Library Project
 *
 * @pjid cdklabs-construct-lib
 */
export class CdklabsConstructLibrary extends CdkConstructLibrary {
  constructor(options: CdklabsConstructLibraryOptions) {
    const cdklabsPublishingDefaultProps: Record<string, any> = (options.cdklabsPublishingDefaults ?? true) ?
      createCdklabsPublishingDefaults(options.name, options.jsiiTargetLanguages) : {};

    // the leftmost object is mutated and returned by deepMerge
    const mergedOptions = deepMerge([
      {},
      cdklabsDefaultProps,
      cdklabsPublishingDefaultProps,
      options,
      cdklabsForcedProps,
    ]) as CdkConstructLibraryOptions;

    super(mergedOptions);
  }
}

export interface CdklabsTypeScriptProjectOptions extends CdkTypeScriptProjectOptions { }

/**
 * Create a Cdklabs TypeScript Project
 *
 * @pjid cdklabs-ts-proj
 */
export class CdklabsTypeScriptProject extends CdkTypeScriptProject {
  constructor(options: CdklabsTypeScriptProjectOptions) {
    // the leftmost object is mutated and returned by deepMerge
    const mergedOptions = deepMerge([
      {},
      cdklabsDefaultProps,
      options,
      cdklabsForcedProps,
    ]) as CdkConstructLibraryOptions;

    super(mergedOptions);
  }
}

export interface CdklabsJsiiProjectOptions extends CdkJsiiProjectOptions, CdklabsPublishingProjectOptions { }

/**
 * Create a Cdklabs Jsii Project
 *
 * @pjid cdklabs-jsii-proj
 */
export class CdklabsJsiiProject extends CdkJsiiProject {
  constructor(options: CdklabsJsiiProjectOptions) {
    const cdklabsPublishingDefaultProps: Record<string, any> = (options.cdklabsPublishingDefaults ?? true) ?
      createCdklabsPublishingDefaults(options.name, options.jsiiTargetLanguages) : {};
    // the leftmost object is mutated and returned by deepMerge
    const mergedOptions = deepMerge([
      {},
      cdklabsDefaultProps,
      cdklabsPublishingDefaultProps,
      options,
      cdklabsForcedProps,
    ]) as CdklabsJsiiProjectOptions;

    super(mergedOptions);
  }
}
