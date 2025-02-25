/**
 * @license
 * Copyright 2019 Google LLC.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * Code distributed by Google as part of this project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
import {ClaimType} from './particle-claim';
import {CheckType} from './particle-check';

/**
 * Complete set of tokens used by `manifest-parser.peg`. To use this you
 * need to follow some simple guidelines:
 *
 * - Most interfaces should extend `BaseNode`
 * - When returning data add `as Token.NewTypeName` to validate your return types.
 *
 * You may need to check the generated output in runtime/ts/manifest-parser.ts to validate.
 */

// duplicate of definition from pegjs code to avoid circular dependencies
export interface SourcePosition {
  offset: number;
  line: number;
  column: number;
}

// duplicate of definition from pegjs code to avoid circular dependencies
export interface SourceLocation {
  filename?: string;
  start: SourcePosition;
  end: SourcePosition;
}

/**
 * A base token interface for the `kind` and `location` entries. This creates
 * a TypeScript Discriminated Union for most tokens.
 */
export class BaseNode {
  kind: string;
  location: SourceLocation;
}

//  PARTICLE TYPES
export interface BigCollectionType extends BaseNode {
  kind: 'big-collection-type';
  type: ParticleHandleConnectionType;
}

export interface CollectionType extends BaseNode {
  kind: 'collection-type';
  type: ParticleHandleConnectionType;
}
export function isCollectionType(node: BaseNode): node is CollectionType {
  return node.kind === 'collection-type';
}

export interface ReferenceType extends BaseNode {
  kind: 'reference-type';
  type: ParticleHandleConnectionType;
}

export interface TypeVariable extends BaseNode {
  kind: 'variable-type';
  name: string;
  constraint: ParticleHandleConnection;
}
export function isTypeVariable(node: BaseNode): node is TypeVariable {
  return node.kind === 'variable-type';
}

export interface SlotType extends BaseNode {
  kind: 'slot-type';
  fields: SlotField[];
  model: {formFactor: string, handle: string};
}
export function isSlotType(node: BaseNode): node is SlotType {
  return node.kind === 'slot-type';
}
export function slandleType(arg: ParticleHandleConnection): SlotType | undefined {
  if (isSlotType(arg.type)) {
    return arg.type;
  }
  if (isCollectionType(arg.type) && isSlotType(arg.type.type)) {
    return arg.type.type;
  }
  return undefined;
}
// END PARTICLE TYPES

export interface Description extends BaseNode {
  kind: 'description';
  name: 'pattern';
  description: Description[];
}

export interface HandleRef extends BaseNode {
  kind: 'handle-ref';
  id?: string;
  name?: string;
  tags: TagList;
}

export interface Import extends BaseNode {
  kind: 'import';
  path: string;
}

export interface ManifestStorage extends BaseNode {
  kind: 'store';
  name: string;
  type: ManifestStorageType;
  id: string|null;
  originalId: string|null;
  version: number;
  tags: TagList;
  source: string;
  origin: string;
  description: string|null;
  claim: ManifestStorageClaim;
}

export type ManifestStorageType = SchemaInline | CollectionType | BigCollectionType | TypeName;

export interface ManifestStorageClaim extends BaseNode {
  kind: 'manifest-storage-claim';
  tags: string[];
}

export interface ManifestStorageSource {
  origin: string;
  source: string;
}

export interface ManifestStorageFileSource extends ManifestStorageSource {
  origin: 'file';
}

export interface ManifestStorageResourceSource extends ManifestStorageSource {
  origin: 'resource';
}

export interface ManifestStorageStorageSource extends ManifestStorageSource {
  origin: 'storage';
}

export interface Meta extends BaseNode {
  kind: 'meta';
  items: (MetaName|MetaStorageKey)[];
}

export interface MetaName extends BaseNode {
  kind: 'name';
  key: string;
  value: string;
}

export interface MetaStorageKey extends BaseNode {
  key: 'storageKey';
  value: string;
  kind: 'storageKey';
}

export type MetaItem = MetaStorageKey | MetaName;

export interface Particle extends BaseNode {
  kind: 'particle';
  name: string;
  implFile?: string;          // not used in RecipeParticle
  verbs?: VerbList;           // not used in RecipeParticle
  args?: ParticleHandleConnection[];  // not used in RecipeParticle
  modality?: string[];      // not used in RecipeParticle
  slots?: ParticleSlotConnection[];    // not used in RecipeParticle
  description?: Description;  // not used in RecipeParticle
  hasParticleArgument?: boolean;  // not used in RecipeParticle
  trustChecks?: ParticleCheckStatement[];
  trustClaims?: ParticleClaimStatement[];

