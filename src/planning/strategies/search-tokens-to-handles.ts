/**
 * @license
 * Copyright (c) 2018 Google Inc. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * Code distributed by Google as part of this project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

import {Arc} from '../../runtime/arc.js';
import {RecipeUtil} from '../../runtime/recipe/recipe-util.js';
import {Recipe} from '../../runtime/recipe/recipe.js';
import {StrategizerWalker, Strategy} from '../strategizer.js';
import {StorageProviderBase} from '../../runtime/storage/storage-provider-base.js';
import {StorageStub} from '../../runtime/storage-stub.js';

export class SearchTokensToHandles extends Strategy {

  async generate(inputParams) {
    const arc = this.arc;
    // Finds stores matching the provided token and compatible with the provided handle's type,
    // which are not already mapped into the provided handle's recipe
    const findMatchingStores = (token, handle) => {
      const counts = RecipeUtil.directionCounts(handle);
      let stores: (StorageProviderBase | StorageStub)[];
      stores = arc.findStoresByType(handle.type, {tags: [`${token}`]});
      let fate = 'use';
      if (stores.length === 0) {
        stores = arc.context.findStoresByType(handle.type, {tags: [`${token}`], subtype: counts.out === 0});
        fate = counts.out === 0 ? 'map' : 'copy';
      }
      stores = stores.filter(store => !handle.recipe.handles.find(handle => handle.id === store.id));
      return stores.map(store => ({store, fate, token}));
    };

    return StrategizerWalker.over(this.getResults(inputParams), new class extends StrategizerWalker {
      onHandle(recipe, handle) {
        if (!recipe.search || recipe.search.unresolvedTokens.length === 0) {
          return undefined;
        }
        if (handle.isResolved() || handle.connections.length === 0) {
          return undefined;
        }

        const possibleMatches = [];
        for (const token of recipe.search.unresolvedTokens) {
          possibleMatches.push(...findMatchingStores(token, handle));
        }
        if (possibleMatches.length === 0) {
          return undefined;
        }
        return possibleMatches.map(match => {
          return (recipe, handle) => {
            handle.fate = match.fate;
            handle.mapToStorage(match.store);
            recipe.search.resolveToken(match.token);
            return 0;
          };
        });
      }
    }(StrategizerWalker.Permuted), this);
  }
}
