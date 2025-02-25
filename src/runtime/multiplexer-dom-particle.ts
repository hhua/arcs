/**
 * @license
 * Copyright (c) 2017 Google Inc. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * Code distributed by Google as part of this project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

import {assert} from '../platform/assert-web.js';
import {ParticleSpec} from './particle-spec.js';
import {TransformationDomParticle} from './transformation-dom-particle.js';
import {Handle} from './handle.js';
import {InnerArcHandle} from './particle-execution-context.js';
import {Type} from './type.js';
import {Content} from './slot-consumer.js';
import {Dictionary} from './hot.js';
import {Entity} from './entity.js';

export class MultiplexerDomParticle extends TransformationDomParticle {

  private _itemSubIdByHostedSlotId: Map<string, string> = new Map();
  private _connByHostedConn: Map<string, string> = new Map();
  handleIds: Dictionary<Promise<Handle>>;

  async _mapParticleConnections(
      listHandleName: string,
      particleHandleName: string,
      hostedParticle: ParticleSpec,
      handles: ReadonlyMap<string, Handle>,
      arc: InnerArcHandle) {
    const otherMappedHandles: string[] = [];
    const otherConnections: string[] = [];
    let index = 2;
    const skipConnectionNames = [listHandleName, particleHandleName];

    for (const [connectionName, otherHandle] of handles) {
      if (skipConnectionNames.includes(connectionName)) {
        continue;
      }
      // TODO(wkorman): For items with embedded recipes we may need a map
      // (perhaps id to index) to make sure we don't map a handle into the inner
      // arc multiple times unnecessarily.

      // TODO(lindner): type erasure to avoid mismatch of Store vs Handle in arc.mapHandle
      // tslint:disable-next-line: no-any
      const otherHandleStore = otherHandle.storage as any;
      otherMappedHandles.push(`use '${await arc.mapHandle(otherHandleStore)}' as v${index}`);
      const hostedOtherConnection = hostedParticle.handleConnections.find(conn => conn.isCompatibleType(otherHandle.type));
      if (hostedOtherConnection) {
        otherConnections.push(`${hostedOtherConnection.name} = v${index++}`);
        // TODO(wkorman): For items with embedded recipes where we may have a
        // different particle rendering each item, we need to track
        // |connByHostedConn| keyed on the particle type.
        this._connByHostedConn.set(hostedOtherConnection.name, connectionName);
      }
    }
    return [otherMappedHandles, otherConnections];
  }

  async setHandles(handles: ReadonlyMap<string, Handle>): Promise<void> {
    this.handleIds = {};
    const arc = await this.constructInnerArc();
    const listHandleName = 'list';
    const particleHandleName = 'hostedParticle';
    const particleHandle = handles.get(particleHandleName);
    let hostedParticle: ParticleSpec | null = null;
    let otherMappedHandles: string[] = [];
    let otherConnections: string[] = [];
    if (particleHandle) {
      // Typecast to any; the get() method doesn't exist on raw Handles.
      // tslint:disable-next-line: no-any
      hostedParticle = await (particleHandle as any).get();
      if (hostedParticle) {
        [otherMappedHandles, otherConnections] =
            await this._mapParticleConnections(listHandleName, particleHandleName, hostedParticle, handles, arc);
      }
    }
    this.setState({
      arc,
      type: handles.get(listHandleName).type,
      hostedParticle,
      otherMappedHandles,
      otherConnections
    });
    await super.setHandles(handles);
  }

  async update({list}, {arc, type, hostedParticle, otherMappedHandles, otherConnections}: {
    arc: InnerArcHandle,
    type: Type,
    hostedParticle: ParticleSpec,
    otherMappedHandles: string[],
    otherConnections: string[],
  }, oldProps, oldState) {
    //console.warn(`[${this.spec.name}]::update`, list, arc);
    if (!list || !arc) {
      return;
    }
    if (oldProps.list === list && oldState.arc === arc) {
      return;
    }
    if (list.length > 0) {
      this.relevance = 0.1;
    }
    for (const [index, item] of this.getListEntries(list)) {
      let resolvedHostedParticle = hostedParticle;
      const id = Entity.id(item);
      if (this.handleIds[id]) {
        const itemHandle = await this.handleIds[id];
        // tslint:disable-next-line: no-any
        (itemHandle as any).set(item);
        continue;
      }
      const itemHandlePromise = arc.createHandle(type.getContainedType(), `item${index}`);
      this.handleIds[id] = itemHandlePromise;
      const itemHandle = await itemHandlePromise;
      if (!resolvedHostedParticle) {
        // If we're muxing on behalf of an item with an embedded recipe, the
        // hosted particle should be retrievable from the item itself. Else we
        // just skip this item.
        if (!item.renderParticleSpec) {
          continue;
        }
        resolvedHostedParticle =
            ParticleSpec.fromLiteral(JSON.parse(item.renderParticleSpec));
        // Re-map compatible handles and compute the connections specific
        // to this item's render particle.
        const listHandleName = 'list';
        const particleHandleName = 'renderParticle';
        [otherMappedHandles, otherConnections] =
            await this._mapParticleConnections(listHandleName, particleHandleName, resolvedHostedParticle, this.handles, arc);
      }
      // TODO(jopra): Using the [0] item may not be desired.
      const hostedSlotName: string = resolvedHostedParticle.slandleConnectionNames()[0];
      const slotNames: string[] = this.spec.slandleConnectionNames();
      assert(slotNames.length > 0, 'there must be at least one slot');
      // TODO(jopra): Using the [0] item may not be desired.
      const slotName = slotNames[0];
      const slotId = await arc.createSlot(this, slotName, itemHandle._id);
      if (!slotId) {
        continue;
      }
      this._itemSubIdByHostedSlotId.set(slotId, id);
      try {
        const recipe = this.constructInnerRecipe(resolvedHostedParticle, item, itemHandle, {name: hostedSlotName, id: slotId}, {connections: otherConnections, handles: otherMappedHandles});
        await arc.loadRecipe(recipe);
        // tslint:disable-next-line: no-any
        (itemHandle as any).set(item);
      }
      catch (e) {
        console.log(e);
      }
    }
  }

  combineHostedModel(slotName: string, hostedSlotId: string, content: Content): void {
    const subId = this._itemSubIdByHostedSlotId.get(hostedSlotId);
    if (!subId) {
      return;
    }
    const items = this._state.renderModel ? this._state.renderModel.items : [];
    const listIndex = items.findIndex(item => item.subId === subId);
    const item = {...content.model, subId};
    if (listIndex >= 0 && listIndex < items.length) {
      items[listIndex] = item;
    }
    else {
      items.push(item);
    }
    this.setState({renderModel: {items}});
  }

  combineHostedTemplate(slotName: string, hostedSlotId: string, content: Content): void {
    const subId = this._itemSubIdByHostedSlotId.get(hostedSlotId);
    if (!subId) {
      return;
    }
    assert(content.templateName, `Template name is missing for slot '${slotName}' (hosted slot ID: '${hostedSlotId}')`);
    const templateName = {...this._state.templateName, [subId]: `${content.templateName}`};
    this.setState({templateName});
    if (content.template) {
      let template = content.template as string;
      // Append subid$={{subid}} attribute to all provided slots, to make it usable for the transformation particle.
      template = template.replace(new RegExp('slotid="[a-z]+"', 'gi'), '$& subid$="{{subId}}"');
      // Replace hosted particle connection in template with the corresponding particle connection names.
      // TODO: make this generic!
      this._connByHostedConn.forEach((conn, hostedConn) => {
          template = template.replace(new RegExp(`{{${hostedConn}.description}}`, 'g'), `{{${conn}.description}}`);
      });
      this.setState({template: {...this._state.template, [content.templateName as string]: template}});
      this.forceRenderTemplate();
    }
  }

  // Abstract methods below.
  // Called to produce a full interpolated recipe for loading into an inner
  // arc for each item. Subclasses should override this method as by default
  // it does nothing and so no recipe will be returned and content will not
  // be loaded successfully into the inner arc.
  constructInnerRecipe?(hostedParticle, item, itemHandle, slot, other): string;

  // Called with the list of items and by default returns the direct result of
  // `Array.entries()`. Subclasses can override this method to alter the item
  // order or otherwise permute the items as desired before their slots are
  // created and contents are rendered.
  // tslint:disable-next-line: no-any
  getListEntries(list: any[]) {
    return list.entries();
  }
}
