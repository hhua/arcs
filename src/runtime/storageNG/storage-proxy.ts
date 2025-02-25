/**
 * @license
 * Copyright (c) 2019 Google Inc. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * Code distributed by Google as part of this project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

import {assert} from '../../platform/assert-web.js';
import {mapStackTrace} from '../../platform/sourcemapped-stacktrace-web.js';
import {PropagatedException, SystemException} from '../arc-exceptions.js';
import {CRDTChange, CRDTConsumerType, CRDTData, CRDTError, CRDTModel, CRDTOperation, CRDTTypeRecord, VersionMap} from '../crdt/crdt.js';
import {Runnable} from '../hot.js';
import {Particle} from '../particle.js';
import {ParticleExecutionContext} from '../particle-execution-context.js';
import {Type} from '../type.js';
import {Handle} from './handle.js';
import {ActiveStore, ProxyMessage, ProxyMessageType} from './store.js';

/**
 * TODO: describe this class.
 */
export class StorageProxy<T extends CRDTTypeRecord> {
  private handles: Handle<T>[] = [];
  private crdt: CRDTModel<T>;
  private id: number;
  apiChannelId: string;
  private store: ActiveStore<T>;
  readonly type: Type;
  pec: ParticleExecutionContext;
  private listenerAttached = false;
  private keepSynced = false;
  private synchronized = false;
  private readonly scheduler: StorageProxyScheduler<T>;
  private modelHasSynced: Runnable = () => undefined;

  constructor(
      apiChannelId: string,
      crdt: CRDTModel<T>,
      store: ActiveStore<T>,
      type: Type,
      pec: ParticleExecutionContext) {
    this.apiChannelId = apiChannelId;
    this.crdt = crdt;
    this.store = store;
    this.type = type;
    this.pec = pec;
    this.scheduler = new StorageProxyScheduler<T>();
  }

  async idle(): Promise<void> {
    return this.scheduler.idle;
  }

  reportExceptionInHost(exception: PropagatedException) {
    // TODO: Encapsulate source-mapping of the stack trace once there are more users of the port.RaiseSystemException() call.
    if (mapStackTrace) {
      mapStackTrace(exception.cause.stack, mappedStack => {
        exception.cause.stack = mappedStack;
        this.store.reportExceptionInHost(exception);
      });
    } else {
      this.store.reportExceptionInHost(exception);
    }
  }

  registerHandle(handle: Handle<T>): VersionMap {
    this.handles.push(handle);

    // Attach an event listener to the backing store when the first readable handle is registered.
    if (!this.listenerAttached) {
      this.id = this.store.on(x => this.onMessage(x));
      this.listenerAttached = true;
    }

    // Change to synchronized mode as soon as we get any handle configured with keepSynced and send
    // a request to get the full model (once).
    // TODO: drop back to non-sync mode if all handles re-configure to !keepSynced.
    if (handle.options.keepSynced) {
      if (!this.keepSynced) {
        this.requestSynchronization().catch(e => {
          this.reportExceptionInHost(new SystemException(
              e, handle.key, 'StorageProxy::registerHandle'));
        });
        this.keepSynced = true;
      }

      // If a handle configured for sync notifications registers after we've received the full
      // model, notify it immediately.
      if (handle.options.notifySync && this.synchronized) {
        handle.onSync();
      }
    }
    return this.versionCopy();
  }

  deregisterHandle(handleIn: Handle<T>) {
    this.handles = this.handles.filter(handle => handle !== handleIn);
  }

  protected versionCopy(): VersionMap {
    const version = {};
    for (const [k, v] of Object.entries(this.crdt.getData().version)) {
      version[k] = v;
    }
    return version;
  }

  async applyOp(op: CRDTOperation): Promise<boolean> {
    const oldData: CRDTConsumerType = this.crdt.getParticleView();
    if (!this.crdt.applyOperation(op)) {
      return false;
    }
    const message: ProxyMessage<T> = {
      type: ProxyMessageType.Operations,
      operations: [op],
      id: this.id
    };
    await this.store.onProxyMessage(message);
    this.notifyUpdate(op, oldData);
    return true;
  }

  async getParticleView(): Promise<[T['consumerType'], VersionMap]> {
    if (this.synchronized) {
      return [this.crdt.getParticleView()!, this.versionCopy()];
    } else {
      const promise: Promise<[T['consumerType'], VersionMap]> =
          new Promise((resolve) => {
            this.modelHasSynced = () => {
              this.modelHasSynced = () => undefined;
              resolve([this.crdt.getParticleView()!, this.versionCopy()]);
            };
          });
      // Request a new model, it will come back asynchronously with a ModelUpdate message.
      await this.requestSynchronization();
      return promise;
    }
  }

  async onMessage(message: ProxyMessage<T>): Promise<boolean> {
    assert(message.id === this.id);
    switch (message.type) {
      case ProxyMessageType.ModelUpdate:
        this.crdt.merge(message.model);
        this.synchronized = true;
        this.modelHasSynced();
        this.notifySync();
        break;
      case ProxyMessageType.Operations: {
        // Bail if we're not in synchronized mode.
        if (!this.keepSynced) {
          return false;
        }
        let oldData: CRDTConsumerType = this.crdt.getParticleView();
        for (const op of message.operations) {
          if (!this.crdt.applyOperation(op)) {
            // If we cannot cleanly apply ops, sync the whole model.
            this.synchronized = false;
            await this.notifyDesync();
            return this.requestSynchronization();
          }
          this.notifyUpdate(op, oldData);
          oldData = this.crdt.getParticleView();
        }
        // If we have consumed all operations, we've caught up.
        this.synchronized = true;
        break;
      }
      case ProxyMessageType.SyncRequest:
        await this.store.onProxyMessage({type: ProxyMessageType.ModelUpdate, model: this.crdt.getData(), id: this.id});
        break;
      default:
        throw new CRDTError(
            `Invalid operation provided to onMessage, message: ${message}`);
    }
    return true;
  }

