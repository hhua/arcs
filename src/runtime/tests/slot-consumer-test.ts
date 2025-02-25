/**
 * @license
 * Copyright (c) 2017 Google Inc. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * Code distributed by Google as part of this project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

import {assert} from '../../platform/chai-web.js';
import {SlotConsumer} from '../slot-consumer.js';
import {ProvidedSlotContext} from '../slot-context.js';
import {ProvideSlotConnectionSpec} from '../particle-spec.js';
import {SlotConnection} from '../recipe/slot-connection.js';

describe('slot consumer', () => {
  it('setting container', async () => {
    const spec = new ProvideSlotConnectionSpec({name: 'dummy-slot', isSet: false});
    const slot = new SlotConsumer(null /* arc */, {name: 'dummy-consumeConn'} as SlotConnection);
    slot.slotContext = new ProvidedSlotContext('dummy-context', 'dummy', [], null, spec, null);
    let startRenderCount = 0;
    let stopRenderCount = 0;
    slot.startRenderCallback = () => { ++startRenderCount; };
    slot.stopRenderCallback = () => { ++stopRenderCount; };

    // container was null, set to null: nothing happens.
    slot.onContainerUpdate(null, null);
    assert.strictEqual(startRenderCount, 0);
    assert.strictEqual(stopRenderCount, 0);

    // context was null, set to non-null: startRender is called.
    slot.onContainerUpdate('dummy-container', null);
    assert.strictEqual(startRenderCount, 1);
    assert.strictEqual(stopRenderCount, 0);

    // context was not null, set to another non-null context: nothing happens.
    assert.isFalse(slot.isSameContainer(slot.getRendering().container, 'other-container'));
    slot.onContainerUpdate('other-container', 'dummy-container');
    assert.strictEqual(startRenderCount, 1);
    assert.strictEqual(stopRenderCount, 0);

    // context was not null, set to null: stopRender is called.
    slot.onContainerUpdate(null, 'other-container');
    assert.strictEqual(startRenderCount, 1);
    assert.strictEqual(stopRenderCount, 1);
  });
});
