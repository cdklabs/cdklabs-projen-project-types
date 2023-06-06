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
  CdkConstructLibraryOptions,
  CdkTypeScriptProject,
  CdkTypeScriptProjectOptions,
} from './cdk';
import { CdkJsiiProject, CdkJsiiProjectOptions } from './jsii';

// override these properties no matter what values are given client-side
const cdklabsForcedProps = {
  author: 'Amazon Web Services',
  authorName: 'Amazon Web Services',
  authorAddress: 'aws-cdk-dev@amazon.com',
  authorEmail: 'aws-cdk-dev@amazon.com',
  authorOrganization: true,
};

const cdklabsDefaultProps = {
  autoApproveUpgrades: true,
  autoApproveOptions: {
    allowedUsernames: ['cdklabs-automation', 'dependabot[bot]'],
    secret: 'GITHUB_TOKEN',
  },
  minNodeVersion: '14.18.0',
  jestOptions: {
    updateSnapshot: UpdateSnapshot.ALWAYS,
  },
  defaultReleaseBranch: 'main',
};

function createCdklabsPublishingDefaults(npmPackageName: string, langs?: JsiiLanguage[]) {
  return {
    ...publishLanguageWrapper(JsiiLanguage.PYTHON, {
      publishToPypi: {
        distName: npmPackageName,
        module: changeDelimiter(npmPackageName, '_'),
      },
    }),
    ...publishLanguageWrapper(JsiiLanguage.JAVA, {
      publishToMaven: {
        javaPackage: `io.github.cdklabs.${changeDelimiter(npmPackageName, '.')}`,
        mavenGroupId: 'io.github.cdklabs',
        mavenArtifactId: npmPackageName,
        mavenEndpoint: 'https://s01.oss.sonatype.org',
      },
    }),
    ...publishLanguageWrapper(JsiiLanguage.DOTNET, {
      publishToNuget: {
        dotNetNamespace: `Cdklabs${upperCaseName(npmPackageName)}`,
        packageId: `Cdklabs${upperCaseName(npmPackageName)}`,
      },
    }),
    ...publishLanguageWrapper(JsiiLanguage.GO, {
      publishToGo: {
        moduleName: `github.com/cdklabs/${npmPackageName}-go`,
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

export interface CdklabsConstructLibraryOptions extends CdkConstructLibraryOptions, CdklabsPublishingProjectOptions {}

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

export interface CdklabsJsiiProjectOptions extends CdkJsiiProjectOptions, CdklabsPublishingProjectOptions {}

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
