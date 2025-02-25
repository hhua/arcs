/**
 * @license
 * Copyright (c) 2018 Google Inc. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * Code distributed by Google as part of this project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

import {Arc} from '../runtime/arc.js';
import {ArcDevtoolsChannel} from './abstract-devtools-channel.js';
import {Manifest} from '../runtime/manifest.js';
import {StorageStub} from '../runtime/storage-stub.js';
import {StorageProviderBase, SingletonStorageProvider, CollectionStorageProvider} from '../runtime/storage/storage-provider-base.js';
import {Type} from '../runtime/type.js';

type Result = {
  name: string,
  tags: string[],
  id: string,
  storage: string,
  type: Type,
  description: string,
  // tslint:disable-next-line: no-any
  value: any,
};

export class ArcStoresFetcher {
  private arc: Arc;
  private arcDevtoolsChannel: ArcDevtoolsChannel;
  private watchedHandles: Set<string> = new Set();
  
  constructor(arc: Arc, arcDevtoolsChannel: ArcDevtoolsChannel) {
    this.arc = arc;
    this.arcDevtoolsChannel = arcDevtoolsChannel;

    arcDevtoolsChannel.listen('fetch-stores', async () => arcDevtoolsChannel.send({
      messageType: 'fetch-stores-result',
      messageBody: await this.listStores()
    }));
  }

  onRecipeInstantiated() {
    for (const store of this.arc._stores) {
      if (!this.watchedHandles.has(store.id)) {
        this.watchedHandles.add(store.id);
        store.on('change', async () => this.arcDevtoolsChannel.send({
          messageType: 'store-value-changed',
          messageBody: {
            id: store.id.toString(),
            value: await this.dereference(store)
          }
        }), this);
      }
    }
  }

  private async listStores() {
    const find = (manifest: Manifest): [StorageStub, string[]][] => {
      let tags = [...manifest.storeTags];
      if (manifest.imports) {
        manifest.imports.forEach(imp => tags = tags.concat(find(imp)));
      }
      return tags;
    };
    return {
      arcStores: await this.digestStores([...this.arc.storeTags]),
      contextStores: await this.digestStores(find(this.arc.context))
    };
  }

  private async digestStores(stores: [StorageProviderBase | StorageStub, string[] | Set<string>][]) {
    const result: Result[] = [];
    for (const [store, tags] of stores) {
      result.push({
        name: store.name,
        tags: tags ? [...tags] : [],
        id: store.id,
        storage: store.storageKey,
        type: store.type,
        description: store.description,
        value: await this.dereference(store)
      });
    }
    return result;
  }

  // tslint:disable-next-line: no-any
  private async dereference(store: StorageProviderBase | StorageStub): Promise<any> {
    if ((store as CollectionStorageProvider).toList) {
      return (store as CollectionStorageProvider).toList();
    } else if ((store as SingletonStorageProvider).get) {
      return (store as SingletonStorageProvider).get();
    } else {
      return `(don't know how to dereference)`;
    }
  }
}
