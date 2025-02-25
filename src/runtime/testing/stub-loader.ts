/**
 * @license
 * Copyright (c) 2018 Google Inc. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * Code distributed by Google as part of this project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
import {Loader} from '../loader.js';
import {Dictionary} from '../hot.js';

/**
 * A Loader initialized with a per-path canned responses.
 * Value for '*' key can be specified for a response if the path did not match.
 * If '*' is not specified and path is not matched, Loader logic is invoked.
 */
export class StubLoader extends Loader {
  _fileMap: Dictionary<string>;
  _cannedResponse: string;
 
  constructor(fileMap: Dictionary<string>) {
    super();
    this._fileMap = fileMap;
    if (fileMap.hasOwnProperty('*')) {
      this._cannedResponse = fileMap['*'];
    }
  }

  async loadResource(path: string): Promise<string> {
    return this._fileMap.hasOwnProperty(path)
        ? this._fileMap[path]
        : (this._cannedResponse || super.loadResource(path));
  }

  path(fileName: string): string {
    return (this._fileMap.hasOwnProperty(fileName) || this._cannedResponse)
        ? fileName
        : super.path(fileName);
  }

  join(prefix: string, path: string): string {
    // If referring from stubbed content, don't prepend stubbed filename.
    return (this._fileMap.hasOwnProperty(prefix) || this._cannedResponse)
        ? path
        : super.join(prefix, path);
  }

  clone(): StubLoader {
    // Each ParticleExecutionContext should get its own Loader, this facilitates that.
    return new StubLoader(this._fileMap);
  }
}
