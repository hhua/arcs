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
import {fetch} from '../platform/fetch-web.js';
import {fs} from '../platform/fs-web.js';
import {vm} from '../platform/vm-web.js';

import {JsonldToManifest} from './converters/jsonldToManifest.js';
import {DomParticle} from './dom-particle.js';
import {MultiplexerDomParticle} from './multiplexer-dom-particle.js';
import {ParticleExecutionContext} from './particle-execution-context.js';
import {ParticleSpec} from './particle-spec.js';
import {Particle} from './particle.js';
import {ClientReference} from './reference.js';
import {TransformationDomParticle} from './transformation-dom-particle.js';

const html = (strings, ...values) => (strings[0] + values.map((v, i) => v + strings[i + 1]).join('')).trim();

function schemaLocationFor(name): string {
  return `../entities/${name}.schema`;
}

export class Loader {
  public pec?: ParticleExecutionContext;

  path(fileName: string): string {
    return fileName.replace(/[/][^/]+$/, '/');
  }

  join(prefix: string, path: string): string {
    if (/^https?:\/\//.test(path)) {
      return path;
    }
    // TODO: replace this with something that isn't hacky
    if (path[0] === '/' || path[1] === ':') {
      return path;
    }
    prefix = this.path(prefix);
    path = this.normalizeDots(`${prefix}${path}`);
    return path;
  }

  // convert `././foo/bar/../baz` to `./foo/baz`
  protected normalizeDots(path: string): string {
    // only unix slashes
    path = path.replace(/\\/g, '/');
    // remove './'
    path = path.replace(/\/\.\//g, '/');
    // remove 'foo/..'
    const norm = s => s.replace(/(?:^|\/)[^./]*\/\.\./g, '');
    for (let n = norm(path); n !== path; path = n, n = norm(path));
    // remove '//' except after `:`
    path = path.replace(/([^:])(\/\/)/g, '$1/');
    return path;
  }

  async loadResource(file: string): Promise<string> {
    if (/^https?:\/\//.test(file)) {
      return this._loadURL(file);
    }
    return this.loadFile(file, 'utf-8') as Promise<string>;
  }

  async loadWasmBinary(spec): Promise<ArrayBuffer> {
    // TODO: use spec.implBlobUrl if present?
    this.mapParticleUrl(spec.implFile);
    const target = this.resolve(spec.implFile);
    if (/^https?:\/\//.test(target)) {
      return fetch(target).then(res => res.arrayBuffer());
    } else {
      return this.loadFile(target) as Promise<ArrayBuffer>;
    }
  }

  mapParticleUrl(path: string) {}

  resolve(path: string) {
    return path;
  }

  private async loadFile(file: string, encoding?: string): Promise<string | ArrayBuffer> {
    return new Promise((resolve, reject) => {
      fs.readFile(file, {encoding}, (err, data: string | Buffer) => {
        if (err) {
          reject(err);
        } else {
          resolve(encoding ? (data as string) : (data as Buffer).buffer);
        }
      });
    });
  }

  async _loadURL(url: string): Promise<string> {
    const fetcher = (url: string) => fetch(url).then(async res => res.ok ? res.text() : undefined);
    if (/\/\/schema.org\//.test(url)) {
      if (url.endsWith('/Thing')) {
        return fetcher('https://schema.org/Product.jsonld').then(data => JsonldToManifest.convert(data, {'@id': 'schema:Thing'}));
      }
      return fetcher(url + '.jsonld').then(data => JsonldToManifest.convert(data));
    }
    return fetcher(url);
  }

  /**
   * Returns a particle class implementation by loading and executing
   * the code defined by a particle.  In the following example `x.js`
   * will be loaded and executed:
   *
   * ```
   * Particle foo in 'x.js'
   * ```
   */
  async loadParticleClass(spec: ParticleSpec): Promise<typeof Particle> {
    const clazz = await this.requireParticle(spec.implFile);
    clazz.spec = spec;
    return clazz;
  }

  /**
   * Loads a particle class from the given filename by loading the
   * script contained in `fileName` and executing it as a script.
   *
   * Protected for use in tests.
   */
  protected async requireParticle(fileName: string): Promise<typeof Particle> {
    if (fileName === null) fileName = '';
    const src = await this.loadResource(fileName);
    // Note. This is not real isolation.
    const script = new vm.Script(src, {filename: fileName, displayErrors: true});
    const result = [];

    // TODO(lindner): restrict Math.random here.
    const self = {
      defineParticle(particleWrapper) {
        result.push(particleWrapper);
      },
      console,
      fetch,
      setTimeout,
      importScripts: s => null //console.log(`(skipping browser-space import for [${s}])`)
    };
    script.runInNewContext(self, {filename: fileName, displayErrors: true});
    assert(result.length > 0 && typeof result[0] === 'function', `Error while instantiating particle implementation from ${fileName}`);
    return this.unwrapParticle(result[0]);
  }

  setParticleExecutionContext(pec: ParticleExecutionContext): void {
    this.pec = pec;
  }

  /**
   * executes the defineParticle() code and returns the results which should be a class definition.
   */
  unwrapParticle(particleWrapper): typeof Particle {
    assert(this.pec);
    return particleWrapper({Particle, DomParticle, TransformationDomParticle, MultiplexerDomParticle, Reference: ClientReference.newClientReference(this.pec), html});
  }

  clone(): Loader {
    return new Loader();
  }
}