  protected notifyUpdate(operation: CRDTOperation, oldData: CRDTConsumerType) {
    const version: VersionMap = this.versionCopy();
    for (const handle of this.handles) {
      if (handle.options.notifyUpdate) {
        this.scheduler.enqueue(
            handle.particle,
            handle,
            {type: HandleMessageType.Update, op: operation, oldData, version});
      } else if (handle.options.keepSynced) {
        // keepSynced but not notifyUpdate, notify of the new model.
        this.scheduler.enqueue(
            handle.particle, handle, {type: HandleMessageType.Sync});
      }
    }
  }

  protected notifySync() {
    for (const handle of this.handles) {
      if (handle.options.notifySync) {
        this.scheduler.enqueue(
            handle.particle, handle, {type: HandleMessageType.Sync});
      }
    }
  }

  protected notifyDesync() {
    for (const handle of this.handles) {
      if (handle.options.notifyDesync) {
        this.scheduler.enqueue(
            handle.particle, handle, {type: HandleMessageType.Desync});
      }
    }
  }

  protected async requestSynchronization(): Promise<boolean> {
    return this.store.onProxyMessage({type: ProxyMessageType.SyncRequest, id: this.id});
  }
}

export class NoOpStorageProxy<T extends CRDTTypeRecord> extends StorageProxy<T> {
  constructor() {
    super(null, null, null, null, null);
  }
  async idle(): Promise<void> {
    return new Promise(resolve => {});
  }

  reportExceptionInHost(exception: PropagatedException): void {}

  registerHandle(handle: Handle<T>): VersionMap {
    return {};
  }
  deregisterHandle(handle: Handle<T>): void {}

  protected versionCopy(): VersionMap {
    return null;
  }

  async applyOp(op: CRDTOperation): Promise<boolean> {
    return new Promise(resolve => {});
  }
  async getParticleView(): Promise<[T['consumerType'], VersionMap]> {
    return new Promise(resolve => {});
  }
  async getData(): Promise<T['data']> {
    return new Promise(resolve => {});
  }
  async onMessage(message: ProxyMessage<T>): Promise<boolean> {
    return new Promise(resolve => {});
  }
  protected notifyUpdate(operation: CRDTOperation, oldData: CRDTConsumerType) {}

  protected notifySync() {}

  protected notifyDesync() {}

  protected async requestSynchronization(): Promise<boolean> {
    return new Promise(resolve => {});
  }
}

enum HandleMessageType {
  Sync,
  Desync,
  Update
}

type Event = {type: HandleMessageType.Sync} |
             {type: HandleMessageType.Desync} |
             {type: HandleMessageType.Update,
               op: CRDTOperation,
               oldData: CRDTConsumerType,
               version: VersionMap};

export class StorageProxyScheduler<T extends CRDTTypeRecord> {
  private _scheduled = false;
  private _queues = new Map<Particle, Map<Handle<T>, Event[]>>();
  private _idleResolver: Runnable|null = null;
  private _idle: Promise<void>|null = null;
  constructor() {
    this._scheduled = false;
    // Particle -> {Handle -> [Queue of events]}
    this._queues = new Map();
  }

  enqueue(particle: Particle, handle: Handle<T>, args: Event) {
    if (!this._queues.has(particle)) {
      this._queues.set(particle, new Map());
    }
    const byHandle = this._queues.get(particle);
    if (!byHandle.has(handle)) {
      byHandle.set(handle, []);
    }
    const queue = byHandle.get(handle);
    queue.push(args);
    this._schedule();
  }

  get busy(): boolean {
    return this._queues.size > 0;
  }

  _updateIdle(): void {
    if (this._idleResolver && !this.busy) {
      this._idleResolver();
      this._idle = null;
      this._idleResolver = null;
    }
  }

  get idle(): Promise<void> {
    if (!this.busy) {
      return Promise.resolve();
    }
    if (!this._idle) {
      this._idle = new Promise(resolve => this._idleResolver = resolve);
    }
    return this._idle;
  }

  _schedule(): void {
    if (this._scheduled) {
      return;
    }
    this._scheduled = true;
    setTimeout(() => {
      this._scheduled = false;
      this._dispatch();
    }, 0);
  }

  _dispatch(): void {
    // TODO: should we process just one particle per task?
    while (this._queues.size > 0) {
      const particle = [...this._queues.keys()][0];
      const byHandle = this._queues.get(particle);
      this._queues.delete(particle);
      for (const [handle, queue] of byHandle.entries()) {
        for (const update of queue) {
          this._dispatchUpdate(handle, update).catch(e =>
            handle.storageProxy.reportExceptionInHost(new SystemException(
                e, 'StorageProxyScheduler::_dispatch', handle.key)));
        }
      }
    }
    this._updateIdle();
  }

  async _dispatchUpdate(handle: Handle<T>, update: Event): Promise<void> {
    switch (update.type) {
      case HandleMessageType.Sync:
        handle.onSync();
        break;
      case HandleMessageType.Desync:
        await handle.onDesync();
        break;
      case HandleMessageType.Update:
        handle.onUpdate(update.op, update.oldData, update.version);
        break;
      default:
        console.error('Ignoring unknown update', update);
    }
  }
}
