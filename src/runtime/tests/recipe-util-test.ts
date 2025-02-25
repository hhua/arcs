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
import {Manifest} from '../manifest.js';
import {RecipeUtil} from '../recipe/recipe-util.js';
import {Particle} from '../recipe/particle.js';
import {Handle} from '../recipe/handle.js';

describe('recipe-util', () => {
  it('can produce a shape match to a simple recipe', async () => {
    const manifest = await Manifest.parse(`
      schema S
      particle A
        out S a
      particle B
        out S b

      recipe Recipe
        map as handle1
        A
          a -> handle1
        B
          b -> handle1`);
    const recipe = manifest.recipes[0];
    const shape = RecipeUtil.makeShape(['A', 'B'], ['v'],
      {'A': {'a': {handle: 'v'}}, 'B': {'b': {handle: 'v'}}});
    const results = RecipeUtil.find(recipe, shape);
    assert.lengthOf(results, 1);
    assert.strictEqual(results[0].score, 0);
    assert.strictEqual((results[0].match['A'] as Particle).name, 'A');
    assert.strictEqual((results[0].match['B'] as Particle).name, 'B');
    assert.strictEqual((results[0].match['v'] as Handle).localName, 'handle1');
  });

  it('cannot produce a shape match to a non-matching recipe', async () => {
    const manifest = await Manifest.parse(`
      schema S
      particle B
        out S b

      recipe Recipe
        map as handle1
        B
          b -> handle1`);
    const recipe = manifest.recipes[0];
    const shape = RecipeUtil.makeShape(['A', 'B'], ['v'],
      {'A': {'a': {handle: 'v'}}, 'B': {'b': {handle: 'v'}}});
    const results = RecipeUtil.find(recipe, shape);
    // TODO: It may be better to not return a result than providing partially
    // resolved results.
    assert.strictEqual(results[0].match['A'], null);
  });

  it('can produce multiple partial shape matches to a simple recipe', async () => {
    const manifest = await Manifest.parse(`
      schema S
      particle A
        out S a
      particle B
        out S b
      particle C
        out S c

      recipe Recipe
        map as handle1
        map as handle2
        A
          a -> handle1
        B
          b -> handle1
        A
          a -> handle2
        C
          c -> handle2`);
    const recipe = manifest.recipes[0];
    const shape = RecipeUtil.makeShape(['A', 'B', 'C'], ['v'],
      {'A': {'a': {handle: 'v'}}, 'B': {'b': {handle: 'v'}}, 'C': {'c': {handle: 'v'}}});
    const results = RecipeUtil.find(recipe, shape);
    assert.lengthOf(results, 2);
    assert.strictEqual(results[0].score, -1);
    assert.strictEqual((results[0].match['A'] as Particle).name, 'A');
    assert.strictEqual((results[0].match['B'] as Particle).name, 'B');
    assert.strictEqual((results[0].match['C'] as Particle).name, 'C');
    assert.strictEqual((results[0].match['v'] as Handle).localName, 'handle1');
    assert.strictEqual(results[1].score, -1);
    assert.strictEqual((results[1].match['A'] as Particle).name, 'A');
    assert.strictEqual((results[1].match['B'] as Particle).name, 'B');
    assert.strictEqual((results[1].match['C'] as Particle).name, 'C');
    assert.strictEqual((results[1].match['v'] as Handle).localName, 'handle2');
  });

  it('can match a free handle', async () => {
    const manifest = await Manifest.parse(`
      particle A
      particle B

      recipe Recipe
        map as h1
        A
        B`);
    const recipe = manifest.recipes[0];
    const shape = RecipeUtil.makeShape(['A', 'B'], ['v'],
      {'A': {'a': {handle: 'v'}}, 'B': {'b': {handle: 'v'}}});
    const results = RecipeUtil.find(recipe, shape);
    assert.lengthOf(results, 1);
    assert.strictEqual(results[0].score, -3);
    assert.strictEqual((results[0].match['v'] as Handle).localName, 'h1');
  });

  it('can match dangling handle connections', async () => {
    const manifest = await Manifest.parse(`
      schema S
      particle A
        out S a
      particle B
        out S b

      recipe Recipe
        map as h1
        A
          a -> //
        B
          b -> //
        `);
    const recipe = manifest.recipes[0];
    const shape = RecipeUtil.makeShape(['A', 'B'], ['h'],
      {'A': {'a': {handle: 'h'}}, 'B': {'b': {handle: 'h'}}});
    const results = RecipeUtil.find(recipe, shape);
    assert.lengthOf(results, 1);
    assert.strictEqual(results[0].score, -1);
    assert.strictEqual((results[0].match['h'] as Handle).localName, 'h1');
    assert.strictEqual((results[0].match['A:a'] as Particle).name, 'a');
    assert.strictEqual((results[0].match['B:b'] as Particle).name, 'b');
  });

  it('matches duplicate particles', async () => {
    const manifest = await Manifest.parse(`
      schema S
      schema T
      particle A
        inout S s
        inout T t

      recipe Recipe0
        use 'id-s1' as h0
        use 'id-t0' as h1
        use 'id-t1' as h2
        A
          s = h0
          t = h1
        A
          s = h0
          t = h1

      recipe Recipe1
        use 'id-s2' as h0
        use 'id-t1' as h1
        A
          s = h0
          t = h1
    `);
    assert.isFalse(RecipeUtil.matchesRecipe(manifest.recipes[0], manifest.recipes[1]));
  });
});