  // fields in RecipeParticle only
  ref?: ParticleRef | '*';
  connections?: RecipeParticleConnection[];
  slotConnections?: RecipeParticleSlotConnection[];
}

/** A trust claim made by a particle about one of its handles. */
export interface ParticleClaimStatement extends BaseNode {
  kind: 'particle-trust-claim';
  handle: string;
  expression: ParticleClaimExpression;
}

export type ParticleClaimExpression = ParticleClaim[]; 

export type ParticleClaim = ParticleClaimIsTag | ParticleClaimDerivesFrom;

/** A claim made by a particle, saying that one of its outputs has a particular trust tag (e.g. "claim output is foo"). */
export interface ParticleClaimIsTag extends BaseNode {
  kind: 'particle-trust-claim-is-tag';
  claimType: ClaimType.IsTag;
  isNot: boolean;
  tag: string;
}

/**
 * A claim made by a particle, saying that one of its outputs derives from one/some of its inputs (e.g. "claim output derives from input1 and
 * input2").
 */
export interface ParticleClaimDerivesFrom extends BaseNode {
  kind: 'particle-trust-claim-derives-from';
  claimType: ClaimType.DerivesFrom;
  parentHandle: string;
}

export interface ParticleCheckStatement extends BaseNode {
  kind: 'particle-trust-check';
  target: ParticleCheckTarget;
  expression: ParticleCheckExpression;
}

export interface ParticleCheckTarget extends BaseNode {
  kind: 'particle-check-target';
  targetType: 'handle' | 'slot';
  name: string;
}

export interface ParticleCheckBooleanExpression extends BaseNode {
  kind: 'particle-trust-check-boolean-expression';
  operator: 'and' | 'or';
  children: ParticleCheckExpression[];
}

export type ParticleCheckExpression = ParticleCheckBooleanExpression | ParticleCheckCondition;

export type ParticleCheckCondition = ParticleCheckHasTag | ParticleCheckIsFromHandle | ParticleCheckIsFromOutput | ParticleCheckIsFromStore;

export interface ParticleCheckHasTag extends BaseNode {
  kind: 'particle-trust-check-has-tag';
  checkType: CheckType.HasTag;
  isNot: boolean;
  tag: string;
}

export interface ParticleCheckIsFromHandle extends BaseNode {
  kind: 'particle-trust-check-is-from-handle';
  checkType: CheckType.IsFromHandle;
  isNot: boolean;
  parentHandle: string;
}

export interface ParticleCheckIsFromOutput extends BaseNode {
  kind: 'particle-trust-check-is-from-output';
  checkType: CheckType.IsFromOutput;
  isNot: boolean;
  output: string;
}

export interface ParticleCheckIsFromStore extends BaseNode {
  kind: 'particle-trust-check-is-from-store';
  checkType: CheckType.IsFromStore;
  isNot: boolean;
  storeRef: StoreReference;
}

export interface StoreReference extends BaseNode {
  kind: 'store-reference';
  type: 'name' | 'id';
  store: string;
}

export interface ParticleModality extends BaseNode {
  kind: 'particle-modality';
  modality: string;
}

export interface ParticleHandleConnection extends BaseNode {
  kind: 'particle-argument';
  direction: Direction;
  type: ParticleHandleConnectionType;
  isOptional: boolean;
  dependentConnections: ParticleHandleConnection[];
  name: string;
  tags: TagList;
}

export type ParticleItem = ParticleModality | ParticleSlotConnection | Description | ParticleHandleConnection;

export interface ParticleHandleDescription extends BaseNode {
  kind: 'handle-description';
  name: string;
  pattern: string;
}

export interface ParticleInterface extends BaseNode {
  kind: 'interface';
  verb: string;
  args: ParticleHandleConnection[];
}

export interface ParticleSlotConnection extends BaseNode {
  kind: 'particle-slot';
  name: string;
  tags: TagList;
  isRequired: boolean;
  isSet: boolean;
  formFactor: SlotFormFactor;
  provideSlotConnections: ParticleProvidedSlot[];
}

