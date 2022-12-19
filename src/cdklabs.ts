import { UpdateSnapshot } from 'projen/lib/javascript';
import { deepMerge } from 'projen/lib/util';
import {
  CdkConstructLibrary,
  CdkConstructLibraryOptions,
  CdkTypeScriptProject,
  CdkTypeScriptProjectOptions,
} from './cdk';

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
    allowedUsernames: ['cdklabs-automation'],
    secret: 'GITHUB_TOKEN',
  },
  minNodeVersion: '14.17.0',
  jestOptions: {
    updateSnapshot: UpdateSnapshot.NEVER,
  },
  defaultReleaseBranch: 'main',
};

function createCdklabsPublishingDefaults(npmPackageName: string) {
  return {
    publishToPypi: {
      distName: npmPackageName,
      module: changeDelimiter(npmPackageName, '_'),
    },
    publishToMaven: {
      javaPackage: `io.github.cdklabs.${changeDelimiter(npmPackageName, '.')}`,
      mavenGroupId: 'io.github.cdklabs',
      mavenArtifactId: npmPackageName,
      mavenEndpoint: 'https://s01.oss.sonatype.org',
    },
    publishToNuget: {
      dotNetNamespace: `Cdklabs${upperCaseName(npmPackageName)}`,
      packageId: `Cdklabs${upperCaseName(npmPackageName)}`,
    },
    publishToGo: {
      moduleName: `${npmPackageName}-go`,
    },
  };

  function upperCaseName(str: string) {
    let words = str.split('-');
    words = words.map((w) => w[0].toUpperCase() + w.substring(1));
    return words.join('');
  }

  function changeDelimiter(str: string, delim: string) {
    return str.split('-').join(delim);
  }
};

export interface CdklabsConstructLibraryOptions extends CdkConstructLibraryOptions {
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
}

/**
 * Create a Cdklabs Construct Library Project
 *
 * @pjid cdklabs-construct-lib
 */
export class CdklabsConstructLibrary extends CdkConstructLibrary {
  constructor(options: CdklabsConstructLibraryOptions) {
    const cdklabsPublishingDefaultProps = (options.cdklabsPublishingDefaults ?? true) ?
      createCdklabsPublishingDefaults(options.name) : {};

    const mergedOptions = deepMerge([
      cdklabsDefaultProps,
      cdklabsPublishingDefaultProps,
      options,
      cdklabsForcedProps,
    ]) as CdkConstructLibraryOptions;

    super(mergedOptions);
  }
}

export interface CdklabsTypeScriptProjectOptions extends CdkTypeScriptProjectOptions {
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
}

/**
 * Create a Cdklabs TypeScript Project
 *
 * @pjid cdklabs-ts-proj
 */
export class CdklabsTypeScriptProject extends CdkTypeScriptProject {
  constructor(options: CdklabsTypeScriptProjectOptions) {
    const cdklabsPublishingDefaultProps = (options.cdklabsPublishingDefaults ?? true) ?
      createCdklabsPublishingDefaults(options.name) : {};

    const mergedOptions = deepMerge([
      cdklabsDefaultProps,
      cdklabsPublishingDefaultProps,
      options,
      cdklabsForcedProps,
    ]) as CdkConstructLibraryOptions;

    super(mergedOptions);
  }
}
