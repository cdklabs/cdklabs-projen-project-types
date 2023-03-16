# Cdklabs Projen Project Types

This repository stores custom project types extended from `projen` with cdklabs defaults
baked in. This is meant to serve as a hook for continuous management of all repos we own.
With cdklabs projen types, we can add new configuration as they come up and have it
propogate to all repositories using the type.

## CdklabsConstructLibrary

This type extends projen's `awscdk.AwsConstructLibrary` project type and should be used in place
of that type.

### Usage

From the command line:

```bash
npx projen new --from cdklabs-projen-project-types cdklabs-construct-lib
```

From inside `cdk-ops`:

```ts
this.cdklabs.addPreApprovedRepo({
  repo: 'cdk-new-lib',
  owner: 'conroyka@amazon.com',
  createWith: {
    projectType: ProjectType.CDKLABS_MANAGED_CONSTRUCT_LIB,
  },
});
```

### Features

- `cdklabsPublishingDefaults`

By default, this is turned on. `cdklabsPublishingDefaults` provides publishing defaults based off
of the project's name. Specifically, the defaults look like this:

```ts
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
```

Additionally, we also require that we publish to all jsii language targets (including go) when
we specify a library as `stable`.

- `private`

By default, a project is created as `private`. Turning this off simply means setting `private: false`.
A project being `private` means it gets certain properties set as default that are true for private
projects. Today, that means setting `private: true` in `package.json`, removing `.mergify.yml` from
the project, and removing `.npmignore`.

## CdklabsTypeScriptProject

This type extends projen's `typescript.TypeScriptProject` project type and should be used in place
of that type.

### Usage

```bash
npx projen new --from cdklabs-projen-project-types cdklabs-ts-proj
```

From inside `cdk-ops`:

```ts
this.cdklabs.addPreApprovedRepo({
  repo: 'cdk-new-lib',
  owner: 'conroyka@amazon.com',
  createWith: {
    projectType: ProjectType.CDKLABS_MANAGED_TS_PROJECT,
  },
});
```

### Features

- `private`

By default, a project is created as `private`. Turning this off simply means setting `private: false`.
A project being `private` means it gets certain properties set as default that are true for private
projects. Today, that means setting `private: true` in `package.json`, removing `.mergify.yml` from
the project, and removing `.npmignore`.

## CdklabsMonorepo

A TypeScript monorepo using Yarn Workspaces.
Individual workspaces can be added with `yarn.TypeScriptWorkspace` which extends projen's `typescript.TypeScriptProject`.

### Usage

```bash
npx projen new --from cdklabs-projen-project-types cdklabs-yarn-monorepo
```

### Features

```ts
const project = new yarn.CdkLabsMonorepo({
  defaultReleaseBranch: "main",
  devDeps: ["cdklabs-projen-project-types"],
  name: "monorepo",
});
```

- Workspace commands: `projen build|compile|package|test|upgrade`\
Will run the specific command in all workspaces and the root if applicable.

- Workspace run: `projen run <command>`\
Executes the given command in all workspaces

- Automatic dependency installation\
The monorepo will know if a dependency has been added for a workspace and run `yarn install` as part of `projen`

- `projen` at any level\
The default `projen` command can be run in any workspace and will execute the monorepo synth command.

- Release\
This feature is not supported at this time.
Any release functionality must be implemented.

- `vscodeWorkspace: boolean`\
You can specifify if a VSCode Workspace file should be created for the monorepo.

#### Workspaces

```ts
new yarn.TypeScriptWorkspace({
  parent: project,
  name: 'workspace'
})
```

- `parent: yarn.Monorepo`\
Workspaces (aka subprojects) must be added using the `parent` option.

- `workspaceScope: string`\
The location the workspace is placed at. Defaults to `./packages`

- `excludeDepsFromUpgrade: Array<string>`\
List any dependencies that should not be updated in the workspace.