export interface ParticleProvidedSlot extends BaseNode {
  kind: 'provided-slot';
  name: string;
  tags: TagList;
  isRequired: boolean;
  isSet: boolean;
  formFactor: SlotFormFactor;
  handles: ParticleProvidedSlotHandle[];
}

export interface ParticleProvidedSlotHandle extends BaseNode {
  kind: 'particle-provided-slot-handle';
  handle: string;
}

export interface ParticleRef extends BaseNode {
  kind: 'particle-ref';
  name: string;
  verbs: VerbList;
  tags: TagList;
}

export interface RecipeNode extends BaseNode {
  kind: 'recipe';
  name: string;
  verbs: VerbList;
  items: RecipeItem[];
  annotation: Annotation;
  triggers: Triggers;
}

export interface RecipeParticle extends BaseNode {
  kind: 'particle';
  name: string;
  ref: ParticleRef;
  connections: RecipeParticleConnection[];
  slotConnections: RecipeParticleSlotConnection[];
}

export interface RequireHandleSection extends BaseNode {
  kind: 'requireHandle';
  name: string;
  ref: HandleRef;
  // TODO: remove fates
  fate: Fate;
}

export interface RecipeRequire extends BaseNode {
  kind: 'require';
  items: RecipeItem[];
}

export type RecipeItem = RecipeParticle | RecipeHandle | RequireHandleSection | RecipeRequire | RecipeSlot | RecipeSearch | RecipeConnection | Description;

export interface RecipeParticleConnection extends BaseNode {
  kind: 'handle-connection';
  param: string;
  dir: DirectionArrow;
  target: ParticleConnectionTargetComponents;
}

export type RecipeParticleItem = RecipeParticleSlotConnection | RecipeParticleConnection;

export interface ParticleConnectionTargetComponents extends BaseNode {
  kind: 'handle-connection-components';
  name: string|null;
  particle: string|null;
  tags: TagList;
}

export type RecipeHandleFate = string;

export interface RecipeHandle extends BaseNode {
  kind: 'handle';
  name: string|null;
  ref: HandleRef;
  fate: Fate;
}

export interface RecipeParticleSlotConnection extends BaseNode {
  kind: 'slot-connection';
  param: string;
  tags: TagList;
  name: string;
  dependentSlotConnections: RecipeParticleSlotConnection[];
  direction: SlotDirection;
}

export interface RecipeSlotConnectionRef extends BaseNode {
  kind: 'slot-connection-ref';
  param: string;
  tags: TagList;
}

export interface RecipeConnection extends BaseNode {
  kind: 'connection';
  direction: DirectionArrow;
  from: ConnectionTarget;
  to: ConnectionTarget;
}

export interface RecipeSearch extends BaseNode {
  kind: 'search';
  phrase: string;
  tokens: string[];
}

export interface RecipeSlot extends BaseNode {
  kind: 'slot';
  ref: HandleRef;
  name: string|null;
}

export interface ConnectionTarget extends BaseNode {
  kind: 'connection-target';
  targetType: 'verb'|'tag'|'localName'|'particle';

  name?: string;      // Only in NameConnectionTarget
  particle?: string;  // Only in ParticleConnectionTarget

  verbs?: VerbList;
  param: string;    // from ConnectionTargetHandleComponents
  tags?: TagList;   // from ConnectionTargetHandleComponents
}

export interface VerbConnectionTarget extends BaseNode {
  targetType: 'verb';
}

export interface TagConnectionTarget extends BaseNode {
  targetType: 'tag';
}

export interface NameConnectionTarget extends BaseNode {
  name: string;
  targetType: 'localName';
}

export interface ParticleConnectionTarget extends BaseNode {
  particle: string;
  targetType: 'particle';
}

export interface ConnectionTargetHandleComponents extends BaseNode {
  param: string;
  tags: TagList;
}

export interface Resource extends BaseNode {
  kind: 'resource';
  name: string;
  data: string;
}

export interface Schema extends BaseNode {
  kind: 'schema';
  items: SchemaItem[];
  alias?: string;
}

export interface SchemaSection extends BaseNode {
  kind: 'schema-section';
  sectionType: string;
  fields: SchemaField[];
}

export interface SchemaField extends BaseNode {
  kind: 'schema-field';
  type: SchemaType;
  name: string;
}

export type SchemaType = SchemaReferenceType|SchemaCollectionType|
    SchemaPrimitiveType|SchemaUnionType|SchemaTupleType;

