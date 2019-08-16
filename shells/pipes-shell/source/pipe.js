/**
 * @license
 * Copyright 2019 Google LLC.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * Code distributed by Google as part of this project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

import {Utils} from '../../lib/utils.js';
import {requireContext} from './context.js';
import {requireIngestionArc} from './ingestion-arc.js';
import {dispatcher} from './dispatcher.js';
import {Bus} from './bus.js';
import {pec} from './verbs/pec.js';
import {spawn, instantiateRecipeByName} from './verbs/spawn.js';
import {RamSlotComposer} from '../../lib/components/ram-slot-composer.js';
import {logsFactory} from '../../../build/runtime/log-factory.js';

const {log, warn} = logsFactory('pipe');

export const initPipe = async (client, paths, storage) => {
  // configure arcs environment
  Utils.init(paths.root, paths.map);
  // marshal context
  const context = await requireContext();
  // marshal dispatcher
  populateDispatcher(dispatcher, composerFactory, storage, context);
  // create bus
  const bus = new Bus(dispatcher, client);
  // return bus
  return bus;
};

export const initArcs = async (storage, bus) => {
  const context = await requireContext();
  // marshal ingestion arc
  await requireIngestionArc(storage, bus);
  // send pipe identifiers to client
  identifyPipe(context, bus);
};

const identifyPipe = async (context, bus) => {
  const recipes = context.allRecipes.map(r => r.name);
  bus.send({message: 'ready', recipes});
};

const populateDispatcher = (dispatcher, composerFactory, storage, context) => {
  Object.assign(dispatcher, {
    pec: async (msg, tid, bus) => {
      return await pec(msg, tid, bus);
    },
    spawn: async (msg, tid, bus) => {
      const arc = await spawn(msg, tid, bus, composerFactory, storage, context);
      arc.tid = tid;
      return arc;
    },
    recipe: async (msg, tid, bus) => {
      const arc = await bus.getAsyncValue(msg.tid);
      if (arc) {
        return await instantiateRecipeByName(arc, msg.recipe);
      }
    },
    // event: async (msg, tid, bus) => {
    //   const arc = await bus.getAsyncValue(msg.tid);
    //   if (arc && arc.pec && arc.pec.slotComposer) {
    //     arc.pec.slotComposer.slotObserver.fire(arc, msg.pid, msg.eventlet);
    //   }
    // }
    event: async (msg, tid, bus) => {
      const arc = await bus.getAsyncValue(msg.tid);
      if (arc) {
        const particle = arc.activeRecipe.particles.find(
          particle => String(particle.id) === msg.pid
        );
        if (particle) {
          log('firing PEC event for', particle.name);
          // TODO(sjmiles): we need `arc` and `particle` here even though
          // the two are bound together, figure out how to simplify
          arc.pec.sendEvent(particle, /*slotName*/'', msg.eventlet);
        }
      }
    }
  });
  return dispatcher;
};

const composerFactory = (modality, bus, tid) => {
  switch (modality) {
    case 'ram': {
      return new RamSlotComposer();
    }
    default: {
      const composer = new RamSlotComposer({
        top: 'top',
        root: 'root',
        modal: 'modal'
      });
      // TODO(sjmiles): hack in transaction identity, make this cleaner
      composer.tid = tid;
      // TODO(sjmiles): slotObserver could be late attached
      // or we could attach a thunk that dispatches to an actual
      // broker configured elsewhere.
      composer.slotObserver = brokerFactory(bus);
      return composer;
    }
  }
};

// `slot-composer` delegates ui work to a `ui-broker`
const brokerFactory = bus => {
  return {
    observe: async (output, arc) => {
      console.log('UiBroker received', output);
      const content = output;
      content.particle = {
        name: output.particle.name,
        id: String(output.particle.id)
      };
      const tid = await bus.recoverTransactionId(arc);
      bus.send({message: 'slot', tid, content: output});
    },
    dispose: () => null
  };
};
