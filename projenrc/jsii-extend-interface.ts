import { join } from 'path';
import { CollectionKind, Docs, InterfaceType, isCollectionTypeReference, isNamedTypeReference, isPrimitiveTypeReference, isUnionTypeReference, loadAssemblyFromPath, Property, TypeKind, TypeReference } from '@jsii/spec';
import { Assembly, TypeSystem } from 'jsii-reflect';
import { Component, Project, SourceCode, SourceCodeOptions, typescript } from 'projen';

const typesystem = new TypeSystem();
const asm = new Assembly(typesystem, loadAssemblyFromPath('node_modules/projen', false, ['class-covariant-overrides']));
typesystem.addAssembly(asm, { isRoot: true });

export interface OptionsGeneratorOptions {
  /**
   * The interface name
   */
  readonly name: string;
  /**
   * The fqn of the interface
   * Is used to auto-add imports.
   * Any local referenced types need to adhere to this hierarchy.
   *
   * @default `${project.name}.${options.name}`
   */
  readonly fqn?: string;
  /**
   * Doc string for the interface
   * @default - Interface name
   */
  readonly description?: string;
  /**
   * @default - `${project.srcDir}/${options.name}.ts`
   */
  readonly filePath?: string;
  /**
   * The properties of this interface
   * When extending, these will overwrite existing properties.
   *
   * @default []
   */
  readonly properties?: Property[];
  /**
   * Extends this jsii type
   */
  readonly extends?: string;
  /**
   * Omit these properties from the parent interface
   */
  readonly omitProps?: string[];
  /**
   * Update these properties from the parent interface
   */
  readonly updateProps?: {
    [name: string]: Partial<Property>;
  };
}

export class JsiiInterface extends Component {
  public constructor(
    project: typescript.TypeScriptProject,
    options: OptionsGeneratorOptions,
  ) {
    super(project);
    const targetSpec: InterfaceType = {
      kind: TypeKind.Interface,
      assembly: project.name,
      fqn: options.fqn ?? `${project.name}.${options.name}`,
      name: options.name,
      docs: {
        summary: options.description ?? options.name,
      },
      properties: options.properties || [],
    };

    if (options.extends) {
      const sourceSpec = typesystem.findInterface(options.extends);
      const omit = [
        ...options.omitProps || [],
        ...options.properties?.map(p => p.name) || [],
      ];
      targetSpec.properties!.push(
        ...sourceSpec.allProperties
          .map(p => {
            if (options.updateProps?.[p.name]) {
              return {
                ...p.spec,
                ...options.updateProps?.[p.name],
              };
            }
            return p.spec;
          })
          .filter(p => !omit.includes(p.name)),
      );
    }

    targetSpec.properties = targetSpec.properties?.sort((a, b) => a.name.localeCompare(b.name));

    const outputFile = options.filePath ?? join(project.srcdir, `${options.name}.ts`);
    new InterfaceFile(project, outputFile, targetSpec);
  }
}

export class InterfaceFile extends SourceCode {
  public constructor(project: Project, filePath: string, private readonly spec: InterfaceType, options: SourceCodeOptions = {}) {
    super(project, filePath, options);

    this.line(`// ${this.marker}`);
    this.renderImports(extractImports(spec));
    this.line();
    this.renderDocBlock(docsToLines(spec.docs));
    this.open(`export interface ${spec.name} {`);
    spec.properties?.forEach(p => this.renderProperty(p));
    this.close('}');
    this.line();
  }

  protected renderImports(modules: Map<string, Set<string>>) {
    Array.from(modules.keys()).sort((a, b) => {
      if (a[0] < b[0]) {
        return 1;
      }
      return a.localeCompare(b);
    }).forEach(mod => {
      const imports = Array.from(modules.get(mod)?.values() || []);
      this.line(`import { ${imports.join(', ')} } from '${mod}';`);
    });
  }

  protected renderProperty(p: Property) {
    if (p.docs) {
      this.renderDocBlock(docsToLines(p.docs));
    }
    this.line(`readonly ${p.name}${p.optional ? '?' : ''}: ${typeRefToType(p.type, this.spec.fqn)};`);
  }

  protected renderDocBlock(lines: string[]) {
    this.line('/**');
    lines.forEach(line => this.line(` * ${line}`));
    this.line(' */');
  }
}

function docsToLines(docs?: Docs): string[] {
  if (!docs) {
    return [];
  }

  const lines = new Array<string>();

  if (docs.summary) {
    lines.push(docs.summary);
  }
  if (docs.remarks) {
    lines.push(...docs.remarks.split('\n'));
  }
  if (docs.default) {
    lines.push(`@default ${docs.default}`);
  }
  if (docs.deprecated) {
    lines.push(`@deprecated ${docs.deprecated}`);
  }

  return lines;
}


function typeRefToType(t: TypeReference, containingFqn: string): string {
  if (isPrimitiveTypeReference(t)) {
    return t.primitive;
  }

  if (isNamedTypeReference(t)) {
    return t.fqn.split('.').slice(1).join('.');
  }

  if (isCollectionTypeReference(t)) {
    switch (t.collection.kind) {
      case CollectionKind.Array:
        return `Array<${typeRefToType(t.collection.elementtype, containingFqn)}>`;
      case CollectionKind.Map:
        return `Record<string, ${typeRefToType(t.collection.elementtype, containingFqn)}>`;
      default:
        return 'any';
    }
  }
  if (isUnionTypeReference(t)) {
    return t.union.types.map(ut => typeRefToType(ut, containingFqn)).join(' | ');
  }

  return 'any';
}

function extractImports(spec: InterfaceType): Map<string, Set<string>> {
  const refs = spec.properties?.flatMap(p => collectFQNs(p.type)) || [];
  return refs.reduce((mods, ref) => {
    const packageName = fqnToImportName(ref, spec.assembly);
    const imports = mods.get(packageName) || new Set();
    const importName = ref.split('.').slice(1)[0] || ref;
    return mods.set(packageName, imports.add(importName));
  }, new Map<string, Set<string>>());
}

function fqnToImportName(fqn: string, localAssembly: string): string {
  const importName = fqn.split('.', 1)[0];

  if (importName === localAssembly) {
    return '.'.repeat(fqn.split('.').length - 1) + '/';
  }

  return importName;
}

function collectFQNs(t: TypeReference): string[] {
  if (isNamedTypeReference(t)) {
    return [t.fqn];
  }

  if (isUnionTypeReference(t)) {
    return t.union.types.flatMap(collectFQNs);
  }

  if (isCollectionTypeReference(t)) {
    return collectFQNs(t.collection.elementtype);
  }

  return [];
}
