/**
 * @license
 * Copyright (c) 2017 Google Inc. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * Code distributed by Google as part of this project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

import {DomParticle} from './dom-particle.js';
import {Entity} from './entity.js';
import {Content} from './slot-consumer.js';

// Regex to separate style and template.
const re = /<style>((?:.|[\r\n])*)<\/style>((?:.|[\r\n])*)/;

/**
 * Particle that does transformation stuff with DOM.
 */
export class TransformationDomParticle extends DomParticle {

  getTemplate(slotName: string) {
    // TODO: add support for multiple slots.
    return this._state.template;
  }

  getTemplateName(slotName: string) {
    // TODO: add support for multiple slots.
    return this._state.templateName;
  }

  render(props, state) {
    return state.renderModel;
  }

  shouldRender(props, state): boolean {
    return Boolean((state.template || state.templateName) && state.renderModel);
  }

  renderHostedSlot(slotName: string, hostedSlotId: string, content: Content): void {
    this.combineHostedTemplate(slotName, hostedSlotId, content);
    this.combineHostedModel(slotName, hostedSlotId, content);
  }

  // abstract
  combineHostedTemplate(slotName: string, hostedSlotId: string, content: Content): void {
  }

  combineHostedModel(slotName: string, hostedSlotId: string, content: Content): void {
  }

  // Helper methods that may be reused in transformation particles to combine hosted content.
  static propsToItems(propsValues) {
    return propsValues ? propsValues.map(e => ({subId: Entity.id(e), ...e})) : [];
  }
}