export interface SchemaPrimitiveType extends BaseNode {
  kind: 'schema-primitive';
  type: 'Text'|'URL'|'Number'|'Boolean'|'Bytes'|'Object';
}

export interface SchemaCollectionType extends BaseNode {
  kind: 'schema-collection';
  schema: SchemaType;
}

export interface SchemaReferenceType extends BaseNode {
  kind: 'schema-reference';
  schema: SchemaType;
}

export interface SchemaUnionType extends BaseNode {
  kind: 'schema-union';
  types: string[];
}

export interface SchemaTupleType extends BaseNode {
  kind: 'schema-tuple';
  types: string[];
}

export interface SchemaInline extends BaseNode {
  kind: 'schema-inline';
  names: string[];
  fields: SchemaInlineField[];
}

export interface SchemaInlineField extends BaseNode {
  kind: 'schema-inline-field';
  name: string;
  type: SchemaType;
}

export interface SchemaSpec extends BaseNode {
  names: string[];
  parents: string[];
}

export type SchemaItem = SchemaField | Description;

export interface SchemaAlias extends BaseNode {
  kind: 'schema';
  items: SchemaItem[];
  alias: string;
}

export interface Interface extends BaseNode {
  kind: 'interface';
  name: string;
  slots: InterfaceSlot[];

  interface?: InterfaceInterface[];
  args?: InterfaceArgument[];
}

export type InterfaceItem = Interface | InterfaceArgument | InterfaceSlot;

export interface InterfaceArgument extends BaseNode {
  kind: 'interface-argument';
  direction: Direction;
  type: string;
  name: string;
}

export interface InterfaceInterface extends BaseNode {
  kind: 'interface';
  verb: string;
  args: InterfaceArgument[];  // InterfaceArgumentList?
}

export interface InterfaceSlot extends BaseNode {
  kind: 'interface-slot';
  name: string|null;
  isRequired: boolean;
  direction: Direction;
  isSet: boolean;
}

export interface SlotField extends BaseNode {
  kind: 'slot-field';
  name: string;
  value: string;
}

export interface SlotFormFactor extends BaseNode {
  kind: 'form-factor';
  formFactor: string;
}

export type ParticleSlotConnectionItem = SlotFormFactor | ParticleProvidedSlot;

export interface TypeName extends BaseNode {
  kind: 'type-name';
  name: string;
}

export interface NameAndTagList {
  name: string;
  tags: TagList;
}

// Aliases to simplify ts-pegjs returnTypes requirement in sigh.
export type Annotation = string;
export type Triggers = [string, string][][];
export type Indent = number;
export type LocalName = string;
export type Manifest = ManifestItem[];
export type ManifestStorageDescription = string;
export type Modality = string;
export type ReservedWord = string;
export type ResourceStart = string;
export type ResourceBody = string;
export type ResourceLine = string;
export type SameIndent = boolean;
export type SameOrMoreIndent = string;
export type SchemaExtends = string[];
export type SpaceTagList = Tag[];
export type Tag = string;
export type TagList = Tag[];
export type TopLevelAlias = string;
export type Verb = string;
export type VerbList = Verb[];
export type Version = number;
export type backquotedString = string;
export type fieldName = string;
export type id = string;
export type upperIdent = string;
export type lowerIdent = string;
export type whiteSpace = string;
export type eolWhiteSpace = string;
export type eol = string;

// String-based enums.
// TODO: convert to actual enums so that they can be iterated over.
export type Direction = 'in' | 'out' | 'inout' | 'host' | '`consume' | '`provide' | 'any';
export type DirectionArrow = '<-' | '->' | '<->' | 'consume' | 'provide' | '=';

export type SlotDirection = 'provide' | 'consume';
export type Fate = 'use' | 'create' | 'map' | 'copy' | '?' | '`slot';

export type ParticleHandleConnectionType = TypeVariable|CollectionType|
    BigCollectionType|ReferenceType|SlotType|SchemaInline|TypeName;

// Note that ManifestStorage* are not here, as they do not have 'kind'
export type All = Import|Meta|MetaName|MetaStorageKey|Particle|ParticleHandleConnection|
    ParticleInterface|RecipeHandle|Resource|Interface|InterfaceArgument|InterfaceInterface|
    InterfaceSlot;

export type ManifestItem =
    RecipeNode|Particle|Import|Schema|ManifestStorage|Interface|Meta|Resource;
