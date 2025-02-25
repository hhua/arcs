/**
 * @license
 * Copyright 2019 Google LLC.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * Code distributed by Google as part of this project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

import {linkJack} from '../../../modalities/dom/components/link-jack.js';
import {generateId} from '../../../modalities/dom/components/generate-id.js';
import {Const} from '../../configuration/constants.js';
import {Xen} from '../../lib/components/xen.js';
import {Utils} from '../../lib/utils.js';
import '../../lib/elements/arc-element.js';
import './web-config.js';
import './web-arc.js';
import './web-context.js';
import './web-launcher.js';
import './web-planner.js';
import './ui/web-shell-ui.js';
//import './pipes/device-client-pipe.js';

const manifests = {
  context: `
    import 'https://$particles/canonical.arcs'
  `,
  launcher: `
    import 'https://$particles/Arcs/Launcher.arcs'
  `,
  pipes: `
    import 'https://$particles/Pipes/BackgroundPipes.arcs'
  `
};

const template = Xen.Template.html`
  <style>
    :host {
      display: block;
      padding-bottom: 128px;
    }
    button {
      padding: 4px;
      margin-bottom: 8px;
    }
    [hidden] {
      display: none;
    }
    [suggestions] {
      background-color: silver;
    }
    [slotid=suggestions] {
      background-color: white;
    }
  </style>
  <!-- manage configuration (read and persist) -->
  <web-config arckey="{{arckey}}" on-config="onState"></web-config>
  <!-- ui chrome -->
  <web-shell-ui arc="{{arc}}" launcherarc="{{launcherArc}}" context="{{context}}" nullarc="{{nullArc}}" pipesarc="{{pipesArc}}" search="{{search}}" on-search="onState" showhint="{{showHint}}">
    <!-- launcher -->
    <arc-element id="launcher" hidden="{{hideLauncher}}" storage="{{storage}}" context="{{context}}" config="{{launcherConfig}}" on-arc="onLauncherArc"></arc-element>
    <!-- <web-arc id="launcher" hidden="{{hideLauncher}}" storage="{{storage}}" context="{{context}}" config="{{launcherConfig}}" on-arc="onLauncherArc"></web-arc> -->
    <!-- <web-launcher hidden="{{hideLauncher}}" storage="{{storage}}" context="{{context}}" info="{{info}}"></web-launcher> -->
    <!-- user arc -->
    <web-arc id="arc" hidden="{{hideArc}}" storage="{{storage}}" context="{{context}}" config="{{arcConfig}}" manifest="{{manifest}}" plan="{{plan}}" on-arc="onState"></web-arc>
    <!-- suggestions -->
    <div slot="suggestions" suggestions>
      <div slotid="suggestions" on-plan-choose="onChooseSuggestion"></div>
    </div>
  </web-shell-ui>
  <!-- user context -->
  <web-context storage="{{storage}}" context="{{precontext}}" on-context="onState"></web-context>
  <!-- web planner -->
  <web-planner config="{{config}}" arc="{{plannerArc}}" search="{{search}}" on-metaplans="onState" on-suggestions="onSuggestions"></web-planner>
  <!-- background arcs -->
  <web-arc id="nullArc" hidden storage="{{storage}}" config="{{nullConfig}}" context="{{context}}" on-arc="onNullArc"></web-arc>
  <!-- <web-arc id="folksArc" hidden storage="{{storage}}" config="{{folksConfig}}" context="{{context}}" on-arc="onFolksArc"></web-arc> -->
  <!-- <web-arc id="pipesArc" hidden storage="{{storage}}" config="{{pipesConfig}}" context="{{context}}" on-arc="onPipesArc"></web-arc> -->
  <!-- data pipes -->
  <!-- <device-client-pipe context="{{context}}" storage="{{storage}}" arc="{{arc}}" pipearc="{{pipesArc}}" suggestions="{{suggestions}}" on-search="onState" on-client-arc="onPipeClientArc" on-suggestion="onChooseSuggestion" on-spawn="onRequestPipeArc" on-reset="onReset"></device-client-pipe> -->
`;

const log = Xen.logFactory('WebShell', '#6660ac');

export class WebShell extends Xen.Debug(Xen.Async, log) {
  static get observedAttributes() {
    return ['root'];
  }
  get template() {
    return template;
  }
  get host() {
    return this;
  }
  attributeChangedCallback(n, old, value) {
    this[n] = value;
  }
  // TODO(sjmiles): only debug stuff in this override
  async _update(props, state, oldProps, oldState) {
    // globals stored for easy console access
    window.shell = this;
    window.arc = state.arc;
    window.context = state.context;
    super._update(props, state, oldProps, oldState);
  }
  async update(props, state) {
    // new config?
    if (state.config !== state._config) {
      const {config} = state;
      state._config = config;
      if (config) {
        state.storage = config.storage;
        state.arckey = config.arc;
        state.ready = true;
      }
    }
    if (state.ready) {
      this.readyUpdate(props, state);
    }
  }
  readyUpdate({root}, state) {
    // setup environment once we have a root and a user
    if (!state.env && root) {
      state.env = this.configureEnv(root);
      this.configureContext();
    }
    // spin up launcher arc
    if (!state.launcherConfig && state.env) {
      this.configureLauncher();
    }
    // poll for arcs-store
    if (!state.store && state.launcherArc) {
      this.waitForStore(500);
    }
    // spin up nullArc
    if (!state.nullConfig && state.context && state.store) {
      this.configureNullArc();
    }
    // spin up pipesArc
    // if (!state.pipesConfig && state.context) {
    //   this.configurePipesArc();
    // }
    // consume a suggestion
    if (state.suggestion && state.context) {
      this.applySuggestion(state.suggestion);
      state.suggestion = null;
    }
    // consume an arckey
    if (state.env && state.arckey && state.context) {
      //if (!state.arcConfig || (state.arcConfig.key !== state.arckey)) {
        // spin up arc from key
        this.configureArcFromKey(state.arckey);
      //}
    }
    // flush arc metadata to storage
    if (state.arc && state.arcMeta) {
      if (state.writtenArcMeta !== state.arcMeta) {
        state.writtenArcMeta = state.arcMeta;
        this.recordArcMeta(state.arcMeta);
      }
    }
    this.state = {hideLauncher: Boolean(state.arckey)};
  }
  render(props, state) {
    const {hideLauncher, showLogin, arc, nullArc} = state;
    const renderModel = {
      plannerArc: hideLauncher ? arc : nullArc,
      hideArc: showLogin ? true : !hideLauncher,
      hideLauncher: showLogin ? true : hideLauncher,
    };
    return [props, state, renderModel];
  }
  async configureEnv(root) {
    // capture anchor-clicks for SPA behavior
    linkJack(document, anchor => this.routeLink(anchor));
    // configure arcs environment
    Utils.init(root);
    return Utils.env;
  }
  routeLink(anchor) {
    const url = new URL(anchor.href, document.location);
    const params = url.searchParams;
    log('routeLink:', /*url,*/ anchor.href, Array.from(params.keys()));
    const arckey = params.get('arc') || '';
    // loopback not supported
    if (arckey !== this.state.arckey) {
      this.state = {arckey, search: ''};
    }
  }
  // TODO(sjmiles): use SyntheticStore instead, see web-context.js
  waitForStore(pollInterval) {
    const {context, launcherArc, store} = this.state;
    if (context && launcherArc && !store) {
      const shareSchema = context.findSchemaByName('ArcMeta');
      const store = launcherArc.findStoresByType(shareSchema.type.collectionOf()).pop();
      if (store) {
        this.state = {store: store};
        store.on('change', info => this.state = {info}, this);
        return;
      }
    }
    log('waitForStore: waiting for launcher store...');
    setTimeout(() => this.waitForStore(pollInterval), pollInterval);
  }
  applySuggestion(suggestion) {
    if (!this.state.arckey) {
      this.configureArcFromSuggestion(suggestion);
    }
    this.state = {plan: suggestion.plan};
  }
  async configureContext() {
    const precontext = await Utils.parse(manifests.context);
    this.state = {
      precontext,
      contextConfig: {
        id: `arc-context`
      }
    };
  }
  configureLauncher() {
    this.state = {
      launcherConfig: {
        id: Const.DEFAULT.launcherId,
        manifest: manifests.launcher
      }
    };
  }
  configureNullArc() {
    this.state = {
      nullConfig: this.configureBgArc('planning')
    };
  }
  configureArcFromKey(arckey) {
    // TODO(sjmiles): current middleware keeps arc-id and storage-key separate, which was a mistake.
    // Fixed at this high-level at the moment. Note this code still works for old arc-keys (uses default storage).
    const parts = arckey.split('/');
    const id = parts.pop();
    const storage = parts.join('/');
    // TODO(sjmiles): don't manipulate state if we can avoid it
    const {arcConfig} = this.state;
    if (!arcConfig || arcConfig.id !== id) {
      this.state = {
        search: '',
        arc: null,
        arckey,
        arcConfig: {
          storage,
          id,
          suggestionContainer: this.getSuggestionSlot()
        }
      };
    }
  }
  configureArcFromSuggestion(suggestion) {
    const storage = this.state.config.storage;
    const luid = generateId();
    const id = `arc-${luid}`;
    const description = suggestion.descriptionText;
    this.configureArc({storage, id, description});
  }
  configureArc({storage, id, manifest, description}) {
    //log(id, manifest);
    const arckey = `${storage}/${id}`;
    const color = ['purple', 'blue', 'green', 'orange', 'brown'][Math.floor(Math.random()*5)];
    this.state = {
      search: '',
      arc: null,
      arckey,
      arcMeta: {
        key: id,
        href: `?arc=${arckey}`,
        description,
        color,
        touched: Date.now()
      },
      // TODO(sjmiles): see web-arc.js for why there are two things called `manifest`
      arcConfig: {
        key: arckey,
        id,
        manifest,
        suggestionContainer: this.getSuggestionSlot()
      },
      manifest: null
    };
  }
  configureBgArc(name)  {
    const key = `arc-${name.toLowerCase()}`;
    // this.recordArcMeta({key: key, href: `?arc=${key}`, description: `${name} arc`, color: 'silver', touched: 0});
    return {
      id: key,
      suggestionContainer: this.getSuggestionSlot()
    };
  }
  getSuggestionSlot() {
    return this._dom.$('[slotid="suggestions"]');
  }
  async recordArcMeta(meta) {
    if (this.state.store) {
      await this.state.store.store({id: meta.key, rawData: meta}, [generateId()]);
    } else {
      log('failed to record arc metadata: no store');
    }
  }
  openLauncher() {
    this.state = {
      search: '',
      arckey: ''
    };
  }
  onLauncherArc(e, launcherArc) {
    this.state = {launcherArc};
  }
  onNullArc(e, nullArc) {
    this.state = {nullArc};
  }
  onSuggestions(e, suggestions) {
    const showHint = Boolean(suggestions.length);
    this.state = {suggestions, showHint};
    if (showHint) {
      // latch showHint
      // TODO(sjmiles): needs debouncing
      // TODO(sjmiles): logic in handler is a bad practice
      setTimeout(() => this.state = {showHint: false}, 0);
    }
  }
  onChooseSuggestion(e, suggestion) {
    log('onChooseSuggestion', suggestion);
    this.state = {suggestion};
  }
  onReset() {
    this.openLauncher();
  }
  //
  // pipes
  //
  // configurePipesArc() {
  //   const pipesConfig = this.configureBgArc('pipes');
  //   pipesConfig.manifest = manifests.pipes;
  //   this.state = {
  //     pipesConfig
  //   };
  // }
  // onPipesArc(e, pipesArc) {
  //   this.state = {pipesArc};
  // }
  // onRequestPipeArc(e, {id, manifest, description}) {
  //   const storage = this.state.config.storage;
  //   this.configureArc({storage, id, manifest, description});
  // }
  // onPipeClientArc(e, arc) {
  //   // TODO(sjmiles): `arc.key` is ad-hoc data from device-client-pipe
  //   const key = arc.key;
  //   this.recordArcMeta({
  //     key: key,
  //     href: `?arc=${key}`,
  //     description: `Piped Data Arc`,
  //     color: 'purple',
  //     touched: Date.now()
  //   });
  // }
}

customElements.define('web-shell', WebShell);
