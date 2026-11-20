(function(exports, require$$0) {
  "use strict";
  const testPath = "npm2url/dist/index.cjs";
  const defaultProviders = {
    jsdelivr: (path) => `https://cdn.jsdelivr.net/npm/${path}`,
    unpkg: (path) => `https://unpkg.com/${path}`
  };
  async function checkUrl(url, signal) {
    const res = await fetch(url, {
      signal
    });
    if (!res.ok) {
      throw res;
    }
    await res.text();
  }
  class UrlBuilder {
    constructor() {
      this.providers = { ...defaultProviders };
      this.provider = "jsdelivr";
    }
    /**
     * Get the fastest provider name.
     * If none of the providers returns a valid response within `timeout`, an error will be thrown.
     */
    async getFastestProvider(timeout = 5e3, path = testPath) {
      const controller = new AbortController();
      let timer = 0;
      try {
        return await new Promise((resolve, reject) => {
          Promise.all(
            Object.entries(this.providers).map(async ([name2, factory]) => {
              try {
                await checkUrl(factory(path), controller.signal);
                resolve(name2);
              } catch {
              }
            })
          ).then(() => reject(new Error("All providers failed")));
          timer = setTimeout(reject, timeout, new Error("Timed out"));
        });
      } finally {
        controller.abort();
        clearTimeout(timer);
      }
    }
    /**
     * Set the current provider to the fastest provider found by `getFastestProvider`.
     */
    async findFastestProvider(timeout, path) {
      this.provider = await this.getFastestProvider(timeout, path);
      return this.provider;
    }
    setProvider(name2, factory) {
      if (factory) {
        this.providers[name2] = factory;
      } else {
        delete this.providers[name2];
      }
    }
    getFullUrl(path, provider = this.provider) {
      if (path.includes("://")) {
        return path;
      }
      const factory = this.providers[provider];
      if (!factory) {
        throw new Error(`Provider ${provider} not found`);
      }
      return factory(path);
    }
  }
  class Hook {
    constructor() {
      this.listeners = [];
    }
    tap(fn) {
      this.listeners.push(fn);
      return () => this.revoke(fn);
    }
    revoke(fn) {
      const i = this.listeners.indexOf(fn);
      if (i >= 0) this.listeners.splice(i, 1);
    }
    revokeAll() {
      this.listeners.splice(0);
    }
    call(...args) {
      for (const fn of this.listeners) {
        fn(...args);
      }
    }
  }
  Math.random().toString(36).slice(2, 8);
  function noop() {
  }
  function walkTree(tree, callback) {
    const walk = (item, parent2) => callback(
      item,
      () => {
        var _a2;
        return (_a2 = item.children) == null ? void 0 : _a2.map((child) => walk(child, item));
      },
      parent2
    );
    return walk(tree);
  }
  function wrapFunction(fn, wrapper) {
    return (...args) => wrapper(fn, ...args);
  }
  function defer() {
    const obj = {};
    obj.promise = new Promise((resolve, reject) => {
      obj.resolve = resolve;
      obj.reject = reject;
    });
    return obj;
  }
  function memoize(fn) {
    const cache = {};
    return function memoized(...args) {
      const key = `${args[0]}`;
      let data2 = cache[key];
      if (!data2) {
        data2 = {
          value: fn(...args)
        };
        cache[key] = data2;
      }
      return data2.value;
    };
  }
  /*! @gera2ld/jsx-dom v2.2.2 | ISC License */
  const VTYPE_ELEMENT = 1;
  const VTYPE_FUNCTION = 2;
  const SVG_NS = "http://www.w3.org/2000/svg";
  const XLINK_NS = "http://www.w3.org/1999/xlink";
  const NS_ATTRS = {
    show: XLINK_NS,
    actuate: XLINK_NS,
    href: XLINK_NS
  };
  const isLeaf = (c) => typeof c === "string" || typeof c === "number";
  const isElement = (c) => (c == null ? void 0 : c.vtype) === VTYPE_ELEMENT;
  const isRenderFunction = (c) => (c == null ? void 0 : c.vtype) === VTYPE_FUNCTION;
  function h(type, props, ...children2) {
    props = Object.assign({}, props, {
      children: children2.length === 1 ? children2[0] : children2
    });
    return jsx(type, props);
  }
  function jsx(type, props) {
    let vtype;
    if (typeof type === "string") vtype = VTYPE_ELEMENT;
    else if (typeof type === "function") vtype = VTYPE_FUNCTION;
    else throw new Error("Invalid VNode type");
    return {
      vtype,
      type,
      props
    };
  }
  function Fragment(props) {
    return props.children;
  }
  const DEFAULT_ENV = {
    isSvg: false
  };
  function insertDom(parent2, nodes) {
    if (!Array.isArray(nodes)) nodes = [nodes];
    nodes = nodes.filter(Boolean);
    if (nodes.length) parent2.append(...nodes);
  }
  function mountAttributes(domElement, props, env) {
    for (const key in props) {
      if (key === "key" || key === "children" || key === "ref") continue;
      if (key === "dangerouslySetInnerHTML") {
        domElement.innerHTML = props[key].__html;
      } else if (key === "innerHTML" || key === "textContent" || key === "innerText" || key === "value" && ["textarea", "select"].includes(domElement.tagName)) {
        const value = props[key];
        if (value != null) domElement[key] = value;
      } else if (key.startsWith("on")) {
        domElement[key.toLowerCase()] = props[key];
      } else {
        setDOMAttribute(domElement, key, props[key], env.isSvg);
      }
    }
  }
  const attrMap = {
    className: "class",
    labelFor: "for"
  };
  function setDOMAttribute(el, attr2, value, isSVG) {
    attr2 = attrMap[attr2] || attr2;
    if (value === true) {
      el.setAttribute(attr2, "");
    } else if (value === false) {
      el.removeAttribute(attr2);
    } else {
      const namespace = isSVG ? NS_ATTRS[attr2] : void 0;
      if (namespace !== void 0) {
        el.setAttributeNS(namespace, attr2, value);
      } else {
        el.setAttribute(attr2, value);
      }
    }
  }
  function flatten(arr) {
    return arr.reduce((prev2, item) => prev2.concat(item), []);
  }
  function mountChildren(children2, env) {
    return Array.isArray(children2) ? flatten(children2.map((child) => mountChildren(child, env))) : mount(children2, env);
  }
  function mount(vnode, env = DEFAULT_ENV) {
    if (vnode == null || typeof vnode === "boolean") {
      return null;
    }
    if (vnode instanceof Node) {
      return vnode;
    }
    if (isRenderFunction(vnode)) {
      const {
        type,
        props
      } = vnode;
      if (type === Fragment) {
        const node = document.createDocumentFragment();
        if (props.children) {
          const children2 = mountChildren(props.children, env);
          insertDom(node, children2);
        }
        return node;
      }
      const childVNode = type(props);
      return mount(childVNode, env);
    }
    if (isLeaf(vnode)) {
      return document.createTextNode(`${vnode}`);
    }
    if (isElement(vnode)) {
      let node;
      const {
        type,
        props
      } = vnode;
      if (!env.isSvg && type === "svg") {
        env = Object.assign({}, env, {
          isSvg: true
        });
      }
      if (!env.isSvg) {
        node = document.createElement(type);
      } else {
        node = document.createElementNS(SVG_NS, type);
      }
      mountAttributes(node, props, env);
      if (props.children) {
        let childEnv = env;
        if (env.isSvg && type === "foreignObject") {
          childEnv = Object.assign({}, childEnv, {
            isSvg: false
          });
        }
        const children2 = mountChildren(props.children, childEnv);
        if (children2 != null) insertDom(node, children2);
      }
      const {
        ref
      } = props;
      if (typeof ref === "function") ref(node);
      return node;
    }
    throw new Error("mount: Invalid Vnode!");
  }
  function mountDom(vnode) {
    return mount(vnode);
  }
  function hm(...args) {
    return mountDom(h(...args));
  }
  const memoizedPreloadJS = memoize((url) => {
    document.head.append(
      hm("link", {
        rel: "preload",
        as: "script",
        href: url
      })
    );
  });
  const jsCache = {};
  async function loadJSItem(item, context) {
    var _a2;
    const src = item.type === "script" && ((_a2 = item.data) == null ? void 0 : _a2.src) || "";
    item.loaded || (item.loaded = jsCache[src]);
    if (!item.loaded) {
      const deferred = defer();
      item.loaded = deferred.promise;
      if (item.type === "script") {
        document.head.append(
          hm("script", {
            ...item.data,
            onLoad: () => deferred.resolve(),
            onError: deferred.reject
          })
        );
        if (!src) {
          deferred.resolve();
        } else {
          jsCache[src] = item.loaded;
        }
      }
      if (item.type === "iife") {
        const { fn, getParams } = item.data;
        fn(...(getParams == null ? void 0 : getParams(context)) || []);
        deferred.resolve();
      }
    }
    await item.loaded;
  }
  async function loadJS(items, context) {
    items.forEach((item) => {
      var _a2;
      if (item.type === "script" && ((_a2 = item.data) == null ? void 0 : _a2.src)) {
        memoizedPreloadJS(item.data.src);
      }
    });
    context = {
      getMarkmap: () => window.markmap,
      ...context
    };
    for (const item of items) {
      await loadJSItem(item, context);
    }
  }
  function buildJSItem(path) {
    return {
      type: "script",
      data: {
        src: path
      }
    };
  }
  function buildCSSItem(path) {
    return {
      type: "stylesheet",
      data: {
        href: path
      }
    };
  }
  const defaultOpts$1 = {
    _useHtmlParser2: false
  };
  function flattenOptions(options, baseOptions) {
    if (!options) {
      return baseOptions !== null && baseOptions !== void 0 ? baseOptions : defaultOpts$1;
    }
    const opts = {
      _useHtmlParser2: !!options.xmlMode,
      ...baseOptions,
      ...options
    };
    if (options.xml) {
      opts._useHtmlParser2 = true;
      opts.xmlMode = true;
      if (options.xml !== true) {
        Object.assign(opts, options.xml);
      }
    } else if (options.xmlMode) {
      opts._useHtmlParser2 = true;
    }
    return opts;
  }
  var ElementType;
  (function(ElementType2) {
    ElementType2["Root"] = "root";
    ElementType2["Text"] = "text";
    ElementType2["Directive"] = "directive";
    ElementType2["Comment"] = "comment";
    ElementType2["Script"] = "script";
    ElementType2["Style"] = "style";
    ElementType2["Tag"] = "tag";
    ElementType2["CDATA"] = "cdata";
    ElementType2["Doctype"] = "doctype";
  })(ElementType || (ElementType = {}));
  function isTag$1(elem) {
    return elem.type === ElementType.Tag || elem.type === ElementType.Script || elem.type === ElementType.Style;
  }
  const Root = ElementType.Root;
  const Text$1 = ElementType.Text;
  const Directive = ElementType.Directive;
  const Comment$1 = ElementType.Comment;
  const Script = ElementType.Script;
  const Style = ElementType.Style;
  const Tag = ElementType.Tag;
  const CDATA$1 = ElementType.CDATA;
  const Doctype = ElementType.Doctype;
  let Node$1 = class Node {
    constructor() {
      this.parent = null;
      this.prev = null;
      this.next = null;
      this.startIndex = null;
      this.endIndex = null;
    }
    // Read-write aliases for properties
    /**
     * Same as {@link parent}.
     * [DOM spec](https://dom.spec.whatwg.org)-compatible alias.
     */
    get parentNode() {
      return this.parent;
    }
    set parentNode(parent2) {
      this.parent = parent2;
    }
    /**
     * Same as {@link prev}.
     * [DOM spec](https://dom.spec.whatwg.org)-compatible alias.
     */
    get previousSibling() {
      return this.prev;
    }
    set previousSibling(prev2) {
      this.prev = prev2;
    }
    /**
     * Same as {@link next}.
     * [DOM spec](https://dom.spec.whatwg.org)-compatible alias.
     */
    get nextSibling() {
      return this.next;
    }
    set nextSibling(next2) {
      this.next = next2;
    }
    /**
     * Clone this node, and optionally its children.
     *
     * @param recursive Clone child nodes as well.
     * @returns A clone of the node.
     */
    cloneNode(recursive = false) {
      return cloneNode(this, recursive);
    }
  };
  class DataNode extends Node$1 {
    /**
     * @param data The content of the data node
     */
    constructor(data2) {
      super();
      this.data = data2;
    }
    /**
     * Same as {@link data}.
     * [DOM spec](https://dom.spec.whatwg.org)-compatible alias.
     */
    get nodeValue() {
      return this.data;
    }
    set nodeValue(data2) {
      this.data = data2;
    }
  }
  class Text extends DataNode {
    constructor() {
      super(...arguments);
      this.type = ElementType.Text;
    }
    get nodeType() {
      return 3;
    }
  }
  class Comment extends DataNode {
    constructor() {
      super(...arguments);
      this.type = ElementType.Comment;
    }
    get nodeType() {
      return 8;
    }
  }
  class ProcessingInstruction extends DataNode {
    constructor(name2, data2) {
      super(data2);
      this.name = name2;
      this.type = ElementType.Directive;
    }
    get nodeType() {
      return 1;
    }
  }
  class NodeWithChildren extends Node$1 {
    /**
     * @param children Children of the node. Only certain node types can have children.
     */
    constructor(children2) {
      super();
      this.children = children2;
    }
    // Aliases
    /** First child of the node. */
    get firstChild() {
      var _a2;
      return (_a2 = this.children[0]) !== null && _a2 !== void 0 ? _a2 : null;
    }
    /** Last child of the node. */
    get lastChild() {
      return this.children.length > 0 ? this.children[this.children.length - 1] : null;
    }
    /**
     * Same as {@link children}.
     * [DOM spec](https://dom.spec.whatwg.org)-compatible alias.
     */
    get childNodes() {
      return this.children;
    }
    set childNodes(children2) {
      this.children = children2;
    }
  }
  class CDATA extends NodeWithChildren {
    constructor() {
      super(...arguments);
      this.type = ElementType.CDATA;
    }
    get nodeType() {
      return 4;
    }
  }
  let Document$1 = class Document extends NodeWithChildren {
    constructor() {
      super(...arguments);
      this.type = ElementType.Root;
    }
    get nodeType() {
      return 9;
    }
  };
  class Element extends NodeWithChildren {
    /**
     * @param name Name of the tag, eg. `div`, `span`.
     * @param attribs Object mapping attribute names to attribute values.
     * @param children Children of the node.
     */
    constructor(name2, attribs, children2 = [], type = name2 === "script" ? ElementType.Script : name2 === "style" ? ElementType.Style : ElementType.Tag) {
      super(children2);
      this.name = name2;
      this.attribs = attribs;
      this.type = type;
    }
    get nodeType() {
      return 1;
    }
    // DOM Level 1 aliases
    /**
     * Same as {@link name}.
     * [DOM spec](https://dom.spec.whatwg.org)-compatible alias.
     */
    get tagName() {
      return this.name;
    }
    set tagName(name2) {
      this.name = name2;
    }
    get attributes() {
      return Object.keys(this.attribs).map((name2) => {
        var _a2, _b;
        return {
          name: name2,
          value: this.attribs[name2],
          namespace: (_a2 = this["x-attribsNamespace"]) === null || _a2 === void 0 ? void 0 : _a2[name2],
          prefix: (_b = this["x-attribsPrefix"]) === null || _b === void 0 ? void 0 : _b[name2]
        };
      });
    }
  }
  function isTag(node) {
    return isTag$1(node);
  }
  function isCDATA(node) {
    return node.type === ElementType.CDATA;
  }
  function isText(node) {
    return node.type === ElementType.Text;
  }
  function isComment(node) {
    return node.type === ElementType.Comment;
  }
  function isDirective(node) {
    return node.type === ElementType.Directive;
  }
  function isDocument$1(node) {
    return node.type === ElementType.Root;
  }
  function hasChildren(node) {
    return Object.prototype.hasOwnProperty.call(node, "children");
  }
  function cloneNode(node, recursive = false) {
    let result;
    if (isText(node)) {
      result = new Text(node.data);
    } else if (isComment(node)) {
      result = new Comment(node.data);
    } else if (isTag(node)) {
      const children2 = recursive ? cloneChildren(node.children) : [];
      const clone2 = new Element(node.name, { ...node.attribs }, children2);
      children2.forEach((child) => child.parent = clone2);
      if (node.namespace != null) {
        clone2.namespace = node.namespace;
      }
      if (node["x-attribsNamespace"]) {
        clone2["x-attribsNamespace"] = { ...node["x-attribsNamespace"] };
      }
      if (node["x-attribsPrefix"]) {
        clone2["x-attribsPrefix"] = { ...node["x-attribsPrefix"] };
      }
      result = clone2;
    } else if (isCDATA(node)) {
      const children2 = recursive ? cloneChildren(node.children) : [];
      const clone2 = new CDATA(children2);
      children2.forEach((child) => child.parent = clone2);
      result = clone2;
    } else if (isDocument$1(node)) {
      const children2 = recursive ? cloneChildren(node.children) : [];
      const clone2 = new Document$1(children2);
      children2.forEach((child) => child.parent = clone2);
      if (node["x-mode"]) {
        clone2["x-mode"] = node["x-mode"];
      }
      result = clone2;
    } else if (isDirective(node)) {
      const instruction = new ProcessingInstruction(node.name, node.data);
      if (node["x-name"] != null) {
        instruction["x-name"] = node["x-name"];
        instruction["x-publicId"] = node["x-publicId"];
        instruction["x-systemId"] = node["x-systemId"];
      }
      result = instruction;
    } else {
      throw new Error(`Not implemented yet: ${node.type}`);
    }
    result.startIndex = node.startIndex;
    result.endIndex = node.endIndex;
    if (node.sourceCodeLocation != null) {
      result.sourceCodeLocation = node.sourceCodeLocation;
    }
    return result;
  }
  function cloneChildren(childs) {
    const children2 = childs.map((child) => cloneNode(child, true));
    for (let i = 1; i < children2.length; i++) {
      children2[i].prev = children2[i - 1];
      children2[i - 1].next = children2[i];
    }
    return children2;
  }
  const defaultOpts = {
    withStartIndices: false,
    withEndIndices: false,
    xmlMode: false
  };
  class DomHandler {
    /**
     * @param callback Called once parsing has completed.
     * @param options Settings for the handler.
     * @param elementCB Callback whenever a tag is closed.
     */
    constructor(callback, options, elementCB) {
      this.dom = [];
      this.root = new Document$1(this.dom);
      this.done = false;
      this.tagStack = [this.root];
      this.lastNode = null;
      this.parser = null;
      if (typeof options === "function") {
        elementCB = options;
        options = defaultOpts;
      }
      if (typeof callback === "object") {
        options = callback;
        callback = void 0;
      }
      this.callback = callback !== null && callback !== void 0 ? callback : null;
      this.options = options !== null && options !== void 0 ? options : defaultOpts;
      this.elementCB = elementCB !== null && elementCB !== void 0 ? elementCB : null;
    }
    onparserinit(parser) {
      this.parser = parser;
    }
    // Resets the handler back to starting state
    onreset() {
      this.dom = [];
      this.root = new Document$1(this.dom);
      this.done = false;
      this.tagStack = [this.root];
      this.lastNode = null;
      this.parser = null;
    }
    // Signals the handler that parsing is done
    onend() {
      if (this.done)
        return;
      this.done = true;
      this.parser = null;
      this.handleCallback(null);
    }
    onerror(error2) {
      this.handleCallback(error2);
    }
    onclosetag() {
      this.lastNode = null;
      const elem = this.tagStack.pop();
      if (this.options.withEndIndices) {
        elem.endIndex = this.parser.endIndex;
      }
      if (this.elementCB)
        this.elementCB(elem);
    }
    onopentag(name2, attribs) {
      const type = this.options.xmlMode ? ElementType.Tag : void 0;
      const element = new Element(name2, attribs, void 0, type);
      this.addNode(element);
      this.tagStack.push(element);
    }
    ontext(data2) {
      const { lastNode } = this;
      if (lastNode && lastNode.type === ElementType.Text) {
        lastNode.data += data2;
        if (this.options.withEndIndices) {
          lastNode.endIndex = this.parser.endIndex;
        }
      } else {
        const node = new Text(data2);
        this.addNode(node);
        this.lastNode = node;
      }
    }
    oncomment(data2) {
      if (this.lastNode && this.lastNode.type === ElementType.Comment) {
        this.lastNode.data += data2;
        return;
      }
      const node = new Comment(data2);
      this.addNode(node);
      this.lastNode = node;
    }
    oncommentend() {
      this.lastNode = null;
    }
    oncdatastart() {
      const text2 = new Text("");
      const node = new CDATA([text2]);
      this.addNode(node);
      text2.parent = node;
      this.lastNode = text2;
    }
    oncdataend() {
      this.lastNode = null;
    }
    onprocessinginstruction(name2, data2) {
      const node = new ProcessingInstruction(name2, data2);
      this.addNode(node);
    }
    handleCallback(error2) {
      if (typeof this.callback === "function") {
        this.callback(error2, this.dom);
      } else if (error2) {
        throw error2;
      }
    }
    addNode(node) {
      const parent2 = this.tagStack[this.tagStack.length - 1];
      const previousSibling = parent2.children[parent2.children.length - 1];
      if (this.options.withStartIndices) {
        node.startIndex = this.parser.startIndex;
      }
      if (this.options.withEndIndices) {
        node.endIndex = this.parser.endIndex;
      }
      parent2.children.push(node);
      if (previousSibling) {
        node.prev = previousSibling;
        previousSibling.next = node;
      }
      node.parent = parent2;
      this.lastNode = null;
    }
  }
  const htmlDecodeTree$1 = new Uint16Array(
    // prettier-ignore
    'ᵁ<Õıʊҝջאٵ۞ޢߖࠏ੊ઑඡ๭༉༦჊ረዡᐕᒝᓃᓟᔥ\0\0\0\0\0\0ᕫᛍᦍᰒᷝ὾⁠↰⊍⏀⏻⑂⠤⤒ⴈ⹈⿎〖㊺㘹㞬㣾㨨㩱㫠㬮ࠀEMabcfglmnoprstu\\bfms¦³¹ÈÏlig耻Æ䃆P耻&䀦cute耻Á䃁reve;䄂Āiyx}rc耻Â䃂;䐐r;쀀𝔄rave耻À䃀pha;䎑acr;䄀d;橓Āgp¡on;䄄f;쀀𝔸plyFunction;恡ing耻Å䃅Ācs¾Ãr;쀀𝒜ign;扔ilde耻Ã䃃ml耻Ä䃄ЀaceforsuåûþėĜĢħĪĀcrêòkslash;或Ŷöø;櫧ed;挆y;䐑ƀcrtąċĔause;戵noullis;愬a;䎒r;쀀𝔅pf;쀀𝔹eve;䋘còēmpeq;扎܀HOacdefhilorsuōőŖƀƞƢƵƷƺǜȕɳɸɾcy;䐧PY耻©䂩ƀcpyŝŢźute;䄆Ā;iŧŨ拒talDifferentialD;慅leys;愭ȀaeioƉƎƔƘron;䄌dil耻Ç䃇rc;䄈nint;戰ot;䄊ĀdnƧƭilla;䂸terDot;䂷òſi;䎧rcleȀDMPTǇǋǑǖot;抙inus;抖lus;投imes;抗oĀcsǢǸkwiseContourIntegral;戲eCurlyĀDQȃȏoubleQuote;思uote;怙ȀlnpuȞȨɇɕonĀ;eȥȦ户;橴ƀgitȯȶȺruent;扡nt;戯ourIntegral;戮ĀfrɌɎ;愂oduct;成nterClockwiseContourIntegral;戳oss;樯cr;쀀𝒞pĀ;Cʄʅ拓ap;才րDJSZacefiosʠʬʰʴʸˋ˗ˡ˦̳ҍĀ;oŹʥtrahd;椑cy;䐂cy;䐅cy;䐏ƀgrsʿ˄ˇger;怡r;憡hv;櫤Āayː˕ron;䄎;䐔lĀ;t˝˞戇a;䎔r;쀀𝔇Āaf˫̧Ācm˰̢riticalȀADGT̖̜̀̆cute;䂴oŴ̋̍;䋙bleAcute;䋝rave;䁠ilde;䋜ond;拄ferentialD;慆Ѱ̽\0\0\0͔͂\0Ѕf;쀀𝔻ƀ;DE͈͉͍䂨ot;惜qual;扐blèCDLRUVͣͲ΂ϏϢϸontourIntegraìȹoɴ͹\0\0ͻ»͉nArrow;懓Āeo·ΤftƀARTΐΖΡrrow;懐ightArrow;懔eåˊngĀLRΫτeftĀARγιrrow;柸ightArrow;柺ightArrow;柹ightĀATϘϞrrow;懒ee;抨pɁϩ\0\0ϯrrow;懑ownArrow;懕erticalBar;戥ǹABLRTaВЪаўѿͼrrowƀ;BUНОТ憓ar;椓pArrow;懵reve;䌑eft˒к\0ц\0ѐightVector;楐eeVector;楞ectorĀ;Bљњ憽ar;楖ightǔѧ\0ѱeeVector;楟ectorĀ;BѺѻ懁ar;楗eeĀ;A҆҇护rrow;憧ĀctҒҗr;쀀𝒟rok;䄐ࠀNTacdfglmopqstuxҽӀӄӋӞӢӧӮӵԡԯԶՒ՝ՠեG;䅊H耻Ð䃐cute耻É䃉ƀaiyӒӗӜron;䄚rc耻Ê䃊;䐭ot;䄖r;쀀𝔈rave耻È䃈ement;戈ĀapӺӾcr;䄒tyɓԆ\0\0ԒmallSquare;旻erySmallSquare;斫ĀgpԦԪon;䄘f;쀀𝔼silon;䎕uĀaiԼՉlĀ;TՂՃ橵ilde;扂librium;懌Āci՗՚r;愰m;橳a;䎗ml耻Ë䃋Āipժկsts;戃onentialE;慇ʀcfiosօֈ֍ֲ׌y;䐤r;쀀𝔉lledɓ֗\0\0֣mallSquare;旼erySmallSquare;斪Ͱֺ\0ֿ\0\0ׄf;쀀𝔽All;戀riertrf;愱cò׋؀JTabcdfgorstר׬ׯ׺؀ؒؖ؛؝أ٬ٲcy;䐃耻>䀾mmaĀ;d׷׸䎓;䏜reve;䄞ƀeiy؇،ؐdil;䄢rc;䄜;䐓ot;䄠r;쀀𝔊;拙pf;쀀𝔾eater̀EFGLSTصلَٖٛ٦qualĀ;Lؾؿ扥ess;招ullEqual;执reater;檢ess;扷lantEqual;橾ilde;扳cr;쀀𝒢;扫ЀAacfiosuڅڋږڛڞڪھۊRDcy;䐪Āctڐڔek;䋇;䁞irc;䄤r;愌lbertSpace;愋ǰگ\0ڲf;愍izontalLine;攀Āctۃۅòکrok;䄦mpńېۘownHumðįqual;扏܀EJOacdfgmnostuۺ۾܃܇܎ܚܞܡܨ݄ݸދޏޕcy;䐕lig;䄲cy;䐁cute耻Í䃍Āiyܓܘrc耻Î䃎;䐘ot;䄰r;愑rave耻Ì䃌ƀ;apܠܯܿĀcgܴܷr;䄪inaryI;慈lieóϝǴ݉\0ݢĀ;eݍݎ戬Āgrݓݘral;戫section;拂isibleĀCTݬݲomma;恣imes;恢ƀgptݿރވon;䄮f;쀀𝕀a;䎙cr;愐ilde;䄨ǫޚ\0ޞcy;䐆l耻Ï䃏ʀcfosuެ޷޼߂ߐĀiyޱ޵rc;䄴;䐙r;쀀𝔍pf;쀀𝕁ǣ߇\0ߌr;쀀𝒥rcy;䐈kcy;䐄΀HJacfosߤߨ߽߬߱ࠂࠈcy;䐥cy;䐌ppa;䎚Āey߶߻dil;䄶;䐚r;쀀𝔎pf;쀀𝕂cr;쀀𝒦րJTaceflmostࠥࠩࠬࡐࡣ঳সে্਷ੇcy;䐉耻<䀼ʀcmnpr࠷࠼ࡁࡄࡍute;䄹bda;䎛g;柪lacetrf;愒r;憞ƀaeyࡗ࡜ࡡron;䄽dil;䄻;䐛Āfsࡨ॰tԀACDFRTUVarࡾࢩࢱࣦ࣠ࣼयज़ΐ४Ānrࢃ࢏gleBracket;柨rowƀ;BR࢙࢚࢞憐ar;懤ightArrow;懆eiling;挈oǵࢷ\0ࣃbleBracket;柦nǔࣈ\0࣒eeVector;楡ectorĀ;Bࣛࣜ懃ar;楙loor;挊ightĀAV࣯ࣵrrow;憔ector;楎Āerँगeƀ;AVउऊऐ抣rrow;憤ector;楚iangleƀ;BEतथऩ抲ar;槏qual;抴pƀDTVषूौownVector;楑eeVector;楠ectorĀ;Bॖॗ憿ar;楘ectorĀ;B॥०憼ar;楒ightáΜs̀EFGLSTॾঋকঝঢভqualGreater;拚ullEqual;扦reater;扶ess;檡lantEqual;橽ilde;扲r;쀀𝔏Ā;eঽা拘ftarrow;懚idot;䄿ƀnpw৔ਖਛgȀLRlr৞৷ਂਐeftĀAR০৬rrow;柵ightArrow;柷ightArrow;柶eftĀarγਊightáοightáϊf;쀀𝕃erĀLRਢਬeftArrow;憙ightArrow;憘ƀchtਾੀੂòࡌ;憰rok;䅁;扪Ѐacefiosuਗ਼੝੠੷੼અઋ઎p;椅y;䐜Ādl੥੯iumSpace;恟lintrf;愳r;쀀𝔐nusPlus;戓pf;쀀𝕄cò੶;䎜ҀJacefostuણધભીଔଙඑ඗ඞcy;䐊cute;䅃ƀaey઴હાron;䅇dil;䅅;䐝ƀgswે૰଎ativeƀMTV૓૟૨ediumSpace;怋hiĀcn૦૘ë૙eryThiî૙tedĀGL૸ଆreaterGreateòٳessLesóੈLine;䀊r;쀀𝔑ȀBnptଢନଷ଺reak;恠BreakingSpace;䂠f;愕ڀ;CDEGHLNPRSTV୕ୖ୪୼஡௫ఄ౞಄ದ೘ൡඅ櫬Āou୛୤ngruent;扢pCap;扭oubleVerticalBar;戦ƀlqxஃஊ஛ement;戉ualĀ;Tஒஓ扠ilde;쀀≂̸ists;戄reater΀;EFGLSTஶஷ஽௉௓௘௥扯qual;扱ullEqual;쀀≧̸reater;쀀≫̸ess;批lantEqual;쀀⩾̸ilde;扵umpń௲௽ownHump;쀀≎̸qual;쀀≏̸eĀfsఊధtTriangleƀ;BEచఛడ拪ar;쀀⧏̸qual;括s̀;EGLSTవశ఼ౄోౘ扮qual;扰reater;扸ess;쀀≪̸lantEqual;쀀⩽̸ilde;扴estedĀGL౨౹reaterGreater;쀀⪢̸essLess;쀀⪡̸recedesƀ;ESಒಓಛ技qual;쀀⪯̸lantEqual;拠ĀeiಫಹverseElement;戌ghtTriangleƀ;BEೋೌ೒拫ar;쀀⧐̸qual;拭ĀquೝഌuareSuĀbp೨೹setĀ;E೰ೳ쀀⊏̸qual;拢ersetĀ;Eഃആ쀀⊐̸qual;拣ƀbcpഓതൎsetĀ;Eഛഞ쀀⊂⃒qual;抈ceedsȀ;ESTലള഻െ抁qual;쀀⪰̸lantEqual;拡ilde;쀀≿̸ersetĀ;E൘൛쀀⊃⃒qual;抉ildeȀ;EFT൮൯൵ൿ扁qual;扄ullEqual;扇ilde;扉erticalBar;戤cr;쀀𝒩ilde耻Ñ䃑;䎝܀Eacdfgmoprstuvලෂ෉෕ෛ෠෧෼ขภยา฿ไlig;䅒cute耻Ó䃓Āiy෎ීrc耻Ô䃔;䐞blac;䅐r;쀀𝔒rave耻Ò䃒ƀaei෮ෲ෶cr;䅌ga;䎩cron;䎟pf;쀀𝕆enCurlyĀDQฎบoubleQuote;怜uote;怘;橔Āclวฬr;쀀𝒪ash耻Ø䃘iŬื฼de耻Õ䃕es;樷ml耻Ö䃖erĀBP๋๠Āar๐๓r;怾acĀek๚๜;揞et;掴arenthesis;揜Ҁacfhilors๿ງຊຏຒດຝະ໼rtialD;戂y;䐟r;쀀𝔓i;䎦;䎠usMinus;䂱Āipຢອncareplanåڝf;愙Ȁ;eio຺ູ໠໤檻cedesȀ;EST່້໏໚扺qual;檯lantEqual;扼ilde;找me;怳Ādp໩໮uct;戏ortionĀ;aȥ໹l;戝Āci༁༆r;쀀𝒫;䎨ȀUfos༑༖༛༟OT耻"䀢r;쀀𝔔pf;愚cr;쀀𝒬؀BEacefhiorsu༾གྷཇའཱིྦྷྪྭ႖ႩႴႾarr;椐G耻®䂮ƀcnrཎནབute;䅔g;柫rĀ;tཛྷཝ憠l;椖ƀaeyཧཬཱron;䅘dil;䅖;䐠Ā;vླྀཹ愜erseĀEUྂྙĀlq྇ྎement;戋uilibrium;懋pEquilibrium;楯r»ཹo;䎡ghtЀACDFTUVa࿁࿫࿳ဢဨၛႇϘĀnr࿆࿒gleBracket;柩rowƀ;BL࿜࿝࿡憒ar;懥eftArrow;懄eiling;按oǵ࿹\0စbleBracket;柧nǔည\0နeeVector;楝ectorĀ;Bဝသ懂ar;楕loor;挋Āerိ၃eƀ;AVဵံြ抢rrow;憦ector;楛iangleƀ;BEၐၑၕ抳ar;槐qual;抵pƀDTVၣၮၸownVector;楏eeVector;楜ectorĀ;Bႂႃ憾ar;楔ectorĀ;B႑႒懀ar;楓Āpuႛ႞f;愝ndImplies;楰ightarrow;懛ĀchႹႼr;愛;憱leDelayed;槴ڀHOacfhimoqstuფჱჷჽᄙᄞᅑᅖᅡᅧᆵᆻᆿĀCcჩხHcy;䐩y;䐨FTcy;䐬cute;䅚ʀ;aeiyᄈᄉᄎᄓᄗ檼ron;䅠dil;䅞rc;䅜;䐡r;쀀𝔖ortȀDLRUᄪᄴᄾᅉownArrow»ОeftArrow»࢚ightArrow»࿝pArrow;憑gma;䎣allCircle;战pf;쀀𝕊ɲᅭ\0\0ᅰt;戚areȀ;ISUᅻᅼᆉᆯ斡ntersection;抓uĀbpᆏᆞsetĀ;Eᆗᆘ抏qual;抑ersetĀ;Eᆨᆩ抐qual;抒nion;抔cr;쀀𝒮ar;拆ȀbcmpᇈᇛሉላĀ;sᇍᇎ拐etĀ;Eᇍᇕqual;抆ĀchᇠህeedsȀ;ESTᇭᇮᇴᇿ扻qual;檰lantEqual;扽ilde;承Tháྌ;我ƀ;esሒሓሣ拑rsetĀ;Eሜም抃qual;抇et»ሓրHRSacfhiorsሾቄ቉ቕ቞ቱቶኟዂወዑORN耻Þ䃞ADE;愢ĀHc቎ቒcy;䐋y;䐦Ābuቚቜ;䀉;䎤ƀaeyብቪቯron;䅤dil;䅢;䐢r;쀀𝔗Āeiቻ኉ǲኀ\0ኇefore;戴a;䎘Ācn኎ኘkSpace;쀀  Space;怉ldeȀ;EFTካኬኲኼ戼qual;扃ullEqual;扅ilde;扈pf;쀀𝕋ipleDot;惛Āctዖዛr;쀀𝒯rok;䅦ૡዷጎጚጦ\0ጬጱ\0\0\0\0\0ጸጽ፷ᎅ\0᏿ᐄᐊᐐĀcrዻጁute耻Ú䃚rĀ;oጇገ憟cir;楉rǣጓ\0጖y;䐎ve;䅬Āiyጞጣrc耻Û䃛;䐣blac;䅰r;쀀𝔘rave耻Ù䃙acr;䅪Ādiፁ፩erĀBPፈ፝Āarፍፐr;䁟acĀekፗፙ;揟et;掵arenthesis;揝onĀ;P፰፱拃lus;抎Āgp፻፿on;䅲f;쀀𝕌ЀADETadps᎕ᎮᎸᏄϨᏒᏗᏳrrowƀ;BDᅐᎠᎤar;椒ownArrow;懅ownArrow;憕quilibrium;楮eeĀ;AᏋᏌ报rrow;憥ownáϳerĀLRᏞᏨeftArrow;憖ightArrow;憗iĀ;lᏹᏺ䏒on;䎥ing;䅮cr;쀀𝒰ilde;䅨ml耻Ü䃜ҀDbcdefosvᐧᐬᐰᐳᐾᒅᒊᒐᒖash;披ar;櫫y;䐒ashĀ;lᐻᐼ抩;櫦Āerᑃᑅ;拁ƀbtyᑌᑐᑺar;怖Ā;iᑏᑕcalȀBLSTᑡᑥᑪᑴar;戣ine;䁼eparator;杘ilde;所ThinSpace;怊r;쀀𝔙pf;쀀𝕍cr;쀀𝒱dash;抪ʀcefosᒧᒬᒱᒶᒼirc;䅴dge;拀r;쀀𝔚pf;쀀𝕎cr;쀀𝒲Ȁfiosᓋᓐᓒᓘr;쀀𝔛;䎞pf;쀀𝕏cr;쀀𝒳ҀAIUacfosuᓱᓵᓹᓽᔄᔏᔔᔚᔠcy;䐯cy;䐇cy;䐮cute耻Ý䃝Āiyᔉᔍrc;䅶;䐫r;쀀𝔜pf;쀀𝕐cr;쀀𝒴ml;䅸ЀHacdefosᔵᔹᔿᕋᕏᕝᕠᕤcy;䐖cute;䅹Āayᕄᕉron;䅽;䐗ot;䅻ǲᕔ\0ᕛoWidtè૙a;䎖r;愨pf;愤cr;쀀𝒵௡ᖃᖊᖐ\0ᖰᖶᖿ\0\0\0\0ᗆᗛᗫᙟ᙭\0ᚕ᚛ᚲᚹ\0ᚾcute耻á䃡reve;䄃̀;Ediuyᖜᖝᖡᖣᖨᖭ戾;쀀∾̳;房rc耻â䃢te肻´̆;䐰lig耻æ䃦Ā;r²ᖺ;쀀𝔞rave耻à䃠ĀepᗊᗖĀfpᗏᗔsym;愵èᗓha;䎱ĀapᗟcĀclᗤᗧr;䄁g;樿ɤᗰ\0\0ᘊʀ;adsvᗺᗻᗿᘁᘇ戧nd;橕;橜lope;橘;橚΀;elmrszᘘᘙᘛᘞᘿᙏᙙ戠;榤e»ᘙsdĀ;aᘥᘦ戡ѡᘰᘲᘴᘶᘸᘺᘼᘾ;榨;榩;榪;榫;榬;榭;榮;榯tĀ;vᙅᙆ戟bĀ;dᙌᙍ抾;榝Āptᙔᙗh;戢»¹arr;捼Āgpᙣᙧon;䄅f;쀀𝕒΀;Eaeiop዁ᙻᙽᚂᚄᚇᚊ;橰cir;橯;扊d;手s;䀧roxĀ;e዁ᚒñᚃing耻å䃥ƀctyᚡᚦᚨr;쀀𝒶;䀪mpĀ;e዁ᚯñʈilde耻ã䃣ml耻ä䃤Āciᛂᛈoninôɲnt;樑ࠀNabcdefiklnoprsu᛭ᛱᜰ᜼ᝃᝈ᝸᝽០៦ᠹᡐᜍ᤽᥈ᥰot;櫭Ācrᛶ᜞kȀcepsᜀᜅᜍᜓong;扌psilon;䏶rime;怵imĀ;e᜚᜛戽q;拍Ŷᜢᜦee;抽edĀ;gᜬᜭ挅e»ᜭrkĀ;t፜᜷brk;掶Āoyᜁᝁ;䐱quo;怞ʀcmprtᝓ᝛ᝡᝤᝨausĀ;eĊĉptyv;榰séᜌnoõēƀahwᝯ᝱ᝳ;䎲;愶een;扬r;쀀𝔟g΀costuvwឍឝឳេ៕៛៞ƀaiuបពរðݠrc;旯p»፱ƀdptឤឨឭot;樀lus;樁imes;樂ɱឹ\0\0ើcup;樆ar;昅riangleĀdu៍្own;施p;斳plus;樄eåᑄåᒭarow;植ƀako៭ᠦᠵĀcn៲ᠣkƀlst៺֫᠂ozenge;槫riangleȀ;dlr᠒᠓᠘᠝斴own;斾eft;旂ight;斸k;搣Ʊᠫ\0ᠳƲᠯ\0ᠱ;斒;斑4;斓ck;斈ĀeoᠾᡍĀ;qᡃᡆ쀀=⃥uiv;쀀≡⃥t;挐Ȁptwxᡙᡞᡧᡬf;쀀𝕓Ā;tᏋᡣom»Ꮜtie;拈؀DHUVbdhmptuvᢅᢖᢪᢻᣗᣛᣬ᣿ᤅᤊᤐᤡȀLRlrᢎᢐᢒᢔ;敗;敔;敖;敓ʀ;DUduᢡᢢᢤᢦᢨ敐;敦;敩;敤;敧ȀLRlrᢳᢵᢷᢹ;敝;敚;敜;教΀;HLRhlrᣊᣋᣍᣏᣑᣓᣕ救;敬;散;敠;敫;敢;敟ox;槉ȀLRlrᣤᣦᣨᣪ;敕;敒;攐;攌ʀ;DUduڽ᣷᣹᣻᣽;敥;敨;攬;攴inus;抟lus;択imes;抠ȀLRlrᤙᤛᤝ᤟;敛;敘;攘;攔΀;HLRhlrᤰᤱᤳᤵᤷ᤻᤹攂;敪;敡;敞;攼;攤;攜Āevģ᥂bar耻¦䂦Ȁceioᥑᥖᥚᥠr;쀀𝒷mi;恏mĀ;e᜚᜜lƀ;bhᥨᥩᥫ䁜;槅sub;柈Ŭᥴ᥾lĀ;e᥹᥺怢t»᥺pƀ;Eeįᦅᦇ;檮Ā;qۜۛೡᦧ\0᧨ᨑᨕᨲ\0ᨷᩐ\0\0᪴\0\0᫁\0\0ᬡᬮ᭍᭒\0᯽\0ᰌƀcpr᦭ᦲ᧝ute;䄇̀;abcdsᦿᧀᧄ᧊᧕᧙戩nd;橄rcup;橉Āau᧏᧒p;橋p;橇ot;橀;쀀∩︀Āeo᧢᧥t;恁îړȀaeiu᧰᧻ᨁᨅǰ᧵\0᧸s;橍on;䄍dil耻ç䃧rc;䄉psĀ;sᨌᨍ橌m;橐ot;䄋ƀdmnᨛᨠᨦil肻¸ƭptyv;榲t脀¢;eᨭᨮ䂢räƲr;쀀𝔠ƀceiᨽᩀᩍy;䑇ckĀ;mᩇᩈ朓ark»ᩈ;䏇r΀;Ecefms᩟᩠ᩢᩫ᪤᪪᪮旋;槃ƀ;elᩩᩪᩭ䋆q;扗eɡᩴ\0\0᪈rrowĀlr᩼᪁eft;憺ight;憻ʀRSacd᪒᪔᪖᪚᪟»ཇ;擈st;抛irc;抚ash;抝nint;樐id;櫯cir;槂ubsĀ;u᪻᪼晣it»᪼ˬ᫇᫔᫺\0ᬊonĀ;eᫍᫎ䀺Ā;qÇÆɭ᫙\0\0᫢aĀ;t᫞᫟䀬;䁀ƀ;fl᫨᫩᫫戁îᅠeĀmx᫱᫶ent»᫩eóɍǧ᫾\0ᬇĀ;dኻᬂot;橭nôɆƀfryᬐᬔᬗ;쀀𝕔oäɔ脀©;sŕᬝr;愗Āaoᬥᬩrr;憵ss;朗Ācuᬲᬷr;쀀𝒸Ābpᬼ᭄Ā;eᭁᭂ櫏;櫑Ā;eᭉᭊ櫐;櫒dot;拯΀delprvw᭠᭬᭷ᮂᮬᯔ᯹arrĀlr᭨᭪;椸;椵ɰ᭲\0\0᭵r;拞c;拟arrĀ;p᭿ᮀ憶;椽̀;bcdosᮏᮐᮖᮡᮥᮨ截rcap;橈Āauᮛᮞp;橆p;橊ot;抍r;橅;쀀∪︀Ȁalrv᮵ᮿᯞᯣrrĀ;mᮼᮽ憷;椼yƀevwᯇᯔᯘqɰᯎ\0\0ᯒreã᭳uã᭵ee;拎edge;拏en耻¤䂤earrowĀlrᯮ᯳eft»ᮀight»ᮽeäᯝĀciᰁᰇoninôǷnt;戱lcty;挭ঀAHabcdefhijlorstuwz᰸᰻᰿ᱝᱩᱵᲊᲞᲬᲷ᳻᳿ᴍᵻᶑᶫᶻ᷆᷍rò΁ar;楥Ȁglrs᱈ᱍ᱒᱔ger;怠eth;愸òᄳhĀ;vᱚᱛ怐»ऊūᱡᱧarow;椏aã̕Āayᱮᱳron;䄏;䐴ƀ;ao̲ᱼᲄĀgrʿᲁr;懊tseq;橷ƀglmᲑᲔᲘ耻°䂰ta;䎴ptyv;榱ĀirᲣᲨsht;楿;쀀𝔡arĀlrᲳᲵ»ࣜ»သʀaegsv᳂͸᳖᳜᳠mƀ;oș᳊᳔ndĀ;ș᳑uit;晦amma;䏝in;拲ƀ;io᳧᳨᳸䃷de脀÷;o᳧ᳰntimes;拇nø᳷cy;䑒cɯᴆ\0\0ᴊrn;挞op;挍ʀlptuwᴘᴝᴢᵉᵕlar;䀤f;쀀𝕕ʀ;emps̋ᴭᴷᴽᵂqĀ;d͒ᴳot;扑inus;戸lus;戔quare;抡blebarwedgåúnƀadhᄮᵝᵧownarrowóᲃarpoonĀlrᵲᵶefôᲴighôᲶŢᵿᶅkaro÷གɯᶊ\0\0ᶎrn;挟op;挌ƀcotᶘᶣᶦĀryᶝᶡ;쀀𝒹;䑕l;槶rok;䄑Ādrᶰᶴot;拱iĀ;fᶺ᠖斿Āah᷀᷃ròЩaòྦangle;榦Āci᷒ᷕy;䑟grarr;柿ऀDacdefglmnopqrstuxḁḉḙḸոḼṉṡṾấắẽỡἪἷὄ὎὚ĀDoḆᴴoôᲉĀcsḎḔute耻é䃩ter;橮ȀaioyḢḧḱḶron;䄛rĀ;cḭḮ扖耻ê䃪lon;払;䑍ot;䄗ĀDrṁṅot;扒;쀀𝔢ƀ;rsṐṑṗ檚ave耻è䃨Ā;dṜṝ檖ot;檘Ȁ;ilsṪṫṲṴ檙nters;揧;愓Ā;dṹṺ檕ot;檗ƀapsẅẉẗcr;䄓tyƀ;svẒẓẕ戅et»ẓpĀ1;ẝẤĳạả;怄;怅怃ĀgsẪẬ;䅋p;怂ĀgpẴẸon;䄙f;쀀𝕖ƀalsỄỎỒrĀ;sỊị拕l;槣us;橱iƀ;lvỚớở䎵on»ớ;䏵ȀcsuvỪỳἋἣĀioữḱrc»Ḯɩỹ\0\0ỻíՈantĀglἂἆtr»ṝess»Ṻƀaeiἒ἖Ἒls;䀽st;扟vĀ;DȵἠD;橸parsl;槥ĀDaἯἳot;打rr;楱ƀcdiἾὁỸr;愯oô͒ĀahὉὋ;䎷耻ð䃰Āmrὓὗl耻ë䃫o;悬ƀcipὡὤὧl;䀡sôծĀeoὬὴctatioîՙnentialåչৡᾒ\0ᾞ\0ᾡᾧ\0\0ῆῌ\0ΐ\0ῦῪ \0 ⁚llingdotseñṄy;䑄male;晀ƀilrᾭᾳ῁lig;耀ﬃɩᾹ\0\0᾽g;耀ﬀig;耀ﬄ;쀀𝔣lig;耀ﬁlig;쀀fjƀaltῙ῜ῡt;晭ig;耀ﬂns;斱of;䆒ǰ΅\0ῳf;쀀𝕗ĀakֿῷĀ;vῼ´拔;櫙artint;樍Āao‌⁕Ācs‑⁒α‚‰‸⁅⁈\0⁐β•‥‧‪‬\0‮耻½䂽;慓耻¼䂼;慕;慙;慛Ƴ‴\0‶;慔;慖ʴ‾⁁\0\0⁃耻¾䂾;慗;慜5;慘ƶ⁌\0⁎;慚;慝8;慞l;恄wn;挢cr;쀀𝒻ࢀEabcdefgijlnorstv₂₉₟₥₰₴⃰⃵⃺⃿℃ℒℸ̗ℾ⅒↞Ā;lٍ₇;檌ƀcmpₐₕ₝ute;䇵maĀ;dₜ᳚䎳;檆reve;䄟Āiy₪₮rc;䄝;䐳ot;䄡Ȁ;lqsؾق₽⃉ƀ;qsؾٌ⃄lanô٥Ȁ;cdl٥⃒⃥⃕c;檩otĀ;o⃜⃝檀Ā;l⃢⃣檂;檄Ā;e⃪⃭쀀⋛︀s;檔r;쀀𝔤Ā;gٳ؛mel;愷cy;䑓Ȁ;Eajٚℌℎℐ;檒;檥;檤ȀEaesℛℝ℩ℴ;扩pĀ;p℣ℤ檊rox»ℤĀ;q℮ℯ檈Ā;q℮ℛim;拧pf;쀀𝕘Āci⅃ⅆr;愊mƀ;el٫ⅎ⅐;檎;檐茀>;cdlqr׮ⅠⅪⅮⅳⅹĀciⅥⅧ;檧r;橺ot;拗Par;榕uest;橼ʀadelsↄⅪ←ٖ↛ǰ↉\0↎proø₞r;楸qĀlqؿ↖lesó₈ií٫Āen↣↭rtneqq;쀀≩︀Å↪ԀAabcefkosy⇄⇇⇱⇵⇺∘∝∯≨≽ròΠȀilmr⇐⇔⇗⇛rsðᒄf»․ilôکĀdr⇠⇤cy;䑊ƀ;cwࣴ⇫⇯ir;楈;憭ar;意irc;䄥ƀalr∁∎∓rtsĀ;u∉∊晥it»∊lip;怦con;抹r;쀀𝔥sĀew∣∩arow;椥arow;椦ʀamopr∺∾≃≞≣rr;懿tht;戻kĀlr≉≓eftarrow;憩ightarrow;憪f;쀀𝕙bar;怕ƀclt≯≴≸r;쀀𝒽asè⇴rok;䄧Ābp⊂⊇ull;恃hen»ᱛૡ⊣\0⊪\0⊸⋅⋎\0⋕⋳\0\0⋸⌢⍧⍢⍿\0⎆⎪⎴cute耻í䃭ƀ;iyݱ⊰⊵rc耻î䃮;䐸Ācx⊼⊿y;䐵cl耻¡䂡ĀfrΟ⋉;쀀𝔦rave耻ì䃬Ȁ;inoܾ⋝⋩⋮Āin⋢⋦nt;樌t;戭fin;槜ta;愩lig;䄳ƀaop⋾⌚⌝ƀcgt⌅⌈⌗r;䄫ƀelpܟ⌏⌓inåގarôܠh;䄱f;抷ed;䆵ʀ;cfotӴ⌬⌱⌽⍁are;愅inĀ;t⌸⌹戞ie;槝doô⌙ʀ;celpݗ⍌⍐⍛⍡al;抺Āgr⍕⍙eróᕣã⍍arhk;樗rod;樼Ȁcgpt⍯⍲⍶⍻y;䑑on;䄯f;쀀𝕚a;䎹uest耻¿䂿Āci⎊⎏r;쀀𝒾nʀ;EdsvӴ⎛⎝⎡ӳ;拹ot;拵Ā;v⎦⎧拴;拳Ā;iݷ⎮lde;䄩ǫ⎸\0⎼cy;䑖l耻ï䃯̀cfmosu⏌⏗⏜⏡⏧⏵Āiy⏑⏕rc;䄵;䐹r;쀀𝔧ath;䈷pf;쀀𝕛ǣ⏬\0⏱r;쀀𝒿rcy;䑘kcy;䑔Ѐacfghjos␋␖␢␧␭␱␵␻ppaĀ;v␓␔䎺;䏰Āey␛␠dil;䄷;䐺r;쀀𝔨reen;䄸cy;䑅cy;䑜pf;쀀𝕜cr;쀀𝓀஀ABEHabcdefghjlmnoprstuv⑰⒁⒆⒍⒑┎┽╚▀♎♞♥♹♽⚚⚲⛘❝❨➋⟀⠁⠒ƀart⑷⑺⑼rò৆òΕail;椛arr;椎Ā;gঔ⒋;檋ar;楢ॣ⒥\0⒪\0⒱\0\0\0\0\0⒵Ⓔ\0ⓆⓈⓍ\0⓹ute;䄺mptyv;榴raîࡌbda;䎻gƀ;dlࢎⓁⓃ;榑åࢎ;檅uo耻«䂫rЀ;bfhlpst࢙ⓞⓦⓩ⓫⓮⓱⓵Ā;f࢝ⓣs;椟s;椝ë≒p;憫l;椹im;楳l;憢ƀ;ae⓿─┄檫il;椙Ā;s┉┊檭;쀀⪭︀ƀabr┕┙┝rr;椌rk;杲Āak┢┬cĀek┨┪;䁻;䁛Āes┱┳;榋lĀdu┹┻;榏;榍Ȁaeuy╆╋╖╘ron;䄾Ādi═╔il;䄼ìࢰâ┩;䐻Ȁcqrs╣╦╭╽a;椶uoĀ;rนᝆĀdu╲╷har;楧shar;楋h;憲ʀ;fgqs▋▌উ◳◿扤tʀahlrt▘▤▷◂◨rrowĀ;t࢙□aé⓶arpoonĀdu▯▴own»њp»०eftarrows;懇ightƀahs◍◖◞rrowĀ;sࣴࢧarpoonó྘quigarro÷⇰hreetimes;拋ƀ;qs▋ও◺lanôবʀ;cdgsব☊☍☝☨c;檨otĀ;o☔☕橿Ā;r☚☛檁;檃Ā;e☢☥쀀⋚︀s;檓ʀadegs☳☹☽♉♋pproøⓆot;拖qĀgq♃♅ôউgtò⒌ôছiíলƀilr♕࣡♚sht;楼;쀀𝔩Ā;Eজ♣;檑š♩♶rĀdu▲♮Ā;l॥♳;楪lk;斄cy;䑙ʀ;achtੈ⚈⚋⚑⚖rò◁orneòᴈard;楫ri;旺Āio⚟⚤dot;䅀ustĀ;a⚬⚭掰che»⚭ȀEaes⚻⚽⛉⛔;扨pĀ;p⛃⛄檉rox»⛄Ā;q⛎⛏檇Ā;q⛎⚻im;拦Ѐabnoptwz⛩⛴⛷✚✯❁❇❐Ānr⛮⛱g;柬r;懽rëࣁgƀlmr⛿✍✔eftĀar০✇ightá৲apsto;柼ightá৽parrowĀlr✥✩efô⓭ight;憬ƀafl✶✹✽r;榅;쀀𝕝us;樭imes;樴š❋❏st;戗áፎƀ;ef❗❘᠀旊nge»❘arĀ;l❤❥䀨t;榓ʀachmt❳❶❼➅➇ròࢨorneòᶌarĀ;d྘➃;業;怎ri;抿̀achiqt➘➝ੀ➢➮➻quo;怹r;쀀𝓁mƀ;egল➪➬;檍;檏Ābu┪➳oĀ;rฟ➹;怚rok;䅂萀<;cdhilqrࠫ⟒☹⟜⟠⟥⟪⟰Āci⟗⟙;檦r;橹reå◲mes;拉arr;楶uest;橻ĀPi⟵⟹ar;榖ƀ;ef⠀भ᠛旃rĀdu⠇⠍shar;楊har;楦Āen⠗⠡rtneqq;쀀≨︀Å⠞܀Dacdefhilnopsu⡀⡅⢂⢎⢓⢠⢥⢨⣚⣢⣤ઃ⣳⤂Dot;戺Ȁclpr⡎⡒⡣⡽r耻¯䂯Āet⡗⡙;時Ā;e⡞⡟朠se»⡟Ā;sျ⡨toȀ;dluျ⡳⡷⡻owîҌefôएðᏑker;斮Āoy⢇⢌mma;権;䐼ash;怔asuredangle»ᘦr;쀀𝔪o;愧ƀcdn⢯⢴⣉ro耻µ䂵Ȁ;acdᑤ⢽⣀⣄sôᚧir;櫰ot肻·Ƶusƀ;bd⣒ᤃ⣓戒Ā;uᴼ⣘;横ţ⣞⣡p;櫛ò−ðઁĀdp⣩⣮els;抧f;쀀𝕞Āct⣸⣽r;쀀𝓂pos»ᖝƀ;lm⤉⤊⤍䎼timap;抸ఀGLRVabcdefghijlmoprstuvw⥂⥓⥾⦉⦘⧚⧩⨕⨚⩘⩝⪃⪕⪤⪨⬄⬇⭄⭿⮮ⰴⱧⱼ⳩Āgt⥇⥋;쀀⋙̸Ā;v⥐௏쀀≫⃒ƀelt⥚⥲⥶ftĀar⥡⥧rrow;懍ightarrow;懎;쀀⋘̸Ā;v⥻ే쀀≪⃒ightarrow;懏ĀDd⦎⦓ash;抯ash;抮ʀbcnpt⦣⦧⦬⦱⧌la»˞ute;䅄g;쀀∠⃒ʀ;Eiop඄⦼⧀⧅⧈;쀀⩰̸d;쀀≋̸s;䅉roø඄urĀ;a⧓⧔普lĀ;s⧓ସǳ⧟\0⧣p肻 ଷmpĀ;e௹ఀʀaeouy⧴⧾⨃⨐⨓ǰ⧹\0⧻;橃on;䅈dil;䅆ngĀ;dൾ⨊ot;쀀⩭̸p;橂;䐽ash;怓΀;Aadqsxஒ⨩⨭⨻⩁⩅⩐rr;懗rĀhr⨳⨶k;椤Ā;oᏲᏰot;쀀≐̸uiöୣĀei⩊⩎ar;椨í஘istĀ;s஠டr;쀀𝔫ȀEest௅⩦⩹⩼ƀ;qs஼⩭௡ƀ;qs஼௅⩴lanô௢ií௪Ā;rஶ⪁»ஷƀAap⪊⪍⪑rò⥱rr;憮ar;櫲ƀ;svྍ⪜ྌĀ;d⪡⪢拼;拺cy;䑚΀AEadest⪷⪺⪾⫂⫅⫶⫹rò⥦;쀀≦̸rr;憚r;急Ȁ;fqs఻⫎⫣⫯tĀar⫔⫙rro÷⫁ightarro÷⪐ƀ;qs఻⪺⫪lanôౕĀ;sౕ⫴»శiíౝĀ;rవ⫾iĀ;eచథiäඐĀpt⬌⬑f;쀀𝕟膀¬;in⬙⬚⬶䂬nȀ;Edvஉ⬤⬨⬮;쀀⋹̸ot;쀀⋵̸ǡஉ⬳⬵;拷;拶iĀ;vಸ⬼ǡಸ⭁⭃;拾;拽ƀaor⭋⭣⭩rȀ;ast୻⭕⭚⭟lleì୻l;쀀⫽⃥;쀀∂̸lint;樔ƀ;ceಒ⭰⭳uåಥĀ;cಘ⭸Ā;eಒ⭽ñಘȀAait⮈⮋⮝⮧rò⦈rrƀ;cw⮔⮕⮙憛;쀀⤳̸;쀀↝̸ghtarrow»⮕riĀ;eೋೖ΀chimpqu⮽⯍⯙⬄୸⯤⯯Ȁ;cerല⯆ഷ⯉uå൅;쀀𝓃ortɭ⬅\0\0⯖ará⭖mĀ;e൮⯟Ā;q൴൳suĀbp⯫⯭å೸åഋƀbcp⯶ⰑⰙȀ;Ees⯿ⰀഢⰄ抄;쀀⫅̸etĀ;eഛⰋqĀ;qണⰀcĀ;eലⰗñസȀ;EesⰢⰣൟⰧ抅;쀀⫆̸etĀ;e൘ⰮqĀ;qൠⰣȀgilrⰽⰿⱅⱇìௗlde耻ñ䃱çృiangleĀlrⱒⱜeftĀ;eచⱚñదightĀ;eೋⱥñ೗Ā;mⱬⱭ䎽ƀ;esⱴⱵⱹ䀣ro;愖p;怇ҀDHadgilrsⲏⲔⲙⲞⲣⲰⲶⳓⳣash;抭arr;椄p;쀀≍⃒ash;抬ĀetⲨⲬ;쀀≥⃒;쀀>⃒nfin;槞ƀAetⲽⳁⳅrr;椂;쀀≤⃒Ā;rⳊⳍ쀀<⃒ie;쀀⊴⃒ĀAtⳘⳜrr;椃rie;쀀⊵⃒im;쀀∼⃒ƀAan⳰⳴ⴂrr;懖rĀhr⳺⳽k;椣Ā;oᏧᏥear;椧ቓ᪕\0\0\0\0\0\0\0\0\0\0\0\0\0ⴭ\0ⴸⵈⵠⵥ⵲ⶄᬇ\0\0ⶍⶫ\0ⷈⷎ\0ⷜ⸙⸫⸾⹃Ācsⴱ᪗ute耻ó䃳ĀiyⴼⵅrĀ;c᪞ⵂ耻ô䃴;䐾ʀabios᪠ⵒⵗǈⵚlac;䅑v;樸old;榼lig;䅓Ācr⵩⵭ir;榿;쀀𝔬ͯ⵹\0\0⵼\0ⶂn;䋛ave耻ò䃲;槁Ābmⶈ෴ar;榵Ȁacitⶕ⶘ⶥⶨrò᪀Āir⶝ⶠr;榾oss;榻nå๒;槀ƀaeiⶱⶵⶹcr;䅍ga;䏉ƀcdnⷀⷅǍron;䎿;榶pf;쀀𝕠ƀaelⷔ⷗ǒr;榷rp;榹΀;adiosvⷪⷫⷮ⸈⸍⸐⸖戨rò᪆Ȁ;efmⷷⷸ⸂⸅橝rĀ;oⷾⷿ愴f»ⷿ耻ª䂪耻º䂺gof;抶r;橖lope;橗;橛ƀclo⸟⸡⸧ò⸁ash耻ø䃸l;折iŬⸯ⸴de耻õ䃵esĀ;aǛ⸺s;樶ml耻ö䃶bar;挽ૡ⹞\0⹽\0⺀⺝\0⺢⺹\0\0⻋ຜ\0⼓\0\0⼫⾼\0⿈rȀ;astЃ⹧⹲຅脀¶;l⹭⹮䂶leìЃɩ⹸\0\0⹻m;櫳;櫽y;䐿rʀcimpt⺋⺏⺓ᡥ⺗nt;䀥od;䀮il;怰enk;怱r;쀀𝔭ƀimo⺨⺰⺴Ā;v⺭⺮䏆;䏕maô੶ne;明ƀ;tv⺿⻀⻈䏀chfork»´;䏖Āau⻏⻟nĀck⻕⻝kĀ;h⇴⻛;愎ö⇴sҀ;abcdemst⻳⻴ᤈ⻹⻽⼄⼆⼊⼎䀫cir;樣ir;樢Āouᵀ⼂;樥;橲n肻±ຝim;樦wo;樧ƀipu⼙⼠⼥ntint;樕f;쀀𝕡nd耻£䂣Ԁ;Eaceinosu່⼿⽁⽄⽇⾁⾉⾒⽾⾶;檳p;檷uå໙Ā;c໎⽌̀;acens່⽙⽟⽦⽨⽾pproø⽃urlyeñ໙ñ໎ƀaes⽯⽶⽺pprox;檹qq;檵im;拨iíໟmeĀ;s⾈ຮ怲ƀEas⽸⾐⽺ð⽵ƀdfp໬⾙⾯ƀals⾠⾥⾪lar;挮ine;挒urf;挓Ā;t໻⾴ï໻rel;抰Āci⿀⿅r;쀀𝓅;䏈ncsp;怈̀fiopsu⿚⋢⿟⿥⿫⿱r;쀀𝔮pf;쀀𝕢rime;恗cr;쀀𝓆ƀaeo⿸〉〓tĀei⿾々rnionóڰnt;樖stĀ;e【】䀿ñἙô༔઀ABHabcdefhilmnoprstux぀けさすムㄎㄫㅇㅢㅲㆎ㈆㈕㈤㈩㉘㉮㉲㊐㊰㊷ƀartぇおがròႳòϝail;検aròᱥar;楤΀cdenqrtとふへみわゔヌĀeuねぱ;쀀∽̱te;䅕iãᅮmptyv;榳gȀ;del࿑らるろ;榒;榥å࿑uo耻»䂻rր;abcfhlpstw࿜ガクシスゼゾダッデナp;極Ā;f࿠ゴs;椠;椳s;椞ë≝ð✮l;楅im;楴l;憣;憝Āaiパフil;椚oĀ;nホボ戶aló༞ƀabrョリヮrò៥rk;杳ĀakンヽcĀekヹ・;䁽;䁝Āes㄂㄄;榌lĀduㄊㄌ;榎;榐Ȁaeuyㄗㄜㄧㄩron;䅙Ādiㄡㄥil;䅗ì࿲âヺ;䑀Ȁclqsㄴㄷㄽㅄa;椷dhar;楩uoĀ;rȎȍh;憳ƀacgㅎㅟངlȀ;ipsླྀㅘㅛႜnåႻarôྩt;断ƀilrㅩဣㅮsht;楽;쀀𝔯ĀaoㅷㆆrĀduㅽㅿ»ѻĀ;l႑ㆄ;楬Ā;vㆋㆌ䏁;䏱ƀgns㆕ㇹㇼht̀ahlrstㆤㆰ㇂㇘㇤㇮rrowĀ;t࿜ㆭaéトarpoonĀduㆻㆿowîㅾp»႒eftĀah㇊㇐rrowó࿪arpoonóՑightarrows;應quigarro÷ニhreetimes;拌g;䋚ingdotseñἲƀahm㈍㈐㈓rò࿪aòՑ;怏oustĀ;a㈞㈟掱che»㈟mid;櫮Ȁabpt㈲㈽㉀㉒Ānr㈷㈺g;柭r;懾rëဃƀafl㉇㉊㉎r;榆;쀀𝕣us;樮imes;樵Āap㉝㉧rĀ;g㉣㉤䀩t;榔olint;樒arò㇣Ȁachq㉻㊀Ⴜ㊅quo;怺r;쀀𝓇Ābu・㊊oĀ;rȔȓƀhir㊗㊛㊠reåㇸmes;拊iȀ;efl㊪ၙᠡ㊫方tri;槎luhar;楨;愞ൡ㋕㋛㋟㌬㌸㍱\0㍺㎤\0\0㏬㏰\0㐨㑈㑚㒭㒱㓊㓱\0㘖\0\0㘳cute;䅛quï➺Ԁ;Eaceinpsyᇭ㋳㋵㋿㌂㌋㌏㌟㌦㌩;檴ǰ㋺\0㋼;檸on;䅡uåᇾĀ;dᇳ㌇il;䅟rc;䅝ƀEas㌖㌘㌛;檶p;檺im;择olint;樓iíሄ;䑁otƀ;be㌴ᵇ㌵担;橦΀Aacmstx㍆㍊㍗㍛㍞㍣㍭rr;懘rĀhr㍐㍒ë∨Ā;oਸ਼਴t耻§䂧i;䀻war;椩mĀin㍩ðnuóñt;朶rĀ;o㍶⁕쀀𝔰Ȁacoy㎂㎆㎑㎠rp;景Āhy㎋㎏cy;䑉;䑈rtɭ㎙\0\0㎜iäᑤaraì⹯耻­䂭Āgm㎨㎴maƀ;fv㎱㎲㎲䏃;䏂Ѐ;deglnprካ㏅㏉㏎㏖㏞㏡㏦ot;橪Ā;q኱ኰĀ;E㏓㏔檞;檠Ā;E㏛㏜檝;檟e;扆lus;樤arr;楲aròᄽȀaeit㏸㐈㐏㐗Āls㏽㐄lsetmé㍪hp;樳parsl;槤Ādlᑣ㐔e;挣Ā;e㐜㐝檪Ā;s㐢㐣檬;쀀⪬︀ƀflp㐮㐳㑂tcy;䑌Ā;b㐸㐹䀯Ā;a㐾㐿槄r;挿f;쀀𝕤aĀdr㑍ЂesĀ;u㑔㑕晠it»㑕ƀcsu㑠㑹㒟Āau㑥㑯pĀ;sᆈ㑫;쀀⊓︀pĀ;sᆴ㑵;쀀⊔︀uĀbp㑿㒏ƀ;esᆗᆜ㒆etĀ;eᆗ㒍ñᆝƀ;esᆨᆭ㒖etĀ;eᆨ㒝ñᆮƀ;afᅻ㒦ְrť㒫ֱ»ᅼaròᅈȀcemt㒹㒾㓂㓅r;쀀𝓈tmîñiì㐕aræᆾĀar㓎㓕rĀ;f㓔ឿ昆Āan㓚㓭ightĀep㓣㓪psiloîỠhé⺯s»⡒ʀbcmnp㓻㕞ሉ㖋㖎Ҁ;Edemnprs㔎㔏㔑㔕㔞㔣㔬㔱㔶抂;櫅ot;檽Ā;dᇚ㔚ot;櫃ult;櫁ĀEe㔨㔪;櫋;把lus;檿arr;楹ƀeiu㔽㕒㕕tƀ;en㔎㕅㕋qĀ;qᇚ㔏eqĀ;q㔫㔨m;櫇Ābp㕚㕜;櫕;櫓c̀;acensᇭ㕬㕲㕹㕻㌦pproø㋺urlyeñᇾñᇳƀaes㖂㖈㌛pproø㌚qñ㌗g;晪ڀ123;Edehlmnps㖩㖬㖯ሜ㖲㖴㗀㗉㗕㗚㗟㗨㗭耻¹䂹耻²䂲耻³䂳;櫆Āos㖹㖼t;檾ub;櫘Ā;dሢ㗅ot;櫄sĀou㗏㗒l;柉b;櫗arr;楻ult;櫂ĀEe㗤㗦;櫌;抋lus;櫀ƀeiu㗴㘉㘌tƀ;enሜ㗼㘂qĀ;qሢ㖲eqĀ;q㗧㗤m;櫈Ābp㘑㘓;櫔;櫖ƀAan㘜㘠㘭rr;懙rĀhr㘦㘨ë∮Ā;oਫ਩war;椪lig耻ß䃟௡㙑㙝㙠ዎ㙳㙹\0㙾㛂\0\0\0\0\0㛛㜃\0㜉㝬\0\0\0㞇ɲ㙖\0\0㙛get;挖;䏄rë๟ƀaey㙦㙫㙰ron;䅥dil;䅣;䑂lrec;挕r;쀀𝔱Ȁeiko㚆㚝㚵㚼ǲ㚋\0㚑eĀ4fኄኁaƀ;sv㚘㚙㚛䎸ym;䏑Ācn㚢㚲kĀas㚨㚮pproø዁im»ኬsðኞĀas㚺㚮ð዁rn耻þ䃾Ǭ̟㛆⋧es膀×;bd㛏㛐㛘䃗Ā;aᤏ㛕r;樱;樰ƀeps㛡㛣㜀á⩍Ȁ;bcf҆㛬㛰㛴ot;挶ir;櫱Ā;o㛹㛼쀀𝕥rk;櫚á㍢rime;怴ƀaip㜏㜒㝤dåቈ΀adempst㜡㝍㝀㝑㝗㝜㝟ngleʀ;dlqr㜰㜱㜶㝀㝂斵own»ᶻeftĀ;e⠀㜾ñम;扜ightĀ;e㊪㝋ñၚot;旬inus;樺lus;樹b;槍ime;樻ezium;揢ƀcht㝲㝽㞁Āry㝷㝻;쀀𝓉;䑆cy;䑛rok;䅧Āio㞋㞎xô᝷headĀlr㞗㞠eftarro÷ࡏightarrow»ཝऀAHabcdfghlmoprstuw㟐㟓㟗㟤㟰㟼㠎㠜㠣㠴㡑㡝㡫㢩㣌㣒㣪㣶ròϭar;楣Ācr㟜㟢ute耻ú䃺òᅐrǣ㟪\0㟭y;䑞ve;䅭Āiy㟵㟺rc耻û䃻;䑃ƀabh㠃㠆㠋ròᎭlac;䅱aòᏃĀir㠓㠘sht;楾;쀀𝔲rave耻ù䃹š㠧㠱rĀlr㠬㠮»ॗ»ႃlk;斀Āct㠹㡍ɯ㠿\0\0㡊rnĀ;e㡅㡆挜r»㡆op;挏ri;旸Āal㡖㡚cr;䅫肻¨͉Āgp㡢㡦on;䅳f;쀀𝕦̀adhlsuᅋ㡸㡽፲㢑㢠ownáᎳarpoonĀlr㢈㢌efô㠭ighô㠯iƀ;hl㢙㢚㢜䏅»ᏺon»㢚parrows;懈ƀcit㢰㣄㣈ɯ㢶\0\0㣁rnĀ;e㢼㢽挝r»㢽op;挎ng;䅯ri;旹cr;쀀𝓊ƀdir㣙㣝㣢ot;拰lde;䅩iĀ;f㜰㣨»᠓Āam㣯㣲rò㢨l耻ü䃼angle;榧ހABDacdeflnoprsz㤜㤟㤩㤭㦵㦸㦽㧟㧤㧨㧳㧹㧽㨁㨠ròϷarĀ;v㤦㤧櫨;櫩asèϡĀnr㤲㤷grt;榜΀eknprst㓣㥆㥋㥒㥝㥤㦖appá␕othinçẖƀhir㓫⻈㥙opô⾵Ā;hᎷ㥢ïㆍĀiu㥩㥭gmá㎳Ābp㥲㦄setneqĀ;q㥽㦀쀀⊊︀;쀀⫋︀setneqĀ;q㦏㦒쀀⊋︀;쀀⫌︀Āhr㦛㦟etá㚜iangleĀlr㦪㦯eft»थight»ၑy;䐲ash»ံƀelr㧄㧒㧗ƀ;beⷪ㧋㧏ar;抻q;扚lip;拮Ābt㧜ᑨaòᑩr;쀀𝔳tré㦮suĀbp㧯㧱»ജ»൙pf;쀀𝕧roð໻tré㦴Ācu㨆㨋r;쀀𝓋Ābp㨐㨘nĀEe㦀㨖»㥾nĀEe㦒㨞»㦐igzag;榚΀cefoprs㨶㨻㩖㩛㩔㩡㩪irc;䅵Ādi㩀㩑Ābg㩅㩉ar;機eĀ;qᗺ㩏;扙erp;愘r;쀀𝔴pf;쀀𝕨Ā;eᑹ㩦atèᑹcr;쀀𝓌ૣណ㪇\0㪋\0㪐㪛\0\0㪝㪨㪫㪯\0\0㫃㫎\0㫘ៜ៟tré៑r;쀀𝔵ĀAa㪔㪗ròσrò৶;䎾ĀAa㪡㪤ròθrò৫að✓is;拻ƀdptឤ㪵㪾Āfl㪺ឩ;쀀𝕩imåឲĀAa㫇㫊ròώròਁĀcq㫒ីr;쀀𝓍Āpt៖㫜ré។Ѐacefiosu㫰㫽㬈㬌㬑㬕㬛㬡cĀuy㫶㫻te耻ý䃽;䑏Āiy㬂㬆rc;䅷;䑋n耻¥䂥r;쀀𝔶cy;䑗pf;쀀𝕪cr;쀀𝓎Ācm㬦㬩y;䑎l耻ÿ䃿Ԁacdefhiosw㭂㭈㭔㭘㭤㭩㭭㭴㭺㮀cute;䅺Āay㭍㭒ron;䅾;䐷ot;䅼Āet㭝㭡træᕟa;䎶r;쀀𝔷cy;䐶grarr;懝pf;쀀𝕫cr;쀀𝓏Ājn㮅㮇;怍j;怌'.split("").map((c) => c.charCodeAt(0))
  );
  const xmlDecodeTree$1 = new Uint16Array(
    // prettier-ignore
    "Ȁaglq	\x1Bɭ\0\0p;䀦os;䀧t;䀾t;䀼uot;䀢".split("").map((c) => c.charCodeAt(0))
  );
  var _a$1;
  const decodeMap$1 = /* @__PURE__ */ new Map([
    [0, 65533],
    // C1 Unicode control character reference replacements
    [128, 8364],
    [130, 8218],
    [131, 402],
    [132, 8222],
    [133, 8230],
    [134, 8224],
    [135, 8225],
    [136, 710],
    [137, 8240],
    [138, 352],
    [139, 8249],
    [140, 338],
    [142, 381],
    [145, 8216],
    [146, 8217],
    [147, 8220],
    [148, 8221],
    [149, 8226],
    [150, 8211],
    [151, 8212],
    [152, 732],
    [153, 8482],
    [154, 353],
    [155, 8250],
    [156, 339],
    [158, 382],
    [159, 376]
  ]);
  const fromCodePoint$2 = (
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, node/no-unsupported-features/es-builtins
    (_a$1 = String.fromCodePoint) !== null && _a$1 !== void 0 ? _a$1 : function(codePoint) {
      let output = "";
      if (codePoint > 65535) {
        codePoint -= 65536;
        output += String.fromCharCode(codePoint >>> 10 & 1023 | 55296);
        codePoint = 56320 | codePoint & 1023;
      }
      output += String.fromCharCode(codePoint);
      return output;
    }
  );
  function replaceCodePoint$1(codePoint) {
    var _a2;
    if (codePoint >= 55296 && codePoint <= 57343 || codePoint > 1114111) {
      return 65533;
    }
    return (_a2 = decodeMap$1.get(codePoint)) !== null && _a2 !== void 0 ? _a2 : codePoint;
  }
  var CharCodes$1;
  (function(CharCodes2) {
    CharCodes2[CharCodes2["NUM"] = 35] = "NUM";
    CharCodes2[CharCodes2["SEMI"] = 59] = "SEMI";
    CharCodes2[CharCodes2["EQUALS"] = 61] = "EQUALS";
    CharCodes2[CharCodes2["ZERO"] = 48] = "ZERO";
    CharCodes2[CharCodes2["NINE"] = 57] = "NINE";
    CharCodes2[CharCodes2["LOWER_A"] = 97] = "LOWER_A";
    CharCodes2[CharCodes2["LOWER_F"] = 102] = "LOWER_F";
    CharCodes2[CharCodes2["LOWER_X"] = 120] = "LOWER_X";
    CharCodes2[CharCodes2["LOWER_Z"] = 122] = "LOWER_Z";
    CharCodes2[CharCodes2["UPPER_A"] = 65] = "UPPER_A";
    CharCodes2[CharCodes2["UPPER_F"] = 70] = "UPPER_F";
    CharCodes2[CharCodes2["UPPER_Z"] = 90] = "UPPER_Z";
  })(CharCodes$1 || (CharCodes$1 = {}));
  const TO_LOWER_BIT$1 = 32;
  var BinTrieFlags$1;
  (function(BinTrieFlags2) {
    BinTrieFlags2[BinTrieFlags2["VALUE_LENGTH"] = 49152] = "VALUE_LENGTH";
    BinTrieFlags2[BinTrieFlags2["BRANCH_LENGTH"] = 16256] = "BRANCH_LENGTH";
    BinTrieFlags2[BinTrieFlags2["JUMP_TABLE"] = 127] = "JUMP_TABLE";
  })(BinTrieFlags$1 || (BinTrieFlags$1 = {}));
  function isNumber$1(code2) {
    return code2 >= CharCodes$1.ZERO && code2 <= CharCodes$1.NINE;
  }
  function isHexadecimalCharacter$1(code2) {
    return code2 >= CharCodes$1.UPPER_A && code2 <= CharCodes$1.UPPER_F || code2 >= CharCodes$1.LOWER_A && code2 <= CharCodes$1.LOWER_F;
  }
  function isAsciiAlphaNumeric$1(code2) {
    return code2 >= CharCodes$1.UPPER_A && code2 <= CharCodes$1.UPPER_Z || code2 >= CharCodes$1.LOWER_A && code2 <= CharCodes$1.LOWER_Z || isNumber$1(code2);
  }
  function isEntityInAttributeInvalidEnd$1(code2) {
    return code2 === CharCodes$1.EQUALS || isAsciiAlphaNumeric$1(code2);
  }
  var EntityDecoderState$1;
  (function(EntityDecoderState2) {
    EntityDecoderState2[EntityDecoderState2["EntityStart"] = 0] = "EntityStart";
    EntityDecoderState2[EntityDecoderState2["NumericStart"] = 1] = "NumericStart";
    EntityDecoderState2[EntityDecoderState2["NumericDecimal"] = 2] = "NumericDecimal";
    EntityDecoderState2[EntityDecoderState2["NumericHex"] = 3] = "NumericHex";
    EntityDecoderState2[EntityDecoderState2["NamedEntity"] = 4] = "NamedEntity";
  })(EntityDecoderState$1 || (EntityDecoderState$1 = {}));
  var DecodingMode$1;
  (function(DecodingMode2) {
    DecodingMode2[DecodingMode2["Legacy"] = 0] = "Legacy";
    DecodingMode2[DecodingMode2["Strict"] = 1] = "Strict";
    DecodingMode2[DecodingMode2["Attribute"] = 2] = "Attribute";
  })(DecodingMode$1 || (DecodingMode$1 = {}));
  let EntityDecoder$1 = class EntityDecoder {
    constructor(decodeTree, emitCodePoint, errors2) {
      this.decodeTree = decodeTree;
      this.emitCodePoint = emitCodePoint;
      this.errors = errors2;
      this.state = EntityDecoderState$1.EntityStart;
      this.consumed = 1;
      this.result = 0;
      this.treeIndex = 0;
      this.excess = 1;
      this.decodeMode = DecodingMode$1.Strict;
    }
    /** Resets the instance to make it reusable. */
    startEntity(decodeMode) {
      this.decodeMode = decodeMode;
      this.state = EntityDecoderState$1.EntityStart;
      this.result = 0;
      this.treeIndex = 0;
      this.excess = 1;
      this.consumed = 1;
    }
    /**
     * Write an entity to the decoder. This can be called multiple times with partial entities.
     * If the entity is incomplete, the decoder will return -1.
     *
     * Mirrors the implementation of `getDecoder`, but with the ability to stop decoding if the
     * entity is incomplete, and resume when the next string is written.
     *
     * @param string The string containing the entity (or a continuation of the entity).
     * @param offset The offset at which the entity begins. Should be 0 if this is not the first call.
     * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
     */
    write(str, offset) {
      switch (this.state) {
        case EntityDecoderState$1.EntityStart: {
          if (str.charCodeAt(offset) === CharCodes$1.NUM) {
            this.state = EntityDecoderState$1.NumericStart;
            this.consumed += 1;
            return this.stateNumericStart(str, offset + 1);
          }
          this.state = EntityDecoderState$1.NamedEntity;
          return this.stateNamedEntity(str, offset);
        }
        case EntityDecoderState$1.NumericStart: {
          return this.stateNumericStart(str, offset);
        }
        case EntityDecoderState$1.NumericDecimal: {
          return this.stateNumericDecimal(str, offset);
        }
        case EntityDecoderState$1.NumericHex: {
          return this.stateNumericHex(str, offset);
        }
        case EntityDecoderState$1.NamedEntity: {
          return this.stateNamedEntity(str, offset);
        }
      }
    }
    /**
     * Switches between the numeric decimal and hexadecimal states.
     *
     * Equivalent to the `Numeric character reference state` in the HTML spec.
     *
     * @param str The string containing the entity (or a continuation of the entity).
     * @param offset The current offset.
     * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
     */
    stateNumericStart(str, offset) {
      if (offset >= str.length) {
        return -1;
      }
      if ((str.charCodeAt(offset) | TO_LOWER_BIT$1) === CharCodes$1.LOWER_X) {
        this.state = EntityDecoderState$1.NumericHex;
        this.consumed += 1;
        return this.stateNumericHex(str, offset + 1);
      }
      this.state = EntityDecoderState$1.NumericDecimal;
      return this.stateNumericDecimal(str, offset);
    }
    addToNumericResult(str, start, end2, base2) {
      if (start !== end2) {
        const digitCount = end2 - start;
        this.result = this.result * Math.pow(base2, digitCount) + parseInt(str.substr(start, digitCount), base2);
        this.consumed += digitCount;
      }
    }
    /**
     * Parses a hexadecimal numeric entity.
     *
     * Equivalent to the `Hexademical character reference state` in the HTML spec.
     *
     * @param str The string containing the entity (or a continuation of the entity).
     * @param offset The current offset.
     * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
     */
    stateNumericHex(str, offset) {
      const startIdx = offset;
      while (offset < str.length) {
        const char = str.charCodeAt(offset);
        if (isNumber$1(char) || isHexadecimalCharacter$1(char)) {
          offset += 1;
        } else {
          this.addToNumericResult(str, startIdx, offset, 16);
          return this.emitNumericEntity(char, 3);
        }
      }
      this.addToNumericResult(str, startIdx, offset, 16);
      return -1;
    }
    /**
     * Parses a decimal numeric entity.
     *
     * Equivalent to the `Decimal character reference state` in the HTML spec.
     *
     * @param str The string containing the entity (or a continuation of the entity).
     * @param offset The current offset.
     * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
     */
    stateNumericDecimal(str, offset) {
      const startIdx = offset;
      while (offset < str.length) {
        const char = str.charCodeAt(offset);
        if (isNumber$1(char)) {
          offset += 1;
        } else {
          this.addToNumericResult(str, startIdx, offset, 10);
          return this.emitNumericEntity(char, 2);
        }
      }
      this.addToNumericResult(str, startIdx, offset, 10);
      return -1;
    }
    /**
     * Validate and emit a numeric entity.
     *
     * Implements the logic from the `Hexademical character reference start
     * state` and `Numeric character reference end state` in the HTML spec.
     *
     * @param lastCp The last code point of the entity. Used to see if the
     *               entity was terminated with a semicolon.
     * @param expectedLength The minimum number of characters that should be
     *                       consumed. Used to validate that at least one digit
     *                       was consumed.
     * @returns The number of characters that were consumed.
     */
    emitNumericEntity(lastCp, expectedLength) {
      var _a2;
      if (this.consumed <= expectedLength) {
        (_a2 = this.errors) === null || _a2 === void 0 ? void 0 : _a2.absenceOfDigitsInNumericCharacterReference(this.consumed);
        return 0;
      }
      if (lastCp === CharCodes$1.SEMI) {
        this.consumed += 1;
      } else if (this.decodeMode === DecodingMode$1.Strict) {
        return 0;
      }
      this.emitCodePoint(replaceCodePoint$1(this.result), this.consumed);
      if (this.errors) {
        if (lastCp !== CharCodes$1.SEMI) {
          this.errors.missingSemicolonAfterCharacterReference();
        }
        this.errors.validateNumericCharacterReference(this.result);
      }
      return this.consumed;
    }
    /**
     * Parses a named entity.
     *
     * Equivalent to the `Named character reference state` in the HTML spec.
     *
     * @param str The string containing the entity (or a continuation of the entity).
     * @param offset The current offset.
     * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
     */
    stateNamedEntity(str, offset) {
      const { decodeTree } = this;
      let current = decodeTree[this.treeIndex];
      let valueLength = (current & BinTrieFlags$1.VALUE_LENGTH) >> 14;
      for (; offset < str.length; offset++, this.excess++) {
        const char = str.charCodeAt(offset);
        this.treeIndex = determineBranch$1(decodeTree, current, this.treeIndex + Math.max(1, valueLength), char);
        if (this.treeIndex < 0) {
          return this.result === 0 || // If we are parsing an attribute
          this.decodeMode === DecodingMode$1.Attribute && // We shouldn't have consumed any characters after the entity,
          (valueLength === 0 || // And there should be no invalid characters.
          isEntityInAttributeInvalidEnd$1(char)) ? 0 : this.emitNotTerminatedNamedEntity();
        }
        current = decodeTree[this.treeIndex];
        valueLength = (current & BinTrieFlags$1.VALUE_LENGTH) >> 14;
        if (valueLength !== 0) {
          if (char === CharCodes$1.SEMI) {
            return this.emitNamedEntityData(this.treeIndex, valueLength, this.consumed + this.excess);
          }
          if (this.decodeMode !== DecodingMode$1.Strict) {
            this.result = this.treeIndex;
            this.consumed += this.excess;
            this.excess = 0;
          }
        }
      }
      return -1;
    }
    /**
     * Emit a named entity that was not terminated with a semicolon.
     *
     * @returns The number of characters consumed.
     */
    emitNotTerminatedNamedEntity() {
      var _a2;
      const { result, decodeTree } = this;
      const valueLength = (decodeTree[result] & BinTrieFlags$1.VALUE_LENGTH) >> 14;
      this.emitNamedEntityData(result, valueLength, this.consumed);
      (_a2 = this.errors) === null || _a2 === void 0 ? void 0 : _a2.missingSemicolonAfterCharacterReference();
      return this.consumed;
    }
    /**
     * Emit a named entity.
     *
     * @param result The index of the entity in the decode tree.
     * @param valueLength The number of bytes in the entity.
     * @param consumed The number of characters consumed.
     *
     * @returns The number of characters consumed.
     */
    emitNamedEntityData(result, valueLength, consumed) {
      const { decodeTree } = this;
      this.emitCodePoint(valueLength === 1 ? decodeTree[result] & ~BinTrieFlags$1.VALUE_LENGTH : decodeTree[result + 1], consumed);
      if (valueLength === 3) {
        this.emitCodePoint(decodeTree[result + 2], consumed);
      }
      return consumed;
    }
    /**
     * Signal to the parser that the end of the input was reached.
     *
     * Remaining data will be emitted and relevant errors will be produced.
     *
     * @returns The number of characters consumed.
     */
    end() {
      var _a2;
      switch (this.state) {
        case EntityDecoderState$1.NamedEntity: {
          return this.result !== 0 && (this.decodeMode !== DecodingMode$1.Attribute || this.result === this.treeIndex) ? this.emitNotTerminatedNamedEntity() : 0;
        }
        // Otherwise, emit a numeric entity if we have one.
        case EntityDecoderState$1.NumericDecimal: {
          return this.emitNumericEntity(0, 2);
        }
        case EntityDecoderState$1.NumericHex: {
          return this.emitNumericEntity(0, 3);
        }
        case EntityDecoderState$1.NumericStart: {
          (_a2 = this.errors) === null || _a2 === void 0 ? void 0 : _a2.absenceOfDigitsInNumericCharacterReference(this.consumed);
          return 0;
        }
        case EntityDecoderState$1.EntityStart: {
          return 0;
        }
      }
    }
  };
  function getDecoder$1(decodeTree) {
    let ret = "";
    const decoder = new EntityDecoder$1(decodeTree, (str) => ret += fromCodePoint$2(str));
    return function decodeWithTrie(str, decodeMode) {
      let lastIndex = 0;
      let offset = 0;
      while ((offset = str.indexOf("&", offset)) >= 0) {
        ret += str.slice(lastIndex, offset);
        decoder.startEntity(decodeMode);
        const len = decoder.write(
          str,
          // Skip the "&"
          offset + 1
        );
        if (len < 0) {
          lastIndex = offset + decoder.end();
          break;
        }
        lastIndex = offset + len;
        offset = len === 0 ? lastIndex + 1 : lastIndex;
      }
      const result = ret + str.slice(lastIndex);
      ret = "";
      return result;
    };
  }
  function determineBranch$1(decodeTree, current, nodeIdx, char) {
    const branchCount = (current & BinTrieFlags$1.BRANCH_LENGTH) >> 7;
    const jumpOffset = current & BinTrieFlags$1.JUMP_TABLE;
    if (branchCount === 0) {
      return jumpOffset !== 0 && char === jumpOffset ? nodeIdx : -1;
    }
    if (jumpOffset) {
      const value = char - jumpOffset;
      return value < 0 || value >= branchCount ? -1 : decodeTree[nodeIdx + value] - 1;
    }
    let lo = nodeIdx;
    let hi = lo + branchCount - 1;
    while (lo <= hi) {
      const mid = lo + hi >>> 1;
      const midVal = decodeTree[mid];
      if (midVal < char) {
        lo = mid + 1;
      } else if (midVal > char) {
        hi = mid - 1;
      } else {
        return decodeTree[mid + branchCount];
      }
    }
    return -1;
  }
  getDecoder$1(htmlDecodeTree$1);
  getDecoder$1(xmlDecodeTree$1);
  const xmlReplacer = /["&'<>$\x80-\uFFFF]/g;
  const xmlCodeMap = /* @__PURE__ */ new Map([
    [34, "&quot;"],
    [38, "&amp;"],
    [39, "&apos;"],
    [60, "&lt;"],
    [62, "&gt;"]
  ]);
  const getCodePoint = (
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    String.prototype.codePointAt != null ? (str, index2) => str.codePointAt(index2) : (
      // http://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
      (c, index2) => (c.charCodeAt(index2) & 64512) === 55296 ? (c.charCodeAt(index2) - 55296) * 1024 + c.charCodeAt(index2 + 1) - 56320 + 65536 : c.charCodeAt(index2)
    )
  );
  function encodeXML(str) {
    let ret = "";
    let lastIdx = 0;
    let match;
    while ((match = xmlReplacer.exec(str)) !== null) {
      const i = match.index;
      const char = str.charCodeAt(i);
      const next2 = xmlCodeMap.get(char);
      if (next2 !== void 0) {
        ret += str.substring(lastIdx, i) + next2;
        lastIdx = i + 1;
      } else {
        ret += `${str.substring(lastIdx, i)}&#x${getCodePoint(str, i).toString(16)};`;
        lastIdx = xmlReplacer.lastIndex += Number((char & 64512) === 55296);
      }
    }
    return ret + str.substr(lastIdx);
  }
  function getEscaper(regex2, map2) {
    return function escape2(data2) {
      let match;
      let lastIdx = 0;
      let result = "";
      while (match = regex2.exec(data2)) {
        if (lastIdx !== match.index) {
          result += data2.substring(lastIdx, match.index);
        }
        result += map2.get(match[0].charCodeAt(0));
        lastIdx = match.index + 1;
      }
      return result + data2.substring(lastIdx);
    };
  }
  const escapeAttribute = getEscaper(/["&\u00A0]/g, /* @__PURE__ */ new Map([
    [34, "&quot;"],
    [38, "&amp;"],
    [160, "&nbsp;"]
  ]));
  const escapeText = getEscaper(/[&<>\u00A0]/g, /* @__PURE__ */ new Map([
    [38, "&amp;"],
    [60, "&lt;"],
    [62, "&gt;"],
    [160, "&nbsp;"]
  ]));
  const elementNames = new Map([
    "altGlyph",
    "altGlyphDef",
    "altGlyphItem",
    "animateColor",
    "animateMotion",
    "animateTransform",
    "clipPath",
    "feBlend",
    "feColorMatrix",
    "feComponentTransfer",
    "feComposite",
    "feConvolveMatrix",
    "feDiffuseLighting",
    "feDisplacementMap",
    "feDistantLight",
    "feDropShadow",
    "feFlood",
    "feFuncA",
    "feFuncB",
    "feFuncG",
    "feFuncR",
    "feGaussianBlur",
    "feImage",
    "feMerge",
    "feMergeNode",
    "feMorphology",
    "feOffset",
    "fePointLight",
    "feSpecularLighting",
    "feSpotLight",
    "feTile",
    "feTurbulence",
    "foreignObject",
    "glyphRef",
    "linearGradient",
    "radialGradient",
    "textPath"
  ].map((val2) => [val2.toLowerCase(), val2]));
  const attributeNames = new Map([
    "definitionURL",
    "attributeName",
    "attributeType",
    "baseFrequency",
    "baseProfile",
    "calcMode",
    "clipPathUnits",
    "diffuseConstant",
    "edgeMode",
    "filterUnits",
    "glyphRef",
    "gradientTransform",
    "gradientUnits",
    "kernelMatrix",
    "kernelUnitLength",
    "keyPoints",
    "keySplines",
    "keyTimes",
    "lengthAdjust",
    "limitingConeAngle",
    "markerHeight",
    "markerUnits",
    "markerWidth",
    "maskContentUnits",
    "maskUnits",
    "numOctaves",
    "pathLength",
    "patternContentUnits",
    "patternTransform",
    "patternUnits",
    "pointsAtX",
    "pointsAtY",
    "pointsAtZ",
    "preserveAlpha",
    "preserveAspectRatio",
    "primitiveUnits",
    "refX",
    "refY",
    "repeatCount",
    "repeatDur",
    "requiredExtensions",
    "requiredFeatures",
    "specularConstant",
    "specularExponent",
    "spreadMethod",
    "startOffset",
    "stdDeviation",
    "stitchTiles",
    "surfaceScale",
    "systemLanguage",
    "tableValues",
    "targetX",
    "targetY",
    "textLength",
    "viewBox",
    "viewTarget",
    "xChannelSelector",
    "yChannelSelector",
    "zoomAndPan"
  ].map((val2) => [val2.toLowerCase(), val2]));
  const unencodedElements = /* @__PURE__ */ new Set([
    "style",
    "script",
    "xmp",
    "iframe",
    "noembed",
    "noframes",
    "plaintext",
    "noscript"
  ]);
  function replaceQuotes(value) {
    return value.replace(/"/g, "&quot;");
  }
  function formatAttributes(attributes2, opts) {
    var _a2;
    if (!attributes2)
      return;
    const encode2 = ((_a2 = opts.encodeEntities) !== null && _a2 !== void 0 ? _a2 : opts.decodeEntities) === false ? replaceQuotes : opts.xmlMode || opts.encodeEntities !== "utf8" ? encodeXML : escapeAttribute;
    return Object.keys(attributes2).map((key) => {
      var _a3, _b;
      const value = (_a3 = attributes2[key]) !== null && _a3 !== void 0 ? _a3 : "";
      if (opts.xmlMode === "foreign") {
        key = (_b = attributeNames.get(key)) !== null && _b !== void 0 ? _b : key;
      }
      if (!opts.emptyAttrs && !opts.xmlMode && value === "") {
        return key;
      }
      return `${key}="${encode2(value)}"`;
    }).join(" ");
  }
  const singleTag = /* @__PURE__ */ new Set([
    "area",
    "base",
    "basefont",
    "br",
    "col",
    "command",
    "embed",
    "frame",
    "hr",
    "img",
    "input",
    "isindex",
    "keygen",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr"
  ]);
  function render$1(node, options = {}) {
    const nodes = "length" in node ? node : [node];
    let output = "";
    for (let i = 0; i < nodes.length; i++) {
      output += renderNode(nodes[i], options);
    }
    return output;
  }
  function renderNode(node, options) {
    switch (node.type) {
      case Root:
        return render$1(node.children, options);
      // @ts-expect-error We don't use `Doctype` yet
      case Doctype:
      case Directive:
        return renderDirective(node);
      case Comment$1:
        return renderComment(node);
      case CDATA$1:
        return renderCdata(node);
      case Script:
      case Style:
      case Tag:
        return renderTag(node, options);
      case Text$1:
        return renderText(node, options);
    }
  }
  const foreignModeIntegrationPoints = /* @__PURE__ */ new Set([
    "mi",
    "mo",
    "mn",
    "ms",
    "mtext",
    "annotation-xml",
    "foreignObject",
    "desc",
    "title"
  ]);
  const foreignElements = /* @__PURE__ */ new Set(["svg", "math"]);
  function renderTag(elem, opts) {
    var _a2;
    if (opts.xmlMode === "foreign") {
      elem.name = (_a2 = elementNames.get(elem.name)) !== null && _a2 !== void 0 ? _a2 : elem.name;
      if (elem.parent && foreignModeIntegrationPoints.has(elem.parent.name)) {
        opts = { ...opts, xmlMode: false };
      }
    }
    if (!opts.xmlMode && foreignElements.has(elem.name)) {
      opts = { ...opts, xmlMode: "foreign" };
    }
    let tag = `<${elem.name}`;
    const attribs = formatAttributes(elem.attribs, opts);
    if (attribs) {
      tag += ` ${attribs}`;
    }
    if (elem.children.length === 0 && (opts.xmlMode ? (
      // In XML mode or foreign mode, and user hasn't explicitly turned off self-closing tags
      opts.selfClosingTags !== false
    ) : (
      // User explicitly asked for self-closing tags, even in HTML mode
      opts.selfClosingTags && singleTag.has(elem.name)
    ))) {
      if (!opts.xmlMode)
        tag += " ";
      tag += "/>";
    } else {
      tag += ">";
      if (elem.children.length > 0) {
        tag += render$1(elem.children, opts);
      }
      if (opts.xmlMode || !singleTag.has(elem.name)) {
        tag += `</${elem.name}>`;
      }
    }
    return tag;
  }
  function renderDirective(elem) {
    return `<${elem.data}>`;
  }
  function renderText(elem, opts) {
    var _a2;
    let data2 = elem.data || "";
    if (((_a2 = opts.encodeEntities) !== null && _a2 !== void 0 ? _a2 : opts.decodeEntities) !== false && !(!opts.xmlMode && elem.parent && unencodedElements.has(elem.parent.name))) {
      data2 = opts.xmlMode || opts.encodeEntities !== "utf8" ? encodeXML(data2) : escapeText(data2);
    }
    return data2;
  }
  function renderCdata(elem) {
    return `<![CDATA[${elem.children[0].data}]]>`;
  }
  function renderComment(elem) {
    return `<!--${elem.data}-->`;
  }
  function getOuterHTML(node, options) {
    return render$1(node, options);
  }
  function getInnerHTML(node, options) {
    return hasChildren(node) ? node.children.map((node2) => getOuterHTML(node2, options)).join("") : "";
  }
  function getText(node) {
    if (Array.isArray(node))
      return node.map(getText).join("");
    if (isTag(node))
      return node.name === "br" ? "\n" : getText(node.children);
    if (isCDATA(node))
      return getText(node.children);
    if (isText(node))
      return node.data;
    return "";
  }
  function textContent(node) {
    if (Array.isArray(node))
      return node.map(textContent).join("");
    if (hasChildren(node) && !isComment(node)) {
      return textContent(node.children);
    }
    if (isText(node))
      return node.data;
    return "";
  }
  function innerText(node) {
    if (Array.isArray(node))
      return node.map(innerText).join("");
    if (hasChildren(node) && (node.type === ElementType.Tag || isCDATA(node))) {
      return innerText(node.children);
    }
    if (isText(node))
      return node.data;
    return "";
  }
  function getChildren(elem) {
    return hasChildren(elem) ? elem.children : [];
  }
  function getParent(elem) {
    return elem.parent || null;
  }
  function getSiblings(elem) {
    const parent2 = getParent(elem);
    if (parent2 != null)
      return getChildren(parent2);
    const siblings2 = [elem];
    let { prev: prev2, next: next2 } = elem;
    while (prev2 != null) {
      siblings2.unshift(prev2);
      ({ prev: prev2 } = prev2);
    }
    while (next2 != null) {
      siblings2.push(next2);
      ({ next: next2 } = next2);
    }
    return siblings2;
  }
  function getAttributeValue(elem, name2) {
    var _a2;
    return (_a2 = elem.attribs) === null || _a2 === void 0 ? void 0 : _a2[name2];
  }
  function hasAttrib(elem, name2) {
    return elem.attribs != null && Object.prototype.hasOwnProperty.call(elem.attribs, name2) && elem.attribs[name2] != null;
  }
  function getName(elem) {
    return elem.name;
  }
  function nextElementSibling(elem) {
    let { next: next2 } = elem;
    while (next2 !== null && !isTag(next2))
      ({ next: next2 } = next2);
    return next2;
  }
  function prevElementSibling(elem) {
    let { prev: prev2 } = elem;
    while (prev2 !== null && !isTag(prev2))
      ({ prev: prev2 } = prev2);
    return prev2;
  }
  function removeElement(elem) {
    if (elem.prev)
      elem.prev.next = elem.next;
    if (elem.next)
      elem.next.prev = elem.prev;
    if (elem.parent) {
      const childs = elem.parent.children;
      const childsIndex = childs.lastIndexOf(elem);
      if (childsIndex >= 0) {
        childs.splice(childsIndex, 1);
      }
    }
    elem.next = null;
    elem.prev = null;
    elem.parent = null;
  }
  function replaceElement(elem, replacement) {
    const prev2 = replacement.prev = elem.prev;
    if (prev2) {
      prev2.next = replacement;
    }
    const next2 = replacement.next = elem.next;
    if (next2) {
      next2.prev = replacement;
    }
    const parent2 = replacement.parent = elem.parent;
    if (parent2) {
      const childs = parent2.children;
      childs[childs.lastIndexOf(elem)] = replacement;
      elem.parent = null;
    }
  }
  function appendChild(parent2, child) {
    removeElement(child);
    child.next = null;
    child.parent = parent2;
    if (parent2.children.push(child) > 1) {
      const sibling = parent2.children[parent2.children.length - 2];
      sibling.next = child;
      child.prev = sibling;
    } else {
      child.prev = null;
    }
  }
  function append$1(elem, next2) {
    removeElement(next2);
    const { parent: parent2 } = elem;
    const currNext = elem.next;
    next2.next = currNext;
    next2.prev = elem;
    elem.next = next2;
    next2.parent = parent2;
    if (currNext) {
      currNext.prev = next2;
      if (parent2) {
        const childs = parent2.children;
        childs.splice(childs.lastIndexOf(currNext), 0, next2);
      }
    } else if (parent2) {
      parent2.children.push(next2);
    }
  }
  function prependChild(parent2, child) {
    removeElement(child);
    child.parent = parent2;
    child.prev = null;
    if (parent2.children.unshift(child) !== 1) {
      const sibling = parent2.children[1];
      sibling.prev = child;
      child.next = sibling;
    } else {
      child.next = null;
    }
  }
  function prepend$1(elem, prev2) {
    removeElement(prev2);
    const { parent: parent2 } = elem;
    if (parent2) {
      const childs = parent2.children;
      childs.splice(childs.indexOf(elem), 0, prev2);
    }
    if (elem.prev) {
      elem.prev.next = prev2;
    }
    prev2.parent = parent2;
    prev2.prev = elem.prev;
    prev2.next = elem;
    elem.prev = prev2;
  }
  function filter$2(test, node, recurse = true, limit = Infinity) {
    return find$2(test, Array.isArray(node) ? node : [node], recurse, limit);
  }
  function find$2(test, nodes, recurse, limit) {
    const result = [];
    const nodeStack = [nodes];
    const indexStack = [0];
    for (; ; ) {
      if (indexStack[0] >= nodeStack[0].length) {
        if (indexStack.length === 1) {
          return result;
        }
        nodeStack.shift();
        indexStack.shift();
        continue;
      }
      const elem = nodeStack[0][indexStack[0]++];
      if (test(elem)) {
        result.push(elem);
        if (--limit <= 0)
          return result;
      }
      if (recurse && hasChildren(elem) && elem.children.length > 0) {
        indexStack.unshift(0);
        nodeStack.unshift(elem.children);
      }
    }
  }
  function findOneChild(test, nodes) {
    return nodes.find(test);
  }
  function findOne(test, nodes, recurse = true) {
    let elem = null;
    for (let i = 0; i < nodes.length && !elem; i++) {
      const node = nodes[i];
      if (!isTag(node)) {
        continue;
      } else if (test(node)) {
        elem = node;
      } else if (recurse && node.children.length > 0) {
        elem = findOne(test, node.children, true);
      }
    }
    return elem;
  }
  function existsOne(test, nodes) {
    return nodes.some((checked) => isTag(checked) && (test(checked) || existsOne(test, checked.children)));
  }
  function findAll(test, nodes) {
    const result = [];
    const nodeStack = [nodes];
    const indexStack = [0];
    for (; ; ) {
      if (indexStack[0] >= nodeStack[0].length) {
        if (nodeStack.length === 1) {
          return result;
        }
        nodeStack.shift();
        indexStack.shift();
        continue;
      }
      const elem = nodeStack[0][indexStack[0]++];
      if (!isTag(elem))
        continue;
      if (test(elem))
        result.push(elem);
      if (elem.children.length > 0) {
        indexStack.unshift(0);
        nodeStack.unshift(elem.children);
      }
    }
  }
  const Checks = {
    tag_name(name2) {
      if (typeof name2 === "function") {
        return (elem) => isTag(elem) && name2(elem.name);
      } else if (name2 === "*") {
        return isTag;
      }
      return (elem) => isTag(elem) && elem.name === name2;
    },
    tag_type(type) {
      if (typeof type === "function") {
        return (elem) => type(elem.type);
      }
      return (elem) => elem.type === type;
    },
    tag_contains(data2) {
      if (typeof data2 === "function") {
        return (elem) => isText(elem) && data2(elem.data);
      }
      return (elem) => isText(elem) && elem.data === data2;
    }
  };
  function getAttribCheck(attrib, value) {
    if (typeof value === "function") {
      return (elem) => isTag(elem) && value(elem.attribs[attrib]);
    }
    return (elem) => isTag(elem) && elem.attribs[attrib] === value;
  }
  function combineFuncs(a, b) {
    return (elem) => a(elem) || b(elem);
  }
  function compileTest(options) {
    const funcs = Object.keys(options).map((key) => {
      const value = options[key];
      return Object.prototype.hasOwnProperty.call(Checks, key) ? Checks[key](value) : getAttribCheck(key, value);
    });
    return funcs.length === 0 ? null : funcs.reduce(combineFuncs);
  }
  function testElement(options, node) {
    const test = compileTest(options);
    return test ? test(node) : true;
  }
  function getElements(options, nodes, recurse, limit = Infinity) {
    const test = compileTest(options);
    return test ? filter$2(test, nodes, recurse, limit) : [];
  }
  function getElementById(id, nodes, recurse = true) {
    if (!Array.isArray(nodes))
      nodes = [nodes];
    return findOne(getAttribCheck("id", id), nodes, recurse);
  }
  function getElementsByTagName(tagName, nodes, recurse = true, limit = Infinity) {
    return filter$2(Checks["tag_name"](tagName), nodes, recurse, limit);
  }
  function getElementsByTagType(type, nodes, recurse = true, limit = Infinity) {
    return filter$2(Checks["tag_type"](type), nodes, recurse, limit);
  }
  function removeSubsets(nodes) {
    let idx = nodes.length;
    while (--idx >= 0) {
      const node = nodes[idx];
      if (idx > 0 && nodes.lastIndexOf(node, idx - 1) >= 0) {
        nodes.splice(idx, 1);
        continue;
      }
      for (let ancestor = node.parent; ancestor; ancestor = ancestor.parent) {
        if (nodes.includes(ancestor)) {
          nodes.splice(idx, 1);
          break;
        }
      }
    }
    return nodes;
  }
  var DocumentPosition;
  (function(DocumentPosition2) {
    DocumentPosition2[DocumentPosition2["DISCONNECTED"] = 1] = "DISCONNECTED";
    DocumentPosition2[DocumentPosition2["PRECEDING"] = 2] = "PRECEDING";
    DocumentPosition2[DocumentPosition2["FOLLOWING"] = 4] = "FOLLOWING";
    DocumentPosition2[DocumentPosition2["CONTAINS"] = 8] = "CONTAINS";
    DocumentPosition2[DocumentPosition2["CONTAINED_BY"] = 16] = "CONTAINED_BY";
  })(DocumentPosition || (DocumentPosition = {}));
  function compareDocumentPosition(nodeA, nodeB) {
    const aParents = [];
    const bParents = [];
    if (nodeA === nodeB) {
      return 0;
    }
    let current = hasChildren(nodeA) ? nodeA : nodeA.parent;
    while (current) {
      aParents.unshift(current);
      current = current.parent;
    }
    current = hasChildren(nodeB) ? nodeB : nodeB.parent;
    while (current) {
      bParents.unshift(current);
      current = current.parent;
    }
    const maxIdx = Math.min(aParents.length, bParents.length);
    let idx = 0;
    while (idx < maxIdx && aParents[idx] === bParents[idx]) {
      idx++;
    }
    if (idx === 0) {
      return DocumentPosition.DISCONNECTED;
    }
    const sharedParent = aParents[idx - 1];
    const siblings2 = sharedParent.children;
    const aSibling = aParents[idx];
    const bSibling = bParents[idx];
    if (siblings2.indexOf(aSibling) > siblings2.indexOf(bSibling)) {
      if (sharedParent === nodeB) {
        return DocumentPosition.FOLLOWING | DocumentPosition.CONTAINED_BY;
      }
      return DocumentPosition.FOLLOWING;
    }
    if (sharedParent === nodeA) {
      return DocumentPosition.PRECEDING | DocumentPosition.CONTAINS;
    }
    return DocumentPosition.PRECEDING;
  }
  function uniqueSort(nodes) {
    nodes = nodes.filter((node, i, arr) => !arr.includes(node, i + 1));
    nodes.sort((a, b) => {
      const relative = compareDocumentPosition(a, b);
      if (relative & DocumentPosition.PRECEDING) {
        return -1;
      } else if (relative & DocumentPosition.FOLLOWING) {
        return 1;
      }
      return 0;
    });
    return nodes;
  }
  function getFeed(doc) {
    const feedRoot = getOneElement(isValidFeed, doc);
    return !feedRoot ? null : feedRoot.name === "feed" ? getAtomFeed(feedRoot) : getRssFeed(feedRoot);
  }
  function getAtomFeed(feedRoot) {
    var _a2;
    const childs = feedRoot.children;
    const feed = {
      type: "atom",
      items: getElementsByTagName("entry", childs).map((item) => {
        var _a3;
        const { children: children2 } = item;
        const entry = { media: getMediaElements(children2) };
        addConditionally(entry, "id", "id", children2);
        addConditionally(entry, "title", "title", children2);
        const href2 = (_a3 = getOneElement("link", children2)) === null || _a3 === void 0 ? void 0 : _a3.attribs["href"];
        if (href2) {
          entry.link = href2;
        }
        const description = fetch$1("summary", children2) || fetch$1("content", children2);
        if (description) {
          entry.description = description;
        }
        const pubDate = fetch$1("updated", children2);
        if (pubDate) {
          entry.pubDate = new Date(pubDate);
        }
        return entry;
      })
    };
    addConditionally(feed, "id", "id", childs);
    addConditionally(feed, "title", "title", childs);
    const href = (_a2 = getOneElement("link", childs)) === null || _a2 === void 0 ? void 0 : _a2.attribs["href"];
    if (href) {
      feed.link = href;
    }
    addConditionally(feed, "description", "subtitle", childs);
    const updated = fetch$1("updated", childs);
    if (updated) {
      feed.updated = new Date(updated);
    }
    addConditionally(feed, "author", "email", childs, true);
    return feed;
  }
  function getRssFeed(feedRoot) {
    var _a2, _b;
    const childs = (_b = (_a2 = getOneElement("channel", feedRoot.children)) === null || _a2 === void 0 ? void 0 : _a2.children) !== null && _b !== void 0 ? _b : [];
    const feed = {
      type: feedRoot.name.substr(0, 3),
      id: "",
      items: getElementsByTagName("item", feedRoot.children).map((item) => {
        const { children: children2 } = item;
        const entry = { media: getMediaElements(children2) };
        addConditionally(entry, "id", "guid", children2);
        addConditionally(entry, "title", "title", children2);
        addConditionally(entry, "link", "link", children2);
        addConditionally(entry, "description", "description", children2);
        const pubDate = fetch$1("pubDate", children2) || fetch$1("dc:date", children2);
        if (pubDate)
          entry.pubDate = new Date(pubDate);
        return entry;
      })
    };
    addConditionally(feed, "title", "title", childs);
    addConditionally(feed, "link", "link", childs);
    addConditionally(feed, "description", "description", childs);
    const updated = fetch$1("lastBuildDate", childs);
    if (updated) {
      feed.updated = new Date(updated);
    }
    addConditionally(feed, "author", "managingEditor", childs, true);
    return feed;
  }
  const MEDIA_KEYS_STRING = ["url", "type", "lang"];
  const MEDIA_KEYS_INT = [
    "fileSize",
    "bitrate",
    "framerate",
    "samplingrate",
    "channels",
    "duration",
    "height",
    "width"
  ];
  function getMediaElements(where) {
    return getElementsByTagName("media:content", where).map((elem) => {
      const { attribs } = elem;
      const media = {
        medium: attribs["medium"],
        isDefault: !!attribs["isDefault"]
      };
      for (const attrib of MEDIA_KEYS_STRING) {
        if (attribs[attrib]) {
          media[attrib] = attribs[attrib];
        }
      }
      for (const attrib of MEDIA_KEYS_INT) {
        if (attribs[attrib]) {
          media[attrib] = parseInt(attribs[attrib], 10);
        }
      }
      if (attribs["expression"]) {
        media.expression = attribs["expression"];
      }
      return media;
    });
  }
  function getOneElement(tagName, node) {
    return getElementsByTagName(tagName, node, true, 1)[0];
  }
  function fetch$1(tagName, where, recurse = false) {
    return textContent(getElementsByTagName(tagName, where, recurse, 1)).trim();
  }
  function addConditionally(obj, prop2, tagName, where, recurse = false) {
    const val2 = fetch$1(tagName, where, recurse);
    if (val2)
      obj[prop2] = val2;
  }
  function isValidFeed(value) {
    return value === "rss" || value === "feed" || value === "rdf:RDF";
  }
  const DomUtils = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    get DocumentPosition() {
      return DocumentPosition;
    },
    append: append$1,
    appendChild,
    compareDocumentPosition,
    existsOne,
    filter: filter$2,
    find: find$2,
    findAll,
    findOne,
    findOneChild,
    getAttributeValue,
    getChildren,
    getElementById,
    getElements,
    getElementsByTagName,
    getElementsByTagType,
    getFeed,
    getInnerHTML,
    getName,
    getOuterHTML,
    getParent,
    getSiblings,
    getText,
    hasAttrib,
    hasChildren,
    innerText,
    isCDATA,
    isComment,
    isDocument: isDocument$1,
    isTag,
    isText,
    nextElementSibling,
    prepend: prepend$1,
    prependChild,
    prevElementSibling,
    removeElement,
    removeSubsets,
    replaceElement,
    testElement,
    textContent,
    uniqueSort
  }, Symbol.toStringTag, { value: "Module" }));
  function render(that, dom, options) {
    if (!that)
      return "";
    return that(dom !== null && dom !== void 0 ? dom : that._root.children, null, void 0, options).toString();
  }
  function isOptions(dom, options) {
    return typeof dom === "object" && dom != null && !("length" in dom) && !("type" in dom);
  }
  function html$1(dom, options) {
    const toRender = isOptions(dom) ? (options = dom, void 0) : dom;
    const opts = {
      ...this === null || this === void 0 ? void 0 : this._options,
      ...flattenOptions(options)
    };
    return render(this, toRender, opts);
  }
  function xml(dom) {
    const options = { ...this._options, xmlMode: true };
    return render(this, dom, options);
  }
  function text$1(elements) {
    const elems = elements !== null && elements !== void 0 ? elements : this ? this.root() : [];
    let ret = "";
    for (let i = 0; i < elems.length; i++) {
      ret += textContent(elems[i]);
    }
    return ret;
  }
  function parseHTML(data2, context, keepScripts = typeof context === "boolean" ? context : false) {
    if (!data2 || typeof data2 !== "string") {
      return null;
    }
    if (typeof context === "boolean") {
      keepScripts = context;
    }
    const parsed = this.load(data2, this._options, false);
    if (!keepScripts) {
      parsed("script").remove();
    }
    return [...parsed.root()[0].children];
  }
  function root() {
    return this(this._root);
  }
  function contains(container, contained) {
    if (contained === container) {
      return false;
    }
    let next2 = contained;
    while (next2 && next2 !== next2.parent) {
      next2 = next2.parent;
      if (next2 === container) {
        return true;
      }
    }
    return false;
  }
  function extract$1(map2) {
    return this.root().extract(map2);
  }
  function merge$1(arr1, arr2) {
    if (!isArrayLike(arr1) || !isArrayLike(arr2)) {
      return;
    }
    let newLength = arr1.length;
    const len = +arr2.length;
    for (let i = 0; i < len; i++) {
      arr1[newLength++] = arr2[i];
    }
    arr1.length = newLength;
    return arr1;
  }
  function isArrayLike(item) {
    if (Array.isArray(item)) {
      return true;
    }
    if (typeof item !== "object" || item === null || !("length" in item) || typeof item.length !== "number" || item.length < 0) {
      return false;
    }
    for (let i = 0; i < item.length; i++) {
      if (!(i in item)) {
        return false;
      }
    }
    return true;
  }
  const staticMethods = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    contains,
    extract: extract$1,
    html: html$1,
    merge: merge$1,
    parseHTML,
    root,
    text: text$1,
    xml
  }, Symbol.toStringTag, { value: "Module" }));
  function isCheerio(maybeCheerio) {
    return maybeCheerio.cheerio != null;
  }
  function camelCase(str) {
    return str.replace(/[._-](\w|$)/g, (_, x) => x.toUpperCase());
  }
  function cssCase(str) {
    return str.replace(/[A-Z]/g, "-$&").toLowerCase();
  }
  function domEach(array, fn) {
    const len = array.length;
    for (let i = 0; i < len; i++)
      fn(array[i], i);
    return array;
  }
  var CharacterCodes;
  (function(CharacterCodes2) {
    CharacterCodes2[CharacterCodes2["LowerA"] = 97] = "LowerA";
    CharacterCodes2[CharacterCodes2["LowerZ"] = 122] = "LowerZ";
    CharacterCodes2[CharacterCodes2["UpperA"] = 65] = "UpperA";
    CharacterCodes2[CharacterCodes2["UpperZ"] = 90] = "UpperZ";
    CharacterCodes2[CharacterCodes2["Exclamation"] = 33] = "Exclamation";
  })(CharacterCodes || (CharacterCodes = {}));
  function isHtml(str) {
    const tagStart = str.indexOf("<");
    if (tagStart < 0 || tagStart > str.length - 3)
      return false;
    const tagChar = str.charCodeAt(tagStart + 1);
    return (tagChar >= CharacterCodes.LowerA && tagChar <= CharacterCodes.LowerZ || tagChar >= CharacterCodes.UpperA && tagChar <= CharacterCodes.UpperZ || tagChar === CharacterCodes.Exclamation) && str.includes(">", tagStart + 2);
  }
  const hasOwn = Object.prototype.hasOwnProperty;
  const rspace = /\s+/;
  const dataAttrPrefix = "data-";
  const rboolean = /^(?:autofocus|autoplay|async|checked|controls|defer|disabled|hidden|loop|multiple|open|readonly|required|scoped|selected)$/i;
  const rbrace = /^{[^]*}$|^\[[^]*]$/;
  function getAttr(elem, name2, xmlMode) {
    var _a2;
    if (!elem || !isTag(elem))
      return void 0;
    (_a2 = elem.attribs) !== null && _a2 !== void 0 ? _a2 : elem.attribs = {};
    if (!name2) {
      return elem.attribs;
    }
    if (hasOwn.call(elem.attribs, name2)) {
      return !xmlMode && rboolean.test(name2) ? name2 : elem.attribs[name2];
    }
    if (elem.name === "option" && name2 === "value") {
      return text$1(elem.children);
    }
    if (elem.name === "input" && (elem.attribs["type"] === "radio" || elem.attribs["type"] === "checkbox") && name2 === "value") {
      return "on";
    }
    return void 0;
  }
  function setAttr(el, name2, value) {
    if (value === null) {
      removeAttribute(el, name2);
    } else {
      el.attribs[name2] = `${value}`;
    }
  }
  function attr(name2, value) {
    if (typeof name2 === "object" || value !== void 0) {
      if (typeof value === "function") {
        if (typeof name2 !== "string") {
          {
            throw new Error("Bad combination of arguments.");
          }
        }
        return domEach(this, (el, i) => {
          if (isTag(el))
            setAttr(el, name2, value.call(el, i, el.attribs[name2]));
        });
      }
      return domEach(this, (el) => {
        if (!isTag(el))
          return;
        if (typeof name2 === "object") {
          for (const objName of Object.keys(name2)) {
            const objValue = name2[objName];
            setAttr(el, objName, objValue);
          }
        } else {
          setAttr(el, name2, value);
        }
      });
    }
    return arguments.length > 1 ? this : getAttr(this[0], name2, this.options.xmlMode);
  }
  function getProp(el, name2, xmlMode) {
    return name2 in el ? (
      // @ts-expect-error TS doesn't like us accessing the value directly here.
      el[name2]
    ) : !xmlMode && rboolean.test(name2) ? getAttr(el, name2, false) !== void 0 : getAttr(el, name2, xmlMode);
  }
  function setProp(el, name2, value, xmlMode) {
    if (name2 in el) {
      el[name2] = value;
    } else {
      setAttr(el, name2, !xmlMode && rboolean.test(name2) ? value ? "" : null : `${value}`);
    }
  }
  function prop(name2, value) {
    var _a2;
    if (typeof name2 === "string" && value === void 0) {
      const el = this[0];
      if (!el || !isTag(el))
        return void 0;
      switch (name2) {
        case "style": {
          const property = this.css();
          const keys = Object.keys(property);
          for (let i = 0; i < keys.length; i++) {
            property[i] = keys[i];
          }
          property.length = keys.length;
          return property;
        }
        case "tagName":
        case "nodeName": {
          return el.name.toUpperCase();
        }
        case "href":
        case "src": {
          const prop2 = (_a2 = el.attribs) === null || _a2 === void 0 ? void 0 : _a2[name2];
          if (typeof URL !== "undefined" && (name2 === "href" && (el.tagName === "a" || el.tagName === "link") || name2 === "src" && (el.tagName === "img" || el.tagName === "iframe" || el.tagName === "audio" || el.tagName === "video" || el.tagName === "source")) && prop2 !== void 0 && this.options.baseURI) {
            return new URL(prop2, this.options.baseURI).href;
          }
          return prop2;
        }
        case "innerText": {
          return innerText(el);
        }
        case "textContent": {
          return textContent(el);
        }
        case "outerHTML": {
          return this.clone().wrap("<container />").parent().html();
        }
        case "innerHTML": {
          return this.html();
        }
        default: {
          return getProp(el, name2, this.options.xmlMode);
        }
      }
    }
    if (typeof name2 === "object" || value !== void 0) {
      if (typeof value === "function") {
        if (typeof name2 === "object") {
          throw new TypeError("Bad combination of arguments.");
        }
        return domEach(this, (el, i) => {
          if (isTag(el)) {
            setProp(el, name2, value.call(el, i, getProp(el, name2, this.options.xmlMode)), this.options.xmlMode);
          }
        });
      }
      return domEach(this, (el) => {
        if (!isTag(el))
          return;
        if (typeof name2 === "object") {
          for (const key of Object.keys(name2)) {
            const val2 = name2[key];
            setProp(el, key, val2, this.options.xmlMode);
          }
        } else {
          setProp(el, name2, value, this.options.xmlMode);
        }
      });
    }
    return void 0;
  }
  function setData(elem, name2, value) {
    var _a2;
    (_a2 = elem.data) !== null && _a2 !== void 0 ? _a2 : elem.data = {};
    if (typeof name2 === "object")
      Object.assign(elem.data, name2);
    else if (typeof name2 === "string" && value !== void 0) {
      elem.data[name2] = value;
    }
  }
  function readAllData(el) {
    for (const domName of Object.keys(el.attribs)) {
      if (!domName.startsWith(dataAttrPrefix)) {
        continue;
      }
      const jsName = camelCase(domName.slice(dataAttrPrefix.length));
      if (!hasOwn.call(el.data, jsName)) {
        el.data[jsName] = parseDataValue(el.attribs[domName]);
      }
    }
    return el.data;
  }
  function readData(el, name2) {
    const domName = dataAttrPrefix + cssCase(name2);
    const data2 = el.data;
    if (hasOwn.call(data2, name2)) {
      return data2[name2];
    }
    if (hasOwn.call(el.attribs, domName)) {
      return data2[name2] = parseDataValue(el.attribs[domName]);
    }
    return void 0;
  }
  function parseDataValue(value) {
    if (value === "null")
      return null;
    if (value === "true")
      return true;
    if (value === "false")
      return false;
    const num = Number(value);
    if (value === String(num))
      return num;
    if (rbrace.test(value)) {
      try {
        return JSON.parse(value);
      } catch {
      }
    }
    return value;
  }
  function data(name2, value) {
    var _a2;
    const elem = this[0];
    if (!elem || !isTag(elem))
      return;
    const dataEl = elem;
    (_a2 = dataEl.data) !== null && _a2 !== void 0 ? _a2 : dataEl.data = {};
    if (name2 == null) {
      return readAllData(dataEl);
    }
    if (typeof name2 === "object" || value !== void 0) {
      domEach(this, (el) => {
        if (isTag(el)) {
          if (typeof name2 === "object")
            setData(el, name2);
          else
            setData(el, name2, value);
        }
      });
      return this;
    }
    return readData(dataEl, name2);
  }
  function val(value) {
    const querying = arguments.length === 0;
    const element = this[0];
    if (!element || !isTag(element))
      return querying ? void 0 : this;
    switch (element.name) {
      case "textarea": {
        return this.text(value);
      }
      case "select": {
        const option = this.find("option:selected");
        if (!querying) {
          if (this.attr("multiple") == null && typeof value === "object") {
            return this;
          }
          this.find("option").removeAttr("selected");
          const values = typeof value === "object" ? value : [value];
          for (const val2 of values) {
            this.find(`option[value="${val2}"]`).attr("selected", "");
          }
          return this;
        }
        return this.attr("multiple") ? option.toArray().map((el) => text$1(el.children)) : option.attr("value");
      }
      case "input":
      case "option": {
        return querying ? this.attr("value") : this.attr("value", value);
      }
    }
    return void 0;
  }
  function removeAttribute(elem, name2) {
    if (!elem.attribs || !hasOwn.call(elem.attribs, name2))
      return;
    delete elem.attribs[name2];
  }
  function splitNames(names) {
    return names ? names.trim().split(rspace) : [];
  }
  function removeAttr(name2) {
    const attrNames = splitNames(name2);
    for (const attrName of attrNames) {
      domEach(this, (elem) => {
        if (isTag(elem))
          removeAttribute(elem, attrName);
      });
    }
    return this;
  }
  function hasClass(className) {
    return this.toArray().some((elem) => {
      const clazz = isTag(elem) && elem.attribs["class"];
      let idx = -1;
      if (clazz && className.length > 0) {
        while ((idx = clazz.indexOf(className, idx + 1)) > -1) {
          const end2 = idx + className.length;
          if ((idx === 0 || rspace.test(clazz[idx - 1])) && (end2 === clazz.length || rspace.test(clazz[end2]))) {
            return true;
          }
        }
      }
      return false;
    });
  }
  function addClass(value) {
    if (typeof value === "function") {
      return domEach(this, (el, i) => {
        if (isTag(el)) {
          const className = el.attribs["class"] || "";
          addClass.call([el], value.call(el, i, className));
        }
      });
    }
    if (!value || typeof value !== "string")
      return this;
    const classNames = value.split(rspace);
    const numElements = this.length;
    for (let i = 0; i < numElements; i++) {
      const el = this[i];
      if (!isTag(el))
        continue;
      const className = getAttr(el, "class", false);
      if (className) {
        let setClass = ` ${className} `;
        for (const cn of classNames) {
          const appendClass = `${cn} `;
          if (!setClass.includes(` ${appendClass}`))
            setClass += appendClass;
        }
        setAttr(el, "class", setClass.trim());
      } else {
        setAttr(el, "class", classNames.join(" ").trim());
      }
    }
    return this;
  }
  function removeClass(name2) {
    if (typeof name2 === "function") {
      return domEach(this, (el, i) => {
        if (isTag(el)) {
          removeClass.call([el], name2.call(el, i, el.attribs["class"] || ""));
        }
      });
    }
    const classes = splitNames(name2);
    const numClasses = classes.length;
    const removeAll = arguments.length === 0;
    return domEach(this, (el) => {
      if (!isTag(el))
        return;
      if (removeAll) {
        el.attribs["class"] = "";
      } else {
        const elClasses = splitNames(el.attribs["class"]);
        let changed = false;
        for (let j = 0; j < numClasses; j++) {
          const index2 = elClasses.indexOf(classes[j]);
          if (index2 >= 0) {
            elClasses.splice(index2, 1);
            changed = true;
            j--;
          }
        }
        if (changed) {
          el.attribs["class"] = elClasses.join(" ");
        }
      }
    });
  }
  function toggleClass(value, stateVal) {
    if (typeof value === "function") {
      return domEach(this, (el, i) => {
        if (isTag(el)) {
          toggleClass.call([el], value.call(el, i, el.attribs["class"] || "", stateVal), stateVal);
        }
      });
    }
    if (!value || typeof value !== "string")
      return this;
    const classNames = value.split(rspace);
    const numClasses = classNames.length;
    const state = typeof stateVal === "boolean" ? stateVal ? 1 : -1 : 0;
    const numElements = this.length;
    for (let i = 0; i < numElements; i++) {
      const el = this[i];
      if (!isTag(el))
        continue;
      const elementClasses = splitNames(el.attribs["class"]);
      for (let j = 0; j < numClasses; j++) {
        const index2 = elementClasses.indexOf(classNames[j]);
        if (state >= 0 && index2 < 0) {
          elementClasses.push(classNames[j]);
        } else if (state <= 0 && index2 >= 0) {
          elementClasses.splice(index2, 1);
        }
      }
      el.attribs["class"] = elementClasses.join(" ");
    }
    return this;
  }
  const Attributes = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    addClass,
    attr,
    data,
    hasClass,
    prop,
    removeAttr,
    removeClass,
    toggleClass,
    val
  }, Symbol.toStringTag, { value: "Module" }));
  var SelectorType;
  (function(SelectorType2) {
    SelectorType2["Attribute"] = "attribute";
    SelectorType2["Pseudo"] = "pseudo";
    SelectorType2["PseudoElement"] = "pseudo-element";
    SelectorType2["Tag"] = "tag";
    SelectorType2["Universal"] = "universal";
    SelectorType2["Adjacent"] = "adjacent";
    SelectorType2["Child"] = "child";
    SelectorType2["Descendant"] = "descendant";
    SelectorType2["Parent"] = "parent";
    SelectorType2["Sibling"] = "sibling";
    SelectorType2["ColumnCombinator"] = "column-combinator";
  })(SelectorType || (SelectorType = {}));
  var AttributeAction;
  (function(AttributeAction2) {
    AttributeAction2["Any"] = "any";
    AttributeAction2["Element"] = "element";
    AttributeAction2["End"] = "end";
    AttributeAction2["Equals"] = "equals";
    AttributeAction2["Exists"] = "exists";
    AttributeAction2["Hyphen"] = "hyphen";
    AttributeAction2["Not"] = "not";
    AttributeAction2["Start"] = "start";
  })(AttributeAction || (AttributeAction = {}));
  const reName = /^[^\\#]?(?:\\(?:[\da-f]{1,6}\s?|.)|[\w\-\u00b0-\uFFFF])+/;
  const reEscape = /\\([\da-f]{1,6}\s?|(\s)|.)/gi;
  const actionTypes = /* @__PURE__ */ new Map([
    [126, AttributeAction.Element],
    [94, AttributeAction.Start],
    [36, AttributeAction.End],
    [42, AttributeAction.Any],
    [33, AttributeAction.Not],
    [124, AttributeAction.Hyphen]
  ]);
  const unpackPseudos = /* @__PURE__ */ new Set([
    "has",
    "not",
    "matches",
    "is",
    "where",
    "host",
    "host-context"
  ]);
  function isTraversal$1(selector) {
    switch (selector.type) {
      case SelectorType.Adjacent:
      case SelectorType.Child:
      case SelectorType.Descendant:
      case SelectorType.Parent:
      case SelectorType.Sibling:
      case SelectorType.ColumnCombinator:
        return true;
      default:
        return false;
    }
  }
  const stripQuotesFromPseudos = /* @__PURE__ */ new Set(["contains", "icontains"]);
  function funescape(_, escaped, escapedWhitespace) {
    const high = parseInt(escaped, 16) - 65536;
    return high !== high || escapedWhitespace ? escaped : high < 0 ? (
      // BMP codepoint
      String.fromCharCode(high + 65536)
    ) : (
      // Supplemental Plane codepoint (surrogate pair)
      String.fromCharCode(high >> 10 | 55296, high & 1023 | 56320)
    );
  }
  function unescapeCSS(str) {
    return str.replace(reEscape, funescape);
  }
  function isQuote(c) {
    return c === 39 || c === 34;
  }
  function isWhitespace$1(c) {
    return c === 32 || c === 9 || c === 10 || c === 12 || c === 13;
  }
  function parse$2(selector) {
    const subselects2 = [];
    const endIndex = parseSelector(subselects2, `${selector}`, 0);
    if (endIndex < selector.length) {
      throw new Error(`Unmatched selector: ${selector.slice(endIndex)}`);
    }
    return subselects2;
  }
  function parseSelector(subselects2, selector, selectorIndex) {
    let tokens = [];
    function getName2(offset) {
      const match = selector.slice(selectorIndex + offset).match(reName);
      if (!match) {
        throw new Error(`Expected name, found ${selector.slice(selectorIndex)}`);
      }
      const [name2] = match;
      selectorIndex += offset + name2.length;
      return unescapeCSS(name2);
    }
    function stripWhitespace(offset) {
      selectorIndex += offset;
      while (selectorIndex < selector.length && isWhitespace$1(selector.charCodeAt(selectorIndex))) {
        selectorIndex++;
      }
    }
    function readValueWithParenthesis() {
      selectorIndex += 1;
      const start = selectorIndex;
      let counter = 1;
      for (; counter > 0 && selectorIndex < selector.length; selectorIndex++) {
        if (selector.charCodeAt(selectorIndex) === 40 && !isEscaped(selectorIndex)) {
          counter++;
        } else if (selector.charCodeAt(selectorIndex) === 41 && !isEscaped(selectorIndex)) {
          counter--;
        }
      }
      if (counter) {
        throw new Error("Parenthesis not matched");
      }
      return unescapeCSS(selector.slice(start, selectorIndex - 1));
    }
    function isEscaped(pos) {
      let slashCount = 0;
      while (selector.charCodeAt(--pos) === 92)
        slashCount++;
      return (slashCount & 1) === 1;
    }
    function ensureNotTraversal() {
      if (tokens.length > 0 && isTraversal$1(tokens[tokens.length - 1])) {
        throw new Error("Did not expect successive traversals.");
      }
    }
    function addTraversal(type) {
      if (tokens.length > 0 && tokens[tokens.length - 1].type === SelectorType.Descendant) {
        tokens[tokens.length - 1].type = type;
        return;
      }
      ensureNotTraversal();
      tokens.push({ type });
    }
    function addSpecialAttribute(name2, action) {
      tokens.push({
        type: SelectorType.Attribute,
        name: name2,
        action,
        value: getName2(1),
        namespace: null,
        ignoreCase: "quirks"
      });
    }
    function finalizeSubselector() {
      if (tokens.length && tokens[tokens.length - 1].type === SelectorType.Descendant) {
        tokens.pop();
      }
      if (tokens.length === 0) {
        throw new Error("Empty sub-selector");
      }
      subselects2.push(tokens);
    }
    stripWhitespace(0);
    if (selector.length === selectorIndex) {
      return selectorIndex;
    }
    loop: while (selectorIndex < selector.length) {
      const firstChar = selector.charCodeAt(selectorIndex);
      switch (firstChar) {
        // Whitespace
        case 32:
        case 9:
        case 10:
        case 12:
        case 13: {
          if (tokens.length === 0 || tokens[0].type !== SelectorType.Descendant) {
            ensureNotTraversal();
            tokens.push({ type: SelectorType.Descendant });
          }
          stripWhitespace(1);
          break;
        }
        // Traversals
        case 62: {
          addTraversal(SelectorType.Child);
          stripWhitespace(1);
          break;
        }
        case 60: {
          addTraversal(SelectorType.Parent);
          stripWhitespace(1);
          break;
        }
        case 126: {
          addTraversal(SelectorType.Sibling);
          stripWhitespace(1);
          break;
        }
        case 43: {
          addTraversal(SelectorType.Adjacent);
          stripWhitespace(1);
          break;
        }
        // Special attribute selectors: .class, #id
        case 46: {
          addSpecialAttribute("class", AttributeAction.Element);
          break;
        }
        case 35: {
          addSpecialAttribute("id", AttributeAction.Equals);
          break;
        }
        case 91: {
          stripWhitespace(1);
          let name2;
          let namespace = null;
          if (selector.charCodeAt(selectorIndex) === 124) {
            name2 = getName2(1);
          } else if (selector.startsWith("*|", selectorIndex)) {
            namespace = "*";
            name2 = getName2(2);
          } else {
            name2 = getName2(0);
            if (selector.charCodeAt(selectorIndex) === 124 && selector.charCodeAt(selectorIndex + 1) !== 61) {
              namespace = name2;
              name2 = getName2(1);
            }
          }
          stripWhitespace(0);
          let action = AttributeAction.Exists;
          const possibleAction = actionTypes.get(selector.charCodeAt(selectorIndex));
          if (possibleAction) {
            action = possibleAction;
            if (selector.charCodeAt(selectorIndex + 1) !== 61) {
              throw new Error("Expected `=`");
            }
            stripWhitespace(2);
          } else if (selector.charCodeAt(selectorIndex) === 61) {
            action = AttributeAction.Equals;
            stripWhitespace(1);
          }
          let value = "";
          let ignoreCase = null;
          if (action !== "exists") {
            if (isQuote(selector.charCodeAt(selectorIndex))) {
              const quote = selector.charCodeAt(selectorIndex);
              let sectionEnd = selectorIndex + 1;
              while (sectionEnd < selector.length && (selector.charCodeAt(sectionEnd) !== quote || isEscaped(sectionEnd))) {
                sectionEnd += 1;
              }
              if (selector.charCodeAt(sectionEnd) !== quote) {
                throw new Error("Attribute value didn't end");
              }
              value = unescapeCSS(selector.slice(selectorIndex + 1, sectionEnd));
              selectorIndex = sectionEnd + 1;
            } else {
              const valueStart = selectorIndex;
              while (selectorIndex < selector.length && (!isWhitespace$1(selector.charCodeAt(selectorIndex)) && selector.charCodeAt(selectorIndex) !== 93 || isEscaped(selectorIndex))) {
                selectorIndex += 1;
              }
              value = unescapeCSS(selector.slice(valueStart, selectorIndex));
            }
            stripWhitespace(0);
            const forceIgnore = selector.charCodeAt(selectorIndex) | 32;
            if (forceIgnore === 115) {
              ignoreCase = false;
              stripWhitespace(1);
            } else if (forceIgnore === 105) {
              ignoreCase = true;
              stripWhitespace(1);
            }
          }
          if (selector.charCodeAt(selectorIndex) !== 93) {
            throw new Error("Attribute selector didn't terminate");
          }
          selectorIndex += 1;
          const attributeSelector = {
            type: SelectorType.Attribute,
            name: name2,
            action,
            value,
            namespace,
            ignoreCase
          };
          tokens.push(attributeSelector);
          break;
        }
        case 58: {
          if (selector.charCodeAt(selectorIndex + 1) === 58) {
            tokens.push({
              type: SelectorType.PseudoElement,
              name: getName2(2).toLowerCase(),
              data: selector.charCodeAt(selectorIndex) === 40 ? readValueWithParenthesis() : null
            });
            continue;
          }
          const name2 = getName2(1).toLowerCase();
          let data2 = null;
          if (selector.charCodeAt(selectorIndex) === 40) {
            if (unpackPseudos.has(name2)) {
              if (isQuote(selector.charCodeAt(selectorIndex + 1))) {
                throw new Error(`Pseudo-selector ${name2} cannot be quoted`);
              }
              data2 = [];
              selectorIndex = parseSelector(data2, selector, selectorIndex + 1);
              if (selector.charCodeAt(selectorIndex) !== 41) {
                throw new Error(`Missing closing parenthesis in :${name2} (${selector})`);
              }
              selectorIndex += 1;
            } else {
              data2 = readValueWithParenthesis();
              if (stripQuotesFromPseudos.has(name2)) {
                const quot = data2.charCodeAt(0);
                if (quot === data2.charCodeAt(data2.length - 1) && isQuote(quot)) {
                  data2 = data2.slice(1, -1);
                }
              }
              data2 = unescapeCSS(data2);
            }
          }
          tokens.push({ type: SelectorType.Pseudo, name: name2, data: data2 });
          break;
        }
        case 44: {
          finalizeSubselector();
          tokens = [];
          stripWhitespace(1);
          break;
        }
        default: {
          if (selector.startsWith("/*", selectorIndex)) {
            const endIndex = selector.indexOf("*/", selectorIndex + 2);
            if (endIndex < 0) {
              throw new Error("Comment was not terminated");
            }
            selectorIndex = endIndex + 2;
            if (tokens.length === 0) {
              stripWhitespace(0);
            }
            break;
          }
          let namespace = null;
          let name2;
          if (firstChar === 42) {
            selectorIndex += 1;
            name2 = "*";
          } else if (firstChar === 124) {
            name2 = "";
            if (selector.charCodeAt(selectorIndex + 1) === 124) {
              addTraversal(SelectorType.ColumnCombinator);
              stripWhitespace(2);
              break;
            }
          } else if (reName.test(selector.slice(selectorIndex))) {
            name2 = getName2(0);
          } else {
            break loop;
          }
          if (selector.charCodeAt(selectorIndex) === 124 && selector.charCodeAt(selectorIndex + 1) !== 124) {
            namespace = name2;
            if (selector.charCodeAt(selectorIndex + 1) === 42) {
              name2 = "*";
              selectorIndex += 2;
            } else {
              name2 = getName2(1);
            }
          }
          tokens.push(name2 === "*" ? { type: SelectorType.Universal, namespace } : { type: SelectorType.Tag, name: name2, namespace });
        }
      }
    }
    finalizeSubselector();
    return selectorIndex;
  }
  function getDefaultExportFromCjs$1(x) {
    return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
  }
  var boolbase$1;
  var hasRequiredBoolbase;
  function requireBoolbase() {
    if (hasRequiredBoolbase) return boolbase$1;
    hasRequiredBoolbase = 1;
    boolbase$1 = {
      trueFunc: function trueFunc() {
        return true;
      },
      falseFunc: function falseFunc() {
        return false;
      }
    };
    return boolbase$1;
  }
  var boolbaseExports = requireBoolbase();
  const boolbase = /* @__PURE__ */ getDefaultExportFromCjs$1(boolbaseExports);
  const procedure = /* @__PURE__ */ new Map([
    [SelectorType.Universal, 50],
    [SelectorType.Tag, 30],
    [SelectorType.Attribute, 1],
    [SelectorType.Pseudo, 0]
  ]);
  function isTraversal(token) {
    return !procedure.has(token.type);
  }
  const attributes = /* @__PURE__ */ new Map([
    [AttributeAction.Exists, 10],
    [AttributeAction.Equals, 8],
    [AttributeAction.Not, 7],
    [AttributeAction.Start, 6],
    [AttributeAction.End, 6],
    [AttributeAction.Any, 5]
  ]);
  function sortByProcedure(arr) {
    const procs = arr.map(getProcedure);
    for (let i = 1; i < arr.length; i++) {
      const procNew = procs[i];
      if (procNew < 0)
        continue;
      for (let j = i - 1; j >= 0 && procNew < procs[j]; j--) {
        const token = arr[j + 1];
        arr[j + 1] = arr[j];
        arr[j] = token;
        procs[j + 1] = procs[j];
        procs[j] = procNew;
      }
    }
  }
  function getProcedure(token) {
    var _a2, _b;
    let proc = (_a2 = procedure.get(token.type)) !== null && _a2 !== void 0 ? _a2 : -1;
    if (token.type === SelectorType.Attribute) {
      proc = (_b = attributes.get(token.action)) !== null && _b !== void 0 ? _b : 4;
      if (token.action === AttributeAction.Equals && token.name === "id") {
        proc = 9;
      }
      if (token.ignoreCase) {
        proc >>= 1;
      }
    } else if (token.type === SelectorType.Pseudo) {
      if (!token.data) {
        proc = 3;
      } else if (token.name === "has" || token.name === "contains") {
        proc = 0;
      } else if (Array.isArray(token.data)) {
        proc = Math.min(...token.data.map((d) => Math.min(...d.map(getProcedure))));
        if (proc < 0) {
          proc = 0;
        }
      } else {
        proc = 2;
      }
    }
    return proc;
  }
  const reChars = /[-[\]{}()*+?.,\\^$|#\s]/g;
  function escapeRegex(value) {
    return value.replace(reChars, "\\$&");
  }
  const caseInsensitiveAttributes = /* @__PURE__ */ new Set([
    "accept",
    "accept-charset",
    "align",
    "alink",
    "axis",
    "bgcolor",
    "charset",
    "checked",
    "clear",
    "codetype",
    "color",
    "compact",
    "declare",
    "defer",
    "dir",
    "direction",
    "disabled",
    "enctype",
    "face",
    "frame",
    "hreflang",
    "http-equiv",
    "lang",
    "language",
    "link",
    "media",
    "method",
    "multiple",
    "nohref",
    "noresize",
    "noshade",
    "nowrap",
    "readonly",
    "rel",
    "rev",
    "rules",
    "scope",
    "scrolling",
    "selected",
    "shape",
    "target",
    "text",
    "type",
    "valign",
    "valuetype",
    "vlink"
  ]);
  function shouldIgnoreCase(selector, options) {
    return typeof selector.ignoreCase === "boolean" ? selector.ignoreCase : selector.ignoreCase === "quirks" ? !!options.quirksMode : !options.xmlMode && caseInsensitiveAttributes.has(selector.name);
  }
  const attributeRules = {
    equals(next2, data2, options) {
      const { adapter } = options;
      const { name: name2 } = data2;
      let { value } = data2;
      if (shouldIgnoreCase(data2, options)) {
        value = value.toLowerCase();
        return (elem) => {
          const attr2 = adapter.getAttributeValue(elem, name2);
          return attr2 != null && attr2.length === value.length && attr2.toLowerCase() === value && next2(elem);
        };
      }
      return (elem) => adapter.getAttributeValue(elem, name2) === value && next2(elem);
    },
    hyphen(next2, data2, options) {
      const { adapter } = options;
      const { name: name2 } = data2;
      let { value } = data2;
      const len = value.length;
      if (shouldIgnoreCase(data2, options)) {
        value = value.toLowerCase();
        return function hyphenIC(elem) {
          const attr2 = adapter.getAttributeValue(elem, name2);
          return attr2 != null && (attr2.length === len || attr2.charAt(len) === "-") && attr2.substr(0, len).toLowerCase() === value && next2(elem);
        };
      }
      return function hyphen(elem) {
        const attr2 = adapter.getAttributeValue(elem, name2);
        return attr2 != null && (attr2.length === len || attr2.charAt(len) === "-") && attr2.substr(0, len) === value && next2(elem);
      };
    },
    element(next2, data2, options) {
      const { adapter } = options;
      const { name: name2, value } = data2;
      if (/\s/.test(value)) {
        return boolbase.falseFunc;
      }
      const regex2 = new RegExp(`(?:^|\\s)${escapeRegex(value)}(?:$|\\s)`, shouldIgnoreCase(data2, options) ? "i" : "");
      return function element(elem) {
        const attr2 = adapter.getAttributeValue(elem, name2);
        return attr2 != null && attr2.length >= value.length && regex2.test(attr2) && next2(elem);
      };
    },
    exists(next2, { name: name2 }, { adapter }) {
      return (elem) => adapter.hasAttrib(elem, name2) && next2(elem);
    },
    start(next2, data2, options) {
      const { adapter } = options;
      const { name: name2 } = data2;
      let { value } = data2;
      const len = value.length;
      if (len === 0) {
        return boolbase.falseFunc;
      }
      if (shouldIgnoreCase(data2, options)) {
        value = value.toLowerCase();
        return (elem) => {
          const attr2 = adapter.getAttributeValue(elem, name2);
          return attr2 != null && attr2.length >= len && attr2.substr(0, len).toLowerCase() === value && next2(elem);
        };
      }
      return (elem) => {
        var _a2;
        return !!((_a2 = adapter.getAttributeValue(elem, name2)) === null || _a2 === void 0 ? void 0 : _a2.startsWith(value)) && next2(elem);
      };
    },
    end(next2, data2, options) {
      const { adapter } = options;
      const { name: name2 } = data2;
      let { value } = data2;
      const len = -value.length;
      if (len === 0) {
        return boolbase.falseFunc;
      }
      if (shouldIgnoreCase(data2, options)) {
        value = value.toLowerCase();
        return (elem) => {
          var _a2;
          return ((_a2 = adapter.getAttributeValue(elem, name2)) === null || _a2 === void 0 ? void 0 : _a2.substr(len).toLowerCase()) === value && next2(elem);
        };
      }
      return (elem) => {
        var _a2;
        return !!((_a2 = adapter.getAttributeValue(elem, name2)) === null || _a2 === void 0 ? void 0 : _a2.endsWith(value)) && next2(elem);
      };
    },
    any(next2, data2, options) {
      const { adapter } = options;
      const { name: name2, value } = data2;
      if (value === "") {
        return boolbase.falseFunc;
      }
      if (shouldIgnoreCase(data2, options)) {
        const regex2 = new RegExp(escapeRegex(value), "i");
        return function anyIC(elem) {
          const attr2 = adapter.getAttributeValue(elem, name2);
          return attr2 != null && attr2.length >= value.length && regex2.test(attr2) && next2(elem);
        };
      }
      return (elem) => {
        var _a2;
        return !!((_a2 = adapter.getAttributeValue(elem, name2)) === null || _a2 === void 0 ? void 0 : _a2.includes(value)) && next2(elem);
      };
    },
    not(next2, data2, options) {
      const { adapter } = options;
      const { name: name2 } = data2;
      let { value } = data2;
      if (value === "") {
        return (elem) => !!adapter.getAttributeValue(elem, name2) && next2(elem);
      } else if (shouldIgnoreCase(data2, options)) {
        value = value.toLowerCase();
        return (elem) => {
          const attr2 = adapter.getAttributeValue(elem, name2);
          return (attr2 == null || attr2.length !== value.length || attr2.toLowerCase() !== value) && next2(elem);
        };
      }
      return (elem) => adapter.getAttributeValue(elem, name2) !== value && next2(elem);
    }
  };
  const whitespace = /* @__PURE__ */ new Set([9, 10, 12, 13, 32]);
  const ZERO = "0".charCodeAt(0);
  const NINE = "9".charCodeAt(0);
  function parse$1(formula) {
    formula = formula.trim().toLowerCase();
    if (formula === "even") {
      return [2, 0];
    } else if (formula === "odd") {
      return [2, 1];
    }
    let idx = 0;
    let a = 0;
    let sign = readSign();
    let number = readNumber();
    if (idx < formula.length && formula.charAt(idx) === "n") {
      idx++;
      a = sign * (number !== null && number !== void 0 ? number : 1);
      skipWhitespace();
      if (idx < formula.length) {
        sign = readSign();
        skipWhitespace();
        number = readNumber();
      } else {
        sign = number = 0;
      }
    }
    if (number === null || idx < formula.length) {
      throw new Error(`n-th rule couldn't be parsed ('${formula}')`);
    }
    return [a, sign * number];
    function readSign() {
      if (formula.charAt(idx) === "-") {
        idx++;
        return -1;
      }
      if (formula.charAt(idx) === "+") {
        idx++;
      }
      return 1;
    }
    function readNumber() {
      const start = idx;
      let value = 0;
      while (idx < formula.length && formula.charCodeAt(idx) >= ZERO && formula.charCodeAt(idx) <= NINE) {
        value = value * 10 + (formula.charCodeAt(idx) - ZERO);
        idx++;
      }
      return idx === start ? null : value;
    }
    function skipWhitespace() {
      while (idx < formula.length && whitespace.has(formula.charCodeAt(idx))) {
        idx++;
      }
    }
  }
  function compile$1(parsed) {
    const a = parsed[0];
    const b = parsed[1] - 1;
    if (b < 0 && a <= 0)
      return boolbase.falseFunc;
    if (a === -1)
      return (index2) => index2 <= b;
    if (a === 0)
      return (index2) => index2 === b;
    if (a === 1)
      return b < 0 ? boolbase.trueFunc : (index2) => index2 >= b;
    const absA = Math.abs(a);
    const bMod = (b % absA + absA) % absA;
    return a > 1 ? (index2) => index2 >= b && index2 % absA === bMod : (index2) => index2 <= b && index2 % absA === bMod;
  }
  function nthCheck(formula) {
    return compile$1(parse$1(formula));
  }
  function getChildFunc(next2, adapter) {
    return (elem) => {
      const parent2 = adapter.getParent(elem);
      return parent2 != null && adapter.isTag(parent2) && next2(elem);
    };
  }
  const filters = {
    contains(next2, text2, { adapter }) {
      return function contains2(elem) {
        return next2(elem) && adapter.getText(elem).includes(text2);
      };
    },
    icontains(next2, text2, { adapter }) {
      const itext = text2.toLowerCase();
      return function icontains(elem) {
        return next2(elem) && adapter.getText(elem).toLowerCase().includes(itext);
      };
    },
    // Location specific methods
    "nth-child"(next2, rule, { adapter, equals }) {
      const func = nthCheck(rule);
      if (func === boolbase.falseFunc)
        return boolbase.falseFunc;
      if (func === boolbase.trueFunc)
        return getChildFunc(next2, adapter);
      return function nthChild(elem) {
        const siblings2 = adapter.getSiblings(elem);
        let pos = 0;
        for (let i = 0; i < siblings2.length; i++) {
          if (equals(elem, siblings2[i]))
            break;
          if (adapter.isTag(siblings2[i])) {
            pos++;
          }
        }
        return func(pos) && next2(elem);
      };
    },
    "nth-last-child"(next2, rule, { adapter, equals }) {
      const func = nthCheck(rule);
      if (func === boolbase.falseFunc)
        return boolbase.falseFunc;
      if (func === boolbase.trueFunc)
        return getChildFunc(next2, adapter);
      return function nthLastChild(elem) {
        const siblings2 = adapter.getSiblings(elem);
        let pos = 0;
        for (let i = siblings2.length - 1; i >= 0; i--) {
          if (equals(elem, siblings2[i]))
            break;
          if (adapter.isTag(siblings2[i])) {
            pos++;
          }
        }
        return func(pos) && next2(elem);
      };
    },
    "nth-of-type"(next2, rule, { adapter, equals }) {
      const func = nthCheck(rule);
      if (func === boolbase.falseFunc)
        return boolbase.falseFunc;
      if (func === boolbase.trueFunc)
        return getChildFunc(next2, adapter);
      return function nthOfType(elem) {
        const siblings2 = adapter.getSiblings(elem);
        let pos = 0;
        for (let i = 0; i < siblings2.length; i++) {
          const currentSibling = siblings2[i];
          if (equals(elem, currentSibling))
            break;
          if (adapter.isTag(currentSibling) && adapter.getName(currentSibling) === adapter.getName(elem)) {
            pos++;
          }
        }
        return func(pos) && next2(elem);
      };
    },
    "nth-last-of-type"(next2, rule, { adapter, equals }) {
      const func = nthCheck(rule);
      if (func === boolbase.falseFunc)
        return boolbase.falseFunc;
      if (func === boolbase.trueFunc)
        return getChildFunc(next2, adapter);
      return function nthLastOfType(elem) {
        const siblings2 = adapter.getSiblings(elem);
        let pos = 0;
        for (let i = siblings2.length - 1; i >= 0; i--) {
          const currentSibling = siblings2[i];
          if (equals(elem, currentSibling))
            break;
          if (adapter.isTag(currentSibling) && adapter.getName(currentSibling) === adapter.getName(elem)) {
            pos++;
          }
        }
        return func(pos) && next2(elem);
      };
    },
    // TODO determine the actual root element
    root(next2, _rule, { adapter }) {
      return (elem) => {
        const parent2 = adapter.getParent(elem);
        return (parent2 == null || !adapter.isTag(parent2)) && next2(elem);
      };
    },
    scope(next2, rule, options, context) {
      const { equals } = options;
      if (!context || context.length === 0) {
        return filters["root"](next2, rule, options);
      }
      if (context.length === 1) {
        return (elem) => equals(context[0], elem) && next2(elem);
      }
      return (elem) => context.includes(elem) && next2(elem);
    },
    hover: dynamicStatePseudo("isHovered"),
    visited: dynamicStatePseudo("isVisited"),
    active: dynamicStatePseudo("isActive")
  };
  function dynamicStatePseudo(name2) {
    return function dynamicPseudo(next2, _rule, { adapter }) {
      const func = adapter[name2];
      if (typeof func !== "function") {
        return boolbase.falseFunc;
      }
      return function active(elem) {
        return func(elem) && next2(elem);
      };
    };
  }
  const pseudos = {
    empty(elem, { adapter }) {
      return !adapter.getChildren(elem).some((elem2) => (
        // FIXME: `getText` call is potentially expensive.
        adapter.isTag(elem2) || adapter.getText(elem2) !== ""
      ));
    },
    "first-child"(elem, { adapter, equals }) {
      if (adapter.prevElementSibling) {
        return adapter.prevElementSibling(elem) == null;
      }
      const firstChild = adapter.getSiblings(elem).find((elem2) => adapter.isTag(elem2));
      return firstChild != null && equals(elem, firstChild);
    },
    "last-child"(elem, { adapter, equals }) {
      const siblings2 = adapter.getSiblings(elem);
      for (let i = siblings2.length - 1; i >= 0; i--) {
        if (equals(elem, siblings2[i]))
          return true;
        if (adapter.isTag(siblings2[i]))
          break;
      }
      return false;
    },
    "first-of-type"(elem, { adapter, equals }) {
      const siblings2 = adapter.getSiblings(elem);
      const elemName = adapter.getName(elem);
      for (let i = 0; i < siblings2.length; i++) {
        const currentSibling = siblings2[i];
        if (equals(elem, currentSibling))
          return true;
        if (adapter.isTag(currentSibling) && adapter.getName(currentSibling) === elemName) {
          break;
        }
      }
      return false;
    },
    "last-of-type"(elem, { adapter, equals }) {
      const siblings2 = adapter.getSiblings(elem);
      const elemName = adapter.getName(elem);
      for (let i = siblings2.length - 1; i >= 0; i--) {
        const currentSibling = siblings2[i];
        if (equals(elem, currentSibling))
          return true;
        if (adapter.isTag(currentSibling) && adapter.getName(currentSibling) === elemName) {
          break;
        }
      }
      return false;
    },
    "only-of-type"(elem, { adapter, equals }) {
      const elemName = adapter.getName(elem);
      return adapter.getSiblings(elem).every((sibling) => equals(elem, sibling) || !adapter.isTag(sibling) || adapter.getName(sibling) !== elemName);
    },
    "only-child"(elem, { adapter, equals }) {
      return adapter.getSiblings(elem).every((sibling) => equals(elem, sibling) || !adapter.isTag(sibling));
    }
  };
  function verifyPseudoArgs(func, name2, subselect, argIndex) {
    if (subselect === null) {
      if (func.length > argIndex) {
        throw new Error(`Pseudo-class :${name2} requires an argument`);
      }
    } else if (func.length === argIndex) {
      throw new Error(`Pseudo-class :${name2} doesn't have any arguments`);
    }
  }
  const aliases = {
    // Links
    "any-link": ":is(a, area, link)[href]",
    link: ":any-link:not(:visited)",
    // Forms
    // https://html.spec.whatwg.org/multipage/scripting.html#disabled-elements
    disabled: `:is(
        :is(button, input, select, textarea, optgroup, option)[disabled],
        optgroup[disabled] > option,
        fieldset[disabled]:not(fieldset[disabled] legend:first-of-type *)
    )`,
    enabled: ":not(:disabled)",
    checked: ":is(:is(input[type=radio], input[type=checkbox])[checked], option:selected)",
    required: ":is(input, select, textarea)[required]",
    optional: ":is(input, select, textarea):not([required])",
    // JQuery extensions
    // https://html.spec.whatwg.org/multipage/form-elements.html#concept-option-selectedness
    selected: "option:is([selected], select:not([multiple]):not(:has(> option[selected])) > :first-of-type)",
    checkbox: "[type=checkbox]",
    file: "[type=file]",
    password: "[type=password]",
    radio: "[type=radio]",
    reset: "[type=reset]",
    image: "[type=image]",
    submit: "[type=submit]",
    parent: ":not(:empty)",
    header: ":is(h1, h2, h3, h4, h5, h6)",
    button: ":is(button, input[type=button])",
    input: ":is(input, textarea, select, button)",
    text: "input:is(:not([type!='']), [type=text])"
  };
  const PLACEHOLDER_ELEMENT = {};
  function ensureIsTag(next2, adapter) {
    if (next2 === boolbase.falseFunc)
      return boolbase.falseFunc;
    return (elem) => adapter.isTag(elem) && next2(elem);
  }
  function getNextSiblings(elem, adapter) {
    const siblings2 = adapter.getSiblings(elem);
    if (siblings2.length <= 1)
      return [];
    const elemIndex = siblings2.indexOf(elem);
    if (elemIndex < 0 || elemIndex === siblings2.length - 1)
      return [];
    return siblings2.slice(elemIndex + 1).filter(adapter.isTag);
  }
  function copyOptions(options) {
    return {
      xmlMode: !!options.xmlMode,
      lowerCaseAttributeNames: !!options.lowerCaseAttributeNames,
      lowerCaseTags: !!options.lowerCaseTags,
      quirksMode: !!options.quirksMode,
      cacheResults: !!options.cacheResults,
      pseudos: options.pseudos,
      adapter: options.adapter,
      equals: options.equals
    };
  }
  const is$2 = (next2, token, options, context, compileToken2) => {
    const func = compileToken2(token, copyOptions(options), context);
    return func === boolbase.trueFunc ? next2 : func === boolbase.falseFunc ? boolbase.falseFunc : (elem) => func(elem) && next2(elem);
  };
  const subselects = {
    is: is$2,
    /**
     * `:matches` and `:where` are aliases for `:is`.
     */
    matches: is$2,
    where: is$2,
    not(next2, token, options, context, compileToken2) {
      const func = compileToken2(token, copyOptions(options), context);
      return func === boolbase.falseFunc ? next2 : func === boolbase.trueFunc ? boolbase.falseFunc : (elem) => !func(elem) && next2(elem);
    },
    has(next2, subselect, options, _context, compileToken2) {
      const { adapter } = options;
      const opts = copyOptions(options);
      opts.relativeSelector = true;
      const context = subselect.some((s) => s.some(isTraversal)) ? (
        // Used as a placeholder. Will be replaced with the actual element.
        [PLACEHOLDER_ELEMENT]
      ) : void 0;
      const compiled = compileToken2(subselect, opts, context);
      if (compiled === boolbase.falseFunc)
        return boolbase.falseFunc;
      const hasElement = ensureIsTag(compiled, adapter);
      if (context && compiled !== boolbase.trueFunc) {
        const { shouldTestNextSiblings = false } = compiled;
        return (elem) => {
          if (!next2(elem))
            return false;
          context[0] = elem;
          const childs = adapter.getChildren(elem);
          const nextElements = shouldTestNextSiblings ? [...childs, ...getNextSiblings(elem, adapter)] : childs;
          return adapter.existsOne(hasElement, nextElements);
        };
      }
      return (elem) => next2(elem) && adapter.existsOne(hasElement, adapter.getChildren(elem));
    }
  };
  function compilePseudoSelector(next2, selector, options, context, compileToken2) {
    var _a2;
    const { name: name2, data: data2 } = selector;
    if (Array.isArray(data2)) {
      if (!(name2 in subselects)) {
        throw new Error(`Unknown pseudo-class :${name2}(${data2})`);
      }
      return subselects[name2](next2, data2, options, context, compileToken2);
    }
    const userPseudo = (_a2 = options.pseudos) === null || _a2 === void 0 ? void 0 : _a2[name2];
    const stringPseudo = typeof userPseudo === "string" ? userPseudo : aliases[name2];
    if (typeof stringPseudo === "string") {
      if (data2 != null) {
        throw new Error(`Pseudo ${name2} doesn't have any arguments`);
      }
      const alias = parse$2(stringPseudo);
      return subselects["is"](next2, alias, options, context, compileToken2);
    }
    if (typeof userPseudo === "function") {
      verifyPseudoArgs(userPseudo, name2, data2, 1);
      return (elem) => userPseudo(elem, data2) && next2(elem);
    }
    if (name2 in filters) {
      return filters[name2](next2, data2, options, context);
    }
    if (name2 in pseudos) {
      const pseudo = pseudos[name2];
      verifyPseudoArgs(pseudo, name2, data2, 2);
      return (elem) => pseudo(elem, options, data2) && next2(elem);
    }
    throw new Error(`Unknown pseudo-class :${name2}`);
  }
  function getElementParent(node, adapter) {
    const parent2 = adapter.getParent(node);
    if (parent2 && adapter.isTag(parent2)) {
      return parent2;
    }
    return null;
  }
  function compileGeneralSelector(next2, selector, options, context, compileToken2) {
    const { adapter, equals } = options;
    switch (selector.type) {
      case SelectorType.PseudoElement: {
        throw new Error("Pseudo-elements are not supported by css-select");
      }
      case SelectorType.ColumnCombinator: {
        throw new Error("Column combinators are not yet supported by css-select");
      }
      case SelectorType.Attribute: {
        if (selector.namespace != null) {
          throw new Error("Namespaced attributes are not yet supported by css-select");
        }
        if (!options.xmlMode || options.lowerCaseAttributeNames) {
          selector.name = selector.name.toLowerCase();
        }
        return attributeRules[selector.action](next2, selector, options);
      }
      case SelectorType.Pseudo: {
        return compilePseudoSelector(next2, selector, options, context, compileToken2);
      }
      // Tags
      case SelectorType.Tag: {
        if (selector.namespace != null) {
          throw new Error("Namespaced tag names are not yet supported by css-select");
        }
        let { name: name2 } = selector;
        if (!options.xmlMode || options.lowerCaseTags) {
          name2 = name2.toLowerCase();
        }
        return function tag(elem) {
          return adapter.getName(elem) === name2 && next2(elem);
        };
      }
      // Traversal
      case SelectorType.Descendant: {
        if (options.cacheResults === false || typeof WeakSet === "undefined") {
          return function descendant(elem) {
            let current = elem;
            while (current = getElementParent(current, adapter)) {
              if (next2(current)) {
                return true;
              }
            }
            return false;
          };
        }
        const isFalseCache = /* @__PURE__ */ new WeakSet();
        return function cachedDescendant(elem) {
          let current = elem;
          while (current = getElementParent(current, adapter)) {
            if (!isFalseCache.has(current)) {
              if (adapter.isTag(current) && next2(current)) {
                return true;
              }
              isFalseCache.add(current);
            }
          }
          return false;
        };
      }
      case "_flexibleDescendant": {
        return function flexibleDescendant(elem) {
          let current = elem;
          do {
            if (next2(current))
              return true;
          } while (current = getElementParent(current, adapter));
          return false;
        };
      }
      case SelectorType.Parent: {
        return function parent2(elem) {
          return adapter.getChildren(elem).some((elem2) => adapter.isTag(elem2) && next2(elem2));
        };
      }
      case SelectorType.Child: {
        return function child(elem) {
          const parent2 = adapter.getParent(elem);
          return parent2 != null && adapter.isTag(parent2) && next2(parent2);
        };
      }
      case SelectorType.Sibling: {
        return function sibling(elem) {
          const siblings2 = adapter.getSiblings(elem);
          for (let i = 0; i < siblings2.length; i++) {
            const currentSibling = siblings2[i];
            if (equals(elem, currentSibling))
              break;
            if (adapter.isTag(currentSibling) && next2(currentSibling)) {
              return true;
            }
          }
          return false;
        };
      }
      case SelectorType.Adjacent: {
        if (adapter.prevElementSibling) {
          return function adjacent(elem) {
            const previous = adapter.prevElementSibling(elem);
            return previous != null && next2(previous);
          };
        }
        return function adjacent(elem) {
          const siblings2 = adapter.getSiblings(elem);
          let lastElement;
          for (let i = 0; i < siblings2.length; i++) {
            const currentSibling = siblings2[i];
            if (equals(elem, currentSibling))
              break;
            if (adapter.isTag(currentSibling)) {
              lastElement = currentSibling;
            }
          }
          return !!lastElement && next2(lastElement);
        };
      }
      case SelectorType.Universal: {
        if (selector.namespace != null && selector.namespace !== "*") {
          throw new Error("Namespaced universal selectors are not yet supported by css-select");
        }
        return next2;
      }
    }
  }
  function includesScopePseudo(t) {
    return t.type === SelectorType.Pseudo && (t.name === "scope" || Array.isArray(t.data) && t.data.some((data2) => data2.some(includesScopePseudo)));
  }
  const DESCENDANT_TOKEN = { type: SelectorType.Descendant };
  const FLEXIBLE_DESCENDANT_TOKEN = {
    type: "_flexibleDescendant"
  };
  const SCOPE_TOKEN = {
    type: SelectorType.Pseudo,
    name: "scope",
    data: null
  };
  function absolutize(token, { adapter }, context) {
    const hasContext = !!(context === null || context === void 0 ? void 0 : context.every((e) => {
      const parent2 = adapter.isTag(e) && adapter.getParent(e);
      return e === PLACEHOLDER_ELEMENT || parent2 && adapter.isTag(parent2);
    }));
    for (const t of token) {
      if (t.length > 0 && isTraversal(t[0]) && t[0].type !== SelectorType.Descendant) ;
      else if (hasContext && !t.some(includesScopePseudo)) {
        t.unshift(DESCENDANT_TOKEN);
      } else {
        continue;
      }
      t.unshift(SCOPE_TOKEN);
    }
  }
  function compileToken(token, options, context) {
    var _a2;
    token.forEach(sortByProcedure);
    context = (_a2 = options.context) !== null && _a2 !== void 0 ? _a2 : context;
    const isArrayContext = Array.isArray(context);
    const finalContext = context && (Array.isArray(context) ? context : [context]);
    if (options.relativeSelector !== false) {
      absolutize(token, options, finalContext);
    } else if (token.some((t) => t.length > 0 && isTraversal(t[0]))) {
      throw new Error("Relative selectors are not allowed when the `relativeSelector` option is disabled");
    }
    let shouldTestNextSiblings = false;
    const query = token.map((rules) => {
      if (rules.length >= 2) {
        const [first2, second] = rules;
        if (first2.type !== SelectorType.Pseudo || first2.name !== "scope") ;
        else if (isArrayContext && second.type === SelectorType.Descendant) {
          rules[1] = FLEXIBLE_DESCENDANT_TOKEN;
        } else if (second.type === SelectorType.Adjacent || second.type === SelectorType.Sibling) {
          shouldTestNextSiblings = true;
        }
      }
      return compileRules(rules, options, finalContext);
    }).reduce(reduceRules, boolbase.falseFunc);
    query.shouldTestNextSiblings = shouldTestNextSiblings;
    return query;
  }
  function compileRules(rules, options, context) {
    var _a2;
    return rules.reduce((previous, rule) => previous === boolbase.falseFunc ? boolbase.falseFunc : compileGeneralSelector(previous, rule, options, context, compileToken), (_a2 = options.rootFunc) !== null && _a2 !== void 0 ? _a2 : boolbase.trueFunc);
  }
  function reduceRules(a, b) {
    if (b === boolbase.falseFunc || a === boolbase.trueFunc) {
      return a;
    }
    if (a === boolbase.falseFunc || b === boolbase.trueFunc) {
      return b;
    }
    return function combine(elem) {
      return a(elem) || b(elem);
    };
  }
  const defaultEquals = (a, b) => a === b;
  const defaultOptions$1 = {
    adapter: DomUtils,
    equals: defaultEquals
  };
  function convertOptionFormats(options) {
    var _a2, _b, _c, _d;
    const opts = options !== null && options !== void 0 ? options : defaultOptions$1;
    (_a2 = opts.adapter) !== null && _a2 !== void 0 ? _a2 : opts.adapter = DomUtils;
    (_b = opts.equals) !== null && _b !== void 0 ? _b : opts.equals = (_d = (_c = opts.adapter) === null || _c === void 0 ? void 0 : _c.equals) !== null && _d !== void 0 ? _d : defaultEquals;
    return opts;
  }
  function wrapCompile(func) {
    return function addAdapter(selector, options, context) {
      const opts = convertOptionFormats(options);
      return func(selector, opts, context);
    };
  }
  const _compileToken = wrapCompile(compileToken);
  function prepareContext(elems, adapter, shouldTestNextSiblings = false) {
    if (shouldTestNextSiblings) {
      elems = appendNextSiblings(elems, adapter);
    }
    return Array.isArray(elems) ? adapter.removeSubsets(elems) : adapter.getChildren(elems);
  }
  function appendNextSiblings(elem, adapter) {
    const elems = Array.isArray(elem) ? elem.slice(0) : [elem];
    const elemsLength = elems.length;
    for (let i = 0; i < elemsLength; i++) {
      const nextSiblings = getNextSiblings(elems[i], adapter);
      elems.push(...nextSiblings);
    }
    return elems;
  }
  const filterNames = /* @__PURE__ */ new Set([
    "first",
    "last",
    "eq",
    "gt",
    "nth",
    "lt",
    "even",
    "odd"
  ]);
  function isFilter(s) {
    if (s.type !== "pseudo")
      return false;
    if (filterNames.has(s.name))
      return true;
    if (s.name === "not" && Array.isArray(s.data)) {
      return s.data.some((s2) => s2.some(isFilter));
    }
    return false;
  }
  function getLimit(filter2, data2, partLimit) {
    const num = data2 != null ? parseInt(data2, 10) : NaN;
    switch (filter2) {
      case "first":
        return 1;
      case "nth":
      case "eq":
        return isFinite(num) ? num >= 0 ? num + 1 : Infinity : 0;
      case "lt":
        return isFinite(num) ? num >= 0 ? Math.min(num, partLimit) : Infinity : 0;
      case "gt":
        return isFinite(num) ? Infinity : 0;
      case "odd":
        return 2 * partLimit;
      case "even":
        return 2 * partLimit - 1;
      case "last":
      case "not":
        return Infinity;
    }
  }
  function getDocumentRoot(node) {
    while (node.parent)
      node = node.parent;
    return node;
  }
  function groupSelectors(selectors) {
    const filteredSelectors = [];
    const plainSelectors = [];
    for (const selector of selectors) {
      if (selector.some(isFilter)) {
        filteredSelectors.push(selector);
      } else {
        plainSelectors.push(selector);
      }
    }
    return [plainSelectors, filteredSelectors];
  }
  const UNIVERSAL_SELECTOR = {
    type: SelectorType.Universal,
    namespace: null
  };
  const SCOPE_PSEUDO = {
    type: SelectorType.Pseudo,
    name: "scope",
    data: null
  };
  function is$1(element, selector, options = {}) {
    return some([element], selector, options);
  }
  function some(elements, selector, options = {}) {
    if (typeof selector === "function")
      return elements.some(selector);
    const [plain, filtered] = groupSelectors(parse$2(selector));
    return plain.length > 0 && elements.some(_compileToken(plain, options)) || filtered.some((sel) => filterBySelector(sel, elements, options).length > 0);
  }
  function filterByPosition(filter2, elems, data2, options) {
    const num = typeof data2 === "string" ? parseInt(data2, 10) : NaN;
    switch (filter2) {
      case "first":
      case "lt":
        return elems;
      case "last":
        return elems.length > 0 ? [elems[elems.length - 1]] : elems;
      case "nth":
      case "eq":
        return isFinite(num) && Math.abs(num) < elems.length ? [num < 0 ? elems[elems.length + num] : elems[num]] : [];
      case "gt":
        return isFinite(num) ? elems.slice(num + 1) : [];
      case "even":
        return elems.filter((_, i) => i % 2 === 0);
      case "odd":
        return elems.filter((_, i) => i % 2 === 1);
      case "not": {
        const filtered = new Set(filterParsed(data2, elems, options));
        return elems.filter((e) => !filtered.has(e));
      }
    }
  }
  function filter$1(selector, elements, options = {}) {
    return filterParsed(parse$2(selector), elements, options);
  }
  function filterParsed(selector, elements, options) {
    if (elements.length === 0)
      return [];
    const [plainSelectors, filteredSelectors] = groupSelectors(selector);
    let found;
    if (plainSelectors.length) {
      const filtered = filterElements(elements, plainSelectors, options);
      if (filteredSelectors.length === 0) {
        return filtered;
      }
      if (filtered.length) {
        found = new Set(filtered);
      }
    }
    for (let i = 0; i < filteredSelectors.length && (found === null || found === void 0 ? void 0 : found.size) !== elements.length; i++) {
      const filteredSelector = filteredSelectors[i];
      const missing = found ? elements.filter((e) => isTag(e) && !found.has(e)) : elements;
      if (missing.length === 0)
        break;
      const filtered = filterBySelector(filteredSelector, elements, options);
      if (filtered.length) {
        if (!found) {
          if (i === filteredSelectors.length - 1) {
            return filtered;
          }
          found = new Set(filtered);
        } else {
          filtered.forEach((el) => found.add(el));
        }
      }
    }
    return typeof found !== "undefined" ? found.size === elements.length ? elements : (
      // Filter elements to preserve order
      elements.filter((el) => found.has(el))
    ) : [];
  }
  function filterBySelector(selector, elements, options) {
    var _a2;
    if (selector.some(isTraversal$1)) {
      const root2 = (_a2 = options.root) !== null && _a2 !== void 0 ? _a2 : getDocumentRoot(elements[0]);
      const opts = { ...options, context: elements, relativeSelector: false };
      selector.push(SCOPE_PSEUDO);
      return findFilterElements(root2, selector, opts, true, elements.length);
    }
    return findFilterElements(elements, selector, options, false, elements.length);
  }
  function select(selector, root2, options = {}, limit = Infinity) {
    if (typeof selector === "function") {
      return find$1(root2, selector);
    }
    const [plain, filtered] = groupSelectors(parse$2(selector));
    const results = filtered.map((sel) => findFilterElements(root2, sel, options, true, limit));
    if (plain.length) {
      results.push(findElements(root2, plain, options, limit));
    }
    if (results.length === 0) {
      return [];
    }
    if (results.length === 1) {
      return results[0];
    }
    return uniqueSort(results.reduce((a, b) => [...a, ...b]));
  }
  function findFilterElements(root2, selector, options, queryForSelector, totalLimit) {
    const filterIndex = selector.findIndex(isFilter);
    const sub = selector.slice(0, filterIndex);
    const filter2 = selector[filterIndex];
    const partLimit = selector.length - 1 === filterIndex ? totalLimit : Infinity;
    const limit = getLimit(filter2.name, filter2.data, partLimit);
    if (limit === 0)
      return [];
    const elemsNoLimit = sub.length === 0 && !Array.isArray(root2) ? getChildren(root2).filter(isTag) : sub.length === 0 ? (Array.isArray(root2) ? root2 : [root2]).filter(isTag) : queryForSelector || sub.some(isTraversal$1) ? findElements(root2, [sub], options, limit) : filterElements(root2, [sub], options);
    const elems = elemsNoLimit.slice(0, limit);
    let result = filterByPosition(filter2.name, elems, filter2.data, options);
    if (result.length === 0 || selector.length === filterIndex + 1) {
      return result;
    }
    const remainingSelector = selector.slice(filterIndex + 1);
    const remainingHasTraversal = remainingSelector.some(isTraversal$1);
    if (remainingHasTraversal) {
      if (isTraversal$1(remainingSelector[0])) {
        const { type } = remainingSelector[0];
        if (type === SelectorType.Sibling || type === SelectorType.Adjacent) {
          result = prepareContext(result, DomUtils, true);
        }
        remainingSelector.unshift(UNIVERSAL_SELECTOR);
      }
      options = {
        ...options,
        // Avoid absolutizing the selector
        relativeSelector: false,
        /*
         * Add a custom root func, to make sure traversals don't match elements
         * that aren't a part of the considered tree.
         */
        rootFunc: (el) => result.includes(el)
      };
    } else if (options.rootFunc && options.rootFunc !== boolbaseExports.trueFunc) {
      options = { ...options, rootFunc: boolbaseExports.trueFunc };
    }
    return remainingSelector.some(isFilter) ? findFilterElements(result, remainingSelector, options, false, totalLimit) : remainingHasTraversal ? (
      // Query existing elements to resolve traversal.
      findElements(result, [remainingSelector], options, totalLimit)
    ) : (
      // If we don't have any more traversals, simply filter elements.
      filterElements(result, [remainingSelector], options)
    );
  }
  function findElements(root2, sel, options, limit) {
    const query = _compileToken(sel, options, root2);
    return find$1(root2, query, limit);
  }
  function find$1(root2, query, limit = Infinity) {
    const elems = prepareContext(root2, DomUtils, query.shouldTestNextSiblings);
    return find$2((node) => isTag(node) && query(node), elems, true, limit);
  }
  function filterElements(elements, sel, options) {
    const els = (Array.isArray(elements) ? elements : [elements]).filter(isTag);
    if (els.length === 0)
      return els;
    const query = _compileToken(sel, options);
    return query === boolbaseExports.trueFunc ? els : els.filter(query);
  }
  const reSiblingSelector = /^\s*[+~]/;
  function find(selectorOrHaystack) {
    if (!selectorOrHaystack) {
      return this._make([]);
    }
    if (typeof selectorOrHaystack !== "string") {
      const haystack = isCheerio(selectorOrHaystack) ? selectorOrHaystack.toArray() : [selectorOrHaystack];
      const context = this.toArray();
      return this._make(haystack.filter((elem) => context.some((node) => contains(node, elem))));
    }
    return this._findBySelector(selectorOrHaystack, Number.POSITIVE_INFINITY);
  }
  function _findBySelector(selector, limit) {
    var _a2;
    const context = this.toArray();
    const elems = reSiblingSelector.test(selector) ? context : this.children().toArray();
    const options = {
      context,
      root: (_a2 = this._root) === null || _a2 === void 0 ? void 0 : _a2[0],
      // Pass options that are recognized by `cheerio-select`
      xmlMode: this.options.xmlMode,
      lowerCaseTags: this.options.lowerCaseTags,
      lowerCaseAttributeNames: this.options.lowerCaseAttributeNames,
      pseudos: this.options.pseudos,
      quirksMode: this.options.quirksMode
    };
    return this._make(select(selector, elems, options, limit));
  }
  function _getMatcher(matchMap) {
    return function(fn, ...postFns) {
      return function(selector) {
        var _a2;
        let matched = matchMap(fn, this);
        if (selector) {
          matched = filterArray(matched, selector, this.options.xmlMode, (_a2 = this._root) === null || _a2 === void 0 ? void 0 : _a2[0]);
        }
        return this._make(
          // Post processing is only necessary if there is more than one element.
          this.length > 1 && matched.length > 1 ? postFns.reduce((elems, fn2) => fn2(elems), matched) : matched
        );
      };
    };
  }
  const _matcher = _getMatcher((fn, elems) => {
    let ret = [];
    for (let i = 0; i < elems.length; i++) {
      const value = fn(elems[i]);
      if (value.length > 0)
        ret = ret.concat(value);
    }
    return ret;
  });
  const _singleMatcher = _getMatcher((fn, elems) => {
    const ret = [];
    for (let i = 0; i < elems.length; i++) {
      const value = fn(elems[i]);
      if (value !== null) {
        ret.push(value);
      }
    }
    return ret;
  });
  function _matchUntil(nextElem, ...postFns) {
    let matches = null;
    const innerMatcher = _getMatcher((nextElem2, elems) => {
      const matched = [];
      domEach(elems, (elem) => {
        for (let next2; next2 = nextElem2(elem); elem = next2) {
          if (matches === null || matches === void 0 ? void 0 : matches(next2, matched.length))
            break;
          matched.push(next2);
        }
      });
      return matched;
    })(nextElem, ...postFns);
    return function(selector, filterSelector) {
      matches = typeof selector === "string" ? (elem) => is$1(elem, selector, this.options) : selector ? getFilterFn(selector) : null;
      const ret = innerMatcher.call(this, filterSelector);
      matches = null;
      return ret;
    };
  }
  function _removeDuplicates(elems) {
    return elems.length > 1 ? Array.from(new Set(elems)) : elems;
  }
  const parent = _singleMatcher(({ parent: parent2 }) => parent2 && !isDocument$1(parent2) ? parent2 : null, _removeDuplicates);
  const parents = _matcher((elem) => {
    const matched = [];
    while (elem.parent && !isDocument$1(elem.parent)) {
      matched.push(elem.parent);
      elem = elem.parent;
    }
    return matched;
  }, uniqueSort, (elems) => elems.reverse());
  const parentsUntil = _matchUntil(({ parent: parent2 }) => parent2 && !isDocument$1(parent2) ? parent2 : null, uniqueSort, (elems) => elems.reverse());
  function closest(selector) {
    var _a2;
    const set2 = [];
    if (!selector) {
      return this._make(set2);
    }
    const selectOpts = {
      xmlMode: this.options.xmlMode,
      root: (_a2 = this._root) === null || _a2 === void 0 ? void 0 : _a2[0]
    };
    const selectFn = typeof selector === "string" ? (elem) => is$1(elem, selector, selectOpts) : getFilterFn(selector);
    domEach(this, (elem) => {
      if (elem && !isDocument$1(elem) && !isTag(elem)) {
        elem = elem.parent;
      }
      while (elem && isTag(elem)) {
        if (selectFn(elem, 0)) {
          if (!set2.includes(elem)) {
            set2.push(elem);
          }
          break;
        }
        elem = elem.parent;
      }
    });
    return this._make(set2);
  }
  const next = _singleMatcher((elem) => nextElementSibling(elem));
  const nextAll = _matcher((elem) => {
    const matched = [];
    while (elem.next) {
      elem = elem.next;
      if (isTag(elem))
        matched.push(elem);
    }
    return matched;
  }, _removeDuplicates);
  const nextUntil = _matchUntil((el) => nextElementSibling(el), _removeDuplicates);
  const prev = _singleMatcher((elem) => prevElementSibling(elem));
  const prevAll = _matcher((elem) => {
    const matched = [];
    while (elem.prev) {
      elem = elem.prev;
      if (isTag(elem))
        matched.push(elem);
    }
    return matched;
  }, _removeDuplicates);
  const prevUntil = _matchUntil((el) => prevElementSibling(el), _removeDuplicates);
  const siblings = _matcher((elem) => getSiblings(elem).filter((el) => isTag(el) && el !== elem), uniqueSort);
  const children = _matcher((elem) => getChildren(elem).filter(isTag), _removeDuplicates);
  function contents() {
    const elems = this.toArray().reduce((newElems, elem) => hasChildren(elem) ? newElems.concat(elem.children) : newElems, []);
    return this._make(elems);
  }
  function each(fn) {
    let i = 0;
    const len = this.length;
    while (i < len && fn.call(this[i], i, this[i]) !== false)
      ++i;
    return this;
  }
  function map$2(fn) {
    let elems = [];
    for (let i = 0; i < this.length; i++) {
      const el = this[i];
      const val2 = fn.call(el, i, el);
      if (val2 != null) {
        elems = elems.concat(val2);
      }
    }
    return this._make(elems);
  }
  function getFilterFn(match) {
    if (typeof match === "function") {
      return (el, i) => match.call(el, i, el);
    }
    if (isCheerio(match)) {
      return (el) => Array.prototype.includes.call(match, el);
    }
    return function(el) {
      return match === el;
    };
  }
  function filter(match) {
    var _a2;
    return this._make(filterArray(this.toArray(), match, this.options.xmlMode, (_a2 = this._root) === null || _a2 === void 0 ? void 0 : _a2[0]));
  }
  function filterArray(nodes, match, xmlMode, root2) {
    return typeof match === "string" ? filter$1(match, nodes, { xmlMode, root: root2 }) : nodes.filter(getFilterFn(match));
  }
  function is(selector) {
    const nodes = this.toArray();
    return typeof selector === "string" ? some(nodes.filter(isTag), selector, this.options) : selector ? nodes.some(getFilterFn(selector)) : false;
  }
  function not(match) {
    let nodes = this.toArray();
    if (typeof match === "string") {
      const matches = new Set(filter$1(match, nodes, this.options));
      nodes = nodes.filter((el) => !matches.has(el));
    } else {
      const filterFn = getFilterFn(match);
      nodes = nodes.filter((el, i) => !filterFn(el, i));
    }
    return this._make(nodes);
  }
  function has$1(selectorOrHaystack) {
    return this.filter(typeof selectorOrHaystack === "string" ? (
      // Using the `:has` selector here short-circuits searches.
      `:has(${selectorOrHaystack})`
    ) : (_, el) => this._make(el).find(selectorOrHaystack).length > 0);
  }
  function first() {
    return this.length > 1 ? this._make(this[0]) : this;
  }
  function last() {
    return this.length > 0 ? this._make(this[this.length - 1]) : this;
  }
  function eq(i) {
    var _a2;
    i = +i;
    if (i === 0 && this.length <= 1)
      return this;
    if (i < 0)
      i = this.length + i;
    return this._make((_a2 = this[i]) !== null && _a2 !== void 0 ? _a2 : []);
  }
  function get(i) {
    if (i == null) {
      return this.toArray();
    }
    return this[i < 0 ? this.length + i : i];
  }
  function toArray() {
    return Array.prototype.slice.call(this);
  }
  function index(selectorOrNeedle) {
    let $haystack;
    let needle;
    if (selectorOrNeedle == null) {
      $haystack = this.parent().children();
      needle = this[0];
    } else if (typeof selectorOrNeedle === "string") {
      $haystack = this._make(selectorOrNeedle);
      needle = this[0];
    } else {
      $haystack = this;
      needle = isCheerio(selectorOrNeedle) ? selectorOrNeedle[0] : selectorOrNeedle;
    }
    return Array.prototype.indexOf.call($haystack, needle);
  }
  function slice(start, end2) {
    return this._make(Array.prototype.slice.call(this, start, end2));
  }
  function end() {
    var _a2;
    return (_a2 = this.prevObject) !== null && _a2 !== void 0 ? _a2 : this._make([]);
  }
  function add(other, context) {
    const selection = this._make(other, context);
    const contents2 = uniqueSort([...this.get(), ...selection.get()]);
    return this._make(contents2);
  }
  function addBack(selector) {
    return this.prevObject ? this.add(selector ? this.prevObject.filter(selector) : this.prevObject) : this;
  }
  const Traversing = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    _findBySelector,
    add,
    addBack,
    children,
    closest,
    contents,
    each,
    end,
    eq,
    filter,
    filterArray,
    find,
    first,
    get,
    has: has$1,
    index,
    is,
    last,
    map: map$2,
    next,
    nextAll,
    nextUntil,
    not,
    parent,
    parents,
    parentsUntil,
    prev,
    prevAll,
    prevUntil,
    siblings,
    slice,
    toArray
  }, Symbol.toStringTag, { value: "Module" }));
  function getParse(parser) {
    return function parse2(content, options, isDocument$1$1, context) {
      if (typeof Buffer !== "undefined" && Buffer.isBuffer(content)) {
        content = content.toString();
      }
      if (typeof content === "string") {
        return parser(content, options, isDocument$1$1, context);
      }
      const doc = content;
      if (!Array.isArray(doc) && isDocument$1(doc)) {
        return doc;
      }
      const root2 = new Document$1([]);
      update(doc, root2);
      return root2;
    };
  }
  function update(newChilds, parent2) {
    const arr = Array.isArray(newChilds) ? newChilds : [newChilds];
    if (parent2) {
      parent2.children = arr;
    } else {
      parent2 = null;
    }
    for (let i = 0; i < arr.length; i++) {
      const node = arr[i];
      if (node.parent && node.parent.children !== arr) {
        removeElement(node);
      }
      if (parent2) {
        node.prev = arr[i - 1] || null;
        node.next = arr[i + 1] || null;
      } else {
        node.prev = node.next = null;
      }
      node.parent = parent2;
    }
    return parent2;
  }
  function _makeDomArray(elem, clone2) {
    if (elem == null) {
      return [];
    }
    if (typeof elem === "string") {
      return this._parse(elem, this.options, false, null).children.slice(0);
    }
    if ("length" in elem) {
      if (elem.length === 1) {
        return this._makeDomArray(elem[0], clone2);
      }
      const result = [];
      for (let i = 0; i < elem.length; i++) {
        const el = elem[i];
        if (typeof el === "object") {
          if (el == null) {
            continue;
          }
          if (!("length" in el)) {
            result.push(clone2 ? cloneNode(el, true) : el);
            continue;
          }
        }
        result.push(...this._makeDomArray(el, clone2));
      }
      return result;
    }
    return [clone2 ? cloneNode(elem, true) : elem];
  }
  function _insert(concatenator) {
    return function(...elems) {
      const lastIdx = this.length - 1;
      return domEach(this, (el, i) => {
        if (!hasChildren(el))
          return;
        const domSrc = typeof elems[0] === "function" ? elems[0].call(el, i, this._render(el.children)) : elems;
        const dom = this._makeDomArray(domSrc, i < lastIdx);
        concatenator(dom, el.children, el);
      });
    };
  }
  function uniqueSplice(array, spliceIdx, spliceCount, newElems, parent2) {
    var _a2, _b;
    const spliceArgs = [
      spliceIdx,
      spliceCount,
      ...newElems
    ];
    const prev2 = spliceIdx === 0 ? null : array[spliceIdx - 1];
    const next2 = spliceIdx + spliceCount >= array.length ? null : array[spliceIdx + spliceCount];
    for (let idx = 0; idx < newElems.length; ++idx) {
      const node = newElems[idx];
      const oldParent = node.parent;
      if (oldParent) {
        const oldSiblings = oldParent.children;
        const prevIdx = oldSiblings.indexOf(node);
        if (prevIdx > -1) {
          oldParent.children.splice(prevIdx, 1);
          if (parent2 === oldParent && spliceIdx > prevIdx) {
            spliceArgs[0]--;
          }
        }
      }
      node.parent = parent2;
      if (node.prev) {
        node.prev.next = (_a2 = node.next) !== null && _a2 !== void 0 ? _a2 : null;
      }
      if (node.next) {
        node.next.prev = (_b = node.prev) !== null && _b !== void 0 ? _b : null;
      }
      node.prev = idx === 0 ? prev2 : newElems[idx - 1];
      node.next = idx === newElems.length - 1 ? next2 : newElems[idx + 1];
    }
    if (prev2) {
      prev2.next = newElems[0];
    }
    if (next2) {
      next2.prev = newElems[newElems.length - 1];
    }
    return array.splice(...spliceArgs);
  }
  function appendTo(target) {
    const appendTarget = isCheerio(target) ? target : this._make(target);
    appendTarget.append(this);
    return this;
  }
  function prependTo(target) {
    const prependTarget = isCheerio(target) ? target : this._make(target);
    prependTarget.prepend(this);
    return this;
  }
  const append = _insert((dom, children2, parent2) => {
    uniqueSplice(children2, children2.length, 0, dom, parent2);
  });
  const prepend = _insert((dom, children2, parent2) => {
    uniqueSplice(children2, 0, 0, dom, parent2);
  });
  function _wrap(insert) {
    return function(wrapper) {
      const lastIdx = this.length - 1;
      const lastParent = this.parents().last();
      for (let i = 0; i < this.length; i++) {
        const el = this[i];
        const wrap2 = typeof wrapper === "function" ? wrapper.call(el, i, el) : typeof wrapper === "string" && !isHtml(wrapper) ? lastParent.find(wrapper).clone() : wrapper;
        const [wrapperDom] = this._makeDomArray(wrap2, i < lastIdx);
        if (!wrapperDom || !hasChildren(wrapperDom))
          continue;
        let elInsertLocation = wrapperDom;
        let j = 0;
        while (j < elInsertLocation.children.length) {
          const child = elInsertLocation.children[j];
          if (isTag(child)) {
            elInsertLocation = child;
            j = 0;
          } else {
            j++;
          }
        }
        insert(el, elInsertLocation, [wrapperDom]);
      }
      return this;
    };
  }
  const wrap = _wrap((el, elInsertLocation, wrapperDom) => {
    const { parent: parent2 } = el;
    if (!parent2)
      return;
    const siblings2 = parent2.children;
    const index2 = siblings2.indexOf(el);
    update([el], elInsertLocation);
    uniqueSplice(siblings2, index2, 0, wrapperDom, parent2);
  });
  const wrapInner = _wrap((el, elInsertLocation, wrapperDom) => {
    if (!hasChildren(el))
      return;
    update(el.children, elInsertLocation);
    update(wrapperDom, el);
  });
  function unwrap(selector) {
    this.parent(selector).not("body").each((_, el) => {
      this._make(el).replaceWith(el.children);
    });
    return this;
  }
  function wrapAll(wrapper) {
    const el = this[0];
    if (el) {
      const wrap2 = this._make(typeof wrapper === "function" ? wrapper.call(el, 0, el) : wrapper).insertBefore(el);
      let elInsertLocation;
      for (let i = 0; i < wrap2.length; i++) {
        if (wrap2[i].type === "tag")
          elInsertLocation = wrap2[i];
      }
      let j = 0;
      while (elInsertLocation && j < elInsertLocation.children.length) {
        const child = elInsertLocation.children[j];
        if (child.type === "tag") {
          elInsertLocation = child;
          j = 0;
        } else {
          j++;
        }
      }
      if (elInsertLocation)
        this._make(elInsertLocation).append(this);
    }
    return this;
  }
  function after(...elems) {
    const lastIdx = this.length - 1;
    return domEach(this, (el, i) => {
      if (!hasChildren(el) || !el.parent) {
        return;
      }
      const siblings2 = el.parent.children;
      const index2 = siblings2.indexOf(el);
      if (index2 < 0)
        return;
      const domSrc = typeof elems[0] === "function" ? elems[0].call(el, i, this._render(el.children)) : elems;
      const dom = this._makeDomArray(domSrc, i < lastIdx);
      uniqueSplice(siblings2, index2 + 1, 0, dom, el.parent);
    });
  }
  function insertAfter(target) {
    if (typeof target === "string") {
      target = this._make(target);
    }
    this.remove();
    const clones = [];
    for (const el of this._makeDomArray(target)) {
      const clonedSelf = this.clone().toArray();
      const { parent: parent2 } = el;
      if (!parent2) {
        continue;
      }
      const siblings2 = parent2.children;
      const index2 = siblings2.indexOf(el);
      if (index2 < 0)
        continue;
      uniqueSplice(siblings2, index2 + 1, 0, clonedSelf, parent2);
      clones.push(...clonedSelf);
    }
    return this._make(clones);
  }
  function before(...elems) {
    const lastIdx = this.length - 1;
    return domEach(this, (el, i) => {
      if (!hasChildren(el) || !el.parent) {
        return;
      }
      const siblings2 = el.parent.children;
      const index2 = siblings2.indexOf(el);
      if (index2 < 0)
        return;
      const domSrc = typeof elems[0] === "function" ? elems[0].call(el, i, this._render(el.children)) : elems;
      const dom = this._makeDomArray(domSrc, i < lastIdx);
      uniqueSplice(siblings2, index2, 0, dom, el.parent);
    });
  }
  function insertBefore(target) {
    const targetArr = this._make(target);
    this.remove();
    const clones = [];
    domEach(targetArr, (el) => {
      const clonedSelf = this.clone().toArray();
      const { parent: parent2 } = el;
      if (!parent2) {
        return;
      }
      const siblings2 = parent2.children;
      const index2 = siblings2.indexOf(el);
      if (index2 < 0)
        return;
      uniqueSplice(siblings2, index2, 0, clonedSelf, parent2);
      clones.push(...clonedSelf);
    });
    return this._make(clones);
  }
  function remove(selector) {
    const elems = selector ? this.filter(selector) : this;
    domEach(elems, (el) => {
      removeElement(el);
      el.prev = el.next = el.parent = null;
    });
    return this;
  }
  function replaceWith(content) {
    return domEach(this, (el, i) => {
      const { parent: parent2 } = el;
      if (!parent2) {
        return;
      }
      const siblings2 = parent2.children;
      const cont = typeof content === "function" ? content.call(el, i, el) : content;
      const dom = this._makeDomArray(cont);
      update(dom, null);
      const index2 = siblings2.indexOf(el);
      uniqueSplice(siblings2, index2, 1, dom, parent2);
      if (!dom.includes(el)) {
        el.parent = el.prev = el.next = null;
      }
    });
  }
  function empty() {
    return domEach(this, (el) => {
      if (!hasChildren(el))
        return;
      for (const child of el.children) {
        child.next = child.prev = child.parent = null;
      }
      el.children.length = 0;
    });
  }
  function html(str) {
    if (str === void 0) {
      const el = this[0];
      if (!el || !hasChildren(el))
        return null;
      return this._render(el.children);
    }
    return domEach(this, (el) => {
      if (!hasChildren(el))
        return;
      for (const child of el.children) {
        child.next = child.prev = child.parent = null;
      }
      const content = isCheerio(str) ? str.toArray() : this._parse(`${str}`, this.options, false, el).children;
      update(content, el);
    });
  }
  function toString() {
    return this._render(this);
  }
  function text$2(str) {
    if (str === void 0) {
      return text$1(this);
    }
    if (typeof str === "function") {
      return domEach(this, (el, i) => this._make(el).text(str.call(el, i, text$1([el]))));
    }
    return domEach(this, (el) => {
      if (!hasChildren(el))
        return;
      for (const child of el.children) {
        child.next = child.prev = child.parent = null;
      }
      const textNode = new Text(`${str}`);
      update(textNode, el);
    });
  }
  function clone() {
    const clone2 = Array.prototype.map.call(this.get(), (el) => cloneNode(el, true));
    const root2 = new Document$1(clone2);
    for (const node of clone2) {
      node.parent = root2;
    }
    return this._make(clone2);
  }
  const Manipulation = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    _makeDomArray,
    after,
    append,
    appendTo,
    before,
    clone,
    empty,
    html,
    insertAfter,
    insertBefore,
    prepend,
    prependTo,
    remove,
    replaceWith,
    text: text$2,
    toString,
    unwrap,
    wrap,
    wrapAll,
    wrapInner
  }, Symbol.toStringTag, { value: "Module" }));
  function css(prop2, val2) {
    if (prop2 != null && val2 != null || // When `prop` is a "plain" object
    typeof prop2 === "object" && !Array.isArray(prop2)) {
      return domEach(this, (el, i) => {
        if (isTag(el)) {
          setCss(el, prop2, val2, i);
        }
      });
    }
    if (this.length === 0) {
      return void 0;
    }
    return getCss(this[0], prop2);
  }
  function setCss(el, prop2, value, idx) {
    if (typeof prop2 === "string") {
      const styles2 = getCss(el);
      const val2 = typeof value === "function" ? value.call(el, idx, styles2[prop2]) : value;
      if (val2 === "") {
        delete styles2[prop2];
      } else if (val2 != null) {
        styles2[prop2] = val2;
      }
      el.attribs["style"] = stringify$1(styles2);
    } else if (typeof prop2 === "object") {
      const keys = Object.keys(prop2);
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        setCss(el, k, prop2[k], i);
      }
    }
  }
  function getCss(el, prop2) {
    if (!el || !isTag(el))
      return;
    const styles2 = parse$3(el.attribs["style"]);
    if (typeof prop2 === "string") {
      return styles2[prop2];
    }
    if (Array.isArray(prop2)) {
      const newStyles = {};
      for (const item of prop2) {
        if (styles2[item] != null) {
          newStyles[item] = styles2[item];
        }
      }
      return newStyles;
    }
    return styles2;
  }
  function stringify$1(obj) {
    return Object.keys(obj).reduce((str, prop2) => `${str}${str ? " " : ""}${prop2}: ${obj[prop2]};`, "");
  }
  function parse$3(styles2) {
    styles2 = (styles2 || "").trim();
    if (!styles2)
      return {};
    const obj = {};
    let key;
    for (const str of styles2.split(";")) {
      const n = str.indexOf(":");
      if (n < 1 || n === str.length - 1) {
        const trimmed = str.trimEnd();
        if (trimmed.length > 0 && key !== void 0) {
          obj[key] += `;${trimmed}`;
        }
      } else {
        key = str.slice(0, n).trim();
        obj[key] = str.slice(n + 1).trim();
      }
    }
    return obj;
  }
  const Css = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    css
  }, Symbol.toStringTag, { value: "Module" }));
  const submittableSelector = "input,select,textarea,keygen";
  const r20 = /%20/g;
  const rCRLF = /\r?\n/g;
  function serialize() {
    const arr = this.serializeArray();
    const retArr = arr.map((data2) => `${encodeURIComponent(data2.name)}=${encodeURIComponent(data2.value)}`);
    return retArr.join("&").replace(r20, "+");
  }
  function serializeArray() {
    return this.map((_, elem) => {
      const $elem = this._make(elem);
      if (isTag(elem) && elem.name === "form") {
        return $elem.find(submittableSelector).toArray();
      }
      return $elem.filter(submittableSelector).toArray();
    }).filter(
      // Verify elements have a name (`attr.name`) and are not disabled (`:enabled`)
      '[name!=""]:enabled:not(:submit, :button, :image, :reset, :file):matches([checked], :not(:checkbox, :radio))'
    ).map((_, elem) => {
      var _a2;
      const $elem = this._make(elem);
      const name2 = $elem.attr("name");
      const value = (_a2 = $elem.val()) !== null && _a2 !== void 0 ? _a2 : "";
      if (Array.isArray(value)) {
        return value.map((val2) => (
          /*
           * We trim replace any line endings (e.g. `\r` or `\r\n` with `\r\n`) to guarantee consistency across platforms
           * These can occur inside of `<textarea>'s`
           */
          { name: name2, value: val2.replace(rCRLF, "\r\n") }
        ));
      }
      return { name: name2, value: value.replace(rCRLF, "\r\n") };
    }).toArray();
  }
  const Forms = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    serialize,
    serializeArray
  }, Symbol.toStringTag, { value: "Module" }));
  function getExtractDescr(descr) {
    var _a2;
    if (typeof descr === "string") {
      return { selector: descr, value: "textContent" };
    }
    return {
      selector: descr.selector,
      value: (_a2 = descr.value) !== null && _a2 !== void 0 ? _a2 : "textContent"
    };
  }
  function extract(map2) {
    const ret = {};
    for (const key in map2) {
      const descr = map2[key];
      const isArray = Array.isArray(descr);
      const { selector, value } = getExtractDescr(isArray ? descr[0] : descr);
      const fn = typeof value === "function" ? value : typeof value === "string" ? (el) => this._make(el).prop(value) : (el) => this._make(el).extract(value);
      if (isArray) {
        ret[key] = this._findBySelector(selector, Number.POSITIVE_INFINITY).map((_, el) => fn(el, key, ret)).get();
      } else {
        const $ = this._findBySelector(selector, 1);
        ret[key] = $.length > 0 ? fn($[0], key, ret) : void 0;
      }
    }
    return ret;
  }
  const Extract = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    extract
  }, Symbol.toStringTag, { value: "Module" }));
  class Cheerio {
    /**
     * Instance of cheerio. Methods are specified in the modules. Usage of this
     * constructor is not recommended. Please use `$.load` instead.
     *
     * @private
     * @param elements - The new selection.
     * @param root - Sets the root node.
     * @param options - Options for the instance.
     */
    constructor(elements, root2, options) {
      this.length = 0;
      this.options = options;
      this._root = root2;
      if (elements) {
        for (let idx = 0; idx < elements.length; idx++) {
          this[idx] = elements[idx];
        }
        this.length = elements.length;
      }
    }
  }
  Cheerio.prototype.cheerio = "[cheerio object]";
  Cheerio.prototype.splice = Array.prototype.splice;
  Cheerio.prototype[Symbol.iterator] = Array.prototype[Symbol.iterator];
  Object.assign(Cheerio.prototype, Attributes, Traversing, Manipulation, Css, Forms, Extract);
  function getLoad(parse2, render2) {
    return function load2(content, options, isDocument2 = true) {
      if (content == null) {
        throw new Error("cheerio.load() expects a string");
      }
      const internalOpts = flattenOptions(options);
      const initialRoot = parse2(content, internalOpts, isDocument2, null);
      class LoadedCheerio extends Cheerio {
        _make(selector, context) {
          const cheerio = initialize(selector, context);
          cheerio.prevObject = this;
          return cheerio;
        }
        _parse(content2, options2, isDocument3, context) {
          return parse2(content2, options2, isDocument3, context);
        }
        _render(dom) {
          return render2(dom, this.options);
        }
      }
      function initialize(selector, context, root2 = initialRoot, opts) {
        if (selector && isCheerio(selector))
          return selector;
        const options2 = flattenOptions(opts, internalOpts);
        const r = typeof root2 === "string" ? [parse2(root2, options2, false, null)] : "length" in root2 ? root2 : [root2];
        const rootInstance = isCheerio(r) ? r : new LoadedCheerio(r, null, options2);
        rootInstance._root = rootInstance;
        if (!selector) {
          return new LoadedCheerio(void 0, rootInstance, options2);
        }
        const elements = typeof selector === "string" && isHtml(selector) ? (
          // $(<html>)
          parse2(selector, options2, false, null).children
        ) : isNode$1(selector) ? (
          // $(dom)
          [selector]
        ) : Array.isArray(selector) ? (
          // $([dom])
          selector
        ) : void 0;
        const instance = new LoadedCheerio(elements, rootInstance, options2);
        if (elements) {
          return instance;
        }
        if (typeof selector !== "string") {
          throw new TypeError("Unexpected type of selector");
        }
        let search = selector;
        const searchContext = context ? (
          // If we don't have a context, maybe we have a root, from loading
          typeof context === "string" ? isHtml(context) ? (
            // $('li', '<ul>...</ul>')
            new LoadedCheerio([parse2(context, options2, false, null)], rootInstance, options2)
          ) : (
            // $('li', 'ul')
            (search = `${context} ${search}`, rootInstance)
          ) : isCheerio(context) ? (
            // $('li', $)
            context
          ) : (
            // $('li', node), $('li', [nodes])
            new LoadedCheerio(Array.isArray(context) ? context : [context], rootInstance, options2)
          )
        ) : rootInstance;
        if (!searchContext)
          return instance;
        return searchContext.find(search);
      }
      Object.assign(initialize, staticMethods, {
        load: load2,
        // `_root` and `_options` are used in static methods.
        _root: initialRoot,
        _options: internalOpts,
        // Add `fn` for plugins
        fn: LoadedCheerio.prototype,
        // Add the prototype here to maintain `instanceof` behavior.
        prototype: LoadedCheerio.prototype
      });
      return initialize;
    };
  }
  function isNode$1(obj) {
    return !!obj.name || obj.type === "root" || obj.type === "text" || obj.type === "comment";
  }
  var CharCodes$2;
  (function(CharCodes2) {
    CharCodes2[CharCodes2["Tab"] = 9] = "Tab";
    CharCodes2[CharCodes2["NewLine"] = 10] = "NewLine";
    CharCodes2[CharCodes2["FormFeed"] = 12] = "FormFeed";
    CharCodes2[CharCodes2["CarriageReturn"] = 13] = "CarriageReturn";
    CharCodes2[CharCodes2["Space"] = 32] = "Space";
    CharCodes2[CharCodes2["ExclamationMark"] = 33] = "ExclamationMark";
    CharCodes2[CharCodes2["Number"] = 35] = "Number";
    CharCodes2[CharCodes2["Amp"] = 38] = "Amp";
    CharCodes2[CharCodes2["SingleQuote"] = 39] = "SingleQuote";
    CharCodes2[CharCodes2["DoubleQuote"] = 34] = "DoubleQuote";
    CharCodes2[CharCodes2["Dash"] = 45] = "Dash";
    CharCodes2[CharCodes2["Slash"] = 47] = "Slash";
    CharCodes2[CharCodes2["Zero"] = 48] = "Zero";
    CharCodes2[CharCodes2["Nine"] = 57] = "Nine";
    CharCodes2[CharCodes2["Semi"] = 59] = "Semi";
    CharCodes2[CharCodes2["Lt"] = 60] = "Lt";
    CharCodes2[CharCodes2["Eq"] = 61] = "Eq";
    CharCodes2[CharCodes2["Gt"] = 62] = "Gt";
    CharCodes2[CharCodes2["Questionmark"] = 63] = "Questionmark";
    CharCodes2[CharCodes2["UpperA"] = 65] = "UpperA";
    CharCodes2[CharCodes2["LowerA"] = 97] = "LowerA";
    CharCodes2[CharCodes2["UpperF"] = 70] = "UpperF";
    CharCodes2[CharCodes2["LowerF"] = 102] = "LowerF";
    CharCodes2[CharCodes2["UpperZ"] = 90] = "UpperZ";
    CharCodes2[CharCodes2["LowerZ"] = 122] = "LowerZ";
    CharCodes2[CharCodes2["LowerX"] = 120] = "LowerX";
    CharCodes2[CharCodes2["OpeningSquareBracket"] = 91] = "OpeningSquareBracket";
  })(CharCodes$2 || (CharCodes$2 = {}));
  var State;
  (function(State2) {
    State2[State2["Text"] = 1] = "Text";
    State2[State2["BeforeTagName"] = 2] = "BeforeTagName";
    State2[State2["InTagName"] = 3] = "InTagName";
    State2[State2["InSelfClosingTag"] = 4] = "InSelfClosingTag";
    State2[State2["BeforeClosingTagName"] = 5] = "BeforeClosingTagName";
    State2[State2["InClosingTagName"] = 6] = "InClosingTagName";
    State2[State2["AfterClosingTagName"] = 7] = "AfterClosingTagName";
    State2[State2["BeforeAttributeName"] = 8] = "BeforeAttributeName";
    State2[State2["InAttributeName"] = 9] = "InAttributeName";
    State2[State2["AfterAttributeName"] = 10] = "AfterAttributeName";
    State2[State2["BeforeAttributeValue"] = 11] = "BeforeAttributeValue";
    State2[State2["InAttributeValueDq"] = 12] = "InAttributeValueDq";
    State2[State2["InAttributeValueSq"] = 13] = "InAttributeValueSq";
    State2[State2["InAttributeValueNq"] = 14] = "InAttributeValueNq";
    State2[State2["BeforeDeclaration"] = 15] = "BeforeDeclaration";
    State2[State2["InDeclaration"] = 16] = "InDeclaration";
    State2[State2["InProcessingInstruction"] = 17] = "InProcessingInstruction";
    State2[State2["BeforeComment"] = 18] = "BeforeComment";
    State2[State2["CDATASequence"] = 19] = "CDATASequence";
    State2[State2["InSpecialComment"] = 20] = "InSpecialComment";
    State2[State2["InCommentLike"] = 21] = "InCommentLike";
    State2[State2["BeforeSpecialS"] = 22] = "BeforeSpecialS";
    State2[State2["BeforeSpecialT"] = 23] = "BeforeSpecialT";
    State2[State2["SpecialStartSequence"] = 24] = "SpecialStartSequence";
    State2[State2["InSpecialTag"] = 25] = "InSpecialTag";
    State2[State2["InEntity"] = 26] = "InEntity";
  })(State || (State = {}));
  function isWhitespace(c) {
    return c === CharCodes$2.Space || c === CharCodes$2.NewLine || c === CharCodes$2.Tab || c === CharCodes$2.FormFeed || c === CharCodes$2.CarriageReturn;
  }
  function isEndOfTagSection(c) {
    return c === CharCodes$2.Slash || c === CharCodes$2.Gt || isWhitespace(c);
  }
  function isASCIIAlpha(c) {
    return c >= CharCodes$2.LowerA && c <= CharCodes$2.LowerZ || c >= CharCodes$2.UpperA && c <= CharCodes$2.UpperZ;
  }
  var QuoteType;
  (function(QuoteType2) {
    QuoteType2[QuoteType2["NoValue"] = 0] = "NoValue";
    QuoteType2[QuoteType2["Unquoted"] = 1] = "Unquoted";
    QuoteType2[QuoteType2["Single"] = 2] = "Single";
    QuoteType2[QuoteType2["Double"] = 3] = "Double";
  })(QuoteType || (QuoteType = {}));
  const Sequences = {
    Cdata: new Uint8Array([67, 68, 65, 84, 65, 91]),
    // CDATA[
    CdataEnd: new Uint8Array([93, 93, 62]),
    // ]]>
    CommentEnd: new Uint8Array([45, 45, 62]),
    // `-->`
    ScriptEnd: new Uint8Array([60, 47, 115, 99, 114, 105, 112, 116]),
    // `<\/script`
    StyleEnd: new Uint8Array([60, 47, 115, 116, 121, 108, 101]),
    // `</style`
    TitleEnd: new Uint8Array([60, 47, 116, 105, 116, 108, 101]),
    // `</title`
    TextareaEnd: new Uint8Array([
      60,
      47,
      116,
      101,
      120,
      116,
      97,
      114,
      101,
      97
    ])
    // `</textarea`
  };
  class Tokenizer {
    constructor({ xmlMode = false, decodeEntities = true }, cbs) {
      this.cbs = cbs;
      this.state = State.Text;
      this.buffer = "";
      this.sectionStart = 0;
      this.index = 0;
      this.entityStart = 0;
      this.baseState = State.Text;
      this.isSpecial = false;
      this.running = true;
      this.offset = 0;
      this.currentSequence = void 0;
      this.sequenceIndex = 0;
      this.xmlMode = xmlMode;
      this.decodeEntities = decodeEntities;
      this.entityDecoder = new EntityDecoder$1(xmlMode ? xmlDecodeTree$1 : htmlDecodeTree$1, (cp, consumed) => this.emitCodePoint(cp, consumed));
    }
    reset() {
      this.state = State.Text;
      this.buffer = "";
      this.sectionStart = 0;
      this.index = 0;
      this.baseState = State.Text;
      this.currentSequence = void 0;
      this.running = true;
      this.offset = 0;
    }
    write(chunk) {
      this.offset += this.buffer.length;
      this.buffer = chunk;
      this.parse();
    }
    end() {
      if (this.running)
        this.finish();
    }
    pause() {
      this.running = false;
    }
    resume() {
      this.running = true;
      if (this.index < this.buffer.length + this.offset) {
        this.parse();
      }
    }
    stateText(c) {
      if (c === CharCodes$2.Lt || !this.decodeEntities && this.fastForwardTo(CharCodes$2.Lt)) {
        if (this.index > this.sectionStart) {
          this.cbs.ontext(this.sectionStart, this.index);
        }
        this.state = State.BeforeTagName;
        this.sectionStart = this.index;
      } else if (this.decodeEntities && c === CharCodes$2.Amp) {
        this.startEntity();
      }
    }
    stateSpecialStartSequence(c) {
      const isEnd = this.sequenceIndex === this.currentSequence.length;
      const isMatch = isEnd ? (
        // If we are at the end of the sequence, make sure the tag name has ended
        isEndOfTagSection(c)
      ) : (
        // Otherwise, do a case-insensitive comparison
        (c | 32) === this.currentSequence[this.sequenceIndex]
      );
      if (!isMatch) {
        this.isSpecial = false;
      } else if (!isEnd) {
        this.sequenceIndex++;
        return;
      }
      this.sequenceIndex = 0;
      this.state = State.InTagName;
      this.stateInTagName(c);
    }
    /** Look for an end tag. For <title> tags, also decode entities. */
    stateInSpecialTag(c) {
      if (this.sequenceIndex === this.currentSequence.length) {
        if (c === CharCodes$2.Gt || isWhitespace(c)) {
          const endOfText = this.index - this.currentSequence.length;
          if (this.sectionStart < endOfText) {
            const actualIndex = this.index;
            this.index = endOfText;
            this.cbs.ontext(this.sectionStart, endOfText);
            this.index = actualIndex;
          }
          this.isSpecial = false;
          this.sectionStart = endOfText + 2;
          this.stateInClosingTagName(c);
          return;
        }
        this.sequenceIndex = 0;
      }
      if ((c | 32) === this.currentSequence[this.sequenceIndex]) {
        this.sequenceIndex += 1;
      } else if (this.sequenceIndex === 0) {
        if (this.currentSequence === Sequences.TitleEnd) {
          if (this.decodeEntities && c === CharCodes$2.Amp) {
            this.startEntity();
          }
        } else if (this.fastForwardTo(CharCodes$2.Lt)) {
          this.sequenceIndex = 1;
        }
      } else {
        this.sequenceIndex = Number(c === CharCodes$2.Lt);
      }
    }
    stateCDATASequence(c) {
      if (c === Sequences.Cdata[this.sequenceIndex]) {
        if (++this.sequenceIndex === Sequences.Cdata.length) {
          this.state = State.InCommentLike;
          this.currentSequence = Sequences.CdataEnd;
          this.sequenceIndex = 0;
          this.sectionStart = this.index + 1;
        }
      } else {
        this.sequenceIndex = 0;
        this.state = State.InDeclaration;
        this.stateInDeclaration(c);
      }
    }
    /**
     * When we wait for one specific character, we can speed things up
     * by skipping through the buffer until we find it.
     *
     * @returns Whether the character was found.
     */
    fastForwardTo(c) {
      while (++this.index < this.buffer.length + this.offset) {
        if (this.buffer.charCodeAt(this.index - this.offset) === c) {
          return true;
        }
      }
      this.index = this.buffer.length + this.offset - 1;
      return false;
    }
    /**
     * Comments and CDATA end with `-->` and `]]>`.
     *
     * Their common qualities are:
     * - Their end sequences have a distinct character they start with.
     * - That character is then repeated, so we have to check multiple repeats.
     * - All characters but the start character of the sequence can be skipped.
     */
    stateInCommentLike(c) {
      if (c === this.currentSequence[this.sequenceIndex]) {
        if (++this.sequenceIndex === this.currentSequence.length) {
          if (this.currentSequence === Sequences.CdataEnd) {
            this.cbs.oncdata(this.sectionStart, this.index, 2);
          } else {
            this.cbs.oncomment(this.sectionStart, this.index, 2);
          }
          this.sequenceIndex = 0;
          this.sectionStart = this.index + 1;
          this.state = State.Text;
        }
      } else if (this.sequenceIndex === 0) {
        if (this.fastForwardTo(this.currentSequence[0])) {
          this.sequenceIndex = 1;
        }
      } else if (c !== this.currentSequence[this.sequenceIndex - 1]) {
        this.sequenceIndex = 0;
      }
    }
    /**
     * HTML only allows ASCII alpha characters (a-z and A-Z) at the beginning of a tag name.
     *
     * XML allows a lot more characters here (@see https://www.w3.org/TR/REC-xml/#NT-NameStartChar).
     * We allow anything that wouldn't end the tag.
     */
    isTagStartChar(c) {
      return this.xmlMode ? !isEndOfTagSection(c) : isASCIIAlpha(c);
    }
    startSpecial(sequence, offset) {
      this.isSpecial = true;
      this.currentSequence = sequence;
      this.sequenceIndex = offset;
      this.state = State.SpecialStartSequence;
    }
    stateBeforeTagName(c) {
      if (c === CharCodes$2.ExclamationMark) {
        this.state = State.BeforeDeclaration;
        this.sectionStart = this.index + 1;
      } else if (c === CharCodes$2.Questionmark) {
        this.state = State.InProcessingInstruction;
        this.sectionStart = this.index + 1;
      } else if (this.isTagStartChar(c)) {
        const lower = c | 32;
        this.sectionStart = this.index;
        if (this.xmlMode) {
          this.state = State.InTagName;
        } else if (lower === Sequences.ScriptEnd[2]) {
          this.state = State.BeforeSpecialS;
        } else if (lower === Sequences.TitleEnd[2]) {
          this.state = State.BeforeSpecialT;
        } else {
          this.state = State.InTagName;
        }
      } else if (c === CharCodes$2.Slash) {
        this.state = State.BeforeClosingTagName;
      } else {
        this.state = State.Text;
        this.stateText(c);
      }
    }
    stateInTagName(c) {
      if (isEndOfTagSection(c)) {
        this.cbs.onopentagname(this.sectionStart, this.index);
        this.sectionStart = -1;
        this.state = State.BeforeAttributeName;
        this.stateBeforeAttributeName(c);
      }
    }
    stateBeforeClosingTagName(c) {
      if (isWhitespace(c)) ;
      else if (c === CharCodes$2.Gt) {
        this.state = State.Text;
      } else {
        this.state = this.isTagStartChar(c) ? State.InClosingTagName : State.InSpecialComment;
        this.sectionStart = this.index;
      }
    }
    stateInClosingTagName(c) {
      if (c === CharCodes$2.Gt || isWhitespace(c)) {
        this.cbs.onclosetag(this.sectionStart, this.index);
        this.sectionStart = -1;
        this.state = State.AfterClosingTagName;
        this.stateAfterClosingTagName(c);
      }
    }
    stateAfterClosingTagName(c) {
      if (c === CharCodes$2.Gt || this.fastForwardTo(CharCodes$2.Gt)) {
        this.state = State.Text;
        this.sectionStart = this.index + 1;
      }
    }
    stateBeforeAttributeName(c) {
      if (c === CharCodes$2.Gt) {
        this.cbs.onopentagend(this.index);
        if (this.isSpecial) {
          this.state = State.InSpecialTag;
          this.sequenceIndex = 0;
        } else {
          this.state = State.Text;
        }
        this.sectionStart = this.index + 1;
      } else if (c === CharCodes$2.Slash) {
        this.state = State.InSelfClosingTag;
      } else if (!isWhitespace(c)) {
        this.state = State.InAttributeName;
        this.sectionStart = this.index;
      }
    }
    stateInSelfClosingTag(c) {
      if (c === CharCodes$2.Gt) {
        this.cbs.onselfclosingtag(this.index);
        this.state = State.Text;
        this.sectionStart = this.index + 1;
        this.isSpecial = false;
      } else if (!isWhitespace(c)) {
        this.state = State.BeforeAttributeName;
        this.stateBeforeAttributeName(c);
      }
    }
    stateInAttributeName(c) {
      if (c === CharCodes$2.Eq || isEndOfTagSection(c)) {
        this.cbs.onattribname(this.sectionStart, this.index);
        this.sectionStart = this.index;
        this.state = State.AfterAttributeName;
        this.stateAfterAttributeName(c);
      }
    }
    stateAfterAttributeName(c) {
      if (c === CharCodes$2.Eq) {
        this.state = State.BeforeAttributeValue;
      } else if (c === CharCodes$2.Slash || c === CharCodes$2.Gt) {
        this.cbs.onattribend(QuoteType.NoValue, this.sectionStart);
        this.sectionStart = -1;
        this.state = State.BeforeAttributeName;
        this.stateBeforeAttributeName(c);
      } else if (!isWhitespace(c)) {
        this.cbs.onattribend(QuoteType.NoValue, this.sectionStart);
        this.state = State.InAttributeName;
        this.sectionStart = this.index;
      }
    }
    stateBeforeAttributeValue(c) {
      if (c === CharCodes$2.DoubleQuote) {
        this.state = State.InAttributeValueDq;
        this.sectionStart = this.index + 1;
      } else if (c === CharCodes$2.SingleQuote) {
        this.state = State.InAttributeValueSq;
        this.sectionStart = this.index + 1;
      } else if (!isWhitespace(c)) {
        this.sectionStart = this.index;
        this.state = State.InAttributeValueNq;
        this.stateInAttributeValueNoQuotes(c);
      }
    }
    handleInAttributeValue(c, quote) {
      if (c === quote || !this.decodeEntities && this.fastForwardTo(quote)) {
        this.cbs.onattribdata(this.sectionStart, this.index);
        this.sectionStart = -1;
        this.cbs.onattribend(quote === CharCodes$2.DoubleQuote ? QuoteType.Double : QuoteType.Single, this.index + 1);
        this.state = State.BeforeAttributeName;
      } else if (this.decodeEntities && c === CharCodes$2.Amp) {
        this.startEntity();
      }
    }
    stateInAttributeValueDoubleQuotes(c) {
      this.handleInAttributeValue(c, CharCodes$2.DoubleQuote);
    }
    stateInAttributeValueSingleQuotes(c) {
      this.handleInAttributeValue(c, CharCodes$2.SingleQuote);
    }
    stateInAttributeValueNoQuotes(c) {
      if (isWhitespace(c) || c === CharCodes$2.Gt) {
        this.cbs.onattribdata(this.sectionStart, this.index);
        this.sectionStart = -1;
        this.cbs.onattribend(QuoteType.Unquoted, this.index);
        this.state = State.BeforeAttributeName;
        this.stateBeforeAttributeName(c);
      } else if (this.decodeEntities && c === CharCodes$2.Amp) {
        this.startEntity();
      }
    }
    stateBeforeDeclaration(c) {
      if (c === CharCodes$2.OpeningSquareBracket) {
        this.state = State.CDATASequence;
        this.sequenceIndex = 0;
      } else {
        this.state = c === CharCodes$2.Dash ? State.BeforeComment : State.InDeclaration;
      }
    }
    stateInDeclaration(c) {
      if (c === CharCodes$2.Gt || this.fastForwardTo(CharCodes$2.Gt)) {
        this.cbs.ondeclaration(this.sectionStart, this.index);
        this.state = State.Text;
        this.sectionStart = this.index + 1;
      }
    }
    stateInProcessingInstruction(c) {
      if (c === CharCodes$2.Gt || this.fastForwardTo(CharCodes$2.Gt)) {
        this.cbs.onprocessinginstruction(this.sectionStart, this.index);
        this.state = State.Text;
        this.sectionStart = this.index + 1;
      }
    }
    stateBeforeComment(c) {
      if (c === CharCodes$2.Dash) {
        this.state = State.InCommentLike;
        this.currentSequence = Sequences.CommentEnd;
        this.sequenceIndex = 2;
        this.sectionStart = this.index + 1;
      } else {
        this.state = State.InDeclaration;
      }
    }
    stateInSpecialComment(c) {
      if (c === CharCodes$2.Gt || this.fastForwardTo(CharCodes$2.Gt)) {
        this.cbs.oncomment(this.sectionStart, this.index, 0);
        this.state = State.Text;
        this.sectionStart = this.index + 1;
      }
    }
    stateBeforeSpecialS(c) {
      const lower = c | 32;
      if (lower === Sequences.ScriptEnd[3]) {
        this.startSpecial(Sequences.ScriptEnd, 4);
      } else if (lower === Sequences.StyleEnd[3]) {
        this.startSpecial(Sequences.StyleEnd, 4);
      } else {
        this.state = State.InTagName;
        this.stateInTagName(c);
      }
    }
    stateBeforeSpecialT(c) {
      const lower = c | 32;
      if (lower === Sequences.TitleEnd[3]) {
        this.startSpecial(Sequences.TitleEnd, 4);
      } else if (lower === Sequences.TextareaEnd[3]) {
        this.startSpecial(Sequences.TextareaEnd, 4);
      } else {
        this.state = State.InTagName;
        this.stateInTagName(c);
      }
    }
    startEntity() {
      this.baseState = this.state;
      this.state = State.InEntity;
      this.entityStart = this.index;
      this.entityDecoder.startEntity(this.xmlMode ? DecodingMode$1.Strict : this.baseState === State.Text || this.baseState === State.InSpecialTag ? DecodingMode$1.Legacy : DecodingMode$1.Attribute);
    }
    stateInEntity() {
      const length = this.entityDecoder.write(this.buffer, this.index - this.offset);
      if (length >= 0) {
        this.state = this.baseState;
        if (length === 0) {
          this.index = this.entityStart;
        }
      } else {
        this.index = this.offset + this.buffer.length - 1;
      }
    }
    /**
     * Remove data that has already been consumed from the buffer.
     */
    cleanup() {
      if (this.running && this.sectionStart !== this.index) {
        if (this.state === State.Text || this.state === State.InSpecialTag && this.sequenceIndex === 0) {
          this.cbs.ontext(this.sectionStart, this.index);
          this.sectionStart = this.index;
        } else if (this.state === State.InAttributeValueDq || this.state === State.InAttributeValueSq || this.state === State.InAttributeValueNq) {
          this.cbs.onattribdata(this.sectionStart, this.index);
          this.sectionStart = this.index;
        }
      }
    }
    shouldContinue() {
      return this.index < this.buffer.length + this.offset && this.running;
    }
    /**
     * Iterates through the buffer, calling the function corresponding to the current state.
     *
     * States that are more likely to be hit are higher up, as a performance improvement.
     */
    parse() {
      while (this.shouldContinue()) {
        const c = this.buffer.charCodeAt(this.index - this.offset);
        switch (this.state) {
          case State.Text: {
            this.stateText(c);
            break;
          }
          case State.SpecialStartSequence: {
            this.stateSpecialStartSequence(c);
            break;
          }
          case State.InSpecialTag: {
            this.stateInSpecialTag(c);
            break;
          }
          case State.CDATASequence: {
            this.stateCDATASequence(c);
            break;
          }
          case State.InAttributeValueDq: {
            this.stateInAttributeValueDoubleQuotes(c);
            break;
          }
          case State.InAttributeName: {
            this.stateInAttributeName(c);
            break;
          }
          case State.InCommentLike: {
            this.stateInCommentLike(c);
            break;
          }
          case State.InSpecialComment: {
            this.stateInSpecialComment(c);
            break;
          }
          case State.BeforeAttributeName: {
            this.stateBeforeAttributeName(c);
            break;
          }
          case State.InTagName: {
            this.stateInTagName(c);
            break;
          }
          case State.InClosingTagName: {
            this.stateInClosingTagName(c);
            break;
          }
          case State.BeforeTagName: {
            this.stateBeforeTagName(c);
            break;
          }
          case State.AfterAttributeName: {
            this.stateAfterAttributeName(c);
            break;
          }
          case State.InAttributeValueSq: {
            this.stateInAttributeValueSingleQuotes(c);
            break;
          }
          case State.BeforeAttributeValue: {
            this.stateBeforeAttributeValue(c);
            break;
          }
          case State.BeforeClosingTagName: {
            this.stateBeforeClosingTagName(c);
            break;
          }
          case State.AfterClosingTagName: {
            this.stateAfterClosingTagName(c);
            break;
          }
          case State.BeforeSpecialS: {
            this.stateBeforeSpecialS(c);
            break;
          }
          case State.BeforeSpecialT: {
            this.stateBeforeSpecialT(c);
            break;
          }
          case State.InAttributeValueNq: {
            this.stateInAttributeValueNoQuotes(c);
            break;
          }
          case State.InSelfClosingTag: {
            this.stateInSelfClosingTag(c);
            break;
          }
          case State.InDeclaration: {
            this.stateInDeclaration(c);
            break;
          }
          case State.BeforeDeclaration: {
            this.stateBeforeDeclaration(c);
            break;
          }
          case State.BeforeComment: {
            this.stateBeforeComment(c);
            break;
          }
          case State.InProcessingInstruction: {
            this.stateInProcessingInstruction(c);
            break;
          }
          case State.InEntity: {
            this.stateInEntity();
            break;
          }
        }
        this.index++;
      }
      this.cleanup();
    }
    finish() {
      if (this.state === State.InEntity) {
        this.entityDecoder.end();
        this.state = this.baseState;
      }
      this.handleTrailingData();
      this.cbs.onend();
    }
    /** Handle any trailing data. */
    handleTrailingData() {
      const endIndex = this.buffer.length + this.offset;
      if (this.sectionStart >= endIndex) {
        return;
      }
      if (this.state === State.InCommentLike) {
        if (this.currentSequence === Sequences.CdataEnd) {
          this.cbs.oncdata(this.sectionStart, endIndex, 0);
        } else {
          this.cbs.oncomment(this.sectionStart, endIndex, 0);
        }
      } else if (this.state === State.InTagName || this.state === State.BeforeAttributeName || this.state === State.BeforeAttributeValue || this.state === State.AfterAttributeName || this.state === State.InAttributeName || this.state === State.InAttributeValueSq || this.state === State.InAttributeValueDq || this.state === State.InAttributeValueNq || this.state === State.InClosingTagName) ;
      else {
        this.cbs.ontext(this.sectionStart, endIndex);
      }
    }
    emitCodePoint(cp, consumed) {
      if (this.baseState !== State.Text && this.baseState !== State.InSpecialTag) {
        if (this.sectionStart < this.entityStart) {
          this.cbs.onattribdata(this.sectionStart, this.entityStart);
        }
        this.sectionStart = this.entityStart + consumed;
        this.index = this.sectionStart - 1;
        this.cbs.onattribentity(cp);
      } else {
        if (this.sectionStart < this.entityStart) {
          this.cbs.ontext(this.sectionStart, this.entityStart);
        }
        this.sectionStart = this.entityStart + consumed;
        this.index = this.sectionStart - 1;
        this.cbs.ontextentity(cp, this.sectionStart);
      }
    }
  }
  const formTags = /* @__PURE__ */ new Set([
    "input",
    "option",
    "optgroup",
    "select",
    "button",
    "datalist",
    "textarea"
  ]);
  const pTag = /* @__PURE__ */ new Set(["p"]);
  const tableSectionTags = /* @__PURE__ */ new Set(["thead", "tbody"]);
  const ddtTags = /* @__PURE__ */ new Set(["dd", "dt"]);
  const rtpTags = /* @__PURE__ */ new Set(["rt", "rp"]);
  const openImpliesClose = /* @__PURE__ */ new Map([
    ["tr", /* @__PURE__ */ new Set(["tr", "th", "td"])],
    ["th", /* @__PURE__ */ new Set(["th"])],
    ["td", /* @__PURE__ */ new Set(["thead", "th", "td"])],
    ["body", /* @__PURE__ */ new Set(["head", "link", "script"])],
    ["li", /* @__PURE__ */ new Set(["li"])],
    ["p", pTag],
    ["h1", pTag],
    ["h2", pTag],
    ["h3", pTag],
    ["h4", pTag],
    ["h5", pTag],
    ["h6", pTag],
    ["select", formTags],
    ["input", formTags],
    ["output", formTags],
    ["button", formTags],
    ["datalist", formTags],
    ["textarea", formTags],
    ["option", /* @__PURE__ */ new Set(["option"])],
    ["optgroup", /* @__PURE__ */ new Set(["optgroup", "option"])],
    ["dd", ddtTags],
    ["dt", ddtTags],
    ["address", pTag],
    ["article", pTag],
    ["aside", pTag],
    ["blockquote", pTag],
    ["details", pTag],
    ["div", pTag],
    ["dl", pTag],
    ["fieldset", pTag],
    ["figcaption", pTag],
    ["figure", pTag],
    ["footer", pTag],
    ["form", pTag],
    ["header", pTag],
    ["hr", pTag],
    ["main", pTag],
    ["nav", pTag],
    ["ol", pTag],
    ["pre", pTag],
    ["section", pTag],
    ["table", pTag],
    ["ul", pTag],
    ["rt", rtpTags],
    ["rp", rtpTags],
    ["tbody", tableSectionTags],
    ["tfoot", tableSectionTags]
  ]);
  const voidElements = /* @__PURE__ */ new Set([
    "area",
    "base",
    "basefont",
    "br",
    "col",
    "command",
    "embed",
    "frame",
    "hr",
    "img",
    "input",
    "isindex",
    "keygen",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr"
  ]);
  const foreignContextElements = /* @__PURE__ */ new Set(["math", "svg"]);
  const htmlIntegrationElements = /* @__PURE__ */ new Set([
    "mi",
    "mo",
    "mn",
    "ms",
    "mtext",
    "annotation-xml",
    "foreignobject",
    "desc",
    "title"
  ]);
  const reNameEnd = /\s|\//;
  let Parser$1 = class Parser {
    constructor(cbs, options = {}) {
      var _a2, _b, _c, _d, _e, _f;
      this.options = options;
      this.startIndex = 0;
      this.endIndex = 0;
      this.openTagStart = 0;
      this.tagname = "";
      this.attribname = "";
      this.attribvalue = "";
      this.attribs = null;
      this.stack = [];
      this.buffers = [];
      this.bufferOffset = 0;
      this.writeIndex = 0;
      this.ended = false;
      this.cbs = cbs !== null && cbs !== void 0 ? cbs : {};
      this.htmlMode = !this.options.xmlMode;
      this.lowerCaseTagNames = (_a2 = options.lowerCaseTags) !== null && _a2 !== void 0 ? _a2 : this.htmlMode;
      this.lowerCaseAttributeNames = (_b = options.lowerCaseAttributeNames) !== null && _b !== void 0 ? _b : this.htmlMode;
      this.recognizeSelfClosing = (_c = options.recognizeSelfClosing) !== null && _c !== void 0 ? _c : !this.htmlMode;
      this.tokenizer = new ((_d = options.Tokenizer) !== null && _d !== void 0 ? _d : Tokenizer)(this.options, this);
      this.foreignContext = [!this.htmlMode];
      (_f = (_e = this.cbs).onparserinit) === null || _f === void 0 ? void 0 : _f.call(_e, this);
    }
    // Tokenizer event handlers
    /** @internal */
    ontext(start, endIndex) {
      var _a2, _b;
      const data2 = this.getSlice(start, endIndex);
      this.endIndex = endIndex - 1;
      (_b = (_a2 = this.cbs).ontext) === null || _b === void 0 ? void 0 : _b.call(_a2, data2);
      this.startIndex = endIndex;
    }
    /** @internal */
    ontextentity(cp, endIndex) {
      var _a2, _b;
      this.endIndex = endIndex - 1;
      (_b = (_a2 = this.cbs).ontext) === null || _b === void 0 ? void 0 : _b.call(_a2, fromCodePoint$2(cp));
      this.startIndex = endIndex;
    }
    /**
     * Checks if the current tag is a void element. Override this if you want
     * to specify your own additional void elements.
     */
    isVoidElement(name2) {
      return this.htmlMode && voidElements.has(name2);
    }
    /** @internal */
    onopentagname(start, endIndex) {
      this.endIndex = endIndex;
      let name2 = this.getSlice(start, endIndex);
      if (this.lowerCaseTagNames) {
        name2 = name2.toLowerCase();
      }
      this.emitOpenTag(name2);
    }
    emitOpenTag(name2) {
      var _a2, _b, _c, _d;
      this.openTagStart = this.startIndex;
      this.tagname = name2;
      const impliesClose = this.htmlMode && openImpliesClose.get(name2);
      if (impliesClose) {
        while (this.stack.length > 0 && impliesClose.has(this.stack[0])) {
          const element = this.stack.shift();
          (_b = (_a2 = this.cbs).onclosetag) === null || _b === void 0 ? void 0 : _b.call(_a2, element, true);
        }
      }
      if (!this.isVoidElement(name2)) {
        this.stack.unshift(name2);
        if (this.htmlMode) {
          if (foreignContextElements.has(name2)) {
            this.foreignContext.unshift(true);
          } else if (htmlIntegrationElements.has(name2)) {
            this.foreignContext.unshift(false);
          }
        }
      }
      (_d = (_c = this.cbs).onopentagname) === null || _d === void 0 ? void 0 : _d.call(_c, name2);
      if (this.cbs.onopentag)
        this.attribs = {};
    }
    endOpenTag(isImplied) {
      var _a2, _b;
      this.startIndex = this.openTagStart;
      if (this.attribs) {
        (_b = (_a2 = this.cbs).onopentag) === null || _b === void 0 ? void 0 : _b.call(_a2, this.tagname, this.attribs, isImplied);
        this.attribs = null;
      }
      if (this.cbs.onclosetag && this.isVoidElement(this.tagname)) {
        this.cbs.onclosetag(this.tagname, true);
      }
      this.tagname = "";
    }
    /** @internal */
    onopentagend(endIndex) {
      this.endIndex = endIndex;
      this.endOpenTag(false);
      this.startIndex = endIndex + 1;
    }
    /** @internal */
    onclosetag(start, endIndex) {
      var _a2, _b, _c, _d, _e, _f, _g, _h;
      this.endIndex = endIndex;
      let name2 = this.getSlice(start, endIndex);
      if (this.lowerCaseTagNames) {
        name2 = name2.toLowerCase();
      }
      if (this.htmlMode && (foreignContextElements.has(name2) || htmlIntegrationElements.has(name2))) {
        this.foreignContext.shift();
      }
      if (!this.isVoidElement(name2)) {
        const pos = this.stack.indexOf(name2);
        if (pos !== -1) {
          for (let index2 = 0; index2 <= pos; index2++) {
            const element = this.stack.shift();
            (_b = (_a2 = this.cbs).onclosetag) === null || _b === void 0 ? void 0 : _b.call(_a2, element, index2 !== pos);
          }
        } else if (this.htmlMode && name2 === "p") {
          this.emitOpenTag("p");
          this.closeCurrentTag(true);
        }
      } else if (this.htmlMode && name2 === "br") {
        (_d = (_c = this.cbs).onopentagname) === null || _d === void 0 ? void 0 : _d.call(_c, "br");
        (_f = (_e = this.cbs).onopentag) === null || _f === void 0 ? void 0 : _f.call(_e, "br", {}, true);
        (_h = (_g = this.cbs).onclosetag) === null || _h === void 0 ? void 0 : _h.call(_g, "br", false);
      }
      this.startIndex = endIndex + 1;
    }
    /** @internal */
    onselfclosingtag(endIndex) {
      this.endIndex = endIndex;
      if (this.recognizeSelfClosing || this.foreignContext[0]) {
        this.closeCurrentTag(false);
        this.startIndex = endIndex + 1;
      } else {
        this.onopentagend(endIndex);
      }
    }
    closeCurrentTag(isOpenImplied) {
      var _a2, _b;
      const name2 = this.tagname;
      this.endOpenTag(isOpenImplied);
      if (this.stack[0] === name2) {
        (_b = (_a2 = this.cbs).onclosetag) === null || _b === void 0 ? void 0 : _b.call(_a2, name2, !isOpenImplied);
        this.stack.shift();
      }
    }
    /** @internal */
    onattribname(start, endIndex) {
      this.startIndex = start;
      const name2 = this.getSlice(start, endIndex);
      this.attribname = this.lowerCaseAttributeNames ? name2.toLowerCase() : name2;
    }
    /** @internal */
    onattribdata(start, endIndex) {
      this.attribvalue += this.getSlice(start, endIndex);
    }
    /** @internal */
    onattribentity(cp) {
      this.attribvalue += fromCodePoint$2(cp);
    }
    /** @internal */
    onattribend(quote, endIndex) {
      var _a2, _b;
      this.endIndex = endIndex;
      (_b = (_a2 = this.cbs).onattribute) === null || _b === void 0 ? void 0 : _b.call(_a2, this.attribname, this.attribvalue, quote === QuoteType.Double ? '"' : quote === QuoteType.Single ? "'" : quote === QuoteType.NoValue ? void 0 : null);
      if (this.attribs && !Object.prototype.hasOwnProperty.call(this.attribs, this.attribname)) {
        this.attribs[this.attribname] = this.attribvalue;
      }
      this.attribvalue = "";
    }
    getInstructionName(value) {
      const index2 = value.search(reNameEnd);
      let name2 = index2 < 0 ? value : value.substr(0, index2);
      if (this.lowerCaseTagNames) {
        name2 = name2.toLowerCase();
      }
      return name2;
    }
    /** @internal */
    ondeclaration(start, endIndex) {
      this.endIndex = endIndex;
      const value = this.getSlice(start, endIndex);
      if (this.cbs.onprocessinginstruction) {
        const name2 = this.getInstructionName(value);
        this.cbs.onprocessinginstruction(`!${name2}`, `!${value}`);
      }
      this.startIndex = endIndex + 1;
    }
    /** @internal */
    onprocessinginstruction(start, endIndex) {
      this.endIndex = endIndex;
      const value = this.getSlice(start, endIndex);
      if (this.cbs.onprocessinginstruction) {
        const name2 = this.getInstructionName(value);
        this.cbs.onprocessinginstruction(`?${name2}`, `?${value}`);
      }
      this.startIndex = endIndex + 1;
    }
    /** @internal */
    oncomment(start, endIndex, offset) {
      var _a2, _b, _c, _d;
      this.endIndex = endIndex;
      (_b = (_a2 = this.cbs).oncomment) === null || _b === void 0 ? void 0 : _b.call(_a2, this.getSlice(start, endIndex - offset));
      (_d = (_c = this.cbs).oncommentend) === null || _d === void 0 ? void 0 : _d.call(_c);
      this.startIndex = endIndex + 1;
    }
    /** @internal */
    oncdata(start, endIndex, offset) {
      var _a2, _b, _c, _d, _e, _f, _g, _h, _j, _k;
      this.endIndex = endIndex;
      const value = this.getSlice(start, endIndex - offset);
      if (!this.htmlMode || this.options.recognizeCDATA) {
        (_b = (_a2 = this.cbs).oncdatastart) === null || _b === void 0 ? void 0 : _b.call(_a2);
        (_d = (_c = this.cbs).ontext) === null || _d === void 0 ? void 0 : _d.call(_c, value);
        (_f = (_e = this.cbs).oncdataend) === null || _f === void 0 ? void 0 : _f.call(_e);
      } else {
        (_h = (_g = this.cbs).oncomment) === null || _h === void 0 ? void 0 : _h.call(_g, `[CDATA[${value}]]`);
        (_k = (_j = this.cbs).oncommentend) === null || _k === void 0 ? void 0 : _k.call(_j);
      }
      this.startIndex = endIndex + 1;
    }
    /** @internal */
    onend() {
      var _a2, _b;
      if (this.cbs.onclosetag) {
        this.endIndex = this.startIndex;
        for (let index2 = 0; index2 < this.stack.length; index2++) {
          this.cbs.onclosetag(this.stack[index2], true);
        }
      }
      (_b = (_a2 = this.cbs).onend) === null || _b === void 0 ? void 0 : _b.call(_a2);
    }
    /**
     * Resets the parser to a blank state, ready to parse a new HTML document
     */
    reset() {
      var _a2, _b, _c, _d;
      (_b = (_a2 = this.cbs).onreset) === null || _b === void 0 ? void 0 : _b.call(_a2);
      this.tokenizer.reset();
      this.tagname = "";
      this.attribname = "";
      this.attribs = null;
      this.stack.length = 0;
      this.startIndex = 0;
      this.endIndex = 0;
      (_d = (_c = this.cbs).onparserinit) === null || _d === void 0 ? void 0 : _d.call(_c, this);
      this.buffers.length = 0;
      this.foreignContext.length = 0;
      this.foreignContext.unshift(!this.htmlMode);
      this.bufferOffset = 0;
      this.writeIndex = 0;
      this.ended = false;
    }
    /**
     * Resets the parser, then parses a complete document and
     * pushes it to the handler.
     *
     * @param data Document to parse.
     */
    parseComplete(data2) {
      this.reset();
      this.end(data2);
    }
    getSlice(start, end2) {
      while (start - this.bufferOffset >= this.buffers[0].length) {
        this.shiftBuffer();
      }
      let slice2 = this.buffers[0].slice(start - this.bufferOffset, end2 - this.bufferOffset);
      while (end2 - this.bufferOffset > this.buffers[0].length) {
        this.shiftBuffer();
        slice2 += this.buffers[0].slice(0, end2 - this.bufferOffset);
      }
      return slice2;
    }
    shiftBuffer() {
      this.bufferOffset += this.buffers[0].length;
      this.writeIndex--;
      this.buffers.shift();
    }
    /**
     * Parses a chunk of data and calls the corresponding callbacks.
     *
     * @param chunk Chunk to parse.
     */
    write(chunk) {
      var _a2, _b;
      if (this.ended) {
        (_b = (_a2 = this.cbs).onerror) === null || _b === void 0 ? void 0 : _b.call(_a2, new Error(".write() after done!"));
        return;
      }
      this.buffers.push(chunk);
      if (this.tokenizer.running) {
        this.tokenizer.write(chunk);
        this.writeIndex++;
      }
    }
    /**
     * Parses the end of the buffer and clears the stack, calls onend.
     *
     * @param chunk Optional final chunk to parse.
     */
    end(chunk) {
      var _a2, _b;
      if (this.ended) {
        (_b = (_a2 = this.cbs).onerror) === null || _b === void 0 ? void 0 : _b.call(_a2, new Error(".end() after done!"));
        return;
      }
      if (chunk)
        this.write(chunk);
      this.ended = true;
      this.tokenizer.end();
    }
    /**
     * Pauses parsing. The parser won't emit events until `resume` is called.
     */
    pause() {
      this.tokenizer.pause();
    }
    /**
     * Resumes parsing after `pause` was called.
     */
    resume() {
      this.tokenizer.resume();
      while (this.tokenizer.running && this.writeIndex < this.buffers.length) {
        this.tokenizer.write(this.buffers[this.writeIndex++]);
      }
      if (this.ended)
        this.tokenizer.end();
    }
    /**
     * Alias of `write`, for backwards compatibility.
     *
     * @param chunk Chunk to parse.
     * @deprecated
     */
    parseChunk(chunk) {
      this.write(chunk);
    }
    /**
     * Alias of `end`, for backwards compatibility.
     *
     * @param chunk Optional final chunk to parse.
     * @deprecated
     */
    done(chunk) {
      this.end(chunk);
    }
  };
  function parseDocument$1(data2, options) {
    const handler = new DomHandler(void 0, options);
    new Parser$1(handler, options).end(data2);
    return handler.root;
  }
  const load = getLoad(getParse(parseDocument$1), render$1);
  const defaultSelectorRules = {
    "div,p": ({ $node }) => ({
      queue: $node.children()
    }),
    "h1,h2,h3,h4,h5,h6": ({ $node, getContent }) => ({
      ...getContent($node.contents())
    }),
    "ul,ol": ({ $node }) => ({
      queue: $node.children(),
      nesting: true
    }),
    li: ({ $node, getContent }) => {
      const queue = $node.children().filter("ul,ol");
      let content;
      if ($node.contents().first().is("div,p")) {
        content = getContent($node.children().first());
      } else {
        let $contents = $node.contents();
        const i = $contents.index(queue);
        if (i >= 0) $contents = $contents.slice(0, i);
        content = getContent($contents);
      }
      return {
        queue,
        nesting: true,
        ...content
      };
    },
    "table,pre,p>img:only-child": ({ $node, getContent }) => ({
      ...getContent($node)
    })
  };
  const defaultOptions$2 = {
    selector: "h1,h2,h3,h4,h5,h6,ul,ol,li,table,pre,p>img:only-child",
    selectorRules: defaultSelectorRules
  };
  const MARKMAP_COMMENT_PREFIX = "markmap: ";
  const SELECTOR_HEADING = /^h[1-6]$/;
  const SELECTOR_LIST = /^[uo]l$/;
  const SELECTOR_LIST_ITEM = /^li$/;
  function getLevel(tagName) {
    if (SELECTOR_HEADING.test(tagName)) return +tagName[1];
    if (SELECTOR_LIST.test(tagName)) return 8;
    if (SELECTOR_LIST_ITEM.test(tagName)) return 9;
    return 7;
  }
  function parseHtml(html2, opts) {
    const options = {
      ...defaultOptions$2,
      ...opts
    };
    const $ = load(html2);
    let $root = $("body");
    if (!$root.length) $root = $.root();
    let id = 0;
    const rootNode = {
      id,
      tag: "",
      html: "",
      level: 0,
      parent: 0,
      childrenLevel: 0,
      children: []
    };
    const headingStack = [];
    let skippingHeading = 0;
    checkNodes($root.children());
    return rootNode;
    function addChild(props) {
      var _a2;
      const { parent: parent2 } = props;
      const node = {
        id: ++id,
        tag: props.tagName,
        level: props.level,
        html: props.html,
        childrenLevel: 0,
        children: props.nesting ? [] : void 0,
        parent: parent2.id
      };
      if ((_a2 = props.comments) == null ? void 0 : _a2.length) {
        node.comments = props.comments;
      }
      if (Object.keys(props.data || {}).length) {
        node.data = props.data;
      }
      if (parent2.children) {
        if (parent2.childrenLevel === 0 || parent2.childrenLevel > node.level) {
          parent2.children = [];
          parent2.childrenLevel = node.level;
        }
        if (parent2.childrenLevel === node.level) {
          parent2.children.push(node);
        }
      }
      return node;
    }
    function getCurrentHeading(level) {
      let heading2;
      while ((heading2 = headingStack[headingStack.length - 1]) && heading2.level >= level) {
        headingStack.pop();
      }
      return heading2 || rootNode;
    }
    function getContent($node) {
      var _a2;
      const result = extractMagicComments($node);
      const html22 = (_a2 = $.html(result.$node)) == null ? void 0 : _a2.trimEnd();
      return { comments: result.comments, html: html22 };
    }
    function extractMagicComments($node) {
      const comments = [];
      $node = $node.filter((_, child) => {
        if (child.type === "comment") {
          const data2 = child.data.trim();
          if (data2.startsWith(MARKMAP_COMMENT_PREFIX)) {
            comments.push(data2.slice(MARKMAP_COMMENT_PREFIX.length).trim());
            return false;
          }
        }
        return true;
      });
      return { $node, comments };
    }
    function checkNodes($els, node) {
      $els.each((_, child) => {
        var _a2;
        const $child = $(child);
        const rule = (_a2 = Object.entries(options.selectorRules).find(
          ([selector]) => $child.is(selector)
        )) == null ? void 0 : _a2[1];
        const result = rule == null ? void 0 : rule({ $node: $child, $, getContent });
        if ((result == null ? void 0 : result.queue) && !result.nesting) {
          checkNodes(result.queue, node);
          return;
        }
        const level = getLevel(child.tagName);
        if (!result) {
          if (level <= 6) {
            skippingHeading = level;
          }
          return;
        }
        if (skippingHeading > 0 && level > skippingHeading) return;
        if (!$child.is(options.selector)) return;
        skippingHeading = 0;
        const isHeading = level <= 6;
        let data2 = {
          // If the child is an inline element and expected to be a separate node,
          // data from the closest `<p>` should be included, e.g. `<p data-lines><img /></p>`
          ...$child.closest("p").data(),
          ...$child.data()
        };
        let html22 = result.html || "";
        if ($child.is("ol>li") && (node == null ? void 0 : node.children)) {
          const start = +($child.parent().attr("start") || 1);
          const listIndex = start + node.children.length;
          html22 = `${listIndex}. ${html22}`;
          data2 = {
            ...data2,
            listIndex
          };
        }
        const childNode = addChild({
          parent: node || getCurrentHeading(level),
          nesting: !!result.queue || isHeading,
          tagName: child.tagName,
          level,
          html: html22,
          comments: result.comments,
          data: data2
        });
        if (isHeading) headingStack.push(childNode);
        if (result.queue) checkNodes(result.queue, childNode);
      });
    }
  }
  function convertNode(htmlRoot) {
    return walkTree(htmlRoot, (htmlNode, next2) => {
      const node = {
        content: htmlNode.html,
        children: next2() || []
      };
      if (htmlNode.data) {
        node.payload = {
          tag: htmlNode.tag,
          ...htmlNode.data
        };
      }
      if (htmlNode.comments) {
        if (htmlNode.comments.includes("foldAll")) {
          node.payload = { ...node.payload, fold: 2 };
        } else if (htmlNode.comments.includes("fold")) {
          node.payload = { ...node.payload, fold: 1 };
        }
      }
      return node;
    });
  }
  function buildTree(html2, opts) {
    const htmlRoot = parseHtml(html2, opts);
    return convertNode(htmlRoot);
  }
  const decodeCache = {};
  function getDecodeCache(exclude) {
    let cache = decodeCache[exclude];
    if (cache) {
      return cache;
    }
    cache = decodeCache[exclude] = [];
    for (let i = 0; i < 128; i++) {
      const ch = String.fromCharCode(i);
      cache.push(ch);
    }
    for (let i = 0; i < exclude.length; i++) {
      const ch = exclude.charCodeAt(i);
      cache[ch] = "%" + ("0" + ch.toString(16).toUpperCase()).slice(-2);
    }
    return cache;
  }
  function decode$1(string2, exclude) {
    if (typeof exclude !== "string") {
      exclude = decode$1.defaultChars;
    }
    const cache = getDecodeCache(exclude);
    return string2.replace(/(%[a-f0-9]{2})+/gi, function(seq2) {
      let result = "";
      for (let i = 0, l = seq2.length; i < l; i += 3) {
        const b1 = parseInt(seq2.slice(i + 1, i + 3), 16);
        if (b1 < 128) {
          result += cache[b1];
          continue;
        }
        if ((b1 & 224) === 192 && i + 3 < l) {
          const b2 = parseInt(seq2.slice(i + 4, i + 6), 16);
          if ((b2 & 192) === 128) {
            const chr = b1 << 6 & 1984 | b2 & 63;
            if (chr < 128) {
              result += "��";
            } else {
              result += String.fromCharCode(chr);
            }
            i += 3;
            continue;
          }
        }
        if ((b1 & 240) === 224 && i + 6 < l) {
          const b2 = parseInt(seq2.slice(i + 4, i + 6), 16);
          const b3 = parseInt(seq2.slice(i + 7, i + 9), 16);
          if ((b2 & 192) === 128 && (b3 & 192) === 128) {
            const chr = b1 << 12 & 61440 | b2 << 6 & 4032 | b3 & 63;
            if (chr < 2048 || chr >= 55296 && chr <= 57343) {
              result += "���";
            } else {
              result += String.fromCharCode(chr);
            }
            i += 6;
            continue;
          }
        }
        if ((b1 & 248) === 240 && i + 9 < l) {
          const b2 = parseInt(seq2.slice(i + 4, i + 6), 16);
          const b3 = parseInt(seq2.slice(i + 7, i + 9), 16);
          const b4 = parseInt(seq2.slice(i + 10, i + 12), 16);
          if ((b2 & 192) === 128 && (b3 & 192) === 128 && (b4 & 192) === 128) {
            let chr = b1 << 18 & 1835008 | b2 << 12 & 258048 | b3 << 6 & 4032 | b4 & 63;
            if (chr < 65536 || chr > 1114111) {
              result += "����";
            } else {
              chr -= 65536;
              result += String.fromCharCode(55296 + (chr >> 10), 56320 + (chr & 1023));
            }
            i += 9;
            continue;
          }
        }
        result += "�";
      }
      return result;
    });
  }
  decode$1.defaultChars = ";/?:@&=+$,#";
  decode$1.componentChars = "";
  const encodeCache = {};
  function getEncodeCache(exclude) {
    let cache = encodeCache[exclude];
    if (cache) {
      return cache;
    }
    cache = encodeCache[exclude] = [];
    for (let i = 0; i < 128; i++) {
      const ch = String.fromCharCode(i);
      if (/^[0-9a-z]$/i.test(ch)) {
        cache.push(ch);
      } else {
        cache.push("%" + ("0" + i.toString(16).toUpperCase()).slice(-2));
      }
    }
    for (let i = 0; i < exclude.length; i++) {
      cache[exclude.charCodeAt(i)] = exclude[i];
    }
    return cache;
  }
  function encode$1(string2, exclude, keepEscaped) {
    if (typeof exclude !== "string") {
      keepEscaped = exclude;
      exclude = encode$1.defaultChars;
    }
    if (typeof keepEscaped === "undefined") {
      keepEscaped = true;
    }
    const cache = getEncodeCache(exclude);
    let result = "";
    for (let i = 0, l = string2.length; i < l; i++) {
      const code2 = string2.charCodeAt(i);
      if (keepEscaped && code2 === 37 && i + 2 < l) {
        if (/^[0-9a-f]{2}$/i.test(string2.slice(i + 1, i + 3))) {
          result += string2.slice(i, i + 3);
          i += 2;
          continue;
        }
      }
      if (code2 < 128) {
        result += cache[code2];
        continue;
      }
      if (code2 >= 55296 && code2 <= 57343) {
        if (code2 >= 55296 && code2 <= 56319 && i + 1 < l) {
          const nextCode = string2.charCodeAt(i + 1);
          if (nextCode >= 56320 && nextCode <= 57343) {
            result += encodeURIComponent(string2[i] + string2[i + 1]);
            i++;
            continue;
          }
        }
        result += "%EF%BF%BD";
        continue;
      }
      result += encodeURIComponent(string2[i]);
    }
    return result;
  }
  encode$1.defaultChars = ";/?:@&=+$,-_.!~*'()#";
  encode$1.componentChars = "-_.!~*'()";
  function format(url) {
    let result = "";
    result += url.protocol || "";
    result += url.slashes ? "//" : "";
    result += url.auth ? url.auth + "@" : "";
    if (url.hostname && url.hostname.indexOf(":") !== -1) {
      result += "[" + url.hostname + "]";
    } else {
      result += url.hostname || "";
    }
    result += url.port ? ":" + url.port : "";
    result += url.pathname || "";
    result += url.search || "";
    result += url.hash || "";
    return result;
  }
  function Url() {
    this.protocol = null;
    this.slashes = null;
    this.auth = null;
    this.port = null;
    this.hostname = null;
    this.hash = null;
    this.search = null;
    this.pathname = null;
  }
  const protocolPattern = /^([a-z0-9.+-]+:)/i;
  const portPattern = /:[0-9]*$/;
  const simplePathPattern = /^(\/\/?(?!\/)[^\?\s]*)(\?[^\s]*)?$/;
  const delims = ["<", ">", '"', "`", " ", "\r", "\n", "	"];
  const unwise = ["{", "}", "|", "\\", "^", "`"].concat(delims);
  const autoEscape = ["'"].concat(unwise);
  const nonHostChars = ["%", "/", "?", ";", "#"].concat(autoEscape);
  const hostEndingChars = ["/", "?", "#"];
  const hostnameMaxLen = 255;
  const hostnamePartPattern = /^[+a-z0-9A-Z_-]{0,63}$/;
  const hostnamePartStart = /^([+a-z0-9A-Z_-]{0,63})(.*)$/;
  const hostlessProtocol = {
    javascript: true,
    "javascript:": true
  };
  const slashedProtocol = {
    http: true,
    https: true,
    ftp: true,
    gopher: true,
    file: true,
    "http:": true,
    "https:": true,
    "ftp:": true,
    "gopher:": true,
    "file:": true
  };
  function urlParse(url, slashesDenoteHost) {
    if (url && url instanceof Url) return url;
    const u = new Url();
    u.parse(url, slashesDenoteHost);
    return u;
  }
  Url.prototype.parse = function(url, slashesDenoteHost) {
    let lowerProto, hec, slashes;
    let rest = url;
    rest = rest.trim();
    if (!slashesDenoteHost && url.split("#").length === 1) {
      const simplePath = simplePathPattern.exec(rest);
      if (simplePath) {
        this.pathname = simplePath[1];
        if (simplePath[2]) {
          this.search = simplePath[2];
        }
        return this;
      }
    }
    let proto = protocolPattern.exec(rest);
    if (proto) {
      proto = proto[0];
      lowerProto = proto.toLowerCase();
      this.protocol = proto;
      rest = rest.substr(proto.length);
    }
    if (slashesDenoteHost || proto || rest.match(/^\/\/[^@\/]+@[^@\/]+/)) {
      slashes = rest.substr(0, 2) === "//";
      if (slashes && !(proto && hostlessProtocol[proto])) {
        rest = rest.substr(2);
        this.slashes = true;
      }
    }
    if (!hostlessProtocol[proto] && (slashes || proto && !slashedProtocol[proto])) {
      let hostEnd = -1;
      for (let i = 0; i < hostEndingChars.length; i++) {
        hec = rest.indexOf(hostEndingChars[i]);
        if (hec !== -1 && (hostEnd === -1 || hec < hostEnd)) {
          hostEnd = hec;
        }
      }
      let auth, atSign;
      if (hostEnd === -1) {
        atSign = rest.lastIndexOf("@");
      } else {
        atSign = rest.lastIndexOf("@", hostEnd);
      }
      if (atSign !== -1) {
        auth = rest.slice(0, atSign);
        rest = rest.slice(atSign + 1);
        this.auth = auth;
      }
      hostEnd = -1;
      for (let i = 0; i < nonHostChars.length; i++) {
        hec = rest.indexOf(nonHostChars[i]);
        if (hec !== -1 && (hostEnd === -1 || hec < hostEnd)) {
          hostEnd = hec;
        }
      }
      if (hostEnd === -1) {
        hostEnd = rest.length;
      }
      if (rest[hostEnd - 1] === ":") {
        hostEnd--;
      }
      const host = rest.slice(0, hostEnd);
      rest = rest.slice(hostEnd);
      this.parseHost(host);
      this.hostname = this.hostname || "";
      const ipv6Hostname = this.hostname[0] === "[" && this.hostname[this.hostname.length - 1] === "]";
      if (!ipv6Hostname) {
        const hostparts = this.hostname.split(/\./);
        for (let i = 0, l = hostparts.length; i < l; i++) {
          const part = hostparts[i];
          if (!part) {
            continue;
          }
          if (!part.match(hostnamePartPattern)) {
            let newpart = "";
            for (let j = 0, k = part.length; j < k; j++) {
              if (part.charCodeAt(j) > 127) {
                newpart += "x";
              } else {
                newpart += part[j];
              }
            }
            if (!newpart.match(hostnamePartPattern)) {
              const validParts = hostparts.slice(0, i);
              const notHost = hostparts.slice(i + 1);
              const bit = part.match(hostnamePartStart);
              if (bit) {
                validParts.push(bit[1]);
                notHost.unshift(bit[2]);
              }
              if (notHost.length) {
                rest = notHost.join(".") + rest;
              }
              this.hostname = validParts.join(".");
              break;
            }
          }
        }
      }
      if (this.hostname.length > hostnameMaxLen) {
        this.hostname = "";
      }
      if (ipv6Hostname) {
        this.hostname = this.hostname.substr(1, this.hostname.length - 2);
      }
    }
    const hash = rest.indexOf("#");
    if (hash !== -1) {
      this.hash = rest.substr(hash);
      rest = rest.slice(0, hash);
    }
    const qm = rest.indexOf("?");
    if (qm !== -1) {
      this.search = rest.substr(qm);
      rest = rest.slice(0, qm);
    }
    if (rest) {
      this.pathname = rest;
    }
    if (slashedProtocol[lowerProto] && this.hostname && !this.pathname) {
      this.pathname = "";
    }
    return this;
  };
  Url.prototype.parseHost = function(host) {
    let port = portPattern.exec(host);
    if (port) {
      port = port[0];
      if (port !== ":") {
        this.port = port.substr(1);
      }
      host = host.substr(0, host.length - port.length);
    }
    if (host) {
      this.hostname = host;
    }
  };
  const mdurl = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    decode: decode$1,
    encode: encode$1,
    format,
    parse: urlParse
  }, Symbol.toStringTag, { value: "Module" }));
  const Any = /[\0-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
  const Cc = /[\0-\x1F\x7F-\x9F]/;
  const regex$1 = /[\xAD\u0600-\u0605\u061C\u06DD\u070F\u0890\u0891\u08E2\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF\uFFF9-\uFFFB]|\uD804[\uDCBD\uDCCD]|\uD80D[\uDC30-\uDC3F]|\uD82F[\uDCA0-\uDCA3]|\uD834[\uDD73-\uDD7A]|\uDB40[\uDC01\uDC20-\uDC7F]/;
  const P = /[!-#%-\*,-\/:;\?@\[-\]_\{\}\xA1\xA7\xAB\xB6\xB7\xBB\xBF\u037E\u0387\u055A-\u055F\u0589\u058A\u05BE\u05C0\u05C3\u05C6\u05F3\u05F4\u0609\u060A\u060C\u060D\u061B\u061D-\u061F\u066A-\u066D\u06D4\u0700-\u070D\u07F7-\u07F9\u0830-\u083E\u085E\u0964\u0965\u0970\u09FD\u0A76\u0AF0\u0C77\u0C84\u0DF4\u0E4F\u0E5A\u0E5B\u0F04-\u0F12\u0F14\u0F3A-\u0F3D\u0F85\u0FD0-\u0FD4\u0FD9\u0FDA\u104A-\u104F\u10FB\u1360-\u1368\u1400\u166E\u169B\u169C\u16EB-\u16ED\u1735\u1736\u17D4-\u17D6\u17D8-\u17DA\u1800-\u180A\u1944\u1945\u1A1E\u1A1F\u1AA0-\u1AA6\u1AA8-\u1AAD\u1B5A-\u1B60\u1B7D\u1B7E\u1BFC-\u1BFF\u1C3B-\u1C3F\u1C7E\u1C7F\u1CC0-\u1CC7\u1CD3\u2010-\u2027\u2030-\u2043\u2045-\u2051\u2053-\u205E\u207D\u207E\u208D\u208E\u2308-\u230B\u2329\u232A\u2768-\u2775\u27C5\u27C6\u27E6-\u27EF\u2983-\u2998\u29D8-\u29DB\u29FC\u29FD\u2CF9-\u2CFC\u2CFE\u2CFF\u2D70\u2E00-\u2E2E\u2E30-\u2E4F\u2E52-\u2E5D\u3001-\u3003\u3008-\u3011\u3014-\u301F\u3030\u303D\u30A0\u30FB\uA4FE\uA4FF\uA60D-\uA60F\uA673\uA67E\uA6F2-\uA6F7\uA874-\uA877\uA8CE\uA8CF\uA8F8-\uA8FA\uA8FC\uA92E\uA92F\uA95F\uA9C1-\uA9CD\uA9DE\uA9DF\uAA5C-\uAA5F\uAADE\uAADF\uAAF0\uAAF1\uABEB\uFD3E\uFD3F\uFE10-\uFE19\uFE30-\uFE52\uFE54-\uFE61\uFE63\uFE68\uFE6A\uFE6B\uFF01-\uFF03\uFF05-\uFF0A\uFF0C-\uFF0F\uFF1A\uFF1B\uFF1F\uFF20\uFF3B-\uFF3D\uFF3F\uFF5B\uFF5D\uFF5F-\uFF65]|\uD800[\uDD00-\uDD02\uDF9F\uDFD0]|\uD801\uDD6F|\uD802[\uDC57\uDD1F\uDD3F\uDE50-\uDE58\uDE7F\uDEF0-\uDEF6\uDF39-\uDF3F\uDF99-\uDF9C]|\uD803[\uDEAD\uDF55-\uDF59\uDF86-\uDF89]|\uD804[\uDC47-\uDC4D\uDCBB\uDCBC\uDCBE-\uDCC1\uDD40-\uDD43\uDD74\uDD75\uDDC5-\uDDC8\uDDCD\uDDDB\uDDDD-\uDDDF\uDE38-\uDE3D\uDEA9]|\uD805[\uDC4B-\uDC4F\uDC5A\uDC5B\uDC5D\uDCC6\uDDC1-\uDDD7\uDE41-\uDE43\uDE60-\uDE6C\uDEB9\uDF3C-\uDF3E]|\uD806[\uDC3B\uDD44-\uDD46\uDDE2\uDE3F-\uDE46\uDE9A-\uDE9C\uDE9E-\uDEA2\uDF00-\uDF09]|\uD807[\uDC41-\uDC45\uDC70\uDC71\uDEF7\uDEF8\uDF43-\uDF4F\uDFFF]|\uD809[\uDC70-\uDC74]|\uD80B[\uDFF1\uDFF2]|\uD81A[\uDE6E\uDE6F\uDEF5\uDF37-\uDF3B\uDF44]|\uD81B[\uDE97-\uDE9A\uDFE2]|\uD82F\uDC9F|\uD836[\uDE87-\uDE8B]|\uD83A[\uDD5E\uDD5F]/;
  const regex = /[\$\+<->\^`\|~\xA2-\xA6\xA8\xA9\xAC\xAE-\xB1\xB4\xB8\xD7\xF7\u02C2-\u02C5\u02D2-\u02DF\u02E5-\u02EB\u02ED\u02EF-\u02FF\u0375\u0384\u0385\u03F6\u0482\u058D-\u058F\u0606-\u0608\u060B\u060E\u060F\u06DE\u06E9\u06FD\u06FE\u07F6\u07FE\u07FF\u0888\u09F2\u09F3\u09FA\u09FB\u0AF1\u0B70\u0BF3-\u0BFA\u0C7F\u0D4F\u0D79\u0E3F\u0F01-\u0F03\u0F13\u0F15-\u0F17\u0F1A-\u0F1F\u0F34\u0F36\u0F38\u0FBE-\u0FC5\u0FC7-\u0FCC\u0FCE\u0FCF\u0FD5-\u0FD8\u109E\u109F\u1390-\u1399\u166D\u17DB\u1940\u19DE-\u19FF\u1B61-\u1B6A\u1B74-\u1B7C\u1FBD\u1FBF-\u1FC1\u1FCD-\u1FCF\u1FDD-\u1FDF\u1FED-\u1FEF\u1FFD\u1FFE\u2044\u2052\u207A-\u207C\u208A-\u208C\u20A0-\u20C0\u2100\u2101\u2103-\u2106\u2108\u2109\u2114\u2116-\u2118\u211E-\u2123\u2125\u2127\u2129\u212E\u213A\u213B\u2140-\u2144\u214A-\u214D\u214F\u218A\u218B\u2190-\u2307\u230C-\u2328\u232B-\u2426\u2440-\u244A\u249C-\u24E9\u2500-\u2767\u2794-\u27C4\u27C7-\u27E5\u27F0-\u2982\u2999-\u29D7\u29DC-\u29FB\u29FE-\u2B73\u2B76-\u2B95\u2B97-\u2BFF\u2CE5-\u2CEA\u2E50\u2E51\u2E80-\u2E99\u2E9B-\u2EF3\u2F00-\u2FD5\u2FF0-\u2FFF\u3004\u3012\u3013\u3020\u3036\u3037\u303E\u303F\u309B\u309C\u3190\u3191\u3196-\u319F\u31C0-\u31E3\u31EF\u3200-\u321E\u322A-\u3247\u3250\u3260-\u327F\u328A-\u32B0\u32C0-\u33FF\u4DC0-\u4DFF\uA490-\uA4C6\uA700-\uA716\uA720\uA721\uA789\uA78A\uA828-\uA82B\uA836-\uA839\uAA77-\uAA79\uAB5B\uAB6A\uAB6B\uFB29\uFBB2-\uFBC2\uFD40-\uFD4F\uFDCF\uFDFC-\uFDFF\uFE62\uFE64-\uFE66\uFE69\uFF04\uFF0B\uFF1C-\uFF1E\uFF3E\uFF40\uFF5C\uFF5E\uFFE0-\uFFE6\uFFE8-\uFFEE\uFFFC\uFFFD]|\uD800[\uDD37-\uDD3F\uDD79-\uDD89\uDD8C-\uDD8E\uDD90-\uDD9C\uDDA0\uDDD0-\uDDFC]|\uD802[\uDC77\uDC78\uDEC8]|\uD805\uDF3F|\uD807[\uDFD5-\uDFF1]|\uD81A[\uDF3C-\uDF3F\uDF45]|\uD82F\uDC9C|\uD833[\uDF50-\uDFC3]|\uD834[\uDC00-\uDCF5\uDD00-\uDD26\uDD29-\uDD64\uDD6A-\uDD6C\uDD83\uDD84\uDD8C-\uDDA9\uDDAE-\uDDEA\uDE00-\uDE41\uDE45\uDF00-\uDF56]|\uD835[\uDEC1\uDEDB\uDEFB\uDF15\uDF35\uDF4F\uDF6F\uDF89\uDFA9\uDFC3]|\uD836[\uDC00-\uDDFF\uDE37-\uDE3A\uDE6D-\uDE74\uDE76-\uDE83\uDE85\uDE86]|\uD838[\uDD4F\uDEFF]|\uD83B[\uDCAC\uDCB0\uDD2E\uDEF0\uDEF1]|\uD83C[\uDC00-\uDC2B\uDC30-\uDC93\uDCA0-\uDCAE\uDCB1-\uDCBF\uDCC1-\uDCCF\uDCD1-\uDCF5\uDD0D-\uDDAD\uDDE6-\uDE02\uDE10-\uDE3B\uDE40-\uDE48\uDE50\uDE51\uDE60-\uDE65\uDF00-\uDFFF]|\uD83D[\uDC00-\uDED7\uDEDC-\uDEEC\uDEF0-\uDEFC\uDF00-\uDF76\uDF7B-\uDFD9\uDFE0-\uDFEB\uDFF0]|\uD83E[\uDC00-\uDC0B\uDC10-\uDC47\uDC50-\uDC59\uDC60-\uDC87\uDC90-\uDCAD\uDCB0\uDCB1\uDD00-\uDE53\uDE60-\uDE6D\uDE70-\uDE7C\uDE80-\uDE88\uDE90-\uDEBD\uDEBF-\uDEC5\uDECE-\uDEDB\uDEE0-\uDEE8\uDEF0-\uDEF8\uDF00-\uDF92\uDF94-\uDFCA]/;
  const Z = /[ \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/;
  const ucmicro = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    Any,
    Cc,
    Cf: regex$1,
    P,
    S: regex,
    Z
  }, Symbol.toStringTag, { value: "Module" }));
  const htmlDecodeTree = new Uint16Array(
    // prettier-ignore
    'ᵁ<Õıʊҝջאٵ۞ޢߖࠏ੊ઑඡ๭༉༦჊ረዡᐕᒝᓃᓟᔥ\0\0\0\0\0\0ᕫᛍᦍᰒᷝ὾⁠↰⊍⏀⏻⑂⠤⤒ⴈ⹈⿎〖㊺㘹㞬㣾㨨㩱㫠㬮ࠀEMabcfglmnoprstu\\bfms¦³¹ÈÏlig耻Æ䃆P耻&䀦cute耻Á䃁reve;䄂Āiyx}rc耻Â䃂;䐐r;쀀𝔄rave耻À䃀pha;䎑acr;䄀d;橓Āgp¡on;䄄f;쀀𝔸plyFunction;恡ing耻Å䃅Ācs¾Ãr;쀀𝒜ign;扔ilde耻Ã䃃ml耻Ä䃄ЀaceforsuåûþėĜĢħĪĀcrêòkslash;或Ŷöø;櫧ed;挆y;䐑ƀcrtąċĔause;戵noullis;愬a;䎒r;쀀𝔅pf;쀀𝔹eve;䋘còēmpeq;扎܀HOacdefhilorsuōőŖƀƞƢƵƷƺǜȕɳɸɾcy;䐧PY耻©䂩ƀcpyŝŢźute;䄆Ā;iŧŨ拒talDifferentialD;慅leys;愭ȀaeioƉƎƔƘron;䄌dil耻Ç䃇rc;䄈nint;戰ot;䄊ĀdnƧƭilla;䂸terDot;䂷òſi;䎧rcleȀDMPTǇǋǑǖot;抙inus;抖lus;投imes;抗oĀcsǢǸkwiseContourIntegral;戲eCurlyĀDQȃȏoubleQuote;思uote;怙ȀlnpuȞȨɇɕonĀ;eȥȦ户;橴ƀgitȯȶȺruent;扡nt;戯ourIntegral;戮ĀfrɌɎ;愂oduct;成nterClockwiseContourIntegral;戳oss;樯cr;쀀𝒞pĀ;Cʄʅ拓ap;才րDJSZacefiosʠʬʰʴʸˋ˗ˡ˦̳ҍĀ;oŹʥtrahd;椑cy;䐂cy;䐅cy;䐏ƀgrsʿ˄ˇger;怡r;憡hv;櫤Āayː˕ron;䄎;䐔lĀ;t˝˞戇a;䎔r;쀀𝔇Āaf˫̧Ācm˰̢riticalȀADGT̖̜̀̆cute;䂴oŴ̋̍;䋙bleAcute;䋝rave;䁠ilde;䋜ond;拄ferentialD;慆Ѱ̽\0\0\0͔͂\0Ѕf;쀀𝔻ƀ;DE͈͉͍䂨ot;惜qual;扐blèCDLRUVͣͲ΂ϏϢϸontourIntegraìȹoɴ͹\0\0ͻ»͉nArrow;懓Āeo·ΤftƀARTΐΖΡrrow;懐ightArrow;懔eåˊngĀLRΫτeftĀARγιrrow;柸ightArrow;柺ightArrow;柹ightĀATϘϞrrow;懒ee;抨pɁϩ\0\0ϯrrow;懑ownArrow;懕erticalBar;戥ǹABLRTaВЪаўѿͼrrowƀ;BUНОТ憓ar;椓pArrow;懵reve;䌑eft˒к\0ц\0ѐightVector;楐eeVector;楞ectorĀ;Bљњ憽ar;楖ightǔѧ\0ѱeeVector;楟ectorĀ;BѺѻ懁ar;楗eeĀ;A҆҇护rrow;憧ĀctҒҗr;쀀𝒟rok;䄐ࠀNTacdfglmopqstuxҽӀӄӋӞӢӧӮӵԡԯԶՒ՝ՠեG;䅊H耻Ð䃐cute耻É䃉ƀaiyӒӗӜron;䄚rc耻Ê䃊;䐭ot;䄖r;쀀𝔈rave耻È䃈ement;戈ĀapӺӾcr;䄒tyɓԆ\0\0ԒmallSquare;旻erySmallSquare;斫ĀgpԦԪon;䄘f;쀀𝔼silon;䎕uĀaiԼՉlĀ;TՂՃ橵ilde;扂librium;懌Āci՗՚r;愰m;橳a;䎗ml耻Ë䃋Āipժկsts;戃onentialE;慇ʀcfiosօֈ֍ֲ׌y;䐤r;쀀𝔉lledɓ֗\0\0֣mallSquare;旼erySmallSquare;斪Ͱֺ\0ֿ\0\0ׄf;쀀𝔽All;戀riertrf;愱cò׋؀JTabcdfgorstר׬ׯ׺؀ؒؖ؛؝أ٬ٲcy;䐃耻>䀾mmaĀ;d׷׸䎓;䏜reve;䄞ƀeiy؇،ؐdil;䄢rc;䄜;䐓ot;䄠r;쀀𝔊;拙pf;쀀𝔾eater̀EFGLSTصلَٖٛ٦qualĀ;Lؾؿ扥ess;招ullEqual;执reater;檢ess;扷lantEqual;橾ilde;扳cr;쀀𝒢;扫ЀAacfiosuڅڋږڛڞڪھۊRDcy;䐪Āctڐڔek;䋇;䁞irc;䄤r;愌lbertSpace;愋ǰگ\0ڲf;愍izontalLine;攀Āctۃۅòکrok;䄦mpńېۘownHumðįqual;扏܀EJOacdfgmnostuۺ۾܃܇܎ܚܞܡܨ݄ݸދޏޕcy;䐕lig;䄲cy;䐁cute耻Í䃍Āiyܓܘrc耻Î䃎;䐘ot;䄰r;愑rave耻Ì䃌ƀ;apܠܯܿĀcgܴܷr;䄪inaryI;慈lieóϝǴ݉\0ݢĀ;eݍݎ戬Āgrݓݘral;戫section;拂isibleĀCTݬݲomma;恣imes;恢ƀgptݿރވon;䄮f;쀀𝕀a;䎙cr;愐ilde;䄨ǫޚ\0ޞcy;䐆l耻Ï䃏ʀcfosuެ޷޼߂ߐĀiyޱ޵rc;䄴;䐙r;쀀𝔍pf;쀀𝕁ǣ߇\0ߌr;쀀𝒥rcy;䐈kcy;䐄΀HJacfosߤߨ߽߬߱ࠂࠈcy;䐥cy;䐌ppa;䎚Āey߶߻dil;䄶;䐚r;쀀𝔎pf;쀀𝕂cr;쀀𝒦րJTaceflmostࠥࠩࠬࡐࡣ঳সে্਷ੇcy;䐉耻<䀼ʀcmnpr࠷࠼ࡁࡄࡍute;䄹bda;䎛g;柪lacetrf;愒r;憞ƀaeyࡗ࡜ࡡron;䄽dil;䄻;䐛Āfsࡨ॰tԀACDFRTUVarࡾࢩࢱࣦ࣠ࣼयज़ΐ४Ānrࢃ࢏gleBracket;柨rowƀ;BR࢙࢚࢞憐ar;懤ightArrow;懆eiling;挈oǵࢷ\0ࣃbleBracket;柦nǔࣈ\0࣒eeVector;楡ectorĀ;Bࣛࣜ懃ar;楙loor;挊ightĀAV࣯ࣵrrow;憔ector;楎Āerँगeƀ;AVउऊऐ抣rrow;憤ector;楚iangleƀ;BEतथऩ抲ar;槏qual;抴pƀDTVषूौownVector;楑eeVector;楠ectorĀ;Bॖॗ憿ar;楘ectorĀ;B॥०憼ar;楒ightáΜs̀EFGLSTॾঋকঝঢভqualGreater;拚ullEqual;扦reater;扶ess;檡lantEqual;橽ilde;扲r;쀀𝔏Ā;eঽা拘ftarrow;懚idot;䄿ƀnpw৔ਖਛgȀLRlr৞৷ਂਐeftĀAR০৬rrow;柵ightArrow;柷ightArrow;柶eftĀarγਊightáοightáϊf;쀀𝕃erĀLRਢਬeftArrow;憙ightArrow;憘ƀchtਾੀੂòࡌ;憰rok;䅁;扪Ѐacefiosuਗ਼੝੠੷੼અઋ઎p;椅y;䐜Ādl੥੯iumSpace;恟lintrf;愳r;쀀𝔐nusPlus;戓pf;쀀𝕄cò੶;䎜ҀJacefostuણધભીଔଙඑ඗ඞcy;䐊cute;䅃ƀaey઴હાron;䅇dil;䅅;䐝ƀgswે૰଎ativeƀMTV૓૟૨ediumSpace;怋hiĀcn૦૘ë૙eryThiî૙tedĀGL૸ଆreaterGreateòٳessLesóੈLine;䀊r;쀀𝔑ȀBnptଢନଷ଺reak;恠BreakingSpace;䂠f;愕ڀ;CDEGHLNPRSTV୕ୖ୪୼஡௫ఄ౞಄ದ೘ൡඅ櫬Āou୛୤ngruent;扢pCap;扭oubleVerticalBar;戦ƀlqxஃஊ஛ement;戉ualĀ;Tஒஓ扠ilde;쀀≂̸ists;戄reater΀;EFGLSTஶஷ஽௉௓௘௥扯qual;扱ullEqual;쀀≧̸reater;쀀≫̸ess;批lantEqual;쀀⩾̸ilde;扵umpń௲௽ownHump;쀀≎̸qual;쀀≏̸eĀfsఊధtTriangleƀ;BEచఛడ拪ar;쀀⧏̸qual;括s̀;EGLSTవశ఼ౄోౘ扮qual;扰reater;扸ess;쀀≪̸lantEqual;쀀⩽̸ilde;扴estedĀGL౨౹reaterGreater;쀀⪢̸essLess;쀀⪡̸recedesƀ;ESಒಓಛ技qual;쀀⪯̸lantEqual;拠ĀeiಫಹverseElement;戌ghtTriangleƀ;BEೋೌ೒拫ar;쀀⧐̸qual;拭ĀquೝഌuareSuĀbp೨೹setĀ;E೰ೳ쀀⊏̸qual;拢ersetĀ;Eഃആ쀀⊐̸qual;拣ƀbcpഓതൎsetĀ;Eഛഞ쀀⊂⃒qual;抈ceedsȀ;ESTലള഻െ抁qual;쀀⪰̸lantEqual;拡ilde;쀀≿̸ersetĀ;E൘൛쀀⊃⃒qual;抉ildeȀ;EFT൮൯൵ൿ扁qual;扄ullEqual;扇ilde;扉erticalBar;戤cr;쀀𝒩ilde耻Ñ䃑;䎝܀Eacdfgmoprstuvලෂ෉෕ෛ෠෧෼ขภยา฿ไlig;䅒cute耻Ó䃓Āiy෎ීrc耻Ô䃔;䐞blac;䅐r;쀀𝔒rave耻Ò䃒ƀaei෮ෲ෶cr;䅌ga;䎩cron;䎟pf;쀀𝕆enCurlyĀDQฎบoubleQuote;怜uote;怘;橔Āclวฬr;쀀𝒪ash耻Ø䃘iŬื฼de耻Õ䃕es;樷ml耻Ö䃖erĀBP๋๠Āar๐๓r;怾acĀek๚๜;揞et;掴arenthesis;揜Ҁacfhilors๿ງຊຏຒດຝະ໼rtialD;戂y;䐟r;쀀𝔓i;䎦;䎠usMinus;䂱Āipຢອncareplanåڝf;愙Ȁ;eio຺ູ໠໤檻cedesȀ;EST່້໏໚扺qual;檯lantEqual;扼ilde;找me;怳Ādp໩໮uct;戏ortionĀ;aȥ໹l;戝Āci༁༆r;쀀𝒫;䎨ȀUfos༑༖༛༟OT耻"䀢r;쀀𝔔pf;愚cr;쀀𝒬؀BEacefhiorsu༾གྷཇའཱིྦྷྪྭ႖ႩႴႾarr;椐G耻®䂮ƀcnrཎནབute;䅔g;柫rĀ;tཛྷཝ憠l;椖ƀaeyཧཬཱron;䅘dil;䅖;䐠Ā;vླྀཹ愜erseĀEUྂྙĀlq྇ྎement;戋uilibrium;懋pEquilibrium;楯r»ཹo;䎡ghtЀACDFTUVa࿁࿫࿳ဢဨၛႇϘĀnr࿆࿒gleBracket;柩rowƀ;BL࿜࿝࿡憒ar;懥eftArrow;懄eiling;按oǵ࿹\0စbleBracket;柧nǔည\0နeeVector;楝ectorĀ;Bဝသ懂ar;楕loor;挋Āerိ၃eƀ;AVဵံြ抢rrow;憦ector;楛iangleƀ;BEၐၑၕ抳ar;槐qual;抵pƀDTVၣၮၸownVector;楏eeVector;楜ectorĀ;Bႂႃ憾ar;楔ectorĀ;B႑႒懀ar;楓Āpuႛ႞f;愝ndImplies;楰ightarrow;懛ĀchႹႼr;愛;憱leDelayed;槴ڀHOacfhimoqstuფჱჷჽᄙᄞᅑᅖᅡᅧᆵᆻᆿĀCcჩხHcy;䐩y;䐨FTcy;䐬cute;䅚ʀ;aeiyᄈᄉᄎᄓᄗ檼ron;䅠dil;䅞rc;䅜;䐡r;쀀𝔖ortȀDLRUᄪᄴᄾᅉownArrow»ОeftArrow»࢚ightArrow»࿝pArrow;憑gma;䎣allCircle;战pf;쀀𝕊ɲᅭ\0\0ᅰt;戚areȀ;ISUᅻᅼᆉᆯ斡ntersection;抓uĀbpᆏᆞsetĀ;Eᆗᆘ抏qual;抑ersetĀ;Eᆨᆩ抐qual;抒nion;抔cr;쀀𝒮ar;拆ȀbcmpᇈᇛሉላĀ;sᇍᇎ拐etĀ;Eᇍᇕqual;抆ĀchᇠህeedsȀ;ESTᇭᇮᇴᇿ扻qual;檰lantEqual;扽ilde;承Tháྌ;我ƀ;esሒሓሣ拑rsetĀ;Eሜም抃qual;抇et»ሓրHRSacfhiorsሾቄ቉ቕ቞ቱቶኟዂወዑORN耻Þ䃞ADE;愢ĀHc቎ቒcy;䐋y;䐦Ābuቚቜ;䀉;䎤ƀaeyብቪቯron;䅤dil;䅢;䐢r;쀀𝔗Āeiቻ኉ǲኀ\0ኇefore;戴a;䎘Ācn኎ኘkSpace;쀀  Space;怉ldeȀ;EFTካኬኲኼ戼qual;扃ullEqual;扅ilde;扈pf;쀀𝕋ipleDot;惛Āctዖዛr;쀀𝒯rok;䅦ૡዷጎጚጦ\0ጬጱ\0\0\0\0\0ጸጽ፷ᎅ\0᏿ᐄᐊᐐĀcrዻጁute耻Ú䃚rĀ;oጇገ憟cir;楉rǣጓ\0጖y;䐎ve;䅬Āiyጞጣrc耻Û䃛;䐣blac;䅰r;쀀𝔘rave耻Ù䃙acr;䅪Ādiፁ፩erĀBPፈ፝Āarፍፐr;䁟acĀekፗፙ;揟et;掵arenthesis;揝onĀ;P፰፱拃lus;抎Āgp፻፿on;䅲f;쀀𝕌ЀADETadps᎕ᎮᎸᏄϨᏒᏗᏳrrowƀ;BDᅐᎠᎤar;椒ownArrow;懅ownArrow;憕quilibrium;楮eeĀ;AᏋᏌ报rrow;憥ownáϳerĀLRᏞᏨeftArrow;憖ightArrow;憗iĀ;lᏹᏺ䏒on;䎥ing;䅮cr;쀀𝒰ilde;䅨ml耻Ü䃜ҀDbcdefosvᐧᐬᐰᐳᐾᒅᒊᒐᒖash;披ar;櫫y;䐒ashĀ;lᐻᐼ抩;櫦Āerᑃᑅ;拁ƀbtyᑌᑐᑺar;怖Ā;iᑏᑕcalȀBLSTᑡᑥᑪᑴar;戣ine;䁼eparator;杘ilde;所ThinSpace;怊r;쀀𝔙pf;쀀𝕍cr;쀀𝒱dash;抪ʀcefosᒧᒬᒱᒶᒼirc;䅴dge;拀r;쀀𝔚pf;쀀𝕎cr;쀀𝒲Ȁfiosᓋᓐᓒᓘr;쀀𝔛;䎞pf;쀀𝕏cr;쀀𝒳ҀAIUacfosuᓱᓵᓹᓽᔄᔏᔔᔚᔠcy;䐯cy;䐇cy;䐮cute耻Ý䃝Āiyᔉᔍrc;䅶;䐫r;쀀𝔜pf;쀀𝕐cr;쀀𝒴ml;䅸ЀHacdefosᔵᔹᔿᕋᕏᕝᕠᕤcy;䐖cute;䅹Āayᕄᕉron;䅽;䐗ot;䅻ǲᕔ\0ᕛoWidtè૙a;䎖r;愨pf;愤cr;쀀𝒵௡ᖃᖊᖐ\0ᖰᖶᖿ\0\0\0\0ᗆᗛᗫᙟ᙭\0ᚕ᚛ᚲᚹ\0ᚾcute耻á䃡reve;䄃̀;Ediuyᖜᖝᖡᖣᖨᖭ戾;쀀∾̳;房rc耻â䃢te肻´̆;䐰lig耻æ䃦Ā;r²ᖺ;쀀𝔞rave耻à䃠ĀepᗊᗖĀfpᗏᗔsym;愵èᗓha;䎱ĀapᗟcĀclᗤᗧr;䄁g;樿ɤᗰ\0\0ᘊʀ;adsvᗺᗻᗿᘁᘇ戧nd;橕;橜lope;橘;橚΀;elmrszᘘᘙᘛᘞᘿᙏᙙ戠;榤e»ᘙsdĀ;aᘥᘦ戡ѡᘰᘲᘴᘶᘸᘺᘼᘾ;榨;榩;榪;榫;榬;榭;榮;榯tĀ;vᙅᙆ戟bĀ;dᙌᙍ抾;榝Āptᙔᙗh;戢»¹arr;捼Āgpᙣᙧon;䄅f;쀀𝕒΀;Eaeiop዁ᙻᙽᚂᚄᚇᚊ;橰cir;橯;扊d;手s;䀧roxĀ;e዁ᚒñᚃing耻å䃥ƀctyᚡᚦᚨr;쀀𝒶;䀪mpĀ;e዁ᚯñʈilde耻ã䃣ml耻ä䃤Āciᛂᛈoninôɲnt;樑ࠀNabcdefiklnoprsu᛭ᛱᜰ᜼ᝃᝈ᝸᝽០៦ᠹᡐᜍ᤽᥈ᥰot;櫭Ācrᛶ᜞kȀcepsᜀᜅᜍᜓong;扌psilon;䏶rime;怵imĀ;e᜚᜛戽q;拍Ŷᜢᜦee;抽edĀ;gᜬᜭ挅e»ᜭrkĀ;t፜᜷brk;掶Āoyᜁᝁ;䐱quo;怞ʀcmprtᝓ᝛ᝡᝤᝨausĀ;eĊĉptyv;榰séᜌnoõēƀahwᝯ᝱ᝳ;䎲;愶een;扬r;쀀𝔟g΀costuvwឍឝឳេ៕៛៞ƀaiuបពរðݠrc;旯p»፱ƀdptឤឨឭot;樀lus;樁imes;樂ɱឹ\0\0ើcup;樆ar;昅riangleĀdu៍្own;施p;斳plus;樄eåᑄåᒭarow;植ƀako៭ᠦᠵĀcn៲ᠣkƀlst៺֫᠂ozenge;槫riangleȀ;dlr᠒᠓᠘᠝斴own;斾eft;旂ight;斸k;搣Ʊᠫ\0ᠳƲᠯ\0ᠱ;斒;斑4;斓ck;斈ĀeoᠾᡍĀ;qᡃᡆ쀀=⃥uiv;쀀≡⃥t;挐Ȁptwxᡙᡞᡧᡬf;쀀𝕓Ā;tᏋᡣom»Ꮜtie;拈؀DHUVbdhmptuvᢅᢖᢪᢻᣗᣛᣬ᣿ᤅᤊᤐᤡȀLRlrᢎᢐᢒᢔ;敗;敔;敖;敓ʀ;DUduᢡᢢᢤᢦᢨ敐;敦;敩;敤;敧ȀLRlrᢳᢵᢷᢹ;敝;敚;敜;教΀;HLRhlrᣊᣋᣍᣏᣑᣓᣕ救;敬;散;敠;敫;敢;敟ox;槉ȀLRlrᣤᣦᣨᣪ;敕;敒;攐;攌ʀ;DUduڽ᣷᣹᣻᣽;敥;敨;攬;攴inus;抟lus;択imes;抠ȀLRlrᤙᤛᤝ᤟;敛;敘;攘;攔΀;HLRhlrᤰᤱᤳᤵᤷ᤻᤹攂;敪;敡;敞;攼;攤;攜Āevģ᥂bar耻¦䂦Ȁceioᥑᥖᥚᥠr;쀀𝒷mi;恏mĀ;e᜚᜜lƀ;bhᥨᥩᥫ䁜;槅sub;柈Ŭᥴ᥾lĀ;e᥹᥺怢t»᥺pƀ;Eeįᦅᦇ;檮Ā;qۜۛೡᦧ\0᧨ᨑᨕᨲ\0ᨷᩐ\0\0᪴\0\0᫁\0\0ᬡᬮ᭍᭒\0᯽\0ᰌƀcpr᦭ᦲ᧝ute;䄇̀;abcdsᦿᧀᧄ᧊᧕᧙戩nd;橄rcup;橉Āau᧏᧒p;橋p;橇ot;橀;쀀∩︀Āeo᧢᧥t;恁îړȀaeiu᧰᧻ᨁᨅǰ᧵\0᧸s;橍on;䄍dil耻ç䃧rc;䄉psĀ;sᨌᨍ橌m;橐ot;䄋ƀdmnᨛᨠᨦil肻¸ƭptyv;榲t脀¢;eᨭᨮ䂢räƲr;쀀𝔠ƀceiᨽᩀᩍy;䑇ckĀ;mᩇᩈ朓ark»ᩈ;䏇r΀;Ecefms᩟᩠ᩢᩫ᪤᪪᪮旋;槃ƀ;elᩩᩪᩭ䋆q;扗eɡᩴ\0\0᪈rrowĀlr᩼᪁eft;憺ight;憻ʀRSacd᪒᪔᪖᪚᪟»ཇ;擈st;抛irc;抚ash;抝nint;樐id;櫯cir;槂ubsĀ;u᪻᪼晣it»᪼ˬ᫇᫔᫺\0ᬊonĀ;eᫍᫎ䀺Ā;qÇÆɭ᫙\0\0᫢aĀ;t᫞᫟䀬;䁀ƀ;fl᫨᫩᫫戁îᅠeĀmx᫱᫶ent»᫩eóɍǧ᫾\0ᬇĀ;dኻᬂot;橭nôɆƀfryᬐᬔᬗ;쀀𝕔oäɔ脀©;sŕᬝr;愗Āaoᬥᬩrr;憵ss;朗Ācuᬲᬷr;쀀𝒸Ābpᬼ᭄Ā;eᭁᭂ櫏;櫑Ā;eᭉᭊ櫐;櫒dot;拯΀delprvw᭠᭬᭷ᮂᮬᯔ᯹arrĀlr᭨᭪;椸;椵ɰ᭲\0\0᭵r;拞c;拟arrĀ;p᭿ᮀ憶;椽̀;bcdosᮏᮐᮖᮡᮥᮨ截rcap;橈Āauᮛᮞp;橆p;橊ot;抍r;橅;쀀∪︀Ȁalrv᮵ᮿᯞᯣrrĀ;mᮼᮽ憷;椼yƀevwᯇᯔᯘqɰᯎ\0\0ᯒreã᭳uã᭵ee;拎edge;拏en耻¤䂤earrowĀlrᯮ᯳eft»ᮀight»ᮽeäᯝĀciᰁᰇoninôǷnt;戱lcty;挭ঀAHabcdefhijlorstuwz᰸᰻᰿ᱝᱩᱵᲊᲞᲬᲷ᳻᳿ᴍᵻᶑᶫᶻ᷆᷍rò΁ar;楥Ȁglrs᱈ᱍ᱒᱔ger;怠eth;愸òᄳhĀ;vᱚᱛ怐»ऊūᱡᱧarow;椏aã̕Āayᱮᱳron;䄏;䐴ƀ;ao̲ᱼᲄĀgrʿᲁr;懊tseq;橷ƀglmᲑᲔᲘ耻°䂰ta;䎴ptyv;榱ĀirᲣᲨsht;楿;쀀𝔡arĀlrᲳᲵ»ࣜ»သʀaegsv᳂͸᳖᳜᳠mƀ;oș᳊᳔ndĀ;ș᳑uit;晦amma;䏝in;拲ƀ;io᳧᳨᳸䃷de脀÷;o᳧ᳰntimes;拇nø᳷cy;䑒cɯᴆ\0\0ᴊrn;挞op;挍ʀlptuwᴘᴝᴢᵉᵕlar;䀤f;쀀𝕕ʀ;emps̋ᴭᴷᴽᵂqĀ;d͒ᴳot;扑inus;戸lus;戔quare;抡blebarwedgåúnƀadhᄮᵝᵧownarrowóᲃarpoonĀlrᵲᵶefôᲴighôᲶŢᵿᶅkaro÷གɯᶊ\0\0ᶎrn;挟op;挌ƀcotᶘᶣᶦĀryᶝᶡ;쀀𝒹;䑕l;槶rok;䄑Ādrᶰᶴot;拱iĀ;fᶺ᠖斿Āah᷀᷃ròЩaòྦangle;榦Āci᷒ᷕy;䑟grarr;柿ऀDacdefglmnopqrstuxḁḉḙḸոḼṉṡṾấắẽỡἪἷὄ὎὚ĀDoḆᴴoôᲉĀcsḎḔute耻é䃩ter;橮ȀaioyḢḧḱḶron;䄛rĀ;cḭḮ扖耻ê䃪lon;払;䑍ot;䄗ĀDrṁṅot;扒;쀀𝔢ƀ;rsṐṑṗ檚ave耻è䃨Ā;dṜṝ檖ot;檘Ȁ;ilsṪṫṲṴ檙nters;揧;愓Ā;dṹṺ檕ot;檗ƀapsẅẉẗcr;䄓tyƀ;svẒẓẕ戅et»ẓpĀ1;ẝẤĳạả;怄;怅怃ĀgsẪẬ;䅋p;怂ĀgpẴẸon;䄙f;쀀𝕖ƀalsỄỎỒrĀ;sỊị拕l;槣us;橱iƀ;lvỚớở䎵on»ớ;䏵ȀcsuvỪỳἋἣĀioữḱrc»Ḯɩỹ\0\0ỻíՈantĀglἂἆtr»ṝess»Ṻƀaeiἒ἖Ἒls;䀽st;扟vĀ;DȵἠD;橸parsl;槥ĀDaἯἳot;打rr;楱ƀcdiἾὁỸr;愯oô͒ĀahὉὋ;䎷耻ð䃰Āmrὓὗl耻ë䃫o;悬ƀcipὡὤὧl;䀡sôծĀeoὬὴctatioîՙnentialåչৡᾒ\0ᾞ\0ᾡᾧ\0\0ῆῌ\0ΐ\0ῦῪ \0 ⁚llingdotseñṄy;䑄male;晀ƀilrᾭᾳ῁lig;耀ﬃɩᾹ\0\0᾽g;耀ﬀig;耀ﬄ;쀀𝔣lig;耀ﬁlig;쀀fjƀaltῙ῜ῡt;晭ig;耀ﬂns;斱of;䆒ǰ΅\0ῳf;쀀𝕗ĀakֿῷĀ;vῼ´拔;櫙artint;樍Āao‌⁕Ācs‑⁒α‚‰‸⁅⁈\0⁐β•‥‧‪‬\0‮耻½䂽;慓耻¼䂼;慕;慙;慛Ƴ‴\0‶;慔;慖ʴ‾⁁\0\0⁃耻¾䂾;慗;慜5;慘ƶ⁌\0⁎;慚;慝8;慞l;恄wn;挢cr;쀀𝒻ࢀEabcdefgijlnorstv₂₉₟₥₰₴⃰⃵⃺⃿℃ℒℸ̗ℾ⅒↞Ā;lٍ₇;檌ƀcmpₐₕ₝ute;䇵maĀ;dₜ᳚䎳;檆reve;䄟Āiy₪₮rc;䄝;䐳ot;䄡Ȁ;lqsؾق₽⃉ƀ;qsؾٌ⃄lanô٥Ȁ;cdl٥⃒⃥⃕c;檩otĀ;o⃜⃝檀Ā;l⃢⃣檂;檄Ā;e⃪⃭쀀⋛︀s;檔r;쀀𝔤Ā;gٳ؛mel;愷cy;䑓Ȁ;Eajٚℌℎℐ;檒;檥;檤ȀEaesℛℝ℩ℴ;扩pĀ;p℣ℤ檊rox»ℤĀ;q℮ℯ檈Ā;q℮ℛim;拧pf;쀀𝕘Āci⅃ⅆr;愊mƀ;el٫ⅎ⅐;檎;檐茀>;cdlqr׮ⅠⅪⅮⅳⅹĀciⅥⅧ;檧r;橺ot;拗Par;榕uest;橼ʀadelsↄⅪ←ٖ↛ǰ↉\0↎proø₞r;楸qĀlqؿ↖lesó₈ií٫Āen↣↭rtneqq;쀀≩︀Å↪ԀAabcefkosy⇄⇇⇱⇵⇺∘∝∯≨≽ròΠȀilmr⇐⇔⇗⇛rsðᒄf»․ilôکĀdr⇠⇤cy;䑊ƀ;cwࣴ⇫⇯ir;楈;憭ar;意irc;䄥ƀalr∁∎∓rtsĀ;u∉∊晥it»∊lip;怦con;抹r;쀀𝔥sĀew∣∩arow;椥arow;椦ʀamopr∺∾≃≞≣rr;懿tht;戻kĀlr≉≓eftarrow;憩ightarrow;憪f;쀀𝕙bar;怕ƀclt≯≴≸r;쀀𝒽asè⇴rok;䄧Ābp⊂⊇ull;恃hen»ᱛૡ⊣\0⊪\0⊸⋅⋎\0⋕⋳\0\0⋸⌢⍧⍢⍿\0⎆⎪⎴cute耻í䃭ƀ;iyݱ⊰⊵rc耻î䃮;䐸Ācx⊼⊿y;䐵cl耻¡䂡ĀfrΟ⋉;쀀𝔦rave耻ì䃬Ȁ;inoܾ⋝⋩⋮Āin⋢⋦nt;樌t;戭fin;槜ta;愩lig;䄳ƀaop⋾⌚⌝ƀcgt⌅⌈⌗r;䄫ƀelpܟ⌏⌓inåގarôܠh;䄱f;抷ed;䆵ʀ;cfotӴ⌬⌱⌽⍁are;愅inĀ;t⌸⌹戞ie;槝doô⌙ʀ;celpݗ⍌⍐⍛⍡al;抺Āgr⍕⍙eróᕣã⍍arhk;樗rod;樼Ȁcgpt⍯⍲⍶⍻y;䑑on;䄯f;쀀𝕚a;䎹uest耻¿䂿Āci⎊⎏r;쀀𝒾nʀ;EdsvӴ⎛⎝⎡ӳ;拹ot;拵Ā;v⎦⎧拴;拳Ā;iݷ⎮lde;䄩ǫ⎸\0⎼cy;䑖l耻ï䃯̀cfmosu⏌⏗⏜⏡⏧⏵Āiy⏑⏕rc;䄵;䐹r;쀀𝔧ath;䈷pf;쀀𝕛ǣ⏬\0⏱r;쀀𝒿rcy;䑘kcy;䑔Ѐacfghjos␋␖␢␧␭␱␵␻ppaĀ;v␓␔䎺;䏰Āey␛␠dil;䄷;䐺r;쀀𝔨reen;䄸cy;䑅cy;䑜pf;쀀𝕜cr;쀀𝓀஀ABEHabcdefghjlmnoprstuv⑰⒁⒆⒍⒑┎┽╚▀♎♞♥♹♽⚚⚲⛘❝❨➋⟀⠁⠒ƀart⑷⑺⑼rò৆òΕail;椛arr;椎Ā;gঔ⒋;檋ar;楢ॣ⒥\0⒪\0⒱\0\0\0\0\0⒵Ⓔ\0ⓆⓈⓍ\0⓹ute;䄺mptyv;榴raîࡌbda;䎻gƀ;dlࢎⓁⓃ;榑åࢎ;檅uo耻«䂫rЀ;bfhlpst࢙ⓞⓦⓩ⓫⓮⓱⓵Ā;f࢝ⓣs;椟s;椝ë≒p;憫l;椹im;楳l;憢ƀ;ae⓿─┄檫il;椙Ā;s┉┊檭;쀀⪭︀ƀabr┕┙┝rr;椌rk;杲Āak┢┬cĀek┨┪;䁻;䁛Āes┱┳;榋lĀdu┹┻;榏;榍Ȁaeuy╆╋╖╘ron;䄾Ādi═╔il;䄼ìࢰâ┩;䐻Ȁcqrs╣╦╭╽a;椶uoĀ;rนᝆĀdu╲╷har;楧shar;楋h;憲ʀ;fgqs▋▌উ◳◿扤tʀahlrt▘▤▷◂◨rrowĀ;t࢙□aé⓶arpoonĀdu▯▴own»њp»०eftarrows;懇ightƀahs◍◖◞rrowĀ;sࣴࢧarpoonó྘quigarro÷⇰hreetimes;拋ƀ;qs▋ও◺lanôবʀ;cdgsব☊☍☝☨c;檨otĀ;o☔☕橿Ā;r☚☛檁;檃Ā;e☢☥쀀⋚︀s;檓ʀadegs☳☹☽♉♋pproøⓆot;拖qĀgq♃♅ôউgtò⒌ôছiíলƀilr♕࣡♚sht;楼;쀀𝔩Ā;Eজ♣;檑š♩♶rĀdu▲♮Ā;l॥♳;楪lk;斄cy;䑙ʀ;achtੈ⚈⚋⚑⚖rò◁orneòᴈard;楫ri;旺Āio⚟⚤dot;䅀ustĀ;a⚬⚭掰che»⚭ȀEaes⚻⚽⛉⛔;扨pĀ;p⛃⛄檉rox»⛄Ā;q⛎⛏檇Ā;q⛎⚻im;拦Ѐabnoptwz⛩⛴⛷✚✯❁❇❐Ānr⛮⛱g;柬r;懽rëࣁgƀlmr⛿✍✔eftĀar০✇ightá৲apsto;柼ightá৽parrowĀlr✥✩efô⓭ight;憬ƀafl✶✹✽r;榅;쀀𝕝us;樭imes;樴š❋❏st;戗áፎƀ;ef❗❘᠀旊nge»❘arĀ;l❤❥䀨t;榓ʀachmt❳❶❼➅➇ròࢨorneòᶌarĀ;d྘➃;業;怎ri;抿̀achiqt➘➝ੀ➢➮➻quo;怹r;쀀𝓁mƀ;egল➪➬;檍;檏Ābu┪➳oĀ;rฟ➹;怚rok;䅂萀<;cdhilqrࠫ⟒☹⟜⟠⟥⟪⟰Āci⟗⟙;檦r;橹reå◲mes;拉arr;楶uest;橻ĀPi⟵⟹ar;榖ƀ;ef⠀भ᠛旃rĀdu⠇⠍shar;楊har;楦Āen⠗⠡rtneqq;쀀≨︀Å⠞܀Dacdefhilnopsu⡀⡅⢂⢎⢓⢠⢥⢨⣚⣢⣤ઃ⣳⤂Dot;戺Ȁclpr⡎⡒⡣⡽r耻¯䂯Āet⡗⡙;時Ā;e⡞⡟朠se»⡟Ā;sျ⡨toȀ;dluျ⡳⡷⡻owîҌefôएðᏑker;斮Āoy⢇⢌mma;権;䐼ash;怔asuredangle»ᘦr;쀀𝔪o;愧ƀcdn⢯⢴⣉ro耻µ䂵Ȁ;acdᑤ⢽⣀⣄sôᚧir;櫰ot肻·Ƶusƀ;bd⣒ᤃ⣓戒Ā;uᴼ⣘;横ţ⣞⣡p;櫛ò−ðઁĀdp⣩⣮els;抧f;쀀𝕞Āct⣸⣽r;쀀𝓂pos»ᖝƀ;lm⤉⤊⤍䎼timap;抸ఀGLRVabcdefghijlmoprstuvw⥂⥓⥾⦉⦘⧚⧩⨕⨚⩘⩝⪃⪕⪤⪨⬄⬇⭄⭿⮮ⰴⱧⱼ⳩Āgt⥇⥋;쀀⋙̸Ā;v⥐௏쀀≫⃒ƀelt⥚⥲⥶ftĀar⥡⥧rrow;懍ightarrow;懎;쀀⋘̸Ā;v⥻ే쀀≪⃒ightarrow;懏ĀDd⦎⦓ash;抯ash;抮ʀbcnpt⦣⦧⦬⦱⧌la»˞ute;䅄g;쀀∠⃒ʀ;Eiop඄⦼⧀⧅⧈;쀀⩰̸d;쀀≋̸s;䅉roø඄urĀ;a⧓⧔普lĀ;s⧓ସǳ⧟\0⧣p肻 ଷmpĀ;e௹ఀʀaeouy⧴⧾⨃⨐⨓ǰ⧹\0⧻;橃on;䅈dil;䅆ngĀ;dൾ⨊ot;쀀⩭̸p;橂;䐽ash;怓΀;Aadqsxஒ⨩⨭⨻⩁⩅⩐rr;懗rĀhr⨳⨶k;椤Ā;oᏲᏰot;쀀≐̸uiöୣĀei⩊⩎ar;椨í஘istĀ;s஠டr;쀀𝔫ȀEest௅⩦⩹⩼ƀ;qs஼⩭௡ƀ;qs஼௅⩴lanô௢ií௪Ā;rஶ⪁»ஷƀAap⪊⪍⪑rò⥱rr;憮ar;櫲ƀ;svྍ⪜ྌĀ;d⪡⪢拼;拺cy;䑚΀AEadest⪷⪺⪾⫂⫅⫶⫹rò⥦;쀀≦̸rr;憚r;急Ȁ;fqs఻⫎⫣⫯tĀar⫔⫙rro÷⫁ightarro÷⪐ƀ;qs఻⪺⫪lanôౕĀ;sౕ⫴»శiíౝĀ;rవ⫾iĀ;eచథiäඐĀpt⬌⬑f;쀀𝕟膀¬;in⬙⬚⬶䂬nȀ;Edvஉ⬤⬨⬮;쀀⋹̸ot;쀀⋵̸ǡஉ⬳⬵;拷;拶iĀ;vಸ⬼ǡಸ⭁⭃;拾;拽ƀaor⭋⭣⭩rȀ;ast୻⭕⭚⭟lleì୻l;쀀⫽⃥;쀀∂̸lint;樔ƀ;ceಒ⭰⭳uåಥĀ;cಘ⭸Ā;eಒ⭽ñಘȀAait⮈⮋⮝⮧rò⦈rrƀ;cw⮔⮕⮙憛;쀀⤳̸;쀀↝̸ghtarrow»⮕riĀ;eೋೖ΀chimpqu⮽⯍⯙⬄୸⯤⯯Ȁ;cerല⯆ഷ⯉uå൅;쀀𝓃ortɭ⬅\0\0⯖ará⭖mĀ;e൮⯟Ā;q൴൳suĀbp⯫⯭å೸åഋƀbcp⯶ⰑⰙȀ;Ees⯿ⰀഢⰄ抄;쀀⫅̸etĀ;eഛⰋqĀ;qണⰀcĀ;eലⰗñസȀ;EesⰢⰣൟⰧ抅;쀀⫆̸etĀ;e൘ⰮqĀ;qൠⰣȀgilrⰽⰿⱅⱇìௗlde耻ñ䃱çృiangleĀlrⱒⱜeftĀ;eచⱚñదightĀ;eೋⱥñ೗Ā;mⱬⱭ䎽ƀ;esⱴⱵⱹ䀣ro;愖p;怇ҀDHadgilrsⲏⲔⲙⲞⲣⲰⲶⳓⳣash;抭arr;椄p;쀀≍⃒ash;抬ĀetⲨⲬ;쀀≥⃒;쀀>⃒nfin;槞ƀAetⲽⳁⳅrr;椂;쀀≤⃒Ā;rⳊⳍ쀀<⃒ie;쀀⊴⃒ĀAtⳘⳜrr;椃rie;쀀⊵⃒im;쀀∼⃒ƀAan⳰⳴ⴂrr;懖rĀhr⳺⳽k;椣Ā;oᏧᏥear;椧ቓ᪕\0\0\0\0\0\0\0\0\0\0\0\0\0ⴭ\0ⴸⵈⵠⵥ⵲ⶄᬇ\0\0ⶍⶫ\0ⷈⷎ\0ⷜ⸙⸫⸾⹃Ācsⴱ᪗ute耻ó䃳ĀiyⴼⵅrĀ;c᪞ⵂ耻ô䃴;䐾ʀabios᪠ⵒⵗǈⵚlac;䅑v;樸old;榼lig;䅓Ācr⵩⵭ir;榿;쀀𝔬ͯ⵹\0\0⵼\0ⶂn;䋛ave耻ò䃲;槁Ābmⶈ෴ar;榵Ȁacitⶕ⶘ⶥⶨrò᪀Āir⶝ⶠr;榾oss;榻nå๒;槀ƀaeiⶱⶵⶹcr;䅍ga;䏉ƀcdnⷀⷅǍron;䎿;榶pf;쀀𝕠ƀaelⷔ⷗ǒr;榷rp;榹΀;adiosvⷪⷫⷮ⸈⸍⸐⸖戨rò᪆Ȁ;efmⷷⷸ⸂⸅橝rĀ;oⷾⷿ愴f»ⷿ耻ª䂪耻º䂺gof;抶r;橖lope;橗;橛ƀclo⸟⸡⸧ò⸁ash耻ø䃸l;折iŬⸯ⸴de耻õ䃵esĀ;aǛ⸺s;樶ml耻ö䃶bar;挽ૡ⹞\0⹽\0⺀⺝\0⺢⺹\0\0⻋ຜ\0⼓\0\0⼫⾼\0⿈rȀ;astЃ⹧⹲຅脀¶;l⹭⹮䂶leìЃɩ⹸\0\0⹻m;櫳;櫽y;䐿rʀcimpt⺋⺏⺓ᡥ⺗nt;䀥od;䀮il;怰enk;怱r;쀀𝔭ƀimo⺨⺰⺴Ā;v⺭⺮䏆;䏕maô੶ne;明ƀ;tv⺿⻀⻈䏀chfork»´;䏖Āau⻏⻟nĀck⻕⻝kĀ;h⇴⻛;愎ö⇴sҀ;abcdemst⻳⻴ᤈ⻹⻽⼄⼆⼊⼎䀫cir;樣ir;樢Āouᵀ⼂;樥;橲n肻±ຝim;樦wo;樧ƀipu⼙⼠⼥ntint;樕f;쀀𝕡nd耻£䂣Ԁ;Eaceinosu່⼿⽁⽄⽇⾁⾉⾒⽾⾶;檳p;檷uå໙Ā;c໎⽌̀;acens່⽙⽟⽦⽨⽾pproø⽃urlyeñ໙ñ໎ƀaes⽯⽶⽺pprox;檹qq;檵im;拨iíໟmeĀ;s⾈ຮ怲ƀEas⽸⾐⽺ð⽵ƀdfp໬⾙⾯ƀals⾠⾥⾪lar;挮ine;挒urf;挓Ā;t໻⾴ï໻rel;抰Āci⿀⿅r;쀀𝓅;䏈ncsp;怈̀fiopsu⿚⋢⿟⿥⿫⿱r;쀀𝔮pf;쀀𝕢rime;恗cr;쀀𝓆ƀaeo⿸〉〓tĀei⿾々rnionóڰnt;樖stĀ;e【】䀿ñἙô༔઀ABHabcdefhilmnoprstux぀けさすムㄎㄫㅇㅢㅲㆎ㈆㈕㈤㈩㉘㉮㉲㊐㊰㊷ƀartぇおがròႳòϝail;検aròᱥar;楤΀cdenqrtとふへみわゔヌĀeuねぱ;쀀∽̱te;䅕iãᅮmptyv;榳gȀ;del࿑らるろ;榒;榥å࿑uo耻»䂻rր;abcfhlpstw࿜ガクシスゼゾダッデナp;極Ā;f࿠ゴs;椠;椳s;椞ë≝ð✮l;楅im;楴l;憣;憝Āaiパフil;椚oĀ;nホボ戶aló༞ƀabrョリヮrò៥rk;杳ĀakンヽcĀekヹ・;䁽;䁝Āes㄂㄄;榌lĀduㄊㄌ;榎;榐Ȁaeuyㄗㄜㄧㄩron;䅙Ādiㄡㄥil;䅗ì࿲âヺ;䑀Ȁclqsㄴㄷㄽㅄa;椷dhar;楩uoĀ;rȎȍh;憳ƀacgㅎㅟངlȀ;ipsླྀㅘㅛႜnåႻarôྩt;断ƀilrㅩဣㅮsht;楽;쀀𝔯ĀaoㅷㆆrĀduㅽㅿ»ѻĀ;l႑ㆄ;楬Ā;vㆋㆌ䏁;䏱ƀgns㆕ㇹㇼht̀ahlrstㆤㆰ㇂㇘㇤㇮rrowĀ;t࿜ㆭaéトarpoonĀduㆻㆿowîㅾp»႒eftĀah㇊㇐rrowó࿪arpoonóՑightarrows;應quigarro÷ニhreetimes;拌g;䋚ingdotseñἲƀahm㈍㈐㈓rò࿪aòՑ;怏oustĀ;a㈞㈟掱che»㈟mid;櫮Ȁabpt㈲㈽㉀㉒Ānr㈷㈺g;柭r;懾rëဃƀafl㉇㉊㉎r;榆;쀀𝕣us;樮imes;樵Āap㉝㉧rĀ;g㉣㉤䀩t;榔olint;樒arò㇣Ȁachq㉻㊀Ⴜ㊅quo;怺r;쀀𝓇Ābu・㊊oĀ;rȔȓƀhir㊗㊛㊠reåㇸmes;拊iȀ;efl㊪ၙᠡ㊫方tri;槎luhar;楨;愞ൡ㋕㋛㋟㌬㌸㍱\0㍺㎤\0\0㏬㏰\0㐨㑈㑚㒭㒱㓊㓱\0㘖\0\0㘳cute;䅛quï➺Ԁ;Eaceinpsyᇭ㋳㋵㋿㌂㌋㌏㌟㌦㌩;檴ǰ㋺\0㋼;檸on;䅡uåᇾĀ;dᇳ㌇il;䅟rc;䅝ƀEas㌖㌘㌛;檶p;檺im;择olint;樓iíሄ;䑁otƀ;be㌴ᵇ㌵担;橦΀Aacmstx㍆㍊㍗㍛㍞㍣㍭rr;懘rĀhr㍐㍒ë∨Ā;oਸ਼਴t耻§䂧i;䀻war;椩mĀin㍩ðnuóñt;朶rĀ;o㍶⁕쀀𝔰Ȁacoy㎂㎆㎑㎠rp;景Āhy㎋㎏cy;䑉;䑈rtɭ㎙\0\0㎜iäᑤaraì⹯耻­䂭Āgm㎨㎴maƀ;fv㎱㎲㎲䏃;䏂Ѐ;deglnprካ㏅㏉㏎㏖㏞㏡㏦ot;橪Ā;q኱ኰĀ;E㏓㏔檞;檠Ā;E㏛㏜檝;檟e;扆lus;樤arr;楲aròᄽȀaeit㏸㐈㐏㐗Āls㏽㐄lsetmé㍪hp;樳parsl;槤Ādlᑣ㐔e;挣Ā;e㐜㐝檪Ā;s㐢㐣檬;쀀⪬︀ƀflp㐮㐳㑂tcy;䑌Ā;b㐸㐹䀯Ā;a㐾㐿槄r;挿f;쀀𝕤aĀdr㑍ЂesĀ;u㑔㑕晠it»㑕ƀcsu㑠㑹㒟Āau㑥㑯pĀ;sᆈ㑫;쀀⊓︀pĀ;sᆴ㑵;쀀⊔︀uĀbp㑿㒏ƀ;esᆗᆜ㒆etĀ;eᆗ㒍ñᆝƀ;esᆨᆭ㒖etĀ;eᆨ㒝ñᆮƀ;afᅻ㒦ְrť㒫ֱ»ᅼaròᅈȀcemt㒹㒾㓂㓅r;쀀𝓈tmîñiì㐕aræᆾĀar㓎㓕rĀ;f㓔ឿ昆Āan㓚㓭ightĀep㓣㓪psiloîỠhé⺯s»⡒ʀbcmnp㓻㕞ሉ㖋㖎Ҁ;Edemnprs㔎㔏㔑㔕㔞㔣㔬㔱㔶抂;櫅ot;檽Ā;dᇚ㔚ot;櫃ult;櫁ĀEe㔨㔪;櫋;把lus;檿arr;楹ƀeiu㔽㕒㕕tƀ;en㔎㕅㕋qĀ;qᇚ㔏eqĀ;q㔫㔨m;櫇Ābp㕚㕜;櫕;櫓c̀;acensᇭ㕬㕲㕹㕻㌦pproø㋺urlyeñᇾñᇳƀaes㖂㖈㌛pproø㌚qñ㌗g;晪ڀ123;Edehlmnps㖩㖬㖯ሜ㖲㖴㗀㗉㗕㗚㗟㗨㗭耻¹䂹耻²䂲耻³䂳;櫆Āos㖹㖼t;檾ub;櫘Ā;dሢ㗅ot;櫄sĀou㗏㗒l;柉b;櫗arr;楻ult;櫂ĀEe㗤㗦;櫌;抋lus;櫀ƀeiu㗴㘉㘌tƀ;enሜ㗼㘂qĀ;qሢ㖲eqĀ;q㗧㗤m;櫈Ābp㘑㘓;櫔;櫖ƀAan㘜㘠㘭rr;懙rĀhr㘦㘨ë∮Ā;oਫ਩war;椪lig耻ß䃟௡㙑㙝㙠ዎ㙳㙹\0㙾㛂\0\0\0\0\0㛛㜃\0㜉㝬\0\0\0㞇ɲ㙖\0\0㙛get;挖;䏄rë๟ƀaey㙦㙫㙰ron;䅥dil;䅣;䑂lrec;挕r;쀀𝔱Ȁeiko㚆㚝㚵㚼ǲ㚋\0㚑eĀ4fኄኁaƀ;sv㚘㚙㚛䎸ym;䏑Ācn㚢㚲kĀas㚨㚮pproø዁im»ኬsðኞĀas㚺㚮ð዁rn耻þ䃾Ǭ̟㛆⋧es膀×;bd㛏㛐㛘䃗Ā;aᤏ㛕r;樱;樰ƀeps㛡㛣㜀á⩍Ȁ;bcf҆㛬㛰㛴ot;挶ir;櫱Ā;o㛹㛼쀀𝕥rk;櫚á㍢rime;怴ƀaip㜏㜒㝤dåቈ΀adempst㜡㝍㝀㝑㝗㝜㝟ngleʀ;dlqr㜰㜱㜶㝀㝂斵own»ᶻeftĀ;e⠀㜾ñम;扜ightĀ;e㊪㝋ñၚot;旬inus;樺lus;樹b;槍ime;樻ezium;揢ƀcht㝲㝽㞁Āry㝷㝻;쀀𝓉;䑆cy;䑛rok;䅧Āio㞋㞎xô᝷headĀlr㞗㞠eftarro÷ࡏightarrow»ཝऀAHabcdfghlmoprstuw㟐㟓㟗㟤㟰㟼㠎㠜㠣㠴㡑㡝㡫㢩㣌㣒㣪㣶ròϭar;楣Ācr㟜㟢ute耻ú䃺òᅐrǣ㟪\0㟭y;䑞ve;䅭Āiy㟵㟺rc耻û䃻;䑃ƀabh㠃㠆㠋ròᎭlac;䅱aòᏃĀir㠓㠘sht;楾;쀀𝔲rave耻ù䃹š㠧㠱rĀlr㠬㠮»ॗ»ႃlk;斀Āct㠹㡍ɯ㠿\0\0㡊rnĀ;e㡅㡆挜r»㡆op;挏ri;旸Āal㡖㡚cr;䅫肻¨͉Āgp㡢㡦on;䅳f;쀀𝕦̀adhlsuᅋ㡸㡽፲㢑㢠ownáᎳarpoonĀlr㢈㢌efô㠭ighô㠯iƀ;hl㢙㢚㢜䏅»ᏺon»㢚parrows;懈ƀcit㢰㣄㣈ɯ㢶\0\0㣁rnĀ;e㢼㢽挝r»㢽op;挎ng;䅯ri;旹cr;쀀𝓊ƀdir㣙㣝㣢ot;拰lde;䅩iĀ;f㜰㣨»᠓Āam㣯㣲rò㢨l耻ü䃼angle;榧ހABDacdeflnoprsz㤜㤟㤩㤭㦵㦸㦽㧟㧤㧨㧳㧹㧽㨁㨠ròϷarĀ;v㤦㤧櫨;櫩asèϡĀnr㤲㤷grt;榜΀eknprst㓣㥆㥋㥒㥝㥤㦖appá␕othinçẖƀhir㓫⻈㥙opô⾵Ā;hᎷ㥢ïㆍĀiu㥩㥭gmá㎳Ābp㥲㦄setneqĀ;q㥽㦀쀀⊊︀;쀀⫋︀setneqĀ;q㦏㦒쀀⊋︀;쀀⫌︀Āhr㦛㦟etá㚜iangleĀlr㦪㦯eft»थight»ၑy;䐲ash»ံƀelr㧄㧒㧗ƀ;beⷪ㧋㧏ar;抻q;扚lip;拮Ābt㧜ᑨaòᑩr;쀀𝔳tré㦮suĀbp㧯㧱»ജ»൙pf;쀀𝕧roð໻tré㦴Ācu㨆㨋r;쀀𝓋Ābp㨐㨘nĀEe㦀㨖»㥾nĀEe㦒㨞»㦐igzag;榚΀cefoprs㨶㨻㩖㩛㩔㩡㩪irc;䅵Ādi㩀㩑Ābg㩅㩉ar;機eĀ;qᗺ㩏;扙erp;愘r;쀀𝔴pf;쀀𝕨Ā;eᑹ㩦atèᑹcr;쀀𝓌ૣណ㪇\0㪋\0㪐㪛\0\0㪝㪨㪫㪯\0\0㫃㫎\0㫘ៜ៟tré៑r;쀀𝔵ĀAa㪔㪗ròσrò৶;䎾ĀAa㪡㪤ròθrò৫að✓is;拻ƀdptឤ㪵㪾Āfl㪺ឩ;쀀𝕩imåឲĀAa㫇㫊ròώròਁĀcq㫒ីr;쀀𝓍Āpt៖㫜ré។Ѐacefiosu㫰㫽㬈㬌㬑㬕㬛㬡cĀuy㫶㫻te耻ý䃽;䑏Āiy㬂㬆rc;䅷;䑋n耻¥䂥r;쀀𝔶cy;䑗pf;쀀𝕪cr;쀀𝓎Ācm㬦㬩y;䑎l耻ÿ䃿Ԁacdefhiosw㭂㭈㭔㭘㭤㭩㭭㭴㭺㮀cute;䅺Āay㭍㭒ron;䅾;䐷ot;䅼Āet㭝㭡træᕟa;䎶r;쀀𝔷cy;䐶grarr;懝pf;쀀𝕫cr;쀀𝓏Ājn㮅㮇;怍j;怌'.split("").map((c) => c.charCodeAt(0))
  );
  const xmlDecodeTree = new Uint16Array(
    // prettier-ignore
    "Ȁaglq	\x1Bɭ\0\0p;䀦os;䀧t;䀾t;䀼uot;䀢".split("").map((c) => c.charCodeAt(0))
  );
  var _a;
  const decodeMap = /* @__PURE__ */ new Map([
    [0, 65533],
    // C1 Unicode control character reference replacements
    [128, 8364],
    [130, 8218],
    [131, 402],
    [132, 8222],
    [133, 8230],
    [134, 8224],
    [135, 8225],
    [136, 710],
    [137, 8240],
    [138, 352],
    [139, 8249],
    [140, 338],
    [142, 381],
    [145, 8216],
    [146, 8217],
    [147, 8220],
    [148, 8221],
    [149, 8226],
    [150, 8211],
    [151, 8212],
    [152, 732],
    [153, 8482],
    [154, 353],
    [155, 8250],
    [156, 339],
    [158, 382],
    [159, 376]
  ]);
  const fromCodePoint$1 = (
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, node/no-unsupported-features/es-builtins
    (_a = String.fromCodePoint) !== null && _a !== void 0 ? _a : function(codePoint) {
      let output = "";
      if (codePoint > 65535) {
        codePoint -= 65536;
        output += String.fromCharCode(codePoint >>> 10 & 1023 | 55296);
        codePoint = 56320 | codePoint & 1023;
      }
      output += String.fromCharCode(codePoint);
      return output;
    }
  );
  function replaceCodePoint(codePoint) {
    var _a2;
    if (codePoint >= 55296 && codePoint <= 57343 || codePoint > 1114111) {
      return 65533;
    }
    return (_a2 = decodeMap.get(codePoint)) !== null && _a2 !== void 0 ? _a2 : codePoint;
  }
  var CharCodes;
  (function(CharCodes2) {
    CharCodes2[CharCodes2["NUM"] = 35] = "NUM";
    CharCodes2[CharCodes2["SEMI"] = 59] = "SEMI";
    CharCodes2[CharCodes2["EQUALS"] = 61] = "EQUALS";
    CharCodes2[CharCodes2["ZERO"] = 48] = "ZERO";
    CharCodes2[CharCodes2["NINE"] = 57] = "NINE";
    CharCodes2[CharCodes2["LOWER_A"] = 97] = "LOWER_A";
    CharCodes2[CharCodes2["LOWER_F"] = 102] = "LOWER_F";
    CharCodes2[CharCodes2["LOWER_X"] = 120] = "LOWER_X";
    CharCodes2[CharCodes2["LOWER_Z"] = 122] = "LOWER_Z";
    CharCodes2[CharCodes2["UPPER_A"] = 65] = "UPPER_A";
    CharCodes2[CharCodes2["UPPER_F"] = 70] = "UPPER_F";
    CharCodes2[CharCodes2["UPPER_Z"] = 90] = "UPPER_Z";
  })(CharCodes || (CharCodes = {}));
  const TO_LOWER_BIT = 32;
  var BinTrieFlags;
  (function(BinTrieFlags2) {
    BinTrieFlags2[BinTrieFlags2["VALUE_LENGTH"] = 49152] = "VALUE_LENGTH";
    BinTrieFlags2[BinTrieFlags2["BRANCH_LENGTH"] = 16256] = "BRANCH_LENGTH";
    BinTrieFlags2[BinTrieFlags2["JUMP_TABLE"] = 127] = "JUMP_TABLE";
  })(BinTrieFlags || (BinTrieFlags = {}));
  function isNumber(code2) {
    return code2 >= CharCodes.ZERO && code2 <= CharCodes.NINE;
  }
  function isHexadecimalCharacter(code2) {
    return code2 >= CharCodes.UPPER_A && code2 <= CharCodes.UPPER_F || code2 >= CharCodes.LOWER_A && code2 <= CharCodes.LOWER_F;
  }
  function isAsciiAlphaNumeric(code2) {
    return code2 >= CharCodes.UPPER_A && code2 <= CharCodes.UPPER_Z || code2 >= CharCodes.LOWER_A && code2 <= CharCodes.LOWER_Z || isNumber(code2);
  }
  function isEntityInAttributeInvalidEnd(code2) {
    return code2 === CharCodes.EQUALS || isAsciiAlphaNumeric(code2);
  }
  var EntityDecoderState;
  (function(EntityDecoderState2) {
    EntityDecoderState2[EntityDecoderState2["EntityStart"] = 0] = "EntityStart";
    EntityDecoderState2[EntityDecoderState2["NumericStart"] = 1] = "NumericStart";
    EntityDecoderState2[EntityDecoderState2["NumericDecimal"] = 2] = "NumericDecimal";
    EntityDecoderState2[EntityDecoderState2["NumericHex"] = 3] = "NumericHex";
    EntityDecoderState2[EntityDecoderState2["NamedEntity"] = 4] = "NamedEntity";
  })(EntityDecoderState || (EntityDecoderState = {}));
  var DecodingMode;
  (function(DecodingMode2) {
    DecodingMode2[DecodingMode2["Legacy"] = 0] = "Legacy";
    DecodingMode2[DecodingMode2["Strict"] = 1] = "Strict";
    DecodingMode2[DecodingMode2["Attribute"] = 2] = "Attribute";
  })(DecodingMode || (DecodingMode = {}));
  class EntityDecoder {
    constructor(decodeTree, emitCodePoint, errors2) {
      this.decodeTree = decodeTree;
      this.emitCodePoint = emitCodePoint;
      this.errors = errors2;
      this.state = EntityDecoderState.EntityStart;
      this.consumed = 1;
      this.result = 0;
      this.treeIndex = 0;
      this.excess = 1;
      this.decodeMode = DecodingMode.Strict;
    }
    /** Resets the instance to make it reusable. */
    startEntity(decodeMode) {
      this.decodeMode = decodeMode;
      this.state = EntityDecoderState.EntityStart;
      this.result = 0;
      this.treeIndex = 0;
      this.excess = 1;
      this.consumed = 1;
    }
    /**
     * Write an entity to the decoder. This can be called multiple times with partial entities.
     * If the entity is incomplete, the decoder will return -1.
     *
     * Mirrors the implementation of `getDecoder`, but with the ability to stop decoding if the
     * entity is incomplete, and resume when the next string is written.
     *
     * @param string The string containing the entity (or a continuation of the entity).
     * @param offset The offset at which the entity begins. Should be 0 if this is not the first call.
     * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
     */
    write(str, offset) {
      switch (this.state) {
        case EntityDecoderState.EntityStart: {
          if (str.charCodeAt(offset) === CharCodes.NUM) {
            this.state = EntityDecoderState.NumericStart;
            this.consumed += 1;
            return this.stateNumericStart(str, offset + 1);
          }
          this.state = EntityDecoderState.NamedEntity;
          return this.stateNamedEntity(str, offset);
        }
        case EntityDecoderState.NumericStart: {
          return this.stateNumericStart(str, offset);
        }
        case EntityDecoderState.NumericDecimal: {
          return this.stateNumericDecimal(str, offset);
        }
        case EntityDecoderState.NumericHex: {
          return this.stateNumericHex(str, offset);
        }
        case EntityDecoderState.NamedEntity: {
          return this.stateNamedEntity(str, offset);
        }
      }
    }
    /**
     * Switches between the numeric decimal and hexadecimal states.
     *
     * Equivalent to the `Numeric character reference state` in the HTML spec.
     *
     * @param str The string containing the entity (or a continuation of the entity).
     * @param offset The current offset.
     * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
     */
    stateNumericStart(str, offset) {
      if (offset >= str.length) {
        return -1;
      }
      if ((str.charCodeAt(offset) | TO_LOWER_BIT) === CharCodes.LOWER_X) {
        this.state = EntityDecoderState.NumericHex;
        this.consumed += 1;
        return this.stateNumericHex(str, offset + 1);
      }
      this.state = EntityDecoderState.NumericDecimal;
      return this.stateNumericDecimal(str, offset);
    }
    addToNumericResult(str, start, end2, base2) {
      if (start !== end2) {
        const digitCount = end2 - start;
        this.result = this.result * Math.pow(base2, digitCount) + parseInt(str.substr(start, digitCount), base2);
        this.consumed += digitCount;
      }
    }
    /**
     * Parses a hexadecimal numeric entity.
     *
     * Equivalent to the `Hexademical character reference state` in the HTML spec.
     *
     * @param str The string containing the entity (or a continuation of the entity).
     * @param offset The current offset.
     * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
     */
    stateNumericHex(str, offset) {
      const startIdx = offset;
      while (offset < str.length) {
        const char = str.charCodeAt(offset);
        if (isNumber(char) || isHexadecimalCharacter(char)) {
          offset += 1;
        } else {
          this.addToNumericResult(str, startIdx, offset, 16);
          return this.emitNumericEntity(char, 3);
        }
      }
      this.addToNumericResult(str, startIdx, offset, 16);
      return -1;
    }
    /**
     * Parses a decimal numeric entity.
     *
     * Equivalent to the `Decimal character reference state` in the HTML spec.
     *
     * @param str The string containing the entity (or a continuation of the entity).
     * @param offset The current offset.
     * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
     */
    stateNumericDecimal(str, offset) {
      const startIdx = offset;
      while (offset < str.length) {
        const char = str.charCodeAt(offset);
        if (isNumber(char)) {
          offset += 1;
        } else {
          this.addToNumericResult(str, startIdx, offset, 10);
          return this.emitNumericEntity(char, 2);
        }
      }
      this.addToNumericResult(str, startIdx, offset, 10);
      return -1;
    }
    /**
     * Validate and emit a numeric entity.
     *
     * Implements the logic from the `Hexademical character reference start
     * state` and `Numeric character reference end state` in the HTML spec.
     *
     * @param lastCp The last code point of the entity. Used to see if the
     *               entity was terminated with a semicolon.
     * @param expectedLength The minimum number of characters that should be
     *                       consumed. Used to validate that at least one digit
     *                       was consumed.
     * @returns The number of characters that were consumed.
     */
    emitNumericEntity(lastCp, expectedLength) {
      var _a2;
      if (this.consumed <= expectedLength) {
        (_a2 = this.errors) === null || _a2 === void 0 ? void 0 : _a2.absenceOfDigitsInNumericCharacterReference(this.consumed);
        return 0;
      }
      if (lastCp === CharCodes.SEMI) {
        this.consumed += 1;
      } else if (this.decodeMode === DecodingMode.Strict) {
        return 0;
      }
      this.emitCodePoint(replaceCodePoint(this.result), this.consumed);
      if (this.errors) {
        if (lastCp !== CharCodes.SEMI) {
          this.errors.missingSemicolonAfterCharacterReference();
        }
        this.errors.validateNumericCharacterReference(this.result);
      }
      return this.consumed;
    }
    /**
     * Parses a named entity.
     *
     * Equivalent to the `Named character reference state` in the HTML spec.
     *
     * @param str The string containing the entity (or a continuation of the entity).
     * @param offset The current offset.
     * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
     */
    stateNamedEntity(str, offset) {
      const { decodeTree } = this;
      let current = decodeTree[this.treeIndex];
      let valueLength = (current & BinTrieFlags.VALUE_LENGTH) >> 14;
      for (; offset < str.length; offset++, this.excess++) {
        const char = str.charCodeAt(offset);
        this.treeIndex = determineBranch(decodeTree, current, this.treeIndex + Math.max(1, valueLength), char);
        if (this.treeIndex < 0) {
          return this.result === 0 || // If we are parsing an attribute
          this.decodeMode === DecodingMode.Attribute && // We shouldn't have consumed any characters after the entity,
          (valueLength === 0 || // And there should be no invalid characters.
          isEntityInAttributeInvalidEnd(char)) ? 0 : this.emitNotTerminatedNamedEntity();
        }
        current = decodeTree[this.treeIndex];
        valueLength = (current & BinTrieFlags.VALUE_LENGTH) >> 14;
        if (valueLength !== 0) {
          if (char === CharCodes.SEMI) {
            return this.emitNamedEntityData(this.treeIndex, valueLength, this.consumed + this.excess);
          }
          if (this.decodeMode !== DecodingMode.Strict) {
            this.result = this.treeIndex;
            this.consumed += this.excess;
            this.excess = 0;
          }
        }
      }
      return -1;
    }
    /**
     * Emit a named entity that was not terminated with a semicolon.
     *
     * @returns The number of characters consumed.
     */
    emitNotTerminatedNamedEntity() {
      var _a2;
      const { result, decodeTree } = this;
      const valueLength = (decodeTree[result] & BinTrieFlags.VALUE_LENGTH) >> 14;
      this.emitNamedEntityData(result, valueLength, this.consumed);
      (_a2 = this.errors) === null || _a2 === void 0 ? void 0 : _a2.missingSemicolonAfterCharacterReference();
      return this.consumed;
    }
    /**
     * Emit a named entity.
     *
     * @param result The index of the entity in the decode tree.
     * @param valueLength The number of bytes in the entity.
     * @param consumed The number of characters consumed.
     *
     * @returns The number of characters consumed.
     */
    emitNamedEntityData(result, valueLength, consumed) {
      const { decodeTree } = this;
      this.emitCodePoint(valueLength === 1 ? decodeTree[result] & ~BinTrieFlags.VALUE_LENGTH : decodeTree[result + 1], consumed);
      if (valueLength === 3) {
        this.emitCodePoint(decodeTree[result + 2], consumed);
      }
      return consumed;
    }
    /**
     * Signal to the parser that the end of the input was reached.
     *
     * Remaining data will be emitted and relevant errors will be produced.
     *
     * @returns The number of characters consumed.
     */
    end() {
      var _a2;
      switch (this.state) {
        case EntityDecoderState.NamedEntity: {
          return this.result !== 0 && (this.decodeMode !== DecodingMode.Attribute || this.result === this.treeIndex) ? this.emitNotTerminatedNamedEntity() : 0;
        }
        // Otherwise, emit a numeric entity if we have one.
        case EntityDecoderState.NumericDecimal: {
          return this.emitNumericEntity(0, 2);
        }
        case EntityDecoderState.NumericHex: {
          return this.emitNumericEntity(0, 3);
        }
        case EntityDecoderState.NumericStart: {
          (_a2 = this.errors) === null || _a2 === void 0 ? void 0 : _a2.absenceOfDigitsInNumericCharacterReference(this.consumed);
          return 0;
        }
        case EntityDecoderState.EntityStart: {
          return 0;
        }
      }
    }
  }
  function getDecoder(decodeTree) {
    let ret = "";
    const decoder = new EntityDecoder(decodeTree, (str) => ret += fromCodePoint$1(str));
    return function decodeWithTrie(str, decodeMode) {
      let lastIndex = 0;
      let offset = 0;
      while ((offset = str.indexOf("&", offset)) >= 0) {
        ret += str.slice(lastIndex, offset);
        decoder.startEntity(decodeMode);
        const len = decoder.write(
          str,
          // Skip the "&"
          offset + 1
        );
        if (len < 0) {
          lastIndex = offset + decoder.end();
          break;
        }
        lastIndex = offset + len;
        offset = len === 0 ? lastIndex + 1 : lastIndex;
      }
      const result = ret + str.slice(lastIndex);
      ret = "";
      return result;
    };
  }
  function determineBranch(decodeTree, current, nodeIdx, char) {
    const branchCount = (current & BinTrieFlags.BRANCH_LENGTH) >> 7;
    const jumpOffset = current & BinTrieFlags.JUMP_TABLE;
    if (branchCount === 0) {
      return jumpOffset !== 0 && char === jumpOffset ? nodeIdx : -1;
    }
    if (jumpOffset) {
      const value = char - jumpOffset;
      return value < 0 || value >= branchCount ? -1 : decodeTree[nodeIdx + value] - 1;
    }
    let lo = nodeIdx;
    let hi = lo + branchCount - 1;
    while (lo <= hi) {
      const mid = lo + hi >>> 1;
      const midVal = decodeTree[mid];
      if (midVal < char) {
        lo = mid + 1;
      } else if (midVal > char) {
        hi = mid - 1;
      } else {
        return decodeTree[mid + branchCount];
      }
    }
    return -1;
  }
  const htmlDecoder = getDecoder(htmlDecodeTree);
  getDecoder(xmlDecodeTree);
  function decodeHTML(str, mode = DecodingMode.Legacy) {
    return htmlDecoder(str, mode);
  }
  function _class$1(obj) {
    return Object.prototype.toString.call(obj);
  }
  function isString$1(obj) {
    return _class$1(obj) === "[object String]";
  }
  const _hasOwnProperty = Object.prototype.hasOwnProperty;
  function has(object, key) {
    return _hasOwnProperty.call(object, key);
  }
  function assign$1(obj) {
    const sources = Array.prototype.slice.call(arguments, 1);
    sources.forEach(function(source) {
      if (!source) {
        return;
      }
      if (typeof source !== "object") {
        throw new TypeError(source + "must be object");
      }
      Object.keys(source).forEach(function(key) {
        obj[key] = source[key];
      });
    });
    return obj;
  }
  function arrayReplaceAt(src, pos, newElements) {
    return [].concat(src.slice(0, pos), newElements, src.slice(pos + 1));
  }
  function isValidEntityCode(c) {
    if (c >= 55296 && c <= 57343) {
      return false;
    }
    if (c >= 64976 && c <= 65007) {
      return false;
    }
    if ((c & 65535) === 65535 || (c & 65535) === 65534) {
      return false;
    }
    if (c >= 0 && c <= 8) {
      return false;
    }
    if (c === 11) {
      return false;
    }
    if (c >= 14 && c <= 31) {
      return false;
    }
    if (c >= 127 && c <= 159) {
      return false;
    }
    if (c > 1114111) {
      return false;
    }
    return true;
  }
  function fromCodePoint(c) {
    if (c > 65535) {
      c -= 65536;
      const surrogate1 = 55296 + (c >> 10);
      const surrogate2 = 56320 + (c & 1023);
      return String.fromCharCode(surrogate1, surrogate2);
    }
    return String.fromCharCode(c);
  }
  const UNESCAPE_MD_RE = /\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g;
  const ENTITY_RE = /&([a-z#][a-z0-9]{1,31});/gi;
  const UNESCAPE_ALL_RE = new RegExp(UNESCAPE_MD_RE.source + "|" + ENTITY_RE.source, "gi");
  const DIGITAL_ENTITY_TEST_RE = /^#((?:x[a-f0-9]{1,8}|[0-9]{1,8}))$/i;
  function replaceEntityPattern(match, name2) {
    if (name2.charCodeAt(0) === 35 && DIGITAL_ENTITY_TEST_RE.test(name2)) {
      const code2 = name2[1].toLowerCase() === "x" ? parseInt(name2.slice(2), 16) : parseInt(name2.slice(1), 10);
      if (isValidEntityCode(code2)) {
        return fromCodePoint(code2);
      }
      return match;
    }
    const decoded = decodeHTML(match);
    if (decoded !== match) {
      return decoded;
    }
    return match;
  }
  function unescapeMd(str) {
    if (str.indexOf("\\") < 0) {
      return str;
    }
    return str.replace(UNESCAPE_MD_RE, "$1");
  }
  function unescapeAll(str) {
    if (str.indexOf("\\") < 0 && str.indexOf("&") < 0) {
      return str;
    }
    return str.replace(UNESCAPE_ALL_RE, function(match, escaped, entity2) {
      if (escaped) {
        return escaped;
      }
      return replaceEntityPattern(match, entity2);
    });
  }
  const HTML_ESCAPE_TEST_RE = /[&<>"]/;
  const HTML_ESCAPE_REPLACE_RE = /[&<>"]/g;
  const HTML_REPLACEMENTS = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
  };
  function replaceUnsafeChar(ch) {
    return HTML_REPLACEMENTS[ch];
  }
  function escapeHtml(str) {
    if (HTML_ESCAPE_TEST_RE.test(str)) {
      return str.replace(HTML_ESCAPE_REPLACE_RE, replaceUnsafeChar);
    }
    return str;
  }
  const REGEXP_ESCAPE_RE = /[.?*+^$[\]\\(){}|-]/g;
  function escapeRE$1(str) {
    return str.replace(REGEXP_ESCAPE_RE, "\\$&");
  }
  function isSpace(code2) {
    switch (code2) {
      case 9:
      case 32:
        return true;
    }
    return false;
  }
  function isWhiteSpace(code2) {
    if (code2 >= 8192 && code2 <= 8202) {
      return true;
    }
    switch (code2) {
      case 9:
      // \t
      case 10:
      // \n
      case 11:
      // \v
      case 12:
      // \f
      case 13:
      // \r
      case 32:
      case 160:
      case 5760:
      case 8239:
      case 8287:
      case 12288:
        return true;
    }
    return false;
  }
  function isPunctChar(ch) {
    return P.test(ch) || regex.test(ch);
  }
  function isMdAsciiPunct(ch) {
    switch (ch) {
      case 33:
      case 34:
      case 35:
      case 36:
      case 37:
      case 38:
      case 39:
      case 40:
      case 41:
      case 42:
      case 43:
      case 44:
      case 45:
      case 46:
      case 47:
      case 58:
      case 59:
      case 60:
      case 61:
      case 62:
      case 63:
      case 64:
      case 91:
      case 92:
      case 93:
      case 94:
      case 95:
      case 96:
      case 123:
      case 124:
      case 125:
      case 126:
        return true;
      default:
        return false;
    }
  }
  function normalizeReference(str) {
    str = str.trim().replace(/\s+/g, " ");
    if ("ẞ".toLowerCase() === "Ṿ") {
      str = str.replace(/ẞ/g, "ß");
    }
    return str.toLowerCase().toUpperCase();
  }
  const lib = { mdurl, ucmicro };
  const utils = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    arrayReplaceAt,
    assign: assign$1,
    escapeHtml,
    escapeRE: escapeRE$1,
    fromCodePoint,
    has,
    isMdAsciiPunct,
    isPunctChar,
    isSpace,
    isString: isString$1,
    isValidEntityCode,
    isWhiteSpace,
    lib,
    normalizeReference,
    unescapeAll,
    unescapeMd
  }, Symbol.toStringTag, { value: "Module" }));
  function parseLinkLabel(state, start, disableNested) {
    let level, found, marker, prevPos;
    const max = state.posMax;
    const oldPos = state.pos;
    state.pos = start + 1;
    level = 1;
    while (state.pos < max) {
      marker = state.src.charCodeAt(state.pos);
      if (marker === 93) {
        level--;
        if (level === 0) {
          found = true;
          break;
        }
      }
      prevPos = state.pos;
      state.md.inline.skipToken(state);
      if (marker === 91) {
        if (prevPos === state.pos - 1) {
          level++;
        } else if (disableNested) {
          state.pos = oldPos;
          return -1;
        }
      }
    }
    let labelEnd = -1;
    if (found) {
      labelEnd = state.pos;
    }
    state.pos = oldPos;
    return labelEnd;
  }
  function parseLinkDestination(str, start, max) {
    let code2;
    let pos = start;
    const result = {
      ok: false,
      pos: 0,
      str: ""
    };
    if (str.charCodeAt(pos) === 60) {
      pos++;
      while (pos < max) {
        code2 = str.charCodeAt(pos);
        if (code2 === 10) {
          return result;
        }
        if (code2 === 60) {
          return result;
        }
        if (code2 === 62) {
          result.pos = pos + 1;
          result.str = unescapeAll(str.slice(start + 1, pos));
          result.ok = true;
          return result;
        }
        if (code2 === 92 && pos + 1 < max) {
          pos += 2;
          continue;
        }
        pos++;
      }
      return result;
    }
    let level = 0;
    while (pos < max) {
      code2 = str.charCodeAt(pos);
      if (code2 === 32) {
        break;
      }
      if (code2 < 32 || code2 === 127) {
        break;
      }
      if (code2 === 92 && pos + 1 < max) {
        if (str.charCodeAt(pos + 1) === 32) {
          break;
        }
        pos += 2;
        continue;
      }
      if (code2 === 40) {
        level++;
        if (level > 32) {
          return result;
        }
      }
      if (code2 === 41) {
        if (level === 0) {
          break;
        }
        level--;
      }
      pos++;
    }
    if (start === pos) {
      return result;
    }
    if (level !== 0) {
      return result;
    }
    result.str = unescapeAll(str.slice(start, pos));
    result.pos = pos;
    result.ok = true;
    return result;
  }
  function parseLinkTitle(str, start, max, prev_state) {
    let code2;
    let pos = start;
    const state = {
      // if `true`, this is a valid link title
      ok: false,
      // if `true`, this link can be continued on the next line
      can_continue: false,
      // if `ok`, it's the position of the first character after the closing marker
      pos: 0,
      // if `ok`, it's the unescaped title
      str: "",
      // expected closing marker character code
      marker: 0
    };
    if (prev_state) {
      state.str = prev_state.str;
      state.marker = prev_state.marker;
    } else {
      if (pos >= max) {
        return state;
      }
      let marker = str.charCodeAt(pos);
      if (marker !== 34 && marker !== 39 && marker !== 40) {
        return state;
      }
      start++;
      pos++;
      if (marker === 40) {
        marker = 41;
      }
      state.marker = marker;
    }
    while (pos < max) {
      code2 = str.charCodeAt(pos);
      if (code2 === state.marker) {
        state.pos = pos + 1;
        state.str += unescapeAll(str.slice(start, pos));
        state.ok = true;
        return state;
      } else if (code2 === 40 && state.marker === 41) {
        return state;
      } else if (code2 === 92 && pos + 1 < max) {
        pos++;
      }
      pos++;
    }
    state.can_continue = true;
    state.str += unescapeAll(str.slice(start, pos));
    return state;
  }
  const helpers = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    parseLinkDestination,
    parseLinkLabel,
    parseLinkTitle
  }, Symbol.toStringTag, { value: "Module" }));
  const default_rules = {};
  default_rules.code_inline = function(tokens, idx, options, env, slf) {
    const token = tokens[idx];
    return "<code" + slf.renderAttrs(token) + ">" + escapeHtml(token.content) + "</code>";
  };
  default_rules.code_block = function(tokens, idx, options, env, slf) {
    const token = tokens[idx];
    return "<pre" + slf.renderAttrs(token) + "><code>" + escapeHtml(tokens[idx].content) + "</code></pre>\n";
  };
  default_rules.fence = function(tokens, idx, options, env, slf) {
    const token = tokens[idx];
    const info = token.info ? unescapeAll(token.info).trim() : "";
    let langName = "";
    let langAttrs = "";
    if (info) {
      const arr = info.split(/(\s+)/g);
      langName = arr[0];
      langAttrs = arr.slice(2).join("");
    }
    let highlighted;
    if (options.highlight) {
      highlighted = options.highlight(token.content, langName, langAttrs) || escapeHtml(token.content);
    } else {
      highlighted = escapeHtml(token.content);
    }
    if (highlighted.indexOf("<pre") === 0) {
      return highlighted + "\n";
    }
    if (info) {
      const i = token.attrIndex("class");
      const tmpAttrs = token.attrs ? token.attrs.slice() : [];
      if (i < 0) {
        tmpAttrs.push(["class", options.langPrefix + langName]);
      } else {
        tmpAttrs[i] = tmpAttrs[i].slice();
        tmpAttrs[i][1] += " " + options.langPrefix + langName;
      }
      const tmpToken = {
        attrs: tmpAttrs
      };
      return `<pre><code${slf.renderAttrs(tmpToken)}>${highlighted}</code></pre>
`;
    }
    return `<pre><code${slf.renderAttrs(token)}>${highlighted}</code></pre>
`;
  };
  default_rules.image = function(tokens, idx, options, env, slf) {
    const token = tokens[idx];
    token.attrs[token.attrIndex("alt")][1] = slf.renderInlineAsText(token.children, options, env);
    return slf.renderToken(tokens, idx, options);
  };
  default_rules.hardbreak = function(tokens, idx, options) {
    return options.xhtmlOut ? "<br />\n" : "<br>\n";
  };
  default_rules.softbreak = function(tokens, idx, options) {
    return options.breaks ? options.xhtmlOut ? "<br />\n" : "<br>\n" : "\n";
  };
  default_rules.text = function(tokens, idx) {
    return escapeHtml(tokens[idx].content);
  };
  default_rules.html_block = function(tokens, idx) {
    return tokens[idx].content;
  };
  default_rules.html_inline = function(tokens, idx) {
    return tokens[idx].content;
  };
  function Renderer() {
    this.rules = assign$1({}, default_rules);
  }
  Renderer.prototype.renderAttrs = function renderAttrs(token) {
    let i, l, result;
    if (!token.attrs) {
      return "";
    }
    result = "";
    for (i = 0, l = token.attrs.length; i < l; i++) {
      result += " " + escapeHtml(token.attrs[i][0]) + '="' + escapeHtml(token.attrs[i][1]) + '"';
    }
    return result;
  };
  Renderer.prototype.renderToken = function renderToken(tokens, idx, options) {
    const token = tokens[idx];
    let result = "";
    if (token.hidden) {
      return "";
    }
    if (token.block && token.nesting !== -1 && idx && tokens[idx - 1].hidden) {
      result += "\n";
    }
    result += (token.nesting === -1 ? "</" : "<") + token.tag;
    result += this.renderAttrs(token);
    if (token.nesting === 0 && options.xhtmlOut) {
      result += " /";
    }
    let needLf = false;
    if (token.block) {
      needLf = true;
      if (token.nesting === 1) {
        if (idx + 1 < tokens.length) {
          const nextToken = tokens[idx + 1];
          if (nextToken.type === "inline" || nextToken.hidden) {
            needLf = false;
          } else if (nextToken.nesting === -1 && nextToken.tag === token.tag) {
            needLf = false;
          }
        }
      }
    }
    result += needLf ? ">\n" : ">";
    return result;
  };
  Renderer.prototype.renderInline = function(tokens, options, env) {
    let result = "";
    const rules = this.rules;
    for (let i = 0, len = tokens.length; i < len; i++) {
      const type = tokens[i].type;
      if (typeof rules[type] !== "undefined") {
        result += rules[type](tokens, i, options, env, this);
      } else {
        result += this.renderToken(tokens, i, options);
      }
    }
    return result;
  };
  Renderer.prototype.renderInlineAsText = function(tokens, options, env) {
    let result = "";
    for (let i = 0, len = tokens.length; i < len; i++) {
      switch (tokens[i].type) {
        case "text":
          result += tokens[i].content;
          break;
        case "image":
          result += this.renderInlineAsText(tokens[i].children, options, env);
          break;
        case "html_inline":
        case "html_block":
          result += tokens[i].content;
          break;
        case "softbreak":
        case "hardbreak":
          result += "\n";
          break;
      }
    }
    return result;
  };
  Renderer.prototype.render = function(tokens, options, env) {
    let result = "";
    const rules = this.rules;
    for (let i = 0, len = tokens.length; i < len; i++) {
      const type = tokens[i].type;
      if (type === "inline") {
        result += this.renderInline(tokens[i].children, options, env);
      } else if (typeof rules[type] !== "undefined") {
        result += rules[type](tokens, i, options, env, this);
      } else {
        result += this.renderToken(tokens, i, options, env);
      }
    }
    return result;
  };
  function Ruler() {
    this.__rules__ = [];
    this.__cache__ = null;
  }
  Ruler.prototype.__find__ = function(name2) {
    for (let i = 0; i < this.__rules__.length; i++) {
      if (this.__rules__[i].name === name2) {
        return i;
      }
    }
    return -1;
  };
  Ruler.prototype.__compile__ = function() {
    const self = this;
    const chains = [""];
    self.__rules__.forEach(function(rule) {
      if (!rule.enabled) {
        return;
      }
      rule.alt.forEach(function(altName) {
        if (chains.indexOf(altName) < 0) {
          chains.push(altName);
        }
      });
    });
    self.__cache__ = {};
    chains.forEach(function(chain) {
      self.__cache__[chain] = [];
      self.__rules__.forEach(function(rule) {
        if (!rule.enabled) {
          return;
        }
        if (chain && rule.alt.indexOf(chain) < 0) {
          return;
        }
        self.__cache__[chain].push(rule.fn);
      });
    });
  };
  Ruler.prototype.at = function(name2, fn, options) {
    const index2 = this.__find__(name2);
    const opt = options || {};
    if (index2 === -1) {
      throw new Error("Parser rule not found: " + name2);
    }
    this.__rules__[index2].fn = fn;
    this.__rules__[index2].alt = opt.alt || [];
    this.__cache__ = null;
  };
  Ruler.prototype.before = function(beforeName, ruleName, fn, options) {
    const index2 = this.__find__(beforeName);
    const opt = options || {};
    if (index2 === -1) {
      throw new Error("Parser rule not found: " + beforeName);
    }
    this.__rules__.splice(index2, 0, {
      name: ruleName,
      enabled: true,
      fn,
      alt: opt.alt || []
    });
    this.__cache__ = null;
  };
  Ruler.prototype.after = function(afterName, ruleName, fn, options) {
    const index2 = this.__find__(afterName);
    const opt = options || {};
    if (index2 === -1) {
      throw new Error("Parser rule not found: " + afterName);
    }
    this.__rules__.splice(index2 + 1, 0, {
      name: ruleName,
      enabled: true,
      fn,
      alt: opt.alt || []
    });
    this.__cache__ = null;
  };
  Ruler.prototype.push = function(ruleName, fn, options) {
    const opt = options || {};
    this.__rules__.push({
      name: ruleName,
      enabled: true,
      fn,
      alt: opt.alt || []
    });
    this.__cache__ = null;
  };
  Ruler.prototype.enable = function(list2, ignoreInvalid) {
    if (!Array.isArray(list2)) {
      list2 = [list2];
    }
    const result = [];
    list2.forEach(function(name2) {
      const idx = this.__find__(name2);
      if (idx < 0) {
        if (ignoreInvalid) {
          return;
        }
        throw new Error("Rules manager: invalid rule name " + name2);
      }
      this.__rules__[idx].enabled = true;
      result.push(name2);
    }, this);
    this.__cache__ = null;
    return result;
  };
  Ruler.prototype.enableOnly = function(list2, ignoreInvalid) {
    if (!Array.isArray(list2)) {
      list2 = [list2];
    }
    this.__rules__.forEach(function(rule) {
      rule.enabled = false;
    });
    this.enable(list2, ignoreInvalid);
  };
  Ruler.prototype.disable = function(list2, ignoreInvalid) {
    if (!Array.isArray(list2)) {
      list2 = [list2];
    }
    const result = [];
    list2.forEach(function(name2) {
      const idx = this.__find__(name2);
      if (idx < 0) {
        if (ignoreInvalid) {
          return;
        }
        throw new Error("Rules manager: invalid rule name " + name2);
      }
      this.__rules__[idx].enabled = false;
      result.push(name2);
    }, this);
    this.__cache__ = null;
    return result;
  };
  Ruler.prototype.getRules = function(chainName) {
    if (this.__cache__ === null) {
      this.__compile__();
    }
    return this.__cache__[chainName] || [];
  };
  function Token(type, tag, nesting) {
    this.type = type;
    this.tag = tag;
    this.attrs = null;
    this.map = null;
    this.nesting = nesting;
    this.level = 0;
    this.children = null;
    this.content = "";
    this.markup = "";
    this.info = "";
    this.meta = null;
    this.block = false;
    this.hidden = false;
  }
  Token.prototype.attrIndex = function attrIndex(name2) {
    if (!this.attrs) {
      return -1;
    }
    const attrs = this.attrs;
    for (let i = 0, len = attrs.length; i < len; i++) {
      if (attrs[i][0] === name2) {
        return i;
      }
    }
    return -1;
  };
  Token.prototype.attrPush = function attrPush(attrData) {
    if (this.attrs) {
      this.attrs.push(attrData);
    } else {
      this.attrs = [attrData];
    }
  };
  Token.prototype.attrSet = function attrSet(name2, value) {
    const idx = this.attrIndex(name2);
    const attrData = [name2, value];
    if (idx < 0) {
      this.attrPush(attrData);
    } else {
      this.attrs[idx] = attrData;
    }
  };
  Token.prototype.attrGet = function attrGet(name2) {
    const idx = this.attrIndex(name2);
    let value = null;
    if (idx >= 0) {
      value = this.attrs[idx][1];
    }
    return value;
  };
  Token.prototype.attrJoin = function attrJoin(name2, value) {
    const idx = this.attrIndex(name2);
    if (idx < 0) {
      this.attrPush([name2, value]);
    } else {
      this.attrs[idx][1] = this.attrs[idx][1] + " " + value;
    }
  };
  function StateCore(src, md, env) {
    this.src = src;
    this.env = env;
    this.tokens = [];
    this.inlineMode = false;
    this.md = md;
  }
  StateCore.prototype.Token = Token;
  const NEWLINES_RE = /\r\n?|\n/g;
  const NULL_RE = /\0/g;
  function normalize(state) {
    let str;
    str = state.src.replace(NEWLINES_RE, "\n");
    str = str.replace(NULL_RE, "�");
    state.src = str;
  }
  function block(state) {
    let token;
    if (state.inlineMode) {
      token = new state.Token("inline", "", 0);
      token.content = state.src;
      token.map = [0, 1];
      token.children = [];
      state.tokens.push(token);
    } else {
      state.md.block.parse(state.src, state.md, state.env, state.tokens);
    }
  }
  function inline(state) {
    const tokens = state.tokens;
    for (let i = 0, l = tokens.length; i < l; i++) {
      const tok = tokens[i];
      if (tok.type === "inline") {
        state.md.inline.parse(tok.content, state.md, state.env, tok.children);
      }
    }
  }
  function isLinkOpen$1(str) {
    return /^<a[>\s]/i.test(str);
  }
  function isLinkClose$1(str) {
    return /^<\/a\s*>/i.test(str);
  }
  function linkify$1(state) {
    const blockTokens = state.tokens;
    if (!state.md.options.linkify) {
      return;
    }
    for (let j = 0, l = blockTokens.length; j < l; j++) {
      if (blockTokens[j].type !== "inline" || !state.md.linkify.pretest(blockTokens[j].content)) {
        continue;
      }
      let tokens = blockTokens[j].children;
      let htmlLinkLevel = 0;
      for (let i = tokens.length - 1; i >= 0; i--) {
        const currentToken = tokens[i];
        if (currentToken.type === "link_close") {
          i--;
          while (tokens[i].level !== currentToken.level && tokens[i].type !== "link_open") {
            i--;
          }
          continue;
        }
        if (currentToken.type === "html_inline") {
          if (isLinkOpen$1(currentToken.content) && htmlLinkLevel > 0) {
            htmlLinkLevel--;
          }
          if (isLinkClose$1(currentToken.content)) {
            htmlLinkLevel++;
          }
        }
        if (htmlLinkLevel > 0) {
          continue;
        }
        if (currentToken.type === "text" && state.md.linkify.test(currentToken.content)) {
          const text2 = currentToken.content;
          let links = state.md.linkify.match(text2);
          const nodes = [];
          let level = currentToken.level;
          let lastPos = 0;
          if (links.length > 0 && links[0].index === 0 && i > 0 && tokens[i - 1].type === "text_special") {
            links = links.slice(1);
          }
          for (let ln = 0; ln < links.length; ln++) {
            const url = links[ln].url;
            const fullUrl = state.md.normalizeLink(url);
            if (!state.md.validateLink(fullUrl)) {
              continue;
            }
            let urlText = links[ln].text;
            if (!links[ln].schema) {
              urlText = state.md.normalizeLinkText("http://" + urlText).replace(/^http:\/\//, "");
            } else if (links[ln].schema === "mailto:" && !/^mailto:/i.test(urlText)) {
              urlText = state.md.normalizeLinkText("mailto:" + urlText).replace(/^mailto:/, "");
            } else {
              urlText = state.md.normalizeLinkText(urlText);
            }
            const pos = links[ln].index;
            if (pos > lastPos) {
              const token = new state.Token("text", "", 0);
              token.content = text2.slice(lastPos, pos);
              token.level = level;
              nodes.push(token);
            }
            const token_o = new state.Token("link_open", "a", 1);
            token_o.attrs = [["href", fullUrl]];
            token_o.level = level++;
            token_o.markup = "linkify";
            token_o.info = "auto";
            nodes.push(token_o);
            const token_t = new state.Token("text", "", 0);
            token_t.content = urlText;
            token_t.level = level;
            nodes.push(token_t);
            const token_c = new state.Token("link_close", "a", -1);
            token_c.level = --level;
            token_c.markup = "linkify";
            token_c.info = "auto";
            nodes.push(token_c);
            lastPos = links[ln].lastIndex;
          }
          if (lastPos < text2.length) {
            const token = new state.Token("text", "", 0);
            token.content = text2.slice(lastPos);
            token.level = level;
            nodes.push(token);
          }
          blockTokens[j].children = tokens = arrayReplaceAt(tokens, i, nodes);
        }
      }
    }
  }
  const RARE_RE = /\+-|\.\.|\?\?\?\?|!!!!|,,|--/;
  const SCOPED_ABBR_TEST_RE = /\((c|tm|r)\)/i;
  const SCOPED_ABBR_RE = /\((c|tm|r)\)/ig;
  const SCOPED_ABBR = {
    c: "©",
    r: "®",
    tm: "™"
  };
  function replaceFn(match, name2) {
    return SCOPED_ABBR[name2.toLowerCase()];
  }
  function replace_scoped(inlineTokens) {
    let inside_autolink = 0;
    for (let i = inlineTokens.length - 1; i >= 0; i--) {
      const token = inlineTokens[i];
      if (token.type === "text" && !inside_autolink) {
        token.content = token.content.replace(SCOPED_ABBR_RE, replaceFn);
      }
      if (token.type === "link_open" && token.info === "auto") {
        inside_autolink--;
      }
      if (token.type === "link_close" && token.info === "auto") {
        inside_autolink++;
      }
    }
  }
  function replace_rare(inlineTokens) {
    let inside_autolink = 0;
    for (let i = inlineTokens.length - 1; i >= 0; i--) {
      const token = inlineTokens[i];
      if (token.type === "text" && !inside_autolink) {
        if (RARE_RE.test(token.content)) {
          token.content = token.content.replace(/\+-/g, "±").replace(/\.{2,}/g, "…").replace(/([?!])…/g, "$1..").replace(/([?!]){4,}/g, "$1$1$1").replace(/,{2,}/g, ",").replace(/(^|[^-])---(?=[^-]|$)/mg, "$1—").replace(/(^|\s)--(?=\s|$)/mg, "$1–").replace(/(^|[^-\s])--(?=[^-\s]|$)/mg, "$1–");
        }
      }
      if (token.type === "link_open" && token.info === "auto") {
        inside_autolink--;
      }
      if (token.type === "link_close" && token.info === "auto") {
        inside_autolink++;
      }
    }
  }
  function replace(state) {
    let blkIdx;
    if (!state.md.options.typographer) {
      return;
    }
    for (blkIdx = state.tokens.length - 1; blkIdx >= 0; blkIdx--) {
      if (state.tokens[blkIdx].type !== "inline") {
        continue;
      }
      if (SCOPED_ABBR_TEST_RE.test(state.tokens[blkIdx].content)) {
        replace_scoped(state.tokens[blkIdx].children);
      }
      if (RARE_RE.test(state.tokens[blkIdx].content)) {
        replace_rare(state.tokens[blkIdx].children);
      }
    }
  }
  const QUOTE_TEST_RE = /['"]/;
  const QUOTE_RE = /['"]/g;
  const APOSTROPHE = "’";
  function replaceAt(str, index2, ch) {
    return str.slice(0, index2) + ch + str.slice(index2 + 1);
  }
  function process_inlines(tokens, state) {
    let j;
    const stack = [];
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const thisLevel = tokens[i].level;
      for (j = stack.length - 1; j >= 0; j--) {
        if (stack[j].level <= thisLevel) {
          break;
        }
      }
      stack.length = j + 1;
      if (token.type !== "text") {
        continue;
      }
      let text2 = token.content;
      let pos = 0;
      let max = text2.length;
      OUTER:
        while (pos < max) {
          QUOTE_RE.lastIndex = pos;
          const t = QUOTE_RE.exec(text2);
          if (!t) {
            break;
          }
          let canOpen = true;
          let canClose = true;
          pos = t.index + 1;
          const isSingle = t[0] === "'";
          let lastChar = 32;
          if (t.index - 1 >= 0) {
            lastChar = text2.charCodeAt(t.index - 1);
          } else {
            for (j = i - 1; j >= 0; j--) {
              if (tokens[j].type === "softbreak" || tokens[j].type === "hardbreak") break;
              if (!tokens[j].content) continue;
              lastChar = tokens[j].content.charCodeAt(tokens[j].content.length - 1);
              break;
            }
          }
          let nextChar = 32;
          if (pos < max) {
            nextChar = text2.charCodeAt(pos);
          } else {
            for (j = i + 1; j < tokens.length; j++) {
              if (tokens[j].type === "softbreak" || tokens[j].type === "hardbreak") break;
              if (!tokens[j].content) continue;
              nextChar = tokens[j].content.charCodeAt(0);
              break;
            }
          }
          const isLastPunctChar = isMdAsciiPunct(lastChar) || isPunctChar(String.fromCharCode(lastChar));
          const isNextPunctChar = isMdAsciiPunct(nextChar) || isPunctChar(String.fromCharCode(nextChar));
          const isLastWhiteSpace = isWhiteSpace(lastChar);
          const isNextWhiteSpace = isWhiteSpace(nextChar);
          if (isNextWhiteSpace) {
            canOpen = false;
          } else if (isNextPunctChar) {
            if (!(isLastWhiteSpace || isLastPunctChar)) {
              canOpen = false;
            }
          }
          if (isLastWhiteSpace) {
            canClose = false;
          } else if (isLastPunctChar) {
            if (!(isNextWhiteSpace || isNextPunctChar)) {
              canClose = false;
            }
          }
          if (nextChar === 34 && t[0] === '"') {
            if (lastChar >= 48 && lastChar <= 57) {
              canClose = canOpen = false;
            }
          }
          if (canOpen && canClose) {
            canOpen = isLastPunctChar;
            canClose = isNextPunctChar;
          }
          if (!canOpen && !canClose) {
            if (isSingle) {
              token.content = replaceAt(token.content, t.index, APOSTROPHE);
            }
            continue;
          }
          if (canClose) {
            for (j = stack.length - 1; j >= 0; j--) {
              let item = stack[j];
              if (stack[j].level < thisLevel) {
                break;
              }
              if (item.single === isSingle && stack[j].level === thisLevel) {
                item = stack[j];
                let openQuote;
                let closeQuote;
                if (isSingle) {
                  openQuote = state.md.options.quotes[2];
                  closeQuote = state.md.options.quotes[3];
                } else {
                  openQuote = state.md.options.quotes[0];
                  closeQuote = state.md.options.quotes[1];
                }
                token.content = replaceAt(token.content, t.index, closeQuote);
                tokens[item.token].content = replaceAt(
                  tokens[item.token].content,
                  item.pos,
                  openQuote
                );
                pos += closeQuote.length - 1;
                if (item.token === i) {
                  pos += openQuote.length - 1;
                }
                text2 = token.content;
                max = text2.length;
                stack.length = j;
                continue OUTER;
              }
            }
          }
          if (canOpen) {
            stack.push({
              token: i,
              pos: t.index,
              single: isSingle,
              level: thisLevel
            });
          } else if (canClose && isSingle) {
            token.content = replaceAt(token.content, t.index, APOSTROPHE);
          }
        }
    }
  }
  function smartquotes(state) {
    if (!state.md.options.typographer) {
      return;
    }
    for (let blkIdx = state.tokens.length - 1; blkIdx >= 0; blkIdx--) {
      if (state.tokens[blkIdx].type !== "inline" || !QUOTE_TEST_RE.test(state.tokens[blkIdx].content)) {
        continue;
      }
      process_inlines(state.tokens[blkIdx].children, state);
    }
  }
  function text_join(state) {
    let curr, last2;
    const blockTokens = state.tokens;
    const l = blockTokens.length;
    for (let j = 0; j < l; j++) {
      if (blockTokens[j].type !== "inline") continue;
      const tokens = blockTokens[j].children;
      const max = tokens.length;
      for (curr = 0; curr < max; curr++) {
        if (tokens[curr].type === "text_special") {
          tokens[curr].type = "text";
        }
      }
      for (curr = last2 = 0; curr < max; curr++) {
        if (tokens[curr].type === "text" && curr + 1 < max && tokens[curr + 1].type === "text") {
          tokens[curr + 1].content = tokens[curr].content + tokens[curr + 1].content;
        } else {
          if (curr !== last2) {
            tokens[last2] = tokens[curr];
          }
          last2++;
        }
      }
      if (curr !== last2) {
        tokens.length = last2;
      }
    }
  }
  const _rules$2 = [
    ["normalize", normalize],
    ["block", block],
    ["inline", inline],
    ["linkify", linkify$1],
    ["replacements", replace],
    ["smartquotes", smartquotes],
    // `text_join` finds `text_special` tokens (for escape sequences)
    // and joins them with the rest of the text
    ["text_join", text_join]
  ];
  function Core() {
    this.ruler = new Ruler();
    for (let i = 0; i < _rules$2.length; i++) {
      this.ruler.push(_rules$2[i][0], _rules$2[i][1]);
    }
  }
  Core.prototype.process = function(state) {
    const rules = this.ruler.getRules("");
    for (let i = 0, l = rules.length; i < l; i++) {
      rules[i](state);
    }
  };
  Core.prototype.State = StateCore;
  function StateBlock(src, md, env, tokens) {
    this.src = src;
    this.md = md;
    this.env = env;
    this.tokens = tokens;
    this.bMarks = [];
    this.eMarks = [];
    this.tShift = [];
    this.sCount = [];
    this.bsCount = [];
    this.blkIndent = 0;
    this.line = 0;
    this.lineMax = 0;
    this.tight = false;
    this.ddIndent = -1;
    this.listIndent = -1;
    this.parentType = "root";
    this.level = 0;
    const s = this.src;
    for (let start = 0, pos = 0, indent = 0, offset = 0, len = s.length, indent_found = false; pos < len; pos++) {
      const ch = s.charCodeAt(pos);
      if (!indent_found) {
        if (isSpace(ch)) {
          indent++;
          if (ch === 9) {
            offset += 4 - offset % 4;
          } else {
            offset++;
          }
          continue;
        } else {
          indent_found = true;
        }
      }
      if (ch === 10 || pos === len - 1) {
        if (ch !== 10) {
          pos++;
        }
        this.bMarks.push(start);
        this.eMarks.push(pos);
        this.tShift.push(indent);
        this.sCount.push(offset);
        this.bsCount.push(0);
        indent_found = false;
        indent = 0;
        offset = 0;
        start = pos + 1;
      }
    }
    this.bMarks.push(s.length);
    this.eMarks.push(s.length);
    this.tShift.push(0);
    this.sCount.push(0);
    this.bsCount.push(0);
    this.lineMax = this.bMarks.length - 1;
  }
  StateBlock.prototype.push = function(type, tag, nesting) {
    const token = new Token(type, tag, nesting);
    token.block = true;
    if (nesting < 0) this.level--;
    token.level = this.level;
    if (nesting > 0) this.level++;
    this.tokens.push(token);
    return token;
  };
  StateBlock.prototype.isEmpty = function isEmpty2(line) {
    return this.bMarks[line] + this.tShift[line] >= this.eMarks[line];
  };
  StateBlock.prototype.skipEmptyLines = function skipEmptyLines(from) {
    for (let max = this.lineMax; from < max; from++) {
      if (this.bMarks[from] + this.tShift[from] < this.eMarks[from]) {
        break;
      }
    }
    return from;
  };
  StateBlock.prototype.skipSpaces = function skipSpaces(pos) {
    for (let max = this.src.length; pos < max; pos++) {
      const ch = this.src.charCodeAt(pos);
      if (!isSpace(ch)) {
        break;
      }
    }
    return pos;
  };
  StateBlock.prototype.skipSpacesBack = function skipSpacesBack(pos, min) {
    if (pos <= min) {
      return pos;
    }
    while (pos > min) {
      if (!isSpace(this.src.charCodeAt(--pos))) {
        return pos + 1;
      }
    }
    return pos;
  };
  StateBlock.prototype.skipChars = function skipChars(pos, code2) {
    for (let max = this.src.length; pos < max; pos++) {
      if (this.src.charCodeAt(pos) !== code2) {
        break;
      }
    }
    return pos;
  };
  StateBlock.prototype.skipCharsBack = function skipCharsBack(pos, code2, min) {
    if (pos <= min) {
      return pos;
    }
    while (pos > min) {
      if (code2 !== this.src.charCodeAt(--pos)) {
        return pos + 1;
      }
    }
    return pos;
  };
  StateBlock.prototype.getLines = function getLines(begin, end2, indent, keepLastLF) {
    if (begin >= end2) {
      return "";
    }
    const queue = new Array(end2 - begin);
    for (let i = 0, line = begin; line < end2; line++, i++) {
      let lineIndent = 0;
      const lineStart = this.bMarks[line];
      let first2 = lineStart;
      let last2;
      if (line + 1 < end2 || keepLastLF) {
        last2 = this.eMarks[line] + 1;
      } else {
        last2 = this.eMarks[line];
      }
      while (first2 < last2 && lineIndent < indent) {
        const ch = this.src.charCodeAt(first2);
        if (isSpace(ch)) {
          if (ch === 9) {
            lineIndent += 4 - (lineIndent + this.bsCount[line]) % 4;
          } else {
            lineIndent++;
          }
        } else if (first2 - lineStart < this.tShift[line]) {
          lineIndent++;
        } else {
          break;
        }
        first2++;
      }
      if (lineIndent > indent) {
        queue[i] = new Array(lineIndent - indent + 1).join(" ") + this.src.slice(first2, last2);
      } else {
        queue[i] = this.src.slice(first2, last2);
      }
    }
    return queue.join("");
  };
  StateBlock.prototype.Token = Token;
  const MAX_AUTOCOMPLETED_CELLS = 65536;
  function getLine(state, line) {
    const pos = state.bMarks[line] + state.tShift[line];
    const max = state.eMarks[line];
    return state.src.slice(pos, max);
  }
  function escapedSplit(str) {
    const result = [];
    const max = str.length;
    let pos = 0;
    let ch = str.charCodeAt(pos);
    let isEscaped = false;
    let lastPos = 0;
    let current = "";
    while (pos < max) {
      if (ch === 124) {
        if (!isEscaped) {
          result.push(current + str.substring(lastPos, pos));
          current = "";
          lastPos = pos + 1;
        } else {
          current += str.substring(lastPos, pos - 1);
          lastPos = pos;
        }
      }
      isEscaped = ch === 92;
      pos++;
      ch = str.charCodeAt(pos);
    }
    result.push(current + str.substring(lastPos));
    return result;
  }
  function table(state, startLine, endLine, silent) {
    if (startLine + 2 > endLine) {
      return false;
    }
    let nextLine = startLine + 1;
    if (state.sCount[nextLine] < state.blkIndent) {
      return false;
    }
    if (state.sCount[nextLine] - state.blkIndent >= 4) {
      return false;
    }
    let pos = state.bMarks[nextLine] + state.tShift[nextLine];
    if (pos >= state.eMarks[nextLine]) {
      return false;
    }
    const firstCh = state.src.charCodeAt(pos++);
    if (firstCh !== 124 && firstCh !== 45 && firstCh !== 58) {
      return false;
    }
    if (pos >= state.eMarks[nextLine]) {
      return false;
    }
    const secondCh = state.src.charCodeAt(pos++);
    if (secondCh !== 124 && secondCh !== 45 && secondCh !== 58 && !isSpace(secondCh)) {
      return false;
    }
    if (firstCh === 45 && isSpace(secondCh)) {
      return false;
    }
    while (pos < state.eMarks[nextLine]) {
      const ch = state.src.charCodeAt(pos);
      if (ch !== 124 && ch !== 45 && ch !== 58 && !isSpace(ch)) {
        return false;
      }
      pos++;
    }
    let lineText = getLine(state, startLine + 1);
    let columns = lineText.split("|");
    const aligns = [];
    for (let i = 0; i < columns.length; i++) {
      const t = columns[i].trim();
      if (!t) {
        if (i === 0 || i === columns.length - 1) {
          continue;
        } else {
          return false;
        }
      }
      if (!/^:?-+:?$/.test(t)) {
        return false;
      }
      if (t.charCodeAt(t.length - 1) === 58) {
        aligns.push(t.charCodeAt(0) === 58 ? "center" : "right");
      } else if (t.charCodeAt(0) === 58) {
        aligns.push("left");
      } else {
        aligns.push("");
      }
    }
    lineText = getLine(state, startLine).trim();
    if (lineText.indexOf("|") === -1) {
      return false;
    }
    if (state.sCount[startLine] - state.blkIndent >= 4) {
      return false;
    }
    columns = escapedSplit(lineText);
    if (columns.length && columns[0] === "") columns.shift();
    if (columns.length && columns[columns.length - 1] === "") columns.pop();
    const columnCount = columns.length;
    if (columnCount === 0 || columnCount !== aligns.length) {
      return false;
    }
    if (silent) {
      return true;
    }
    const oldParentType = state.parentType;
    state.parentType = "table";
    const terminatorRules = state.md.block.ruler.getRules("blockquote");
    const token_to = state.push("table_open", "table", 1);
    const tableLines = [startLine, 0];
    token_to.map = tableLines;
    const token_tho = state.push("thead_open", "thead", 1);
    token_tho.map = [startLine, startLine + 1];
    const token_htro = state.push("tr_open", "tr", 1);
    token_htro.map = [startLine, startLine + 1];
    for (let i = 0; i < columns.length; i++) {
      const token_ho = state.push("th_open", "th", 1);
      if (aligns[i]) {
        token_ho.attrs = [["style", "text-align:" + aligns[i]]];
      }
      const token_il = state.push("inline", "", 0);
      token_il.content = columns[i].trim();
      token_il.children = [];
      state.push("th_close", "th", -1);
    }
    state.push("tr_close", "tr", -1);
    state.push("thead_close", "thead", -1);
    let tbodyLines;
    let autocompletedCells = 0;
    for (nextLine = startLine + 2; nextLine < endLine; nextLine++) {
      if (state.sCount[nextLine] < state.blkIndent) {
        break;
      }
      let terminate = false;
      for (let i = 0, l = terminatorRules.length; i < l; i++) {
        if (terminatorRules[i](state, nextLine, endLine, true)) {
          terminate = true;
          break;
        }
      }
      if (terminate) {
        break;
      }
      lineText = getLine(state, nextLine).trim();
      if (!lineText) {
        break;
      }
      if (state.sCount[nextLine] - state.blkIndent >= 4) {
        break;
      }
      columns = escapedSplit(lineText);
      if (columns.length && columns[0] === "") columns.shift();
      if (columns.length && columns[columns.length - 1] === "") columns.pop();
      autocompletedCells += columnCount - columns.length;
      if (autocompletedCells > MAX_AUTOCOMPLETED_CELLS) {
        break;
      }
      if (nextLine === startLine + 2) {
        const token_tbo = state.push("tbody_open", "tbody", 1);
        token_tbo.map = tbodyLines = [startLine + 2, 0];
      }
      const token_tro = state.push("tr_open", "tr", 1);
      token_tro.map = [nextLine, nextLine + 1];
      for (let i = 0; i < columnCount; i++) {
        const token_tdo = state.push("td_open", "td", 1);
        if (aligns[i]) {
          token_tdo.attrs = [["style", "text-align:" + aligns[i]]];
        }
        const token_il = state.push("inline", "", 0);
        token_il.content = columns[i] ? columns[i].trim() : "";
        token_il.children = [];
        state.push("td_close", "td", -1);
      }
      state.push("tr_close", "tr", -1);
    }
    if (tbodyLines) {
      state.push("tbody_close", "tbody", -1);
      tbodyLines[1] = nextLine;
    }
    state.push("table_close", "table", -1);
    tableLines[1] = nextLine;
    state.parentType = oldParentType;
    state.line = nextLine;
    return true;
  }
  function code(state, startLine, endLine) {
    if (state.sCount[startLine] - state.blkIndent < 4) {
      return false;
    }
    let nextLine = startLine + 1;
    let last2 = nextLine;
    while (nextLine < endLine) {
      if (state.isEmpty(nextLine)) {
        nextLine++;
        continue;
      }
      if (state.sCount[nextLine] - state.blkIndent >= 4) {
        nextLine++;
        last2 = nextLine;
        continue;
      }
      break;
    }
    state.line = last2;
    const token = state.push("code_block", "code", 0);
    token.content = state.getLines(startLine, last2, 4 + state.blkIndent, false) + "\n";
    token.map = [startLine, state.line];
    return true;
  }
  function fence(state, startLine, endLine, silent) {
    let pos = state.bMarks[startLine] + state.tShift[startLine];
    let max = state.eMarks[startLine];
    if (state.sCount[startLine] - state.blkIndent >= 4) {
      return false;
    }
    if (pos + 3 > max) {
      return false;
    }
    const marker = state.src.charCodeAt(pos);
    if (marker !== 126 && marker !== 96) {
      return false;
    }
    let mem = pos;
    pos = state.skipChars(pos, marker);
    let len = pos - mem;
    if (len < 3) {
      return false;
    }
    const markup = state.src.slice(mem, pos);
    const params = state.src.slice(pos, max);
    if (marker === 96) {
      if (params.indexOf(String.fromCharCode(marker)) >= 0) {
        return false;
      }
    }
    if (silent) {
      return true;
    }
    let nextLine = startLine;
    let haveEndMarker = false;
    for (; ; ) {
      nextLine++;
      if (nextLine >= endLine) {
        break;
      }
      pos = mem = state.bMarks[nextLine] + state.tShift[nextLine];
      max = state.eMarks[nextLine];
      if (pos < max && state.sCount[nextLine] < state.blkIndent) {
        break;
      }
      if (state.src.charCodeAt(pos) !== marker) {
        continue;
      }
      if (state.sCount[nextLine] - state.blkIndent >= 4) {
        continue;
      }
      pos = state.skipChars(pos, marker);
      if (pos - mem < len) {
        continue;
      }
      pos = state.skipSpaces(pos);
      if (pos < max) {
        continue;
      }
      haveEndMarker = true;
      break;
    }
    len = state.sCount[startLine];
    state.line = nextLine + (haveEndMarker ? 1 : 0);
    const token = state.push("fence", "code", 0);
    token.info = params;
    token.content = state.getLines(startLine + 1, nextLine, len, true);
    token.markup = markup;
    token.map = [startLine, state.line];
    return true;
  }
  function blockquote(state, startLine, endLine, silent) {
    let pos = state.bMarks[startLine] + state.tShift[startLine];
    let max = state.eMarks[startLine];
    const oldLineMax = state.lineMax;
    if (state.sCount[startLine] - state.blkIndent >= 4) {
      return false;
    }
    if (state.src.charCodeAt(pos) !== 62) {
      return false;
    }
    if (silent) {
      return true;
    }
    const oldBMarks = [];
    const oldBSCount = [];
    const oldSCount = [];
    const oldTShift = [];
    const terminatorRules = state.md.block.ruler.getRules("blockquote");
    const oldParentType = state.parentType;
    state.parentType = "blockquote";
    let lastLineEmpty = false;
    let nextLine;
    for (nextLine = startLine; nextLine < endLine; nextLine++) {
      const isOutdented = state.sCount[nextLine] < state.blkIndent;
      pos = state.bMarks[nextLine] + state.tShift[nextLine];
      max = state.eMarks[nextLine];
      if (pos >= max) {
        break;
      }
      if (state.src.charCodeAt(pos++) === 62 && !isOutdented) {
        let initial = state.sCount[nextLine] + 1;
        let spaceAfterMarker;
        let adjustTab;
        if (state.src.charCodeAt(pos) === 32) {
          pos++;
          initial++;
          adjustTab = false;
          spaceAfterMarker = true;
        } else if (state.src.charCodeAt(pos) === 9) {
          spaceAfterMarker = true;
          if ((state.bsCount[nextLine] + initial) % 4 === 3) {
            pos++;
            initial++;
            adjustTab = false;
          } else {
            adjustTab = true;
          }
        } else {
          spaceAfterMarker = false;
        }
        let offset = initial;
        oldBMarks.push(state.bMarks[nextLine]);
        state.bMarks[nextLine] = pos;
        while (pos < max) {
          const ch = state.src.charCodeAt(pos);
          if (isSpace(ch)) {
            if (ch === 9) {
              offset += 4 - (offset + state.bsCount[nextLine] + (adjustTab ? 1 : 0)) % 4;
            } else {
              offset++;
            }
          } else {
            break;
          }
          pos++;
        }
        lastLineEmpty = pos >= max;
        oldBSCount.push(state.bsCount[nextLine]);
        state.bsCount[nextLine] = state.sCount[nextLine] + 1 + (spaceAfterMarker ? 1 : 0);
        oldSCount.push(state.sCount[nextLine]);
        state.sCount[nextLine] = offset - initial;
        oldTShift.push(state.tShift[nextLine]);
        state.tShift[nextLine] = pos - state.bMarks[nextLine];
        continue;
      }
      if (lastLineEmpty) {
        break;
      }
      let terminate = false;
      for (let i = 0, l = terminatorRules.length; i < l; i++) {
        if (terminatorRules[i](state, nextLine, endLine, true)) {
          terminate = true;
          break;
        }
      }
      if (terminate) {
        state.lineMax = nextLine;
        if (state.blkIndent !== 0) {
          oldBMarks.push(state.bMarks[nextLine]);
          oldBSCount.push(state.bsCount[nextLine]);
          oldTShift.push(state.tShift[nextLine]);
          oldSCount.push(state.sCount[nextLine]);
          state.sCount[nextLine] -= state.blkIndent;
        }
        break;
      }
      oldBMarks.push(state.bMarks[nextLine]);
      oldBSCount.push(state.bsCount[nextLine]);
      oldTShift.push(state.tShift[nextLine]);
      oldSCount.push(state.sCount[nextLine]);
      state.sCount[nextLine] = -1;
    }
    const oldIndent = state.blkIndent;
    state.blkIndent = 0;
    const token_o = state.push("blockquote_open", "blockquote", 1);
    token_o.markup = ">";
    const lines = [startLine, 0];
    token_o.map = lines;
    state.md.block.tokenize(state, startLine, nextLine);
    const token_c = state.push("blockquote_close", "blockquote", -1);
    token_c.markup = ">";
    state.lineMax = oldLineMax;
    state.parentType = oldParentType;
    lines[1] = state.line;
    for (let i = 0; i < oldTShift.length; i++) {
      state.bMarks[i + startLine] = oldBMarks[i];
      state.tShift[i + startLine] = oldTShift[i];
      state.sCount[i + startLine] = oldSCount[i];
      state.bsCount[i + startLine] = oldBSCount[i];
    }
    state.blkIndent = oldIndent;
    return true;
  }
  function hr(state, startLine, endLine, silent) {
    const max = state.eMarks[startLine];
    if (state.sCount[startLine] - state.blkIndent >= 4) {
      return false;
    }
    let pos = state.bMarks[startLine] + state.tShift[startLine];
    const marker = state.src.charCodeAt(pos++);
    if (marker !== 42 && marker !== 45 && marker !== 95) {
      return false;
    }
    let cnt = 1;
    while (pos < max) {
      const ch = state.src.charCodeAt(pos++);
      if (ch !== marker && !isSpace(ch)) {
        return false;
      }
      if (ch === marker) {
        cnt++;
      }
    }
    if (cnt < 3) {
      return false;
    }
    if (silent) {
      return true;
    }
    state.line = startLine + 1;
    const token = state.push("hr", "hr", 0);
    token.map = [startLine, state.line];
    token.markup = Array(cnt + 1).join(String.fromCharCode(marker));
    return true;
  }
  function skipBulletListMarker(state, startLine) {
    const max = state.eMarks[startLine];
    let pos = state.bMarks[startLine] + state.tShift[startLine];
    const marker = state.src.charCodeAt(pos++);
    if (marker !== 42 && marker !== 45 && marker !== 43) {
      return -1;
    }
    if (pos < max) {
      const ch = state.src.charCodeAt(pos);
      if (!isSpace(ch)) {
        return -1;
      }
    }
    return pos;
  }
  function skipOrderedListMarker(state, startLine) {
    const start = state.bMarks[startLine] + state.tShift[startLine];
    const max = state.eMarks[startLine];
    let pos = start;
    if (pos + 1 >= max) {
      return -1;
    }
    let ch = state.src.charCodeAt(pos++);
    if (ch < 48 || ch > 57) {
      return -1;
    }
    for (; ; ) {
      if (pos >= max) {
        return -1;
      }
      ch = state.src.charCodeAt(pos++);
      if (ch >= 48 && ch <= 57) {
        if (pos - start >= 10) {
          return -1;
        }
        continue;
      }
      if (ch === 41 || ch === 46) {
        break;
      }
      return -1;
    }
    if (pos < max) {
      ch = state.src.charCodeAt(pos);
      if (!isSpace(ch)) {
        return -1;
      }
    }
    return pos;
  }
  function markTightParagraphs(state, idx) {
    const level = state.level + 2;
    for (let i = idx + 2, l = state.tokens.length - 2; i < l; i++) {
      if (state.tokens[i].level === level && state.tokens[i].type === "paragraph_open") {
        state.tokens[i + 2].hidden = true;
        state.tokens[i].hidden = true;
        i += 2;
      }
    }
  }
  function list(state, startLine, endLine, silent) {
    let max, pos, start, token;
    let nextLine = startLine;
    let tight = true;
    if (state.sCount[nextLine] - state.blkIndent >= 4) {
      return false;
    }
    if (state.listIndent >= 0 && state.sCount[nextLine] - state.listIndent >= 4 && state.sCount[nextLine] < state.blkIndent) {
      return false;
    }
    let isTerminatingParagraph = false;
    if (silent && state.parentType === "paragraph") {
      if (state.sCount[nextLine] >= state.blkIndent) {
        isTerminatingParagraph = true;
      }
    }
    let isOrdered;
    let markerValue;
    let posAfterMarker;
    if ((posAfterMarker = skipOrderedListMarker(state, nextLine)) >= 0) {
      isOrdered = true;
      start = state.bMarks[nextLine] + state.tShift[nextLine];
      markerValue = Number(state.src.slice(start, posAfterMarker - 1));
      if (isTerminatingParagraph && markerValue !== 1) return false;
    } else if ((posAfterMarker = skipBulletListMarker(state, nextLine)) >= 0) {
      isOrdered = false;
    } else {
      return false;
    }
    if (isTerminatingParagraph) {
      if (state.skipSpaces(posAfterMarker) >= state.eMarks[nextLine]) return false;
    }
    if (silent) {
      return true;
    }
    const markerCharCode = state.src.charCodeAt(posAfterMarker - 1);
    const listTokIdx = state.tokens.length;
    if (isOrdered) {
      token = state.push("ordered_list_open", "ol", 1);
      if (markerValue !== 1) {
        token.attrs = [["start", markerValue]];
      }
    } else {
      token = state.push("bullet_list_open", "ul", 1);
    }
    const listLines = [nextLine, 0];
    token.map = listLines;
    token.markup = String.fromCharCode(markerCharCode);
    let prevEmptyEnd = false;
    const terminatorRules = state.md.block.ruler.getRules("list");
    const oldParentType = state.parentType;
    state.parentType = "list";
    while (nextLine < endLine) {
      pos = posAfterMarker;
      max = state.eMarks[nextLine];
      const initial = state.sCount[nextLine] + posAfterMarker - (state.bMarks[nextLine] + state.tShift[nextLine]);
      let offset = initial;
      while (pos < max) {
        const ch = state.src.charCodeAt(pos);
        if (ch === 9) {
          offset += 4 - (offset + state.bsCount[nextLine]) % 4;
        } else if (ch === 32) {
          offset++;
        } else {
          break;
        }
        pos++;
      }
      const contentStart = pos;
      let indentAfterMarker;
      if (contentStart >= max) {
        indentAfterMarker = 1;
      } else {
        indentAfterMarker = offset - initial;
      }
      if (indentAfterMarker > 4) {
        indentAfterMarker = 1;
      }
      const indent = initial + indentAfterMarker;
      token = state.push("list_item_open", "li", 1);
      token.markup = String.fromCharCode(markerCharCode);
      const itemLines = [nextLine, 0];
      token.map = itemLines;
      if (isOrdered) {
        token.info = state.src.slice(start, posAfterMarker - 1);
      }
      const oldTight = state.tight;
      const oldTShift = state.tShift[nextLine];
      const oldSCount = state.sCount[nextLine];
      const oldListIndent = state.listIndent;
      state.listIndent = state.blkIndent;
      state.blkIndent = indent;
      state.tight = true;
      state.tShift[nextLine] = contentStart - state.bMarks[nextLine];
      state.sCount[nextLine] = offset;
      if (contentStart >= max && state.isEmpty(nextLine + 1)) {
        state.line = Math.min(state.line + 2, endLine);
      } else {
        state.md.block.tokenize(state, nextLine, endLine, true);
      }
      if (!state.tight || prevEmptyEnd) {
        tight = false;
      }
      prevEmptyEnd = state.line - nextLine > 1 && state.isEmpty(state.line - 1);
      state.blkIndent = state.listIndent;
      state.listIndent = oldListIndent;
      state.tShift[nextLine] = oldTShift;
      state.sCount[nextLine] = oldSCount;
      state.tight = oldTight;
      token = state.push("list_item_close", "li", -1);
      token.markup = String.fromCharCode(markerCharCode);
      nextLine = state.line;
      itemLines[1] = nextLine;
      if (nextLine >= endLine) {
        break;
      }
      if (state.sCount[nextLine] < state.blkIndent) {
        break;
      }
      if (state.sCount[nextLine] - state.blkIndent >= 4) {
        break;
      }
      let terminate = false;
      for (let i = 0, l = terminatorRules.length; i < l; i++) {
        if (terminatorRules[i](state, nextLine, endLine, true)) {
          terminate = true;
          break;
        }
      }
      if (terminate) {
        break;
      }
      if (isOrdered) {
        posAfterMarker = skipOrderedListMarker(state, nextLine);
        if (posAfterMarker < 0) {
          break;
        }
        start = state.bMarks[nextLine] + state.tShift[nextLine];
      } else {
        posAfterMarker = skipBulletListMarker(state, nextLine);
        if (posAfterMarker < 0) {
          break;
        }
      }
      if (markerCharCode !== state.src.charCodeAt(posAfterMarker - 1)) {
        break;
      }
    }
    if (isOrdered) {
      token = state.push("ordered_list_close", "ol", -1);
    } else {
      token = state.push("bullet_list_close", "ul", -1);
    }
    token.markup = String.fromCharCode(markerCharCode);
    listLines[1] = nextLine;
    state.line = nextLine;
    state.parentType = oldParentType;
    if (tight) {
      markTightParagraphs(state, listTokIdx);
    }
    return true;
  }
  function reference(state, startLine, _endLine, silent) {
    let pos = state.bMarks[startLine] + state.tShift[startLine];
    let max = state.eMarks[startLine];
    let nextLine = startLine + 1;
    if (state.sCount[startLine] - state.blkIndent >= 4) {
      return false;
    }
    if (state.src.charCodeAt(pos) !== 91) {
      return false;
    }
    function getNextLine(nextLine2) {
      const endLine = state.lineMax;
      if (nextLine2 >= endLine || state.isEmpty(nextLine2)) {
        return null;
      }
      let isContinuation = false;
      if (state.sCount[nextLine2] - state.blkIndent > 3) {
        isContinuation = true;
      }
      if (state.sCount[nextLine2] < 0) {
        isContinuation = true;
      }
      if (!isContinuation) {
        const terminatorRules = state.md.block.ruler.getRules("reference");
        const oldParentType = state.parentType;
        state.parentType = "reference";
        let terminate = false;
        for (let i = 0, l = terminatorRules.length; i < l; i++) {
          if (terminatorRules[i](state, nextLine2, endLine, true)) {
            terminate = true;
            break;
          }
        }
        state.parentType = oldParentType;
        if (terminate) {
          return null;
        }
      }
      const pos2 = state.bMarks[nextLine2] + state.tShift[nextLine2];
      const max2 = state.eMarks[nextLine2];
      return state.src.slice(pos2, max2 + 1);
    }
    let str = state.src.slice(pos, max + 1);
    max = str.length;
    let labelEnd = -1;
    for (pos = 1; pos < max; pos++) {
      const ch = str.charCodeAt(pos);
      if (ch === 91) {
        return false;
      } else if (ch === 93) {
        labelEnd = pos;
        break;
      } else if (ch === 10) {
        const lineContent = getNextLine(nextLine);
        if (lineContent !== null) {
          str += lineContent;
          max = str.length;
          nextLine++;
        }
      } else if (ch === 92) {
        pos++;
        if (pos < max && str.charCodeAt(pos) === 10) {
          const lineContent = getNextLine(nextLine);
          if (lineContent !== null) {
            str += lineContent;
            max = str.length;
            nextLine++;
          }
        }
      }
    }
    if (labelEnd < 0 || str.charCodeAt(labelEnd + 1) !== 58) {
      return false;
    }
    for (pos = labelEnd + 2; pos < max; pos++) {
      const ch = str.charCodeAt(pos);
      if (ch === 10) {
        const lineContent = getNextLine(nextLine);
        if (lineContent !== null) {
          str += lineContent;
          max = str.length;
          nextLine++;
        }
      } else if (isSpace(ch)) ;
      else {
        break;
      }
    }
    const destRes = state.md.helpers.parseLinkDestination(str, pos, max);
    if (!destRes.ok) {
      return false;
    }
    const href = state.md.normalizeLink(destRes.str);
    if (!state.md.validateLink(href)) {
      return false;
    }
    pos = destRes.pos;
    const destEndPos = pos;
    const destEndLineNo = nextLine;
    const start = pos;
    for (; pos < max; pos++) {
      const ch = str.charCodeAt(pos);
      if (ch === 10) {
        const lineContent = getNextLine(nextLine);
        if (lineContent !== null) {
          str += lineContent;
          max = str.length;
          nextLine++;
        }
      } else if (isSpace(ch)) ;
      else {
        break;
      }
    }
    let titleRes = state.md.helpers.parseLinkTitle(str, pos, max);
    while (titleRes.can_continue) {
      const lineContent = getNextLine(nextLine);
      if (lineContent === null) break;
      str += lineContent;
      pos = max;
      max = str.length;
      nextLine++;
      titleRes = state.md.helpers.parseLinkTitle(str, pos, max, titleRes);
    }
    let title;
    if (pos < max && start !== pos && titleRes.ok) {
      title = titleRes.str;
      pos = titleRes.pos;
    } else {
      title = "";
      pos = destEndPos;
      nextLine = destEndLineNo;
    }
    while (pos < max) {
      const ch = str.charCodeAt(pos);
      if (!isSpace(ch)) {
        break;
      }
      pos++;
    }
    if (pos < max && str.charCodeAt(pos) !== 10) {
      if (title) {
        title = "";
        pos = destEndPos;
        nextLine = destEndLineNo;
        while (pos < max) {
          const ch = str.charCodeAt(pos);
          if (!isSpace(ch)) {
            break;
          }
          pos++;
        }
      }
    }
    if (pos < max && str.charCodeAt(pos) !== 10) {
      return false;
    }
    const label = normalizeReference(str.slice(1, labelEnd));
    if (!label) {
      return false;
    }
    if (silent) {
      return true;
    }
    if (typeof state.env.references === "undefined") {
      state.env.references = {};
    }
    if (typeof state.env.references[label] === "undefined") {
      state.env.references[label] = { title, href };
    }
    state.line = nextLine;
    return true;
  }
  const block_names = [
    "address",
    "article",
    "aside",
    "base",
    "basefont",
    "blockquote",
    "body",
    "caption",
    "center",
    "col",
    "colgroup",
    "dd",
    "details",
    "dialog",
    "dir",
    "div",
    "dl",
    "dt",
    "fieldset",
    "figcaption",
    "figure",
    "footer",
    "form",
    "frame",
    "frameset",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "head",
    "header",
    "hr",
    "html",
    "iframe",
    "legend",
    "li",
    "link",
    "main",
    "menu",
    "menuitem",
    "nav",
    "noframes",
    "ol",
    "optgroup",
    "option",
    "p",
    "param",
    "search",
    "section",
    "summary",
    "table",
    "tbody",
    "td",
    "tfoot",
    "th",
    "thead",
    "title",
    "tr",
    "track",
    "ul"
  ];
  const attr_name = "[a-zA-Z_:][a-zA-Z0-9:._-]*";
  const unquoted = "[^\"'=<>`\\x00-\\x20]+";
  const single_quoted = "'[^']*'";
  const double_quoted = '"[^"]*"';
  const attr_value = "(?:" + unquoted + "|" + single_quoted + "|" + double_quoted + ")";
  const attribute = "(?:\\s+" + attr_name + "(?:\\s*=\\s*" + attr_value + ")?)";
  const open_tag = "<[A-Za-z][A-Za-z0-9\\-]*" + attribute + "*\\s*\\/?>";
  const close_tag = "<\\/[A-Za-z][A-Za-z0-9\\-]*\\s*>";
  const comment = "<!---?>|<!--(?:[^-]|-[^-]|--[^>])*-->";
  const processing = "<[?][\\s\\S]*?[?]>";
  const declaration = "<![A-Za-z][^>]*>";
  const cdata = "<!\\[CDATA\\[[\\s\\S]*?\\]\\]>";
  const HTML_TAG_RE = new RegExp("^(?:" + open_tag + "|" + close_tag + "|" + comment + "|" + processing + "|" + declaration + "|" + cdata + ")");
  const HTML_OPEN_CLOSE_TAG_RE = new RegExp("^(?:" + open_tag + "|" + close_tag + ")");
  const HTML_SEQUENCES = [
    [/^<(script|pre|style|textarea)(?=(\s|>|$))/i, /<\/(script|pre|style|textarea)>/i, true],
    [/^<!--/, /-->/, true],
    [/^<\?/, /\?>/, true],
    [/^<![A-Z]/, />/, true],
    [/^<!\[CDATA\[/, /\]\]>/, true],
    [new RegExp("^</?(" + block_names.join("|") + ")(?=(\\s|/?>|$))", "i"), /^$/, true],
    [new RegExp(HTML_OPEN_CLOSE_TAG_RE.source + "\\s*$"), /^$/, false]
  ];
  function html_block(state, startLine, endLine, silent) {
    let pos = state.bMarks[startLine] + state.tShift[startLine];
    let max = state.eMarks[startLine];
    if (state.sCount[startLine] - state.blkIndent >= 4) {
      return false;
    }
    if (!state.md.options.html) {
      return false;
    }
    if (state.src.charCodeAt(pos) !== 60) {
      return false;
    }
    let lineText = state.src.slice(pos, max);
    let i = 0;
    for (; i < HTML_SEQUENCES.length; i++) {
      if (HTML_SEQUENCES[i][0].test(lineText)) {
        break;
      }
    }
    if (i === HTML_SEQUENCES.length) {
      return false;
    }
    if (silent) {
      return HTML_SEQUENCES[i][2];
    }
    let nextLine = startLine + 1;
    if (!HTML_SEQUENCES[i][1].test(lineText)) {
      for (; nextLine < endLine; nextLine++) {
        if (state.sCount[nextLine] < state.blkIndent) {
          break;
        }
        pos = state.bMarks[nextLine] + state.tShift[nextLine];
        max = state.eMarks[nextLine];
        lineText = state.src.slice(pos, max);
        if (HTML_SEQUENCES[i][1].test(lineText)) {
          if (lineText.length !== 0) {
            nextLine++;
          }
          break;
        }
      }
    }
    state.line = nextLine;
    const token = state.push("html_block", "", 0);
    token.map = [startLine, nextLine];
    token.content = state.getLines(startLine, nextLine, state.blkIndent, true);
    return true;
  }
  function heading(state, startLine, endLine, silent) {
    let pos = state.bMarks[startLine] + state.tShift[startLine];
    let max = state.eMarks[startLine];
    if (state.sCount[startLine] - state.blkIndent >= 4) {
      return false;
    }
    let ch = state.src.charCodeAt(pos);
    if (ch !== 35 || pos >= max) {
      return false;
    }
    let level = 1;
    ch = state.src.charCodeAt(++pos);
    while (ch === 35 && pos < max && level <= 6) {
      level++;
      ch = state.src.charCodeAt(++pos);
    }
    if (level > 6 || pos < max && !isSpace(ch)) {
      return false;
    }
    if (silent) {
      return true;
    }
    max = state.skipSpacesBack(max, pos);
    const tmp = state.skipCharsBack(max, 35, pos);
    if (tmp > pos && isSpace(state.src.charCodeAt(tmp - 1))) {
      max = tmp;
    }
    state.line = startLine + 1;
    const token_o = state.push("heading_open", "h" + String(level), 1);
    token_o.markup = "########".slice(0, level);
    token_o.map = [startLine, state.line];
    const token_i = state.push("inline", "", 0);
    token_i.content = state.src.slice(pos, max).trim();
    token_i.map = [startLine, state.line];
    token_i.children = [];
    const token_c = state.push("heading_close", "h" + String(level), -1);
    token_c.markup = "########".slice(0, level);
    return true;
  }
  function lheading(state, startLine, endLine) {
    const terminatorRules = state.md.block.ruler.getRules("paragraph");
    if (state.sCount[startLine] - state.blkIndent >= 4) {
      return false;
    }
    const oldParentType = state.parentType;
    state.parentType = "paragraph";
    let level = 0;
    let marker;
    let nextLine = startLine + 1;
    for (; nextLine < endLine && !state.isEmpty(nextLine); nextLine++) {
      if (state.sCount[nextLine] - state.blkIndent > 3) {
        continue;
      }
      if (state.sCount[nextLine] >= state.blkIndent) {
        let pos = state.bMarks[nextLine] + state.tShift[nextLine];
        const max = state.eMarks[nextLine];
        if (pos < max) {
          marker = state.src.charCodeAt(pos);
          if (marker === 45 || marker === 61) {
            pos = state.skipChars(pos, marker);
            pos = state.skipSpaces(pos);
            if (pos >= max) {
              level = marker === 61 ? 1 : 2;
              break;
            }
          }
        }
      }
      if (state.sCount[nextLine] < 0) {
        continue;
      }
      let terminate = false;
      for (let i = 0, l = terminatorRules.length; i < l; i++) {
        if (terminatorRules[i](state, nextLine, endLine, true)) {
          terminate = true;
          break;
        }
      }
      if (terminate) {
        break;
      }
    }
    if (!level) {
      return false;
    }
    const content = state.getLines(startLine, nextLine, state.blkIndent, false).trim();
    state.line = nextLine + 1;
    const token_o = state.push("heading_open", "h" + String(level), 1);
    token_o.markup = String.fromCharCode(marker);
    token_o.map = [startLine, state.line];
    const token_i = state.push("inline", "", 0);
    token_i.content = content;
    token_i.map = [startLine, state.line - 1];
    token_i.children = [];
    const token_c = state.push("heading_close", "h" + String(level), -1);
    token_c.markup = String.fromCharCode(marker);
    state.parentType = oldParentType;
    return true;
  }
  function paragraph(state, startLine, endLine) {
    const terminatorRules = state.md.block.ruler.getRules("paragraph");
    const oldParentType = state.parentType;
    let nextLine = startLine + 1;
    state.parentType = "paragraph";
    for (; nextLine < endLine && !state.isEmpty(nextLine); nextLine++) {
      if (state.sCount[nextLine] - state.blkIndent > 3) {
        continue;
      }
      if (state.sCount[nextLine] < 0) {
        continue;
      }
      let terminate = false;
      for (let i = 0, l = terminatorRules.length; i < l; i++) {
        if (terminatorRules[i](state, nextLine, endLine, true)) {
          terminate = true;
          break;
        }
      }
      if (terminate) {
        break;
      }
    }
    const content = state.getLines(startLine, nextLine, state.blkIndent, false).trim();
    state.line = nextLine;
    const token_o = state.push("paragraph_open", "p", 1);
    token_o.map = [startLine, state.line];
    const token_i = state.push("inline", "", 0);
    token_i.content = content;
    token_i.map = [startLine, state.line];
    token_i.children = [];
    state.push("paragraph_close", "p", -1);
    state.parentType = oldParentType;
    return true;
  }
  const _rules$1 = [
    // First 2 params - rule name & source. Secondary array - list of rules,
    // which can be terminated by this one.
    ["table", table, ["paragraph", "reference"]],
    ["code", code],
    ["fence", fence, ["paragraph", "reference", "blockquote", "list"]],
    ["blockquote", blockquote, ["paragraph", "reference", "blockquote", "list"]],
    ["hr", hr, ["paragraph", "reference", "blockquote", "list"]],
    ["list", list, ["paragraph", "reference", "blockquote"]],
    ["reference", reference],
    ["html_block", html_block, ["paragraph", "reference", "blockquote"]],
    ["heading", heading, ["paragraph", "reference", "blockquote"]],
    ["lheading", lheading],
    ["paragraph", paragraph]
  ];
  function ParserBlock() {
    this.ruler = new Ruler();
    for (let i = 0; i < _rules$1.length; i++) {
      this.ruler.push(_rules$1[i][0], _rules$1[i][1], { alt: (_rules$1[i][2] || []).slice() });
    }
  }
  ParserBlock.prototype.tokenize = function(state, startLine, endLine) {
    const rules = this.ruler.getRules("");
    const len = rules.length;
    const maxNesting = state.md.options.maxNesting;
    let line = startLine;
    let hasEmptyLines = false;
    while (line < endLine) {
      state.line = line = state.skipEmptyLines(line);
      if (line >= endLine) {
        break;
      }
      if (state.sCount[line] < state.blkIndent) {
        break;
      }
      if (state.level >= maxNesting) {
        state.line = endLine;
        break;
      }
      const prevLine = state.line;
      let ok = false;
      for (let i = 0; i < len; i++) {
        ok = rules[i](state, line, endLine, false);
        if (ok) {
          if (prevLine >= state.line) {
            throw new Error("block rule didn't increment state.line");
          }
          break;
        }
      }
      if (!ok) throw new Error("none of the block rules matched");
      state.tight = !hasEmptyLines;
      if (state.isEmpty(state.line - 1)) {
        hasEmptyLines = true;
      }
      line = state.line;
      if (line < endLine && state.isEmpty(line)) {
        hasEmptyLines = true;
        line++;
        state.line = line;
      }
    }
  };
  ParserBlock.prototype.parse = function(src, md, env, outTokens) {
    if (!src) {
      return;
    }
    const state = new this.State(src, md, env, outTokens);
    this.tokenize(state, state.line, state.lineMax);
  };
  ParserBlock.prototype.State = StateBlock;
  function StateInline(src, md, env, outTokens) {
    this.src = src;
    this.env = env;
    this.md = md;
    this.tokens = outTokens;
    this.tokens_meta = Array(outTokens.length);
    this.pos = 0;
    this.posMax = this.src.length;
    this.level = 0;
    this.pending = "";
    this.pendingLevel = 0;
    this.cache = {};
    this.delimiters = [];
    this._prev_delimiters = [];
    this.backticks = {};
    this.backticksScanned = false;
    this.linkLevel = 0;
  }
  StateInline.prototype.pushPending = function() {
    const token = new Token("text", "", 0);
    token.content = this.pending;
    token.level = this.pendingLevel;
    this.tokens.push(token);
    this.pending = "";
    return token;
  };
  StateInline.prototype.push = function(type, tag, nesting) {
    if (this.pending) {
      this.pushPending();
    }
    const token = new Token(type, tag, nesting);
    let token_meta = null;
    if (nesting < 0) {
      this.level--;
      this.delimiters = this._prev_delimiters.pop();
    }
    token.level = this.level;
    if (nesting > 0) {
      this.level++;
      this._prev_delimiters.push(this.delimiters);
      this.delimiters = [];
      token_meta = { delimiters: this.delimiters };
    }
    this.pendingLevel = this.level;
    this.tokens.push(token);
    this.tokens_meta.push(token_meta);
    return token;
  };
  StateInline.prototype.scanDelims = function(start, canSplitWord) {
    const max = this.posMax;
    const marker = this.src.charCodeAt(start);
    const lastChar = start > 0 ? this.src.charCodeAt(start - 1) : 32;
    let pos = start;
    while (pos < max && this.src.charCodeAt(pos) === marker) {
      pos++;
    }
    const count = pos - start;
    const nextChar = pos < max ? this.src.charCodeAt(pos) : 32;
    const isLastPunctChar = isMdAsciiPunct(lastChar) || isPunctChar(String.fromCharCode(lastChar));
    const isNextPunctChar = isMdAsciiPunct(nextChar) || isPunctChar(String.fromCharCode(nextChar));
    const isLastWhiteSpace = isWhiteSpace(lastChar);
    const isNextWhiteSpace = isWhiteSpace(nextChar);
    const left_flanking = !isNextWhiteSpace && (!isNextPunctChar || isLastWhiteSpace || isLastPunctChar);
    const right_flanking = !isLastWhiteSpace && (!isLastPunctChar || isNextWhiteSpace || isNextPunctChar);
    const can_open = left_flanking && (canSplitWord || !right_flanking || isLastPunctChar);
    const can_close = right_flanking && (canSplitWord || !left_flanking || isNextPunctChar);
    return { can_open, can_close, length: count };
  };
  StateInline.prototype.Token = Token;
  function isTerminatorChar(ch) {
    switch (ch) {
      case 10:
      case 33:
      case 35:
      case 36:
      case 37:
      case 38:
      case 42:
      case 43:
      case 45:
      case 58:
      case 60:
      case 61:
      case 62:
      case 64:
      case 91:
      case 92:
      case 93:
      case 94:
      case 95:
      case 96:
      case 123:
      case 125:
      case 126:
        return true;
      default:
        return false;
    }
  }
  function text(state, silent) {
    let pos = state.pos;
    while (pos < state.posMax && !isTerminatorChar(state.src.charCodeAt(pos))) {
      pos++;
    }
    if (pos === state.pos) {
      return false;
    }
    if (!silent) {
      state.pending += state.src.slice(state.pos, pos);
    }
    state.pos = pos;
    return true;
  }
  const SCHEME_RE = /(?:^|[^a-z0-9.+-])([a-z][a-z0-9.+-]*)$/i;
  function linkify(state, silent) {
    if (!state.md.options.linkify) return false;
    if (state.linkLevel > 0) return false;
    const pos = state.pos;
    const max = state.posMax;
    if (pos + 3 > max) return false;
    if (state.src.charCodeAt(pos) !== 58) return false;
    if (state.src.charCodeAt(pos + 1) !== 47) return false;
    if (state.src.charCodeAt(pos + 2) !== 47) return false;
    const match = state.pending.match(SCHEME_RE);
    if (!match) return false;
    const proto = match[1];
    const link2 = state.md.linkify.matchAtStart(state.src.slice(pos - proto.length));
    if (!link2) return false;
    let url = link2.url;
    if (url.length <= proto.length) return false;
    url = url.replace(/\*+$/, "");
    const fullUrl = state.md.normalizeLink(url);
    if (!state.md.validateLink(fullUrl)) return false;
    if (!silent) {
      state.pending = state.pending.slice(0, -proto.length);
      const token_o = state.push("link_open", "a", 1);
      token_o.attrs = [["href", fullUrl]];
      token_o.markup = "linkify";
      token_o.info = "auto";
      const token_t = state.push("text", "", 0);
      token_t.content = state.md.normalizeLinkText(url);
      const token_c = state.push("link_close", "a", -1);
      token_c.markup = "linkify";
      token_c.info = "auto";
    }
    state.pos += url.length - proto.length;
    return true;
  }
  function newline(state, silent) {
    let pos = state.pos;
    if (state.src.charCodeAt(pos) !== 10) {
      return false;
    }
    const pmax = state.pending.length - 1;
    const max = state.posMax;
    if (!silent) {
      if (pmax >= 0 && state.pending.charCodeAt(pmax) === 32) {
        if (pmax >= 1 && state.pending.charCodeAt(pmax - 1) === 32) {
          let ws = pmax - 1;
          while (ws >= 1 && state.pending.charCodeAt(ws - 1) === 32) ws--;
          state.pending = state.pending.slice(0, ws);
          state.push("hardbreak", "br", 0);
        } else {
          state.pending = state.pending.slice(0, -1);
          state.push("softbreak", "br", 0);
        }
      } else {
        state.push("softbreak", "br", 0);
      }
    }
    pos++;
    while (pos < max && isSpace(state.src.charCodeAt(pos))) {
      pos++;
    }
    state.pos = pos;
    return true;
  }
  const ESCAPED = [];
  for (let i = 0; i < 256; i++) {
    ESCAPED.push(0);
  }
  "\\!\"#$%&'()*+,./:;<=>?@[]^_`{|}~-".split("").forEach(function(ch) {
    ESCAPED[ch.charCodeAt(0)] = 1;
  });
  function escape(state, silent) {
    let pos = state.pos;
    const max = state.posMax;
    if (state.src.charCodeAt(pos) !== 92) return false;
    pos++;
    if (pos >= max) return false;
    let ch1 = state.src.charCodeAt(pos);
    if (ch1 === 10) {
      if (!silent) {
        state.push("hardbreak", "br", 0);
      }
      pos++;
      while (pos < max) {
        ch1 = state.src.charCodeAt(pos);
        if (!isSpace(ch1)) break;
        pos++;
      }
      state.pos = pos;
      return true;
    }
    let escapedStr = state.src[pos];
    if (ch1 >= 55296 && ch1 <= 56319 && pos + 1 < max) {
      const ch2 = state.src.charCodeAt(pos + 1);
      if (ch2 >= 56320 && ch2 <= 57343) {
        escapedStr += state.src[pos + 1];
        pos++;
      }
    }
    const origStr = "\\" + escapedStr;
    if (!silent) {
      const token = state.push("text_special", "", 0);
      if (ch1 < 256 && ESCAPED[ch1] !== 0) {
        token.content = escapedStr;
      } else {
        token.content = origStr;
      }
      token.markup = origStr;
      token.info = "escape";
    }
    state.pos = pos + 1;
    return true;
  }
  function backtick(state, silent) {
    let pos = state.pos;
    const ch = state.src.charCodeAt(pos);
    if (ch !== 96) {
      return false;
    }
    const start = pos;
    pos++;
    const max = state.posMax;
    while (pos < max && state.src.charCodeAt(pos) === 96) {
      pos++;
    }
    const marker = state.src.slice(start, pos);
    const openerLength = marker.length;
    if (state.backticksScanned && (state.backticks[openerLength] || 0) <= start) {
      if (!silent) state.pending += marker;
      state.pos += openerLength;
      return true;
    }
    let matchEnd = pos;
    let matchStart;
    while ((matchStart = state.src.indexOf("`", matchEnd)) !== -1) {
      matchEnd = matchStart + 1;
      while (matchEnd < max && state.src.charCodeAt(matchEnd) === 96) {
        matchEnd++;
      }
      const closerLength = matchEnd - matchStart;
      if (closerLength === openerLength) {
        if (!silent) {
          const token = state.push("code_inline", "code", 0);
          token.markup = marker;
          token.content = state.src.slice(pos, matchStart).replace(/\n/g, " ").replace(/^ (.+) $/, "$1");
        }
        state.pos = matchEnd;
        return true;
      }
      state.backticks[closerLength] = matchStart;
    }
    state.backticksScanned = true;
    if (!silent) state.pending += marker;
    state.pos += openerLength;
    return true;
  }
  function strikethrough_tokenize(state, silent) {
    const start = state.pos;
    const marker = state.src.charCodeAt(start);
    if (silent) {
      return false;
    }
    if (marker !== 126) {
      return false;
    }
    const scanned = state.scanDelims(state.pos, true);
    let len = scanned.length;
    const ch = String.fromCharCode(marker);
    if (len < 2) {
      return false;
    }
    let token;
    if (len % 2) {
      token = state.push("text", "", 0);
      token.content = ch;
      len--;
    }
    for (let i = 0; i < len; i += 2) {
      token = state.push("text", "", 0);
      token.content = ch + ch;
      state.delimiters.push({
        marker,
        length: 0,
        // disable "rule of 3" length checks meant for emphasis
        token: state.tokens.length - 1,
        end: -1,
        open: scanned.can_open,
        close: scanned.can_close
      });
    }
    state.pos += scanned.length;
    return true;
  }
  function postProcess$1(state, delimiters) {
    let token;
    const loneMarkers = [];
    const max = delimiters.length;
    for (let i = 0; i < max; i++) {
      const startDelim = delimiters[i];
      if (startDelim.marker !== 126) {
        continue;
      }
      if (startDelim.end === -1) {
        continue;
      }
      const endDelim = delimiters[startDelim.end];
      token = state.tokens[startDelim.token];
      token.type = "s_open";
      token.tag = "s";
      token.nesting = 1;
      token.markup = "~~";
      token.content = "";
      token = state.tokens[endDelim.token];
      token.type = "s_close";
      token.tag = "s";
      token.nesting = -1;
      token.markup = "~~";
      token.content = "";
      if (state.tokens[endDelim.token - 1].type === "text" && state.tokens[endDelim.token - 1].content === "~") {
        loneMarkers.push(endDelim.token - 1);
      }
    }
    while (loneMarkers.length) {
      const i = loneMarkers.pop();
      let j = i + 1;
      while (j < state.tokens.length && state.tokens[j].type === "s_close") {
        j++;
      }
      j--;
      if (i !== j) {
        token = state.tokens[j];
        state.tokens[j] = state.tokens[i];
        state.tokens[i] = token;
      }
    }
  }
  function strikethrough_postProcess(state) {
    const tokens_meta = state.tokens_meta;
    const max = state.tokens_meta.length;
    postProcess$1(state, state.delimiters);
    for (let curr = 0; curr < max; curr++) {
      if (tokens_meta[curr] && tokens_meta[curr].delimiters) {
        postProcess$1(state, tokens_meta[curr].delimiters);
      }
    }
  }
  const r_strikethrough = {
    tokenize: strikethrough_tokenize,
    postProcess: strikethrough_postProcess
  };
  function emphasis_tokenize(state, silent) {
    const start = state.pos;
    const marker = state.src.charCodeAt(start);
    if (silent) {
      return false;
    }
    if (marker !== 95 && marker !== 42) {
      return false;
    }
    const scanned = state.scanDelims(state.pos, marker === 42);
    for (let i = 0; i < scanned.length; i++) {
      const token = state.push("text", "", 0);
      token.content = String.fromCharCode(marker);
      state.delimiters.push({
        // Char code of the starting marker (number).
        //
        marker,
        // Total length of these series of delimiters.
        //
        length: scanned.length,
        // A position of the token this delimiter corresponds to.
        //
        token: state.tokens.length - 1,
        // If this delimiter is matched as a valid opener, `end` will be
        // equal to its position, otherwise it's `-1`.
        //
        end: -1,
        // Boolean flags that determine if this delimiter could open or close
        // an emphasis.
        //
        open: scanned.can_open,
        close: scanned.can_close
      });
    }
    state.pos += scanned.length;
    return true;
  }
  function postProcess(state, delimiters) {
    const max = delimiters.length;
    for (let i = max - 1; i >= 0; i--) {
      const startDelim = delimiters[i];
      if (startDelim.marker !== 95 && startDelim.marker !== 42) {
        continue;
      }
      if (startDelim.end === -1) {
        continue;
      }
      const endDelim = delimiters[startDelim.end];
      const isStrong = i > 0 && delimiters[i - 1].end === startDelim.end + 1 && // check that first two markers match and adjacent
      delimiters[i - 1].marker === startDelim.marker && delimiters[i - 1].token === startDelim.token - 1 && // check that last two markers are adjacent (we can safely assume they match)
      delimiters[startDelim.end + 1].token === endDelim.token + 1;
      const ch = String.fromCharCode(startDelim.marker);
      const token_o = state.tokens[startDelim.token];
      token_o.type = isStrong ? "strong_open" : "em_open";
      token_o.tag = isStrong ? "strong" : "em";
      token_o.nesting = 1;
      token_o.markup = isStrong ? ch + ch : ch;
      token_o.content = "";
      const token_c = state.tokens[endDelim.token];
      token_c.type = isStrong ? "strong_close" : "em_close";
      token_c.tag = isStrong ? "strong" : "em";
      token_c.nesting = -1;
      token_c.markup = isStrong ? ch + ch : ch;
      token_c.content = "";
      if (isStrong) {
        state.tokens[delimiters[i - 1].token].content = "";
        state.tokens[delimiters[startDelim.end + 1].token].content = "";
        i--;
      }
    }
  }
  function emphasis_post_process(state) {
    const tokens_meta = state.tokens_meta;
    const max = state.tokens_meta.length;
    postProcess(state, state.delimiters);
    for (let curr = 0; curr < max; curr++) {
      if (tokens_meta[curr] && tokens_meta[curr].delimiters) {
        postProcess(state, tokens_meta[curr].delimiters);
      }
    }
  }
  const r_emphasis = {
    tokenize: emphasis_tokenize,
    postProcess: emphasis_post_process
  };
  function link(state, silent) {
    let code2, label, res, ref;
    let href = "";
    let title = "";
    let start = state.pos;
    let parseReference = true;
    if (state.src.charCodeAt(state.pos) !== 91) {
      return false;
    }
    const oldPos = state.pos;
    const max = state.posMax;
    const labelStart = state.pos + 1;
    const labelEnd = state.md.helpers.parseLinkLabel(state, state.pos, true);
    if (labelEnd < 0) {
      return false;
    }
    let pos = labelEnd + 1;
    if (pos < max && state.src.charCodeAt(pos) === 40) {
      parseReference = false;
      pos++;
      for (; pos < max; pos++) {
        code2 = state.src.charCodeAt(pos);
        if (!isSpace(code2) && code2 !== 10) {
          break;
        }
      }
      if (pos >= max) {
        return false;
      }
      start = pos;
      res = state.md.helpers.parseLinkDestination(state.src, pos, state.posMax);
      if (res.ok) {
        href = state.md.normalizeLink(res.str);
        if (state.md.validateLink(href)) {
          pos = res.pos;
        } else {
          href = "";
        }
        start = pos;
        for (; pos < max; pos++) {
          code2 = state.src.charCodeAt(pos);
          if (!isSpace(code2) && code2 !== 10) {
            break;
          }
        }
        res = state.md.helpers.parseLinkTitle(state.src, pos, state.posMax);
        if (pos < max && start !== pos && res.ok) {
          title = res.str;
          pos = res.pos;
          for (; pos < max; pos++) {
            code2 = state.src.charCodeAt(pos);
            if (!isSpace(code2) && code2 !== 10) {
              break;
            }
          }
        }
      }
      if (pos >= max || state.src.charCodeAt(pos) !== 41) {
        parseReference = true;
      }
      pos++;
    }
    if (parseReference) {
      if (typeof state.env.references === "undefined") {
        return false;
      }
      if (pos < max && state.src.charCodeAt(pos) === 91) {
        start = pos + 1;
        pos = state.md.helpers.parseLinkLabel(state, pos);
        if (pos >= 0) {
          label = state.src.slice(start, pos++);
        } else {
          pos = labelEnd + 1;
        }
      } else {
        pos = labelEnd + 1;
      }
      if (!label) {
        label = state.src.slice(labelStart, labelEnd);
      }
      ref = state.env.references[normalizeReference(label)];
      if (!ref) {
        state.pos = oldPos;
        return false;
      }
      href = ref.href;
      title = ref.title;
    }
    if (!silent) {
      state.pos = labelStart;
      state.posMax = labelEnd;
      const token_o = state.push("link_open", "a", 1);
      const attrs = [["href", href]];
      token_o.attrs = attrs;
      if (title) {
        attrs.push(["title", title]);
      }
      state.linkLevel++;
      state.md.inline.tokenize(state);
      state.linkLevel--;
      state.push("link_close", "a", -1);
    }
    state.pos = pos;
    state.posMax = max;
    return true;
  }
  function image(state, silent) {
    let code2, content, label, pos, ref, res, title, start;
    let href = "";
    const oldPos = state.pos;
    const max = state.posMax;
    if (state.src.charCodeAt(state.pos) !== 33) {
      return false;
    }
    if (state.src.charCodeAt(state.pos + 1) !== 91) {
      return false;
    }
    const labelStart = state.pos + 2;
    const labelEnd = state.md.helpers.parseLinkLabel(state, state.pos + 1, false);
    if (labelEnd < 0) {
      return false;
    }
    pos = labelEnd + 1;
    if (pos < max && state.src.charCodeAt(pos) === 40) {
      pos++;
      for (; pos < max; pos++) {
        code2 = state.src.charCodeAt(pos);
        if (!isSpace(code2) && code2 !== 10) {
          break;
        }
      }
      if (pos >= max) {
        return false;
      }
      start = pos;
      res = state.md.helpers.parseLinkDestination(state.src, pos, state.posMax);
      if (res.ok) {
        href = state.md.normalizeLink(res.str);
        if (state.md.validateLink(href)) {
          pos = res.pos;
        } else {
          href = "";
        }
      }
      start = pos;
      for (; pos < max; pos++) {
        code2 = state.src.charCodeAt(pos);
        if (!isSpace(code2) && code2 !== 10) {
          break;
        }
      }
      res = state.md.helpers.parseLinkTitle(state.src, pos, state.posMax);
      if (pos < max && start !== pos && res.ok) {
        title = res.str;
        pos = res.pos;
        for (; pos < max; pos++) {
          code2 = state.src.charCodeAt(pos);
          if (!isSpace(code2) && code2 !== 10) {
            break;
          }
        }
      } else {
        title = "";
      }
      if (pos >= max || state.src.charCodeAt(pos) !== 41) {
        state.pos = oldPos;
        return false;
      }
      pos++;
    } else {
      if (typeof state.env.references === "undefined") {
        return false;
      }
      if (pos < max && state.src.charCodeAt(pos) === 91) {
        start = pos + 1;
        pos = state.md.helpers.parseLinkLabel(state, pos);
        if (pos >= 0) {
          label = state.src.slice(start, pos++);
        } else {
          pos = labelEnd + 1;
        }
      } else {
        pos = labelEnd + 1;
      }
      if (!label) {
        label = state.src.slice(labelStart, labelEnd);
      }
      ref = state.env.references[normalizeReference(label)];
      if (!ref) {
        state.pos = oldPos;
        return false;
      }
      href = ref.href;
      title = ref.title;
    }
    if (!silent) {
      content = state.src.slice(labelStart, labelEnd);
      const tokens = [];
      state.md.inline.parse(
        content,
        state.md,
        state.env,
        tokens
      );
      const token = state.push("image", "img", 0);
      const attrs = [["src", href], ["alt", ""]];
      token.attrs = attrs;
      token.children = tokens;
      token.content = content;
      if (title) {
        attrs.push(["title", title]);
      }
    }
    state.pos = pos;
    state.posMax = max;
    return true;
  }
  const EMAIL_RE = /^([a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)$/;
  const AUTOLINK_RE = /^([a-zA-Z][a-zA-Z0-9+.-]{1,31}):([^<>\x00-\x20]*)$/;
  function autolink(state, silent) {
    let pos = state.pos;
    if (state.src.charCodeAt(pos) !== 60) {
      return false;
    }
    const start = state.pos;
    const max = state.posMax;
    for (; ; ) {
      if (++pos >= max) return false;
      const ch = state.src.charCodeAt(pos);
      if (ch === 60) return false;
      if (ch === 62) break;
    }
    const url = state.src.slice(start + 1, pos);
    if (AUTOLINK_RE.test(url)) {
      const fullUrl = state.md.normalizeLink(url);
      if (!state.md.validateLink(fullUrl)) {
        return false;
      }
      if (!silent) {
        const token_o = state.push("link_open", "a", 1);
        token_o.attrs = [["href", fullUrl]];
        token_o.markup = "autolink";
        token_o.info = "auto";
        const token_t = state.push("text", "", 0);
        token_t.content = state.md.normalizeLinkText(url);
        const token_c = state.push("link_close", "a", -1);
        token_c.markup = "autolink";
        token_c.info = "auto";
      }
      state.pos += url.length + 2;
      return true;
    }
    if (EMAIL_RE.test(url)) {
      const fullUrl = state.md.normalizeLink("mailto:" + url);
      if (!state.md.validateLink(fullUrl)) {
        return false;
      }
      if (!silent) {
        const token_o = state.push("link_open", "a", 1);
        token_o.attrs = [["href", fullUrl]];
        token_o.markup = "autolink";
        token_o.info = "auto";
        const token_t = state.push("text", "", 0);
        token_t.content = state.md.normalizeLinkText(url);
        const token_c = state.push("link_close", "a", -1);
        token_c.markup = "autolink";
        token_c.info = "auto";
      }
      state.pos += url.length + 2;
      return true;
    }
    return false;
  }
  function isLinkOpen(str) {
    return /^<a[>\s]/i.test(str);
  }
  function isLinkClose(str) {
    return /^<\/a\s*>/i.test(str);
  }
  function isLetter(ch) {
    const lc = ch | 32;
    return lc >= 97 && lc <= 122;
  }
  function html_inline(state, silent) {
    if (!state.md.options.html) {
      return false;
    }
    const max = state.posMax;
    const pos = state.pos;
    if (state.src.charCodeAt(pos) !== 60 || pos + 2 >= max) {
      return false;
    }
    const ch = state.src.charCodeAt(pos + 1);
    if (ch !== 33 && ch !== 63 && ch !== 47 && !isLetter(ch)) {
      return false;
    }
    const match = state.src.slice(pos).match(HTML_TAG_RE);
    if (!match) {
      return false;
    }
    if (!silent) {
      const token = state.push("html_inline", "", 0);
      token.content = match[0];
      if (isLinkOpen(token.content)) state.linkLevel++;
      if (isLinkClose(token.content)) state.linkLevel--;
    }
    state.pos += match[0].length;
    return true;
  }
  const DIGITAL_RE = /^&#((?:x[a-f0-9]{1,6}|[0-9]{1,7}));/i;
  const NAMED_RE = /^&([a-z][a-z0-9]{1,31});/i;
  function entity(state, silent) {
    const pos = state.pos;
    const max = state.posMax;
    if (state.src.charCodeAt(pos) !== 38) return false;
    if (pos + 1 >= max) return false;
    const ch = state.src.charCodeAt(pos + 1);
    if (ch === 35) {
      const match = state.src.slice(pos).match(DIGITAL_RE);
      if (match) {
        if (!silent) {
          const code2 = match[1][0].toLowerCase() === "x" ? parseInt(match[1].slice(1), 16) : parseInt(match[1], 10);
          const token = state.push("text_special", "", 0);
          token.content = isValidEntityCode(code2) ? fromCodePoint(code2) : fromCodePoint(65533);
          token.markup = match[0];
          token.info = "entity";
        }
        state.pos += match[0].length;
        return true;
      }
    } else {
      const match = state.src.slice(pos).match(NAMED_RE);
      if (match) {
        const decoded = decodeHTML(match[0]);
        if (decoded !== match[0]) {
          if (!silent) {
            const token = state.push("text_special", "", 0);
            token.content = decoded;
            token.markup = match[0];
            token.info = "entity";
          }
          state.pos += match[0].length;
          return true;
        }
      }
    }
    return false;
  }
  function processDelimiters(delimiters) {
    const openersBottom = {};
    const max = delimiters.length;
    if (!max) return;
    let headerIdx = 0;
    let lastTokenIdx = -2;
    const jumps = [];
    for (let closerIdx = 0; closerIdx < max; closerIdx++) {
      const closer = delimiters[closerIdx];
      jumps.push(0);
      if (delimiters[headerIdx].marker !== closer.marker || lastTokenIdx !== closer.token - 1) {
        headerIdx = closerIdx;
      }
      lastTokenIdx = closer.token;
      closer.length = closer.length || 0;
      if (!closer.close) continue;
      if (!openersBottom.hasOwnProperty(closer.marker)) {
        openersBottom[closer.marker] = [-1, -1, -1, -1, -1, -1];
      }
      const minOpenerIdx = openersBottom[closer.marker][(closer.open ? 3 : 0) + closer.length % 3];
      let openerIdx = headerIdx - jumps[headerIdx] - 1;
      let newMinOpenerIdx = openerIdx;
      for (; openerIdx > minOpenerIdx; openerIdx -= jumps[openerIdx] + 1) {
        const opener = delimiters[openerIdx];
        if (opener.marker !== closer.marker) continue;
        if (opener.open && opener.end < 0) {
          let isOddMatch = false;
          if (opener.close || closer.open) {
            if ((opener.length + closer.length) % 3 === 0) {
              if (opener.length % 3 !== 0 || closer.length % 3 !== 0) {
                isOddMatch = true;
              }
            }
          }
          if (!isOddMatch) {
            const lastJump = openerIdx > 0 && !delimiters[openerIdx - 1].open ? jumps[openerIdx - 1] + 1 : 0;
            jumps[closerIdx] = closerIdx - openerIdx + lastJump;
            jumps[openerIdx] = lastJump;
            closer.open = false;
            opener.end = closerIdx;
            opener.close = false;
            newMinOpenerIdx = -1;
            lastTokenIdx = -2;
            break;
          }
        }
      }
      if (newMinOpenerIdx !== -1) {
        openersBottom[closer.marker][(closer.open ? 3 : 0) + (closer.length || 0) % 3] = newMinOpenerIdx;
      }
    }
  }
  function link_pairs(state) {
    const tokens_meta = state.tokens_meta;
    const max = state.tokens_meta.length;
    processDelimiters(state.delimiters);
    for (let curr = 0; curr < max; curr++) {
      if (tokens_meta[curr] && tokens_meta[curr].delimiters) {
        processDelimiters(tokens_meta[curr].delimiters);
      }
    }
  }
  function fragments_join(state) {
    let curr, last2;
    let level = 0;
    const tokens = state.tokens;
    const max = state.tokens.length;
    for (curr = last2 = 0; curr < max; curr++) {
      if (tokens[curr].nesting < 0) level--;
      tokens[curr].level = level;
      if (tokens[curr].nesting > 0) level++;
      if (tokens[curr].type === "text" && curr + 1 < max && tokens[curr + 1].type === "text") {
        tokens[curr + 1].content = tokens[curr].content + tokens[curr + 1].content;
      } else {
        if (curr !== last2) {
          tokens[last2] = tokens[curr];
        }
        last2++;
      }
    }
    if (curr !== last2) {
      tokens.length = last2;
    }
  }
  const _rules = [
    ["text", text],
    ["linkify", linkify],
    ["newline", newline],
    ["escape", escape],
    ["backticks", backtick],
    ["strikethrough", r_strikethrough.tokenize],
    ["emphasis", r_emphasis.tokenize],
    ["link", link],
    ["image", image],
    ["autolink", autolink],
    ["html_inline", html_inline],
    ["entity", entity]
  ];
  const _rules2 = [
    ["balance_pairs", link_pairs],
    ["strikethrough", r_strikethrough.postProcess],
    ["emphasis", r_emphasis.postProcess],
    // rules for pairs separate '**' into its own text tokens, which may be left unused,
    // rule below merges unused segments back with the rest of the text
    ["fragments_join", fragments_join]
  ];
  function ParserInline() {
    this.ruler = new Ruler();
    for (let i = 0; i < _rules.length; i++) {
      this.ruler.push(_rules[i][0], _rules[i][1]);
    }
    this.ruler2 = new Ruler();
    for (let i = 0; i < _rules2.length; i++) {
      this.ruler2.push(_rules2[i][0], _rules2[i][1]);
    }
  }
  ParserInline.prototype.skipToken = function(state) {
    const pos = state.pos;
    const rules = this.ruler.getRules("");
    const len = rules.length;
    const maxNesting = state.md.options.maxNesting;
    const cache = state.cache;
    if (typeof cache[pos] !== "undefined") {
      state.pos = cache[pos];
      return;
    }
    let ok = false;
    if (state.level < maxNesting) {
      for (let i = 0; i < len; i++) {
        state.level++;
        ok = rules[i](state, true);
        state.level--;
        if (ok) {
          if (pos >= state.pos) {
            throw new Error("inline rule didn't increment state.pos");
          }
          break;
        }
      }
    } else {
      state.pos = state.posMax;
    }
    if (!ok) {
      state.pos++;
    }
    cache[pos] = state.pos;
  };
  ParserInline.prototype.tokenize = function(state) {
    const rules = this.ruler.getRules("");
    const len = rules.length;
    const end2 = state.posMax;
    const maxNesting = state.md.options.maxNesting;
    while (state.pos < end2) {
      const prevPos = state.pos;
      let ok = false;
      if (state.level < maxNesting) {
        for (let i = 0; i < len; i++) {
          ok = rules[i](state, false);
          if (ok) {
            if (prevPos >= state.pos) {
              throw new Error("inline rule didn't increment state.pos");
            }
            break;
          }
        }
      }
      if (ok) {
        if (state.pos >= end2) {
          break;
        }
        continue;
      }
      state.pending += state.src[state.pos++];
    }
    if (state.pending) {
      state.pushPending();
    }
  };
  ParserInline.prototype.parse = function(str, md, env, outTokens) {
    const state = new this.State(str, md, env, outTokens);
    this.tokenize(state);
    const rules = this.ruler2.getRules("");
    const len = rules.length;
    for (let i = 0; i < len; i++) {
      rules[i](state);
    }
  };
  ParserInline.prototype.State = StateInline;
  function reFactory(opts) {
    const re = {};
    opts = opts || {};
    re.src_Any = Any.source;
    re.src_Cc = Cc.source;
    re.src_Z = Z.source;
    re.src_P = P.source;
    re.src_ZPCc = [re.src_Z, re.src_P, re.src_Cc].join("|");
    re.src_ZCc = [re.src_Z, re.src_Cc].join("|");
    const text_separators = "[><｜]";
    re.src_pseudo_letter = "(?:(?!" + text_separators + "|" + re.src_ZPCc + ")" + re.src_Any + ")";
    re.src_ip4 = "(?:(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)";
    re.src_auth = "(?:(?:(?!" + re.src_ZCc + "|[@/\\[\\]()]).)+@)?";
    re.src_port = "(?::(?:6(?:[0-4]\\d{3}|5(?:[0-4]\\d{2}|5(?:[0-2]\\d|3[0-5])))|[1-5]?\\d{1,4}))?";
    re.src_host_terminator = "(?=$|" + text_separators + "|" + re.src_ZPCc + ")(?!" + (opts["---"] ? "-(?!--)|" : "-|") + "_|:\\d|\\.-|\\.(?!$|" + re.src_ZPCc + "))";
    re.src_path = "(?:[/?#](?:(?!" + re.src_ZCc + "|" + text_separators + `|[()[\\]{}.,"'?!\\-;]).|\\[(?:(?!` + re.src_ZCc + "|\\]).)*\\]|\\((?:(?!" + re.src_ZCc + "|[)]).)*\\)|\\{(?:(?!" + re.src_ZCc + '|[}]).)*\\}|\\"(?:(?!' + re.src_ZCc + `|["]).)+\\"|\\'(?:(?!` + re.src_ZCc + "|[']).)+\\'|\\'(?=" + re.src_pseudo_letter + "|[-])|\\.{2,}[a-zA-Z0-9%/&]|\\.(?!" + re.src_ZCc + "|[.]|$)|" + (opts["---"] ? "\\-(?!--(?:[^-]|$))(?:-*)|" : "\\-+|") + // allow `,,,` in paths
    ",(?!" + re.src_ZCc + "|$)|;(?!" + re.src_ZCc + "|$)|\\!+(?!" + re.src_ZCc + "|[!]|$)|\\?(?!" + re.src_ZCc + "|[?]|$))+|\\/)?";
    re.src_email_name = '[\\-;:&=\\+\\$,\\.a-zA-Z0-9_][\\-;:&=\\+\\$,\\"\\.a-zA-Z0-9_]*';
    re.src_xn = "xn--[a-z0-9\\-]{1,59}";
    re.src_domain_root = // Allow letters & digits (http://test1)
    "(?:" + re.src_xn + "|" + re.src_pseudo_letter + "{1,63})";
    re.src_domain = "(?:" + re.src_xn + "|(?:" + re.src_pseudo_letter + ")|(?:" + re.src_pseudo_letter + "(?:-|" + re.src_pseudo_letter + "){0,61}" + re.src_pseudo_letter + "))";
    re.src_host = "(?:(?:(?:(?:" + re.src_domain + ")\\.)*" + re.src_domain + "))";
    re.tpl_host_fuzzy = "(?:" + re.src_ip4 + "|(?:(?:(?:" + re.src_domain + ")\\.)+(?:%TLDS%)))";
    re.tpl_host_no_ip_fuzzy = "(?:(?:(?:" + re.src_domain + ")\\.)+(?:%TLDS%))";
    re.src_host_strict = re.src_host + re.src_host_terminator;
    re.tpl_host_fuzzy_strict = re.tpl_host_fuzzy + re.src_host_terminator;
    re.src_host_port_strict = re.src_host + re.src_port + re.src_host_terminator;
    re.tpl_host_port_fuzzy_strict = re.tpl_host_fuzzy + re.src_port + re.src_host_terminator;
    re.tpl_host_port_no_ip_fuzzy_strict = re.tpl_host_no_ip_fuzzy + re.src_port + re.src_host_terminator;
    re.tpl_host_fuzzy_test = "localhost|www\\.|\\.\\d{1,3}\\.|(?:\\.(?:%TLDS%)(?:" + re.src_ZPCc + "|>|$))";
    re.tpl_email_fuzzy = "(^|" + text_separators + '|"|\\(|' + re.src_ZCc + ")(" + re.src_email_name + "@" + re.tpl_host_fuzzy_strict + ")";
    re.tpl_link_fuzzy = // Fuzzy link can't be prepended with .:/\- and non punctuation.
    // but can start with > (markdown blockquote)
    "(^|(?![.:/\\-_@])(?:[$+<=>^`|｜]|" + re.src_ZPCc + "))((?![$+<=>^`|｜])" + re.tpl_host_port_fuzzy_strict + re.src_path + ")";
    re.tpl_link_no_ip_fuzzy = // Fuzzy link can't be prepended with .:/\- and non punctuation.
    // but can start with > (markdown blockquote)
    "(^|(?![.:/\\-_@])(?:[$+<=>^`|｜]|" + re.src_ZPCc + "))((?![$+<=>^`|｜])" + re.tpl_host_port_no_ip_fuzzy_strict + re.src_path + ")";
    return re;
  }
  function assign(obj) {
    const sources = Array.prototype.slice.call(arguments, 1);
    sources.forEach(function(source) {
      if (!source) {
        return;
      }
      Object.keys(source).forEach(function(key) {
        obj[key] = source[key];
      });
    });
    return obj;
  }
  function _class(obj) {
    return Object.prototype.toString.call(obj);
  }
  function isString(obj) {
    return _class(obj) === "[object String]";
  }
  function isObject(obj) {
    return _class(obj) === "[object Object]";
  }
  function isRegExp(obj) {
    return _class(obj) === "[object RegExp]";
  }
  function isFunction(obj) {
    return _class(obj) === "[object Function]";
  }
  function escapeRE(str) {
    return str.replace(/[.?*+^$[\]\\(){}|-]/g, "\\$&");
  }
  const defaultOptions = {
    fuzzyLink: true,
    fuzzyEmail: true,
    fuzzyIP: false
  };
  function isOptionsObj(obj) {
    return Object.keys(obj || {}).reduce(function(acc, k) {
      return acc || defaultOptions.hasOwnProperty(k);
    }, false);
  }
  const defaultSchemas = {
    "http:": {
      validate: function(text2, pos, self) {
        const tail = text2.slice(pos);
        if (!self.re.http) {
          self.re.http = new RegExp(
            "^\\/\\/" + self.re.src_auth + self.re.src_host_port_strict + self.re.src_path,
            "i"
          );
        }
        if (self.re.http.test(tail)) {
          return tail.match(self.re.http)[0].length;
        }
        return 0;
      }
    },
    "https:": "http:",
    "ftp:": "http:",
    "//": {
      validate: function(text2, pos, self) {
        const tail = text2.slice(pos);
        if (!self.re.no_http) {
          self.re.no_http = new RegExp(
            "^" + self.re.src_auth + // Don't allow single-level domains, because of false positives like '//test'
            // with code comments
            "(?:localhost|(?:(?:" + self.re.src_domain + ")\\.)+" + self.re.src_domain_root + ")" + self.re.src_port + self.re.src_host_terminator + self.re.src_path,
            "i"
          );
        }
        if (self.re.no_http.test(tail)) {
          if (pos >= 3 && text2[pos - 3] === ":") {
            return 0;
          }
          if (pos >= 3 && text2[pos - 3] === "/") {
            return 0;
          }
          return tail.match(self.re.no_http)[0].length;
        }
        return 0;
      }
    },
    "mailto:": {
      validate: function(text2, pos, self) {
        const tail = text2.slice(pos);
        if (!self.re.mailto) {
          self.re.mailto = new RegExp(
            "^" + self.re.src_email_name + "@" + self.re.src_host_strict,
            "i"
          );
        }
        if (self.re.mailto.test(tail)) {
          return tail.match(self.re.mailto)[0].length;
        }
        return 0;
      }
    }
  };
  const tlds_2ch_src_re = "a[cdefgilmnoqrstuwxz]|b[abdefghijmnorstvwyz]|c[acdfghiklmnoruvwxyz]|d[ejkmoz]|e[cegrstu]|f[ijkmor]|g[abdefghilmnpqrstuwy]|h[kmnrtu]|i[delmnoqrst]|j[emop]|k[eghimnprwyz]|l[abcikrstuvy]|m[acdeghklmnopqrstuvwxyz]|n[acefgilopruz]|om|p[aefghklmnrstwy]|qa|r[eosuw]|s[abcdeghijklmnortuvxyz]|t[cdfghjklmnortvwz]|u[agksyz]|v[aceginu]|w[fs]|y[et]|z[amw]";
  const tlds_default = "biz|com|edu|gov|net|org|pro|web|xxx|aero|asia|coop|info|museum|name|shop|рф".split("|");
  function resetScanCache(self) {
    self.__index__ = -1;
    self.__text_cache__ = "";
  }
  function createValidator(re) {
    return function(text2, pos) {
      const tail = text2.slice(pos);
      if (re.test(tail)) {
        return tail.match(re)[0].length;
      }
      return 0;
    };
  }
  function createNormalizer() {
    return function(match, self) {
      self.normalize(match);
    };
  }
  function compile(self) {
    const re = self.re = reFactory(self.__opts__);
    const tlds = self.__tlds__.slice();
    self.onCompile();
    if (!self.__tlds_replaced__) {
      tlds.push(tlds_2ch_src_re);
    }
    tlds.push(re.src_xn);
    re.src_tlds = tlds.join("|");
    function untpl(tpl) {
      return tpl.replace("%TLDS%", re.src_tlds);
    }
    re.email_fuzzy = RegExp(untpl(re.tpl_email_fuzzy), "i");
    re.link_fuzzy = RegExp(untpl(re.tpl_link_fuzzy), "i");
    re.link_no_ip_fuzzy = RegExp(untpl(re.tpl_link_no_ip_fuzzy), "i");
    re.host_fuzzy_test = RegExp(untpl(re.tpl_host_fuzzy_test), "i");
    const aliases2 = [];
    self.__compiled__ = {};
    function schemaError(name2, val2) {
      throw new Error('(LinkifyIt) Invalid schema "' + name2 + '": ' + val2);
    }
    Object.keys(self.__schemas__).forEach(function(name2) {
      const val2 = self.__schemas__[name2];
      if (val2 === null) {
        return;
      }
      const compiled = { validate: null, link: null };
      self.__compiled__[name2] = compiled;
      if (isObject(val2)) {
        if (isRegExp(val2.validate)) {
          compiled.validate = createValidator(val2.validate);
        } else if (isFunction(val2.validate)) {
          compiled.validate = val2.validate;
        } else {
          schemaError(name2, val2);
        }
        if (isFunction(val2.normalize)) {
          compiled.normalize = val2.normalize;
        } else if (!val2.normalize) {
          compiled.normalize = createNormalizer();
        } else {
          schemaError(name2, val2);
        }
        return;
      }
      if (isString(val2)) {
        aliases2.push(name2);
        return;
      }
      schemaError(name2, val2);
    });
    aliases2.forEach(function(alias) {
      if (!self.__compiled__[self.__schemas__[alias]]) {
        return;
      }
      self.__compiled__[alias].validate = self.__compiled__[self.__schemas__[alias]].validate;
      self.__compiled__[alias].normalize = self.__compiled__[self.__schemas__[alias]].normalize;
    });
    self.__compiled__[""] = { validate: null, normalize: createNormalizer() };
    const slist = Object.keys(self.__compiled__).filter(function(name2) {
      return name2.length > 0 && self.__compiled__[name2];
    }).map(escapeRE).join("|");
    self.re.schema_test = RegExp("(^|(?!_)(?:[><｜]|" + re.src_ZPCc + "))(" + slist + ")", "i");
    self.re.schema_search = RegExp("(^|(?!_)(?:[><｜]|" + re.src_ZPCc + "))(" + slist + ")", "ig");
    self.re.schema_at_start = RegExp("^" + self.re.schema_search.source, "i");
    self.re.pretest = RegExp(
      "(" + self.re.schema_test.source + ")|(" + self.re.host_fuzzy_test.source + ")|@",
      "i"
    );
    resetScanCache(self);
  }
  function Match(self, shift) {
    const start = self.__index__;
    const end2 = self.__last_index__;
    const text2 = self.__text_cache__.slice(start, end2);
    this.schema = self.__schema__.toLowerCase();
    this.index = start + shift;
    this.lastIndex = end2 + shift;
    this.raw = text2;
    this.text = text2;
    this.url = text2;
  }
  function createMatch(self, shift) {
    const match = new Match(self, shift);
    self.__compiled__[match.schema].normalize(match, self);
    return match;
  }
  function LinkifyIt(schemas2, options) {
    if (!(this instanceof LinkifyIt)) {
      return new LinkifyIt(schemas2, options);
    }
    if (!options) {
      if (isOptionsObj(schemas2)) {
        options = schemas2;
        schemas2 = {};
      }
    }
    this.__opts__ = assign({}, defaultOptions, options);
    this.__index__ = -1;
    this.__last_index__ = -1;
    this.__schema__ = "";
    this.__text_cache__ = "";
    this.__schemas__ = assign({}, defaultSchemas, schemas2);
    this.__compiled__ = {};
    this.__tlds__ = tlds_default;
    this.__tlds_replaced__ = false;
    this.re = {};
    compile(this);
  }
  LinkifyIt.prototype.add = function add2(schema2, definition) {
    this.__schemas__[schema2] = definition;
    compile(this);
    return this;
  };
  LinkifyIt.prototype.set = function set2(options) {
    this.__opts__ = assign(this.__opts__, options);
    return this;
  };
  LinkifyIt.prototype.test = function test(text2) {
    this.__text_cache__ = text2;
    this.__index__ = -1;
    if (!text2.length) {
      return false;
    }
    let m, ml, me, len, shift, next2, re, tld_pos, at_pos;
    if (this.re.schema_test.test(text2)) {
      re = this.re.schema_search;
      re.lastIndex = 0;
      while ((m = re.exec(text2)) !== null) {
        len = this.testSchemaAt(text2, m[2], re.lastIndex);
        if (len) {
          this.__schema__ = m[2];
          this.__index__ = m.index + m[1].length;
          this.__last_index__ = m.index + m[0].length + len;
          break;
        }
      }
    }
    if (this.__opts__.fuzzyLink && this.__compiled__["http:"]) {
      tld_pos = text2.search(this.re.host_fuzzy_test);
      if (tld_pos >= 0) {
        if (this.__index__ < 0 || tld_pos < this.__index__) {
          if ((ml = text2.match(this.__opts__.fuzzyIP ? this.re.link_fuzzy : this.re.link_no_ip_fuzzy)) !== null) {
            shift = ml.index + ml[1].length;
            if (this.__index__ < 0 || shift < this.__index__) {
              this.__schema__ = "";
              this.__index__ = shift;
              this.__last_index__ = ml.index + ml[0].length;
            }
          }
        }
      }
    }
    if (this.__opts__.fuzzyEmail && this.__compiled__["mailto:"]) {
      at_pos = text2.indexOf("@");
      if (at_pos >= 0) {
        if ((me = text2.match(this.re.email_fuzzy)) !== null) {
          shift = me.index + me[1].length;
          next2 = me.index + me[0].length;
          if (this.__index__ < 0 || shift < this.__index__ || shift === this.__index__ && next2 > this.__last_index__) {
            this.__schema__ = "mailto:";
            this.__index__ = shift;
            this.__last_index__ = next2;
          }
        }
      }
    }
    return this.__index__ >= 0;
  };
  LinkifyIt.prototype.pretest = function pretest(text2) {
    return this.re.pretest.test(text2);
  };
  LinkifyIt.prototype.testSchemaAt = function testSchemaAt(text2, schema2, pos) {
    if (!this.__compiled__[schema2.toLowerCase()]) {
      return 0;
    }
    return this.__compiled__[schema2.toLowerCase()].validate(text2, pos, this);
  };
  LinkifyIt.prototype.match = function match(text2) {
    const result = [];
    let shift = 0;
    if (this.__index__ >= 0 && this.__text_cache__ === text2) {
      result.push(createMatch(this, shift));
      shift = this.__last_index__;
    }
    let tail = shift ? text2.slice(shift) : text2;
    while (this.test(tail)) {
      result.push(createMatch(this, shift));
      tail = tail.slice(this.__last_index__);
      shift += this.__last_index__;
    }
    if (result.length) {
      return result;
    }
    return null;
  };
  LinkifyIt.prototype.matchAtStart = function matchAtStart(text2) {
    this.__text_cache__ = text2;
    this.__index__ = -1;
    if (!text2.length) return null;
    const m = this.re.schema_at_start.exec(text2);
    if (!m) return null;
    const len = this.testSchemaAt(text2, m[2], m[0].length);
    if (!len) return null;
    this.__schema__ = m[2];
    this.__index__ = m.index + m[1].length;
    this.__last_index__ = m.index + m[0].length + len;
    return createMatch(this, 0);
  };
  LinkifyIt.prototype.tlds = function tlds(list2, keepOld) {
    list2 = Array.isArray(list2) ? list2 : [list2];
    if (!keepOld) {
      this.__tlds__ = list2.slice();
      this.__tlds_replaced__ = true;
      compile(this);
      return this;
    }
    this.__tlds__ = this.__tlds__.concat(list2).sort().filter(function(el, idx, arr) {
      return el !== arr[idx - 1];
    }).reverse();
    compile(this);
    return this;
  };
  LinkifyIt.prototype.normalize = function normalize2(match) {
    if (!match.schema) {
      match.url = "http://" + match.url;
    }
    if (match.schema === "mailto:" && !/^mailto:/i.test(match.url)) {
      match.url = "mailto:" + match.url;
    }
  };
  LinkifyIt.prototype.onCompile = function onCompile() {
  };
  const maxInt = 2147483647;
  const base = 36;
  const tMin = 1;
  const tMax = 26;
  const skew = 38;
  const damp = 700;
  const initialBias = 72;
  const initialN = 128;
  const delimiter = "-";
  const regexPunycode = /^xn--/;
  const regexNonASCII = /[^\0-\x7F]/;
  const regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g;
  const errors = {
    "overflow": "Overflow: input needs wider integers to process",
    "not-basic": "Illegal input >= 0x80 (not a basic code point)",
    "invalid-input": "Invalid input"
  };
  const baseMinusTMin = base - tMin;
  const floor = Math.floor;
  const stringFromCharCode = String.fromCharCode;
  function error(type) {
    throw new RangeError(errors[type]);
  }
  function map$1(array, callback) {
    const result = [];
    let length = array.length;
    while (length--) {
      result[length] = callback(array[length]);
    }
    return result;
  }
  function mapDomain(domain, callback) {
    const parts = domain.split("@");
    let result = "";
    if (parts.length > 1) {
      result = parts[0] + "@";
      domain = parts[1];
    }
    domain = domain.replace(regexSeparators, ".");
    const labels = domain.split(".");
    const encoded = map$1(labels, callback).join(".");
    return result + encoded;
  }
  function ucs2decode(string2) {
    const output = [];
    let counter = 0;
    const length = string2.length;
    while (counter < length) {
      const value = string2.charCodeAt(counter++);
      if (value >= 55296 && value <= 56319 && counter < length) {
        const extra = string2.charCodeAt(counter++);
        if ((extra & 64512) == 56320) {
          output.push(((value & 1023) << 10) + (extra & 1023) + 65536);
        } else {
          output.push(value);
          counter--;
        }
      } else {
        output.push(value);
      }
    }
    return output;
  }
  const ucs2encode = (codePoints) => String.fromCodePoint(...codePoints);
  const basicToDigit = function(codePoint) {
    if (codePoint >= 48 && codePoint < 58) {
      return 26 + (codePoint - 48);
    }
    if (codePoint >= 65 && codePoint < 91) {
      return codePoint - 65;
    }
    if (codePoint >= 97 && codePoint < 123) {
      return codePoint - 97;
    }
    return base;
  };
  const digitToBasic = function(digit, flag) {
    return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
  };
  const adapt = function(delta, numPoints, firstTime) {
    let k = 0;
    delta = firstTime ? floor(delta / damp) : delta >> 1;
    delta += floor(delta / numPoints);
    for (; delta > baseMinusTMin * tMax >> 1; k += base) {
      delta = floor(delta / baseMinusTMin);
    }
    return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
  };
  const decode = function(input) {
    const output = [];
    const inputLength = input.length;
    let i = 0;
    let n = initialN;
    let bias = initialBias;
    let basic = input.lastIndexOf(delimiter);
    if (basic < 0) {
      basic = 0;
    }
    for (let j = 0; j < basic; ++j) {
      if (input.charCodeAt(j) >= 128) {
        error("not-basic");
      }
      output.push(input.charCodeAt(j));
    }
    for (let index2 = basic > 0 ? basic + 1 : 0; index2 < inputLength; ) {
      const oldi = i;
      for (let w = 1, k = base; ; k += base) {
        if (index2 >= inputLength) {
          error("invalid-input");
        }
        const digit = basicToDigit(input.charCodeAt(index2++));
        if (digit >= base) {
          error("invalid-input");
        }
        if (digit > floor((maxInt - i) / w)) {
          error("overflow");
        }
        i += digit * w;
        const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
        if (digit < t) {
          break;
        }
        const baseMinusT = base - t;
        if (w > floor(maxInt / baseMinusT)) {
          error("overflow");
        }
        w *= baseMinusT;
      }
      const out = output.length + 1;
      bias = adapt(i - oldi, out, oldi == 0);
      if (floor(i / out) > maxInt - n) {
        error("overflow");
      }
      n += floor(i / out);
      i %= out;
      output.splice(i++, 0, n);
    }
    return String.fromCodePoint(...output);
  };
  const encode = function(input) {
    const output = [];
    input = ucs2decode(input);
    const inputLength = input.length;
    let n = initialN;
    let delta = 0;
    let bias = initialBias;
    for (const currentValue of input) {
      if (currentValue < 128) {
        output.push(stringFromCharCode(currentValue));
      }
    }
    const basicLength = output.length;
    let handledCPCount = basicLength;
    if (basicLength) {
      output.push(delimiter);
    }
    while (handledCPCount < inputLength) {
      let m = maxInt;
      for (const currentValue of input) {
        if (currentValue >= n && currentValue < m) {
          m = currentValue;
        }
      }
      const handledCPCountPlusOne = handledCPCount + 1;
      if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
        error("overflow");
      }
      delta += (m - n) * handledCPCountPlusOne;
      n = m;
      for (const currentValue of input) {
        if (currentValue < n && ++delta > maxInt) {
          error("overflow");
        }
        if (currentValue === n) {
          let q = delta;
          for (let k = base; ; k += base) {
            const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
            if (q < t) {
              break;
            }
            const qMinusT = q - t;
            const baseMinusT = base - t;
            output.push(
              stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0))
            );
            q = floor(qMinusT / baseMinusT);
          }
          output.push(stringFromCharCode(digitToBasic(q, 0)));
          bias = adapt(delta, handledCPCountPlusOne, handledCPCount === basicLength);
          delta = 0;
          ++handledCPCount;
        }
      }
      ++delta;
      ++n;
    }
    return output.join("");
  };
  const toUnicode = function(input) {
    return mapDomain(input, function(string2) {
      return regexPunycode.test(string2) ? decode(string2.slice(4).toLowerCase()) : string2;
    });
  };
  const toASCII = function(input) {
    return mapDomain(input, function(string2) {
      return regexNonASCII.test(string2) ? "xn--" + encode(string2) : string2;
    });
  };
  const punycode = {
    /**
     * A string representing the current Punycode.js version number.
     * @memberOf punycode
     * @type String
     */
    "version": "2.3.1",
    /**
     * An object of methods to convert from JavaScript's internal character
     * representation (UCS-2) to Unicode code points, and back.
     * @see <https://mathiasbynens.be/notes/javascript-encoding>
     * @memberOf punycode
     * @type Object
     */
    "ucs2": {
      "decode": ucs2decode,
      "encode": ucs2encode
    },
    "decode": decode,
    "encode": encode,
    "toASCII": toASCII,
    "toUnicode": toUnicode
  };
  const cfg_default = {
    options: {
      // Enable HTML tags in source
      html: false,
      // Use '/' to close single tags (<br />)
      xhtmlOut: false,
      // Convert '\n' in paragraphs into <br>
      breaks: false,
      // CSS language prefix for fenced blocks
      langPrefix: "language-",
      // autoconvert URL-like texts to links
      linkify: false,
      // Enable some language-neutral replacements + quotes beautification
      typographer: false,
      // Double + single quotes replacement pairs, when typographer enabled,
      // and smartquotes on. Could be either a String or an Array.
      //
      // For example, you can use '«»„“' for Russian, '„“‚‘' for German,
      // and ['«\xA0', '\xA0»', '‹\xA0', '\xA0›'] for French (including nbsp).
      quotes: "“”‘’",
      /* “”‘’ */
      // Highlighter function. Should return escaped HTML,
      // or '' if the source string is not changed and should be escaped externaly.
      // If result starts with <pre... internal wrapper is skipped.
      //
      // function (/*str, lang*/) { return ''; }
      //
      highlight: null,
      // Internal protection, recursion limit
      maxNesting: 100
    },
    components: {
      core: {},
      block: {},
      inline: {}
    }
  };
  const cfg_zero = {
    options: {
      // Enable HTML tags in source
      html: false,
      // Use '/' to close single tags (<br />)
      xhtmlOut: false,
      // Convert '\n' in paragraphs into <br>
      breaks: false,
      // CSS language prefix for fenced blocks
      langPrefix: "language-",
      // autoconvert URL-like texts to links
      linkify: false,
      // Enable some language-neutral replacements + quotes beautification
      typographer: false,
      // Double + single quotes replacement pairs, when typographer enabled,
      // and smartquotes on. Could be either a String or an Array.
      //
      // For example, you can use '«»„“' for Russian, '„“‚‘' for German,
      // and ['«\xA0', '\xA0»', '‹\xA0', '\xA0›'] for French (including nbsp).
      quotes: "“”‘’",
      /* “”‘’ */
      // Highlighter function. Should return escaped HTML,
      // or '' if the source string is not changed and should be escaped externaly.
      // If result starts with <pre... internal wrapper is skipped.
      //
      // function (/*str, lang*/) { return ''; }
      //
      highlight: null,
      // Internal protection, recursion limit
      maxNesting: 20
    },
    components: {
      core: {
        rules: [
          "normalize",
          "block",
          "inline",
          "text_join"
        ]
      },
      block: {
        rules: [
          "paragraph"
        ]
      },
      inline: {
        rules: [
          "text"
        ],
        rules2: [
          "balance_pairs",
          "fragments_join"
        ]
      }
    }
  };
  const cfg_commonmark = {
    options: {
      // Enable HTML tags in source
      html: true,
      // Use '/' to close single tags (<br />)
      xhtmlOut: true,
      // Convert '\n' in paragraphs into <br>
      breaks: false,
      // CSS language prefix for fenced blocks
      langPrefix: "language-",
      // autoconvert URL-like texts to links
      linkify: false,
      // Enable some language-neutral replacements + quotes beautification
      typographer: false,
      // Double + single quotes replacement pairs, when typographer enabled,
      // and smartquotes on. Could be either a String or an Array.
      //
      // For example, you can use '«»„“' for Russian, '„“‚‘' for German,
      // and ['«\xA0', '\xA0»', '‹\xA0', '\xA0›'] for French (including nbsp).
      quotes: "“”‘’",
      /* “”‘’ */
      // Highlighter function. Should return escaped HTML,
      // or '' if the source string is not changed and should be escaped externaly.
      // If result starts with <pre... internal wrapper is skipped.
      //
      // function (/*str, lang*/) { return ''; }
      //
      highlight: null,
      // Internal protection, recursion limit
      maxNesting: 20
    },
    components: {
      core: {
        rules: [
          "normalize",
          "block",
          "inline",
          "text_join"
        ]
      },
      block: {
        rules: [
          "blockquote",
          "code",
          "fence",
          "heading",
          "hr",
          "html_block",
          "lheading",
          "list",
          "reference",
          "paragraph"
        ]
      },
      inline: {
        rules: [
          "autolink",
          "backticks",
          "emphasis",
          "entity",
          "escape",
          "html_inline",
          "image",
          "link",
          "newline",
          "text"
        ],
        rules2: [
          "balance_pairs",
          "emphasis",
          "fragments_join"
        ]
      }
    }
  };
  const config$2 = {
    default: cfg_default,
    zero: cfg_zero,
    commonmark: cfg_commonmark
  };
  const BAD_PROTO_RE = /^(vbscript|javascript|file|data):/;
  const GOOD_DATA_RE = /^data:image\/(gif|png|jpeg|webp);/;
  function validateLink(url) {
    const str = url.trim().toLowerCase();
    return BAD_PROTO_RE.test(str) ? GOOD_DATA_RE.test(str) : true;
  }
  const RECODE_HOSTNAME_FOR = ["http:", "https:", "mailto:"];
  function normalizeLink(url) {
    const parsed = urlParse(url, true);
    if (parsed.hostname) {
      if (!parsed.protocol || RECODE_HOSTNAME_FOR.indexOf(parsed.protocol) >= 0) {
        try {
          parsed.hostname = punycode.toASCII(parsed.hostname);
        } catch (er) {
        }
      }
    }
    return encode$1(format(parsed));
  }
  function normalizeLinkText(url) {
    const parsed = urlParse(url, true);
    if (parsed.hostname) {
      if (!parsed.protocol || RECODE_HOSTNAME_FOR.indexOf(parsed.protocol) >= 0) {
        try {
          parsed.hostname = punycode.toUnicode(parsed.hostname);
        } catch (er) {
        }
      }
    }
    return decode$1(format(parsed), decode$1.defaultChars + "%");
  }
  function MarkdownIt(presetName, options) {
    if (!(this instanceof MarkdownIt)) {
      return new MarkdownIt(presetName, options);
    }
    if (!options) {
      if (!isString$1(presetName)) {
        options = presetName || {};
        presetName = "default";
      }
    }
    this.inline = new ParserInline();
    this.block = new ParserBlock();
    this.core = new Core();
    this.renderer = new Renderer();
    this.linkify = new LinkifyIt();
    this.validateLink = validateLink;
    this.normalizeLink = normalizeLink;
    this.normalizeLinkText = normalizeLinkText;
    this.utils = utils;
    this.helpers = assign$1({}, helpers);
    this.options = {};
    this.configure(presetName);
    if (options) {
      this.set(options);
    }
  }
  MarkdownIt.prototype.set = function(options) {
    assign$1(this.options, options);
    return this;
  };
  MarkdownIt.prototype.configure = function(presets) {
    const self = this;
    if (isString$1(presets)) {
      const presetName = presets;
      presets = config$2[presetName];
      if (!presets) {
        throw new Error('Wrong `markdown-it` preset "' + presetName + '", check name');
      }
    }
    if (!presets) {
      throw new Error("Wrong `markdown-it` preset, can't be empty");
    }
    if (presets.options) {
      self.set(presets.options);
    }
    if (presets.components) {
      Object.keys(presets.components).forEach(function(name2) {
        if (presets.components[name2].rules) {
          self[name2].ruler.enableOnly(presets.components[name2].rules);
        }
        if (presets.components[name2].rules2) {
          self[name2].ruler2.enableOnly(presets.components[name2].rules2);
        }
      });
    }
    return this;
  };
  MarkdownIt.prototype.enable = function(list2, ignoreInvalid) {
    let result = [];
    if (!Array.isArray(list2)) {
      list2 = [list2];
    }
    ["core", "block", "inline"].forEach(function(chain) {
      result = result.concat(this[chain].ruler.enable(list2, true));
    }, this);
    result = result.concat(this.inline.ruler2.enable(list2, true));
    const missed = list2.filter(function(name2) {
      return result.indexOf(name2) < 0;
    });
    if (missed.length && !ignoreInvalid) {
      throw new Error("MarkdownIt. Failed to enable unknown rule(s): " + missed);
    }
    return this;
  };
  MarkdownIt.prototype.disable = function(list2, ignoreInvalid) {
    let result = [];
    if (!Array.isArray(list2)) {
      list2 = [list2];
    }
    ["core", "block", "inline"].forEach(function(chain) {
      result = result.concat(this[chain].ruler.disable(list2, true));
    }, this);
    result = result.concat(this.inline.ruler2.disable(list2, true));
    const missed = list2.filter(function(name2) {
      return result.indexOf(name2) < 0;
    });
    if (missed.length && !ignoreInvalid) {
      throw new Error("MarkdownIt. Failed to disable unknown rule(s): " + missed);
    }
    return this;
  };
  MarkdownIt.prototype.use = function(plugin2) {
    const args = [this].concat(Array.prototype.slice.call(arguments, 1));
    plugin2.apply(plugin2, args);
    return this;
  };
  MarkdownIt.prototype.parse = function(src, env) {
    if (typeof src !== "string") {
      throw new Error("Input data should be a String");
    }
    const state = new this.core.State(src, this, env);
    this.core.process(state);
    return state.tokens;
  };
  MarkdownIt.prototype.render = function(src, env) {
    env = env || {};
    return this.renderer.render(this.parse(src, env), this.options, env);
  };
  MarkdownIt.prototype.parseInline = function(src, env) {
    const state = new this.core.State(src, this, env);
    state.inlineMode = true;
    this.core.process(state);
    return state.tokens;
  };
  MarkdownIt.prototype.renderInline = function(src, env) {
    env = env || {};
    return this.renderer.render(this.parseInline(src, env), this.options, env);
  };
  function ins_plugin$1(md) {
    function tokenize(state, silent) {
      const start = state.pos;
      const marker = state.src.charCodeAt(start);
      if (silent) {
        return false;
      }
      if (marker !== 43) {
        return false;
      }
      const scanned = state.scanDelims(state.pos, true);
      let len = scanned.length;
      const ch = String.fromCharCode(marker);
      if (len < 2) {
        return false;
      }
      if (len % 2) {
        const token = state.push("text", "", 0);
        token.content = ch;
        len--;
      }
      for (let i = 0; i < len; i += 2) {
        const token = state.push("text", "", 0);
        token.content = ch + ch;
        if (!scanned.can_open && !scanned.can_close) {
          continue;
        }
        state.delimiters.push({
          marker,
          length: 0,
          // disable "rule of 3" length checks meant for emphasis
          jump: i / 2,
          // 1 delimiter = 2 characters
          token: state.tokens.length - 1,
          end: -1,
          open: scanned.can_open,
          close: scanned.can_close
        });
      }
      state.pos += scanned.length;
      return true;
    }
    function postProcess2(state, delimiters) {
      let token;
      const loneMarkers = [];
      const max = delimiters.length;
      for (let i = 0; i < max; i++) {
        const startDelim = delimiters[i];
        if (startDelim.marker !== 43) {
          continue;
        }
        if (startDelim.end === -1) {
          continue;
        }
        const endDelim = delimiters[startDelim.end];
        token = state.tokens[startDelim.token];
        token.type = "ins_open";
        token.tag = "ins";
        token.nesting = 1;
        token.markup = "++";
        token.content = "";
        token = state.tokens[endDelim.token];
        token.type = "ins_close";
        token.tag = "ins";
        token.nesting = -1;
        token.markup = "++";
        token.content = "";
        if (state.tokens[endDelim.token - 1].type === "text" && state.tokens[endDelim.token - 1].content === "+") {
          loneMarkers.push(endDelim.token - 1);
        }
      }
      while (loneMarkers.length) {
        const i = loneMarkers.pop();
        let j = i + 1;
        while (j < state.tokens.length && state.tokens[j].type === "ins_close") {
          j++;
        }
        j--;
        if (i !== j) {
          token = state.tokens[j];
          state.tokens[j] = state.tokens[i];
          state.tokens[i] = token;
        }
      }
    }
    md.inline.ruler.before("emphasis", "ins", tokenize);
    md.inline.ruler2.before("emphasis", "ins", function(state) {
      const tokens_meta = state.tokens_meta;
      const max = (state.tokens_meta || []).length;
      postProcess2(state, state.delimiters);
      for (let curr = 0; curr < max; curr++) {
        if (tokens_meta[curr] && tokens_meta[curr].delimiters) {
          postProcess2(state, tokens_meta[curr].delimiters);
        }
      }
    });
  }
  function ins_plugin(md) {
    function tokenize(state, silent) {
      const start = state.pos;
      const marker = state.src.charCodeAt(start);
      if (silent) {
        return false;
      }
      if (marker !== 61) {
        return false;
      }
      const scanned = state.scanDelims(state.pos, true);
      let len = scanned.length;
      const ch = String.fromCharCode(marker);
      if (len < 2) {
        return false;
      }
      if (len % 2) {
        const token = state.push("text", "", 0);
        token.content = ch;
        len--;
      }
      for (let i = 0; i < len; i += 2) {
        const token = state.push("text", "", 0);
        token.content = ch + ch;
        if (!scanned.can_open && !scanned.can_close) {
          continue;
        }
        state.delimiters.push({
          marker,
          length: 0,
          // disable "rule of 3" length checks meant for emphasis
          jump: i / 2,
          // 1 delimiter = 2 characters
          token: state.tokens.length - 1,
          end: -1,
          open: scanned.can_open,
          close: scanned.can_close
        });
      }
      state.pos += scanned.length;
      return true;
    }
    function postProcess2(state, delimiters) {
      const loneMarkers = [];
      const max = delimiters.length;
      for (let i = 0; i < max; i++) {
        const startDelim = delimiters[i];
        if (startDelim.marker !== 61) {
          continue;
        }
        if (startDelim.end === -1) {
          continue;
        }
        const endDelim = delimiters[startDelim.end];
        const token_o = state.tokens[startDelim.token];
        token_o.type = "mark_open";
        token_o.tag = "mark";
        token_o.nesting = 1;
        token_o.markup = "==";
        token_o.content = "";
        const token_c = state.tokens[endDelim.token];
        token_c.type = "mark_close";
        token_c.tag = "mark";
        token_c.nesting = -1;
        token_c.markup = "==";
        token_c.content = "";
        if (state.tokens[endDelim.token - 1].type === "text" && state.tokens[endDelim.token - 1].content === "=") {
          loneMarkers.push(endDelim.token - 1);
        }
      }
      while (loneMarkers.length) {
        const i = loneMarkers.pop();
        let j = i + 1;
        while (j < state.tokens.length && state.tokens[j].type === "mark_close") {
          j++;
        }
        j--;
        if (i !== j) {
          const token = state.tokens[j];
          state.tokens[j] = state.tokens[i];
          state.tokens[i] = token;
        }
      }
    }
    md.inline.ruler.before("emphasis", "mark", tokenize);
    md.inline.ruler2.before("emphasis", "mark", function(state) {
      let curr;
      const tokens_meta = state.tokens_meta;
      const max = (state.tokens_meta || []).length;
      postProcess2(state, state.delimiters);
      for (curr = 0; curr < max; curr++) {
        if (tokens_meta[curr] && tokens_meta[curr].delimiters) {
          postProcess2(state, tokens_meta[curr].delimiters);
        }
      }
    });
  }
  const UNESCAPE_RE$1 = /\\([ \\!"#$%&'()*+,./:;<=>?@[\]^_`{|}~-])/g;
  function subscript(state, silent) {
    const max = state.posMax;
    const start = state.pos;
    if (state.src.charCodeAt(start) !== 126) {
      return false;
    }
    if (silent) {
      return false;
    }
    if (start + 2 >= max) {
      return false;
    }
    state.pos = start + 1;
    let found = false;
    while (state.pos < max) {
      if (state.src.charCodeAt(state.pos) === 126) {
        found = true;
        break;
      }
      state.md.inline.skipToken(state);
    }
    if (!found || start + 1 === state.pos) {
      state.pos = start;
      return false;
    }
    const content = state.src.slice(start + 1, state.pos);
    if (content.match(/(^|[^\\])(\\\\)*\s/)) {
      state.pos = start;
      return false;
    }
    state.posMax = state.pos;
    state.pos = start + 1;
    const token_so = state.push("sub_open", "sub", 1);
    token_so.markup = "~";
    const token_t = state.push("text", "", 0);
    token_t.content = content.replace(UNESCAPE_RE$1, "$1");
    const token_sc = state.push("sub_close", "sub", -1);
    token_sc.markup = "~";
    state.pos = state.posMax + 1;
    state.posMax = max;
    return true;
  }
  function sub_plugin(md) {
    md.inline.ruler.after("emphasis", "sub", subscript);
  }
  const UNESCAPE_RE = /\\([ \\!"#$%&'()*+,./:;<=>?@[\]^_`{|}~-])/g;
  function superscript(state, silent) {
    const max = state.posMax;
    const start = state.pos;
    if (state.src.charCodeAt(start) !== 94) {
      return false;
    }
    if (silent) {
      return false;
    }
    if (start + 2 >= max) {
      return false;
    }
    state.pos = start + 1;
    let found = false;
    while (state.pos < max) {
      if (state.src.charCodeAt(state.pos) === 94) {
        found = true;
        break;
      }
      state.md.inline.skipToken(state);
    }
    if (!found || start + 1 === state.pos) {
      state.pos = start;
      return false;
    }
    const content = state.src.slice(start + 1, state.pos);
    if (content.match(/(^|[^\\])(\\\\)*\s/)) {
      state.pos = start;
      return false;
    }
    state.posMax = state.pos;
    state.pos = start + 1;
    const token_so = state.push("sup_open", "sup", 1);
    token_so.markup = "^";
    const token_t = state.push("text", "", 0);
    token_t.content = content.replace(UNESCAPE_RE, "$1");
    const token_sc = state.push("sup_close", "sup", -1);
    token_sc.markup = "^";
    state.pos = state.posMax + 1;
    state.posMax = max;
    return true;
  }
  function sup_plugin(md) {
    md.inline.ruler.after("emphasis", "sup", superscript);
  }
  function initializeMarkdownIt() {
    const md = MarkdownIt({
      html: true,
      breaks: true
    });
    md.use(ins_plugin$1).use(ins_plugin).use(sub_plugin).use(sup_plugin);
    return md;
  }
  function createTransformHooks(transformer) {
    return {
      transformer,
      parser: new Hook(),
      beforeParse: new Hook(),
      afterParse: new Hook(),
      retransform: new Hook()
    };
  }
  function definePlugin(plugin2) {
    return plugin2;
  }
  const svgMarked = '<svg width="16" height="16" viewBox="0 -3 24 24"><path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2m-9 14-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8z"/></svg>\n';
  const svgUnmarked = '<svg width="16" height="16" viewBox="0 -3 24 24"><path fill-rule="evenodd" d="M6 5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1zM3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-5z" clip-rule="evenodd"/></svg>\n';
  const name$5 = "checkbox";
  const images = {
    " ": svgUnmarked.trim(),
    x: svgMarked.trim()
  };
  const plugin$3 = definePlugin({
    name: name$5,
    transform(transformHooks) {
      transformHooks.parser.tap((md) => {
        md.core.ruler.before("inline", "checkbox", (state) => {
          for (let i = 2; i < state.tokens.length; i += 1) {
            const token = state.tokens[i];
            if (token.type === "inline" && token.content) {
              const prevType = state.tokens[i - 1].type;
              const prevPrevType = state.tokens[i - 2].type;
              if (prevType === "heading_open" || prevType === "paragraph_open" && prevPrevType === "list_item_open") {
                token.content = token.content.replace(
                  /^\[(.)\] /,
                  (m, g) => images[g] ? `${images[g]} ` : m
                );
              }
            }
          }
          return false;
        });
      });
      return {};
    }
  });
  const ALIAS = Symbol.for("yaml.alias");
  const DOC = Symbol.for("yaml.document");
  const MAP = Symbol.for("yaml.map");
  const PAIR = Symbol.for("yaml.pair");
  const SCALAR$1 = Symbol.for("yaml.scalar");
  const SEQ = Symbol.for("yaml.seq");
  const NODE_TYPE = Symbol.for("yaml.node.type");
  const isAlias = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === ALIAS;
  const isDocument = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === DOC;
  const isMap = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === MAP;
  const isPair = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === PAIR;
  const isScalar = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SCALAR$1;
  const isSeq = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SEQ;
  function isCollection(node) {
    if (node && typeof node === "object")
      switch (node[NODE_TYPE]) {
        case MAP:
        case SEQ:
          return true;
      }
    return false;
  }
  function isNode(node) {
    if (node && typeof node === "object")
      switch (node[NODE_TYPE]) {
        case ALIAS:
        case MAP:
        case SCALAR$1:
        case SEQ:
          return true;
      }
    return false;
  }
  const hasAnchor = (node) => (isScalar(node) || isCollection(node)) && !!node.anchor;
  const BREAK = Symbol("break visit");
  const SKIP = Symbol("skip children");
  const REMOVE = Symbol("remove node");
  function visit(node, visitor) {
    const visitor_ = initVisitor(visitor);
    if (isDocument(node)) {
      const cd = visit_(null, node.contents, visitor_, Object.freeze([node]));
      if (cd === REMOVE)
        node.contents = null;
    } else
      visit_(null, node, visitor_, Object.freeze([]));
  }
  visit.BREAK = BREAK;
  visit.SKIP = SKIP;
  visit.REMOVE = REMOVE;
  function visit_(key, node, visitor, path) {
    const ctrl = callVisitor(key, node, visitor, path);
    if (isNode(ctrl) || isPair(ctrl)) {
      replaceNode(key, path, ctrl);
      return visit_(key, ctrl, visitor, path);
    }
    if (typeof ctrl !== "symbol") {
      if (isCollection(node)) {
        path = Object.freeze(path.concat(node));
        for (let i = 0; i < node.items.length; ++i) {
          const ci = visit_(i, node.items[i], visitor, path);
          if (typeof ci === "number")
            i = ci - 1;
          else if (ci === BREAK)
            return BREAK;
          else if (ci === REMOVE) {
            node.items.splice(i, 1);
            i -= 1;
          }
        }
      } else if (isPair(node)) {
        path = Object.freeze(path.concat(node));
        const ck = visit_("key", node.key, visitor, path);
        if (ck === BREAK)
          return BREAK;
        else if (ck === REMOVE)
          node.key = null;
        const cv = visit_("value", node.value, visitor, path);
        if (cv === BREAK)
          return BREAK;
        else if (cv === REMOVE)
          node.value = null;
      }
    }
    return ctrl;
  }
  function initVisitor(visitor) {
    if (typeof visitor === "object" && (visitor.Collection || visitor.Node || visitor.Value)) {
      return Object.assign({
        Alias: visitor.Node,
        Map: visitor.Node,
        Scalar: visitor.Node,
        Seq: visitor.Node
      }, visitor.Value && {
        Map: visitor.Value,
        Scalar: visitor.Value,
        Seq: visitor.Value
      }, visitor.Collection && {
        Map: visitor.Collection,
        Seq: visitor.Collection
      }, visitor);
    }
    return visitor;
  }
  function callVisitor(key, node, visitor, path) {
    var _a2, _b, _c, _d, _e;
    if (typeof visitor === "function")
      return visitor(key, node, path);
    if (isMap(node))
      return (_a2 = visitor.Map) == null ? void 0 : _a2.call(visitor, key, node, path);
    if (isSeq(node))
      return (_b = visitor.Seq) == null ? void 0 : _b.call(visitor, key, node, path);
    if (isPair(node))
      return (_c = visitor.Pair) == null ? void 0 : _c.call(visitor, key, node, path);
    if (isScalar(node))
      return (_d = visitor.Scalar) == null ? void 0 : _d.call(visitor, key, node, path);
    if (isAlias(node))
      return (_e = visitor.Alias) == null ? void 0 : _e.call(visitor, key, node, path);
    return void 0;
  }
  function replaceNode(key, path, node) {
    const parent2 = path[path.length - 1];
    if (isCollection(parent2)) {
      parent2.items[key] = node;
    } else if (isPair(parent2)) {
      if (key === "key")
        parent2.key = node;
      else
        parent2.value = node;
    } else if (isDocument(parent2)) {
      parent2.contents = node;
    } else {
      const pt = isAlias(parent2) ? "alias" : "scalar";
      throw new Error(`Cannot replace node with ${pt} parent`);
    }
  }
  const escapeChars = {
    "!": "%21",
    ",": "%2C",
    "[": "%5B",
    "]": "%5D",
    "{": "%7B",
    "}": "%7D"
  };
  const escapeTagName = (tn) => tn.replace(/[!,[\]{}]/g, (ch) => escapeChars[ch]);
  class Directives {
    constructor(yaml, tags) {
      this.docStart = null;
      this.docEnd = false;
      this.yaml = Object.assign({}, Directives.defaultYaml, yaml);
      this.tags = Object.assign({}, Directives.defaultTags, tags);
    }
    clone() {
      const copy = new Directives(this.yaml, this.tags);
      copy.docStart = this.docStart;
      return copy;
    }
    /**
     * During parsing, get a Directives instance for the current document and
     * update the stream state according to the current version's spec.
     */
    atDocument() {
      const res = new Directives(this.yaml, this.tags);
      switch (this.yaml.version) {
        case "1.1":
          this.atNextDocument = true;
          break;
        case "1.2":
          this.atNextDocument = false;
          this.yaml = {
            explicit: Directives.defaultYaml.explicit,
            version: "1.2"
          };
          this.tags = Object.assign({}, Directives.defaultTags);
          break;
      }
      return res;
    }
    /**
     * @param onError - May be called even if the action was successful
     * @returns `true` on success
     */
    add(line, onError) {
      if (this.atNextDocument) {
        this.yaml = { explicit: Directives.defaultYaml.explicit, version: "1.1" };
        this.tags = Object.assign({}, Directives.defaultTags);
        this.atNextDocument = false;
      }
      const parts = line.trim().split(/[ \t]+/);
      const name2 = parts.shift();
      switch (name2) {
        case "%TAG": {
          if (parts.length !== 2) {
            onError(0, "%TAG directive should contain exactly two parts");
            if (parts.length < 2)
              return false;
          }
          const [handle, prefix] = parts;
          this.tags[handle] = prefix;
          return true;
        }
        case "%YAML": {
          this.yaml.explicit = true;
          if (parts.length !== 1) {
            onError(0, "%YAML directive should contain exactly one part");
            return false;
          }
          const [version] = parts;
          if (version === "1.1" || version === "1.2") {
            this.yaml.version = version;
            return true;
          } else {
            const isValid = /^\d+\.\d+$/.test(version);
            onError(6, `Unsupported YAML version ${version}`, isValid);
            return false;
          }
        }
        default:
          onError(0, `Unknown directive ${name2}`, true);
          return false;
      }
    }
    /**
     * Resolves a tag, matching handles to those defined in %TAG directives.
     *
     * @returns Resolved tag, which may also be the non-specific tag `'!'` or a
     *   `'!local'` tag, or `null` if unresolvable.
     */
    tagName(source, onError) {
      if (source === "!")
        return "!";
      if (source[0] !== "!") {
        onError(`Not a valid tag: ${source}`);
        return null;
      }
      if (source[1] === "<") {
        const verbatim = source.slice(2, -1);
        if (verbatim === "!" || verbatim === "!!") {
          onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
          return null;
        }
        if (source[source.length - 1] !== ">")
          onError("Verbatim tags must end with a >");
        return verbatim;
      }
      const [, handle, suffix] = source.match(/^(.*!)([^!]*)$/s);
      if (!suffix)
        onError(`The ${source} tag has no suffix`);
      const prefix = this.tags[handle];
      if (prefix) {
        try {
          return prefix + decodeURIComponent(suffix);
        } catch (error2) {
          onError(String(error2));
          return null;
        }
      }
      if (handle === "!")
        return source;
      onError(`Could not resolve tag: ${source}`);
      return null;
    }
    /**
     * Given a fully resolved tag, returns its printable string form,
     * taking into account current tag prefixes and defaults.
     */
    tagString(tag) {
      for (const [handle, prefix] of Object.entries(this.tags)) {
        if (tag.startsWith(prefix))
          return handle + escapeTagName(tag.substring(prefix.length));
      }
      return tag[0] === "!" ? tag : `!<${tag}>`;
    }
    toString(doc) {
      const lines = this.yaml.explicit ? [`%YAML ${this.yaml.version || "1.2"}`] : [];
      const tagEntries = Object.entries(this.tags);
      let tagNames;
      if (doc && tagEntries.length > 0 && isNode(doc.contents)) {
        const tags = {};
        visit(doc.contents, (_key, node) => {
          if (isNode(node) && node.tag)
            tags[node.tag] = true;
        });
        tagNames = Object.keys(tags);
      } else
        tagNames = [];
      for (const [handle, prefix] of tagEntries) {
        if (handle === "!!" && prefix === "tag:yaml.org,2002:")
          continue;
        if (!doc || tagNames.some((tn) => tn.startsWith(prefix)))
          lines.push(`%TAG ${handle} ${prefix}`);
      }
      return lines.join("\n");
    }
  }
  Directives.defaultYaml = { explicit: false, version: "1.2" };
  Directives.defaultTags = { "!!": "tag:yaml.org,2002:" };
  function anchorIsValid(anchor) {
    if (/[\x00-\x19\s,[\]{}]/.test(anchor)) {
      const sa = JSON.stringify(anchor);
      const msg = `Anchor must not contain whitespace or control characters: ${sa}`;
      throw new Error(msg);
    }
    return true;
  }
  function anchorNames(root2) {
    const anchors = /* @__PURE__ */ new Set();
    visit(root2, {
      Value(_key, node) {
        if (node.anchor)
          anchors.add(node.anchor);
      }
    });
    return anchors;
  }
  function findNewAnchor(prefix, exclude) {
    for (let i = 1; true; ++i) {
      const name2 = `${prefix}${i}`;
      if (!exclude.has(name2))
        return name2;
    }
  }
  function createNodeAnchors(doc, prefix) {
    const aliasObjects = [];
    const sourceObjects = /* @__PURE__ */ new Map();
    let prevAnchors = null;
    return {
      onAnchor: (source) => {
        aliasObjects.push(source);
        if (!prevAnchors)
          prevAnchors = anchorNames(doc);
        const anchor = findNewAnchor(prefix, prevAnchors);
        prevAnchors.add(anchor);
        return anchor;
      },
      /**
       * With circular references, the source node is only resolved after all
       * of its child nodes are. This is why anchors are set only after all of
       * the nodes have been created.
       */
      setAnchors: () => {
        for (const source of aliasObjects) {
          const ref = sourceObjects.get(source);
          if (typeof ref === "object" && ref.anchor && (isScalar(ref.node) || isCollection(ref.node))) {
            ref.node.anchor = ref.anchor;
          } else {
            const error2 = new Error("Failed to resolve repeated object (this should not happen)");
            error2.source = source;
            throw error2;
          }
        }
      },
      sourceObjects
    };
  }
  function applyReviver(reviver, obj, key, val2) {
    if (val2 && typeof val2 === "object") {
      if (Array.isArray(val2)) {
        for (let i = 0, len = val2.length; i < len; ++i) {
          const v0 = val2[i];
          const v1 = applyReviver(reviver, val2, String(i), v0);
          if (v1 === void 0)
            delete val2[i];
          else if (v1 !== v0)
            val2[i] = v1;
        }
      } else if (val2 instanceof Map) {
        for (const k of Array.from(val2.keys())) {
          const v0 = val2.get(k);
          const v1 = applyReviver(reviver, val2, k, v0);
          if (v1 === void 0)
            val2.delete(k);
          else if (v1 !== v0)
            val2.set(k, v1);
        }
      } else if (val2 instanceof Set) {
        for (const v0 of Array.from(val2)) {
          const v1 = applyReviver(reviver, val2, v0, v0);
          if (v1 === void 0)
            val2.delete(v0);
          else if (v1 !== v0) {
            val2.delete(v0);
            val2.add(v1);
          }
        }
      } else {
        for (const [k, v0] of Object.entries(val2)) {
          const v1 = applyReviver(reviver, val2, k, v0);
          if (v1 === void 0)
            delete val2[k];
          else if (v1 !== v0)
            val2[k] = v1;
        }
      }
    }
    return reviver.call(obj, key, val2);
  }
  function toJS(value, arg, ctx) {
    if (Array.isArray(value))
      return value.map((v, i) => toJS(v, String(i), ctx));
    if (value && typeof value.toJSON === "function") {
      if (!ctx || !hasAnchor(value))
        return value.toJSON(arg, ctx);
      const data2 = { aliasCount: 0, count: 1, res: void 0 };
      ctx.anchors.set(value, data2);
      ctx.onCreate = (res2) => {
        data2.res = res2;
        delete ctx.onCreate;
      };
      const res = value.toJSON(arg, ctx);
      if (ctx.onCreate)
        ctx.onCreate(res);
      return res;
    }
    if (typeof value === "bigint" && !(ctx == null ? void 0 : ctx.keep))
      return Number(value);
    return value;
  }
  class NodeBase {
    constructor(type) {
      Object.defineProperty(this, NODE_TYPE, { value: type });
    }
    /** Create a copy of this node.  */
    clone() {
      const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
      if (this.range)
        copy.range = this.range.slice();
      return copy;
    }
    /** A plain JavaScript representation of this node. */
    toJS(doc, { mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
      if (!isDocument(doc))
        throw new TypeError("A document argument is required");
      const ctx = {
        anchors: /* @__PURE__ */ new Map(),
        doc,
        keep: true,
        mapAsMap: mapAsMap === true,
        mapKeyWarned: false,
        maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
      };
      const res = toJS(this, "", ctx);
      if (typeof onAnchor === "function")
        for (const { count, res: res2 } of ctx.anchors.values())
          onAnchor(res2, count);
      return typeof reviver === "function" ? applyReviver(reviver, { "": res }, "", res) : res;
    }
  }
  class Alias extends NodeBase {
    constructor(source) {
      super(ALIAS);
      this.source = source;
      Object.defineProperty(this, "tag", {
        set() {
          throw new Error("Alias nodes cannot have tags");
        }
      });
    }
    /**
     * Resolve the value of this alias within `doc`, finding the last
     * instance of the `source` anchor before this node.
     */
    resolve(doc) {
      let found = void 0;
      visit(doc, {
        Node: (_key, node) => {
          if (node === this)
            return visit.BREAK;
          if (node.anchor === this.source)
            found = node;
        }
      });
      return found;
    }
    toJSON(_arg, ctx) {
      if (!ctx)
        return { source: this.source };
      const { anchors, doc, maxAliasCount } = ctx;
      const source = this.resolve(doc);
      if (!source) {
        const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
        throw new ReferenceError(msg);
      }
      let data2 = anchors.get(source);
      if (!data2) {
        toJS(source, null, ctx);
        data2 = anchors.get(source);
      }
      if (!data2 || data2.res === void 0) {
        const msg = "This should not happen: Alias anchor was not resolved?";
        throw new ReferenceError(msg);
      }
      if (maxAliasCount >= 0) {
        data2.count += 1;
        if (data2.aliasCount === 0)
          data2.aliasCount = getAliasCount(doc, source, anchors);
        if (data2.count * data2.aliasCount > maxAliasCount) {
          const msg = "Excessive alias count indicates a resource exhaustion attack";
          throw new ReferenceError(msg);
        }
      }
      return data2.res;
    }
    toString(ctx, _onComment, _onChompKeep) {
      const src = `*${this.source}`;
      if (ctx) {
        anchorIsValid(this.source);
        if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
          const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
          throw new Error(msg);
        }
        if (ctx.implicitKey)
          return `${src} `;
      }
      return src;
    }
  }
  function getAliasCount(doc, node, anchors) {
    if (isAlias(node)) {
      const source = node.resolve(doc);
      const anchor = anchors && source && anchors.get(source);
      return anchor ? anchor.count * anchor.aliasCount : 0;
    } else if (isCollection(node)) {
      let count = 0;
      for (const item of node.items) {
        const c = getAliasCount(doc, item, anchors);
        if (c > count)
          count = c;
      }
      return count;
    } else if (isPair(node)) {
      const kc = getAliasCount(doc, node.key, anchors);
      const vc = getAliasCount(doc, node.value, anchors);
      return Math.max(kc, vc);
    }
    return 1;
  }
  const isScalarValue = (value) => !value || typeof value !== "function" && typeof value !== "object";
  class Scalar extends NodeBase {
    constructor(value) {
      super(SCALAR$1);
      this.value = value;
    }
    toJSON(arg, ctx) {
      return (ctx == null ? void 0 : ctx.keep) ? this.value : toJS(this.value, arg, ctx);
    }
    toString() {
      return String(this.value);
    }
  }
  Scalar.BLOCK_FOLDED = "BLOCK_FOLDED";
  Scalar.BLOCK_LITERAL = "BLOCK_LITERAL";
  Scalar.PLAIN = "PLAIN";
  Scalar.QUOTE_DOUBLE = "QUOTE_DOUBLE";
  Scalar.QUOTE_SINGLE = "QUOTE_SINGLE";
  const defaultTagPrefix = "tag:yaml.org,2002:";
  function findTagObject(value, tagName, tags) {
    if (tagName) {
      const match = tags.filter((t) => t.tag === tagName);
      const tagObj = match.find((t) => !t.format) ?? match[0];
      if (!tagObj)
        throw new Error(`Tag ${tagName} not found`);
      return tagObj;
    }
    return tags.find((t) => {
      var _a2;
      return ((_a2 = t.identify) == null ? void 0 : _a2.call(t, value)) && !t.format;
    });
  }
  function createNode(value, tagName, ctx) {
    var _a2, _b, _c;
    if (isDocument(value))
      value = value.contents;
    if (isNode(value))
      return value;
    if (isPair(value)) {
      const map2 = (_b = (_a2 = ctx.schema[MAP]).createNode) == null ? void 0 : _b.call(_a2, ctx.schema, null, ctx);
      map2.items.push(value);
      return map2;
    }
    if (value instanceof String || value instanceof Number || value instanceof Boolean || typeof BigInt !== "undefined" && value instanceof BigInt) {
      value = value.valueOf();
    }
    const { aliasDuplicateObjects, onAnchor, onTagObj, schema: schema2, sourceObjects } = ctx;
    let ref = void 0;
    if (aliasDuplicateObjects && value && typeof value === "object") {
      ref = sourceObjects.get(value);
      if (ref) {
        if (!ref.anchor)
          ref.anchor = onAnchor(value);
        return new Alias(ref.anchor);
      } else {
        ref = { anchor: null, node: null };
        sourceObjects.set(value, ref);
      }
    }
    if (tagName == null ? void 0 : tagName.startsWith("!!"))
      tagName = defaultTagPrefix + tagName.slice(2);
    let tagObj = findTagObject(value, tagName, schema2.tags);
    if (!tagObj) {
      if (value && typeof value.toJSON === "function") {
        value = value.toJSON();
      }
      if (!value || typeof value !== "object") {
        const node2 = new Scalar(value);
        if (ref)
          ref.node = node2;
        return node2;
      }
      tagObj = value instanceof Map ? schema2[MAP] : Symbol.iterator in Object(value) ? schema2[SEQ] : schema2[MAP];
    }
    if (onTagObj) {
      onTagObj(tagObj);
      delete ctx.onTagObj;
    }
    const node = (tagObj == null ? void 0 : tagObj.createNode) ? tagObj.createNode(ctx.schema, value, ctx) : typeof ((_c = tagObj == null ? void 0 : tagObj.nodeClass) == null ? void 0 : _c.from) === "function" ? tagObj.nodeClass.from(ctx.schema, value, ctx) : new Scalar(value);
    if (tagName)
      node.tag = tagName;
    else if (!tagObj.default)
      node.tag = tagObj.tag;
    if (ref)
      ref.node = node;
    return node;
  }
  function collectionFromPath(schema2, path, value) {
    let v = value;
    for (let i = path.length - 1; i >= 0; --i) {
      const k = path[i];
      if (typeof k === "number" && Number.isInteger(k) && k >= 0) {
        const a = [];
        a[k] = v;
        v = a;
      } else {
        v = /* @__PURE__ */ new Map([[k, v]]);
      }
    }
    return createNode(v, void 0, {
      aliasDuplicateObjects: false,
      keepUndefined: false,
      onAnchor: () => {
        throw new Error("This should not happen, please report a bug.");
      },
      schema: schema2,
      sourceObjects: /* @__PURE__ */ new Map()
    });
  }
  const isEmptyPath = (path) => path == null || typeof path === "object" && !!path[Symbol.iterator]().next().done;
  class Collection extends NodeBase {
    constructor(type, schema2) {
      super(type);
      Object.defineProperty(this, "schema", {
        value: schema2,
        configurable: true,
        enumerable: false,
        writable: true
      });
    }
    /**
     * Create a copy of this collection.
     *
     * @param schema - If defined, overwrites the original's schema
     */
    clone(schema2) {
      const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
      if (schema2)
        copy.schema = schema2;
      copy.items = copy.items.map((it) => isNode(it) || isPair(it) ? it.clone(schema2) : it);
      if (this.range)
        copy.range = this.range.slice();
      return copy;
    }
    /**
     * Adds a value to the collection. For `!!map` and `!!omap` the value must
     * be a Pair instance or a `{ key, value }` object, which may not have a key
     * that already exists in the map.
     */
    addIn(path, value) {
      if (isEmptyPath(path))
        this.add(value);
      else {
        const [key, ...rest] = path;
        const node = this.get(key, true);
        if (isCollection(node))
          node.addIn(rest, value);
        else if (node === void 0 && this.schema)
          this.set(key, collectionFromPath(this.schema, rest, value));
        else
          throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
      }
    }
    /**
     * Removes a value from the collection.
     * @returns `true` if the item was found and removed.
     */
    deleteIn(path) {
      const [key, ...rest] = path;
      if (rest.length === 0)
        return this.delete(key);
      const node = this.get(key, true);
      if (isCollection(node))
        return node.deleteIn(rest);
      else
        throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
    }
    /**
     * Returns item at `key`, or `undefined` if not found. By default unwraps
     * scalar values from their surrounding node; to disable set `keepScalar` to
     * `true` (collections are always returned intact).
     */
    getIn(path, keepScalar) {
      const [key, ...rest] = path;
      const node = this.get(key, true);
      if (rest.length === 0)
        return !keepScalar && isScalar(node) ? node.value : node;
      else
        return isCollection(node) ? node.getIn(rest, keepScalar) : void 0;
    }
    hasAllNullValues(allowScalar) {
      return this.items.every((node) => {
        if (!isPair(node))
          return false;
        const n = node.value;
        return n == null || allowScalar && isScalar(n) && n.value == null && !n.commentBefore && !n.comment && !n.tag;
      });
    }
    /**
     * Checks if the collection includes a value with the key `key`.
     */
    hasIn(path) {
      const [key, ...rest] = path;
      if (rest.length === 0)
        return this.has(key);
      const node = this.get(key, true);
      return isCollection(node) ? node.hasIn(rest) : false;
    }
    /**
     * Sets a value in this collection. For `!!set`, `value` needs to be a
     * boolean to add/remove the item from the set.
     */
    setIn(path, value) {
      const [key, ...rest] = path;
      if (rest.length === 0) {
        this.set(key, value);
      } else {
        const node = this.get(key, true);
        if (isCollection(node))
          node.setIn(rest, value);
        else if (node === void 0 && this.schema)
          this.set(key, collectionFromPath(this.schema, rest, value));
        else
          throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
      }
    }
  }
  const stringifyComment = (str) => str.replace(/^(?!$)(?: $)?/gm, "#");
  function indentComment(comment2, indent) {
    if (/^\n+$/.test(comment2))
      return comment2.substring(1);
    return indent ? comment2.replace(/^(?! *$)/gm, indent) : comment2;
  }
  const lineComment = (str, indent, comment2) => str.endsWith("\n") ? indentComment(comment2, indent) : comment2.includes("\n") ? "\n" + indentComment(comment2, indent) : (str.endsWith(" ") ? "" : " ") + comment2;
  const FOLD_FLOW = "flow";
  const FOLD_BLOCK = "block";
  const FOLD_QUOTED = "quoted";
  function foldFlowLines(text2, indent, mode = "flow", { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {}) {
    if (!lineWidth || lineWidth < 0)
      return text2;
    if (lineWidth < minContentWidth)
      minContentWidth = 0;
    const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
    if (text2.length <= endStep)
      return text2;
    const folds = [];
    const escapedFolds = {};
    let end2 = lineWidth - indent.length;
    if (typeof indentAtStart === "number") {
      if (indentAtStart > lineWidth - Math.max(2, minContentWidth))
        folds.push(0);
      else
        end2 = lineWidth - indentAtStart;
    }
    let split = void 0;
    let prev2 = void 0;
    let overflow = false;
    let i = -1;
    let escStart = -1;
    let escEnd = -1;
    if (mode === FOLD_BLOCK) {
      i = consumeMoreIndentedLines(text2, i, indent.length);
      if (i !== -1)
        end2 = i + endStep;
    }
    for (let ch; ch = text2[i += 1]; ) {
      if (mode === FOLD_QUOTED && ch === "\\") {
        escStart = i;
        switch (text2[i + 1]) {
          case "x":
            i += 3;
            break;
          case "u":
            i += 5;
            break;
          case "U":
            i += 9;
            break;
          default:
            i += 1;
        }
        escEnd = i;
      }
      if (ch === "\n") {
        if (mode === FOLD_BLOCK)
          i = consumeMoreIndentedLines(text2, i, indent.length);
        end2 = i + indent.length + endStep;
        split = void 0;
      } else {
        if (ch === " " && prev2 && prev2 !== " " && prev2 !== "\n" && prev2 !== "	") {
          const next2 = text2[i + 1];
          if (next2 && next2 !== " " && next2 !== "\n" && next2 !== "	")
            split = i;
        }
        if (i >= end2) {
          if (split) {
            folds.push(split);
            end2 = split + endStep;
            split = void 0;
          } else if (mode === FOLD_QUOTED) {
            while (prev2 === " " || prev2 === "	") {
              prev2 = ch;
              ch = text2[i += 1];
              overflow = true;
            }
            const j = i > escEnd + 1 ? i - 2 : escStart - 1;
            if (escapedFolds[j])
              return text2;
            folds.push(j);
            escapedFolds[j] = true;
            end2 = j + endStep;
            split = void 0;
          } else {
            overflow = true;
          }
        }
      }
      prev2 = ch;
    }
    if (overflow && onOverflow)
      onOverflow();
    if (folds.length === 0)
      return text2;
    if (onFold)
      onFold();
    let res = text2.slice(0, folds[0]);
    for (let i2 = 0; i2 < folds.length; ++i2) {
      const fold = folds[i2];
      const end3 = folds[i2 + 1] || text2.length;
      if (fold === 0)
        res = `
${indent}${text2.slice(0, end3)}`;
      else {
        if (mode === FOLD_QUOTED && escapedFolds[fold])
          res += `${text2[fold]}\\`;
        res += `
${indent}${text2.slice(fold + 1, end3)}`;
      }
    }
    return res;
  }
  function consumeMoreIndentedLines(text2, i, indent) {
    let end2 = i;
    let start = i + 1;
    let ch = text2[start];
    while (ch === " " || ch === "	") {
      if (i < start + indent) {
        ch = text2[++i];
      } else {
        do {
          ch = text2[++i];
        } while (ch && ch !== "\n");
        end2 = i;
        start = i + 1;
        ch = text2[start];
      }
    }
    return end2;
  }
  const getFoldOptions = (ctx, isBlock2) => ({
    indentAtStart: isBlock2 ? ctx.indent.length : ctx.indentAtStart,
    lineWidth: ctx.options.lineWidth,
    minContentWidth: ctx.options.minContentWidth
  });
  const containsDocumentMarker = (str) => /^(%|---|\.\.\.)/m.test(str);
  function lineLengthOverLimit(str, lineWidth, indentLength) {
    if (!lineWidth || lineWidth < 0)
      return false;
    const limit = lineWidth - indentLength;
    const strLen = str.length;
    if (strLen <= limit)
      return false;
    for (let i = 0, start = 0; i < strLen; ++i) {
      if (str[i] === "\n") {
        if (i - start > limit)
          return true;
        start = i + 1;
        if (strLen - start <= limit)
          return false;
      }
    }
    return true;
  }
  function doubleQuotedString(value, ctx) {
    const json = JSON.stringify(value);
    if (ctx.options.doubleQuotedAsJSON)
      return json;
    const { implicitKey } = ctx;
    const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
    const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
    let str = "";
    let start = 0;
    for (let i = 0, ch = json[i]; ch; ch = json[++i]) {
      if (ch === " " && json[i + 1] === "\\" && json[i + 2] === "n") {
        str += json.slice(start, i) + "\\ ";
        i += 1;
        start = i;
        ch = "\\";
      }
      if (ch === "\\")
        switch (json[i + 1]) {
          case "u":
            {
              str += json.slice(start, i);
              const code2 = json.substr(i + 2, 4);
              switch (code2) {
                case "0000":
                  str += "\\0";
                  break;
                case "0007":
                  str += "\\a";
                  break;
                case "000b":
                  str += "\\v";
                  break;
                case "001b":
                  str += "\\e";
                  break;
                case "0085":
                  str += "\\N";
                  break;
                case "00a0":
                  str += "\\_";
                  break;
                case "2028":
                  str += "\\L";
                  break;
                case "2029":
                  str += "\\P";
                  break;
                default:
                  if (code2.substr(0, 2) === "00")
                    str += "\\x" + code2.substr(2);
                  else
                    str += json.substr(i, 6);
              }
              i += 5;
              start = i + 1;
            }
            break;
          case "n":
            if (implicitKey || json[i + 2] === '"' || json.length < minMultiLineLength) {
              i += 1;
            } else {
              str += json.slice(start, i) + "\n\n";
              while (json[i + 2] === "\\" && json[i + 3] === "n" && json[i + 4] !== '"') {
                str += "\n";
                i += 2;
              }
              str += indent;
              if (json[i + 2] === " ")
                str += "\\";
              i += 1;
              start = i + 1;
            }
            break;
          default:
            i += 1;
        }
    }
    str = start ? str + json.slice(start) : json;
    return implicitKey ? str : foldFlowLines(str, indent, FOLD_QUOTED, getFoldOptions(ctx, false));
  }
  function singleQuotedString(value, ctx) {
    if (ctx.options.singleQuote === false || ctx.implicitKey && value.includes("\n") || /[ \t]\n|\n[ \t]/.test(value))
      return doubleQuotedString(value, ctx);
    const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
    const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, `$&
${indent}`) + "'";
    return ctx.implicitKey ? res : foldFlowLines(res, indent, FOLD_FLOW, getFoldOptions(ctx, false));
  }
  function quotedString(value, ctx) {
    const { singleQuote } = ctx.options;
    let qs;
    if (singleQuote === false)
      qs = doubleQuotedString;
    else {
      const hasDouble = value.includes('"');
      const hasSingle = value.includes("'");
      if (hasDouble && !hasSingle)
        qs = singleQuotedString;
      else if (hasSingle && !hasDouble)
        qs = doubleQuotedString;
      else
        qs = singleQuote ? singleQuotedString : doubleQuotedString;
    }
    return qs(value, ctx);
  }
  let blockEndNewlines;
  try {
    blockEndNewlines = new RegExp("(^|(?<!\n))\n+(?!\n|$)", "g");
  } catch {
    blockEndNewlines = /\n+(?!\n|$)/g;
  }
  function blockString({ comment: comment2, type, value }, ctx, onComment, onChompKeep) {
    const { blockQuote, commentString, lineWidth } = ctx.options;
    if (!blockQuote || /\n[\t ]+$/.test(value) || /^\s*$/.test(value)) {
      return quotedString(value, ctx);
    }
    const indent = ctx.indent || (ctx.forceBlockIndent || containsDocumentMarker(value) ? "  " : "");
    const literal = blockQuote === "literal" ? true : blockQuote === "folded" || type === Scalar.BLOCK_FOLDED ? false : type === Scalar.BLOCK_LITERAL ? true : !lineLengthOverLimit(value, lineWidth, indent.length);
    if (!value)
      return literal ? "|\n" : ">\n";
    let chomp;
    let endStart;
    for (endStart = value.length; endStart > 0; --endStart) {
      const ch = value[endStart - 1];
      if (ch !== "\n" && ch !== "	" && ch !== " ")
        break;
    }
    let end2 = value.substring(endStart);
    const endNlPos = end2.indexOf("\n");
    if (endNlPos === -1) {
      chomp = "-";
    } else if (value === end2 || endNlPos !== end2.length - 1) {
      chomp = "+";
      if (onChompKeep)
        onChompKeep();
    } else {
      chomp = "";
    }
    if (end2) {
      value = value.slice(0, -end2.length);
      if (end2[end2.length - 1] === "\n")
        end2 = end2.slice(0, -1);
      end2 = end2.replace(blockEndNewlines, `$&${indent}`);
    }
    let startWithSpace = false;
    let startEnd;
    let startNlPos = -1;
    for (startEnd = 0; startEnd < value.length; ++startEnd) {
      const ch = value[startEnd];
      if (ch === " ")
        startWithSpace = true;
      else if (ch === "\n")
        startNlPos = startEnd;
      else
        break;
    }
    let start = value.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
    if (start) {
      value = value.substring(start.length);
      start = start.replace(/\n+/g, `$&${indent}`);
    }
    const indentSize = indent ? "2" : "1";
    let header = (startWithSpace ? indentSize : "") + chomp;
    if (comment2) {
      header += " " + commentString(comment2.replace(/ ?[\r\n]+/g, " "));
      if (onComment)
        onComment();
    }
    if (!literal) {
      const foldedValue = value.replace(/\n+/g, "\n$&").replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, "$1$2").replace(/\n+/g, `$&${indent}`);
      let literalFallback = false;
      const foldOptions = getFoldOptions(ctx, true);
      if (blockQuote !== "folded" && type !== Scalar.BLOCK_FOLDED) {
        foldOptions.onOverflow = () => {
          literalFallback = true;
        };
      }
      const body = foldFlowLines(`${start}${foldedValue}${end2}`, indent, FOLD_BLOCK, foldOptions);
      if (!literalFallback)
        return `>${header}
${indent}${body}`;
    }
    value = value.replace(/\n+/g, `$&${indent}`);
    return `|${header}
${indent}${start}${value}${end2}`;
  }
  function plainString(item, ctx, onComment, onChompKeep) {
    const { type, value } = item;
    const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
    if (implicitKey && value.includes("\n") || inFlow && /[[\]{},]/.test(value)) {
      return quotedString(value, ctx);
    }
    if (!value || /^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) {
      return implicitKey || inFlow || !value.includes("\n") ? quotedString(value, ctx) : blockString(item, ctx, onComment, onChompKeep);
    }
    if (!implicitKey && !inFlow && type !== Scalar.PLAIN && value.includes("\n")) {
      return blockString(item, ctx, onComment, onChompKeep);
    }
    if (containsDocumentMarker(value)) {
      if (indent === "") {
        ctx.forceBlockIndent = true;
        return blockString(item, ctx, onComment, onChompKeep);
      } else if (implicitKey && indent === indentStep) {
        return quotedString(value, ctx);
      }
    }
    const str = value.replace(/\n+/g, `$&
${indent}`);
    if (actualString) {
      const test = (tag) => {
        var _a2;
        return tag.default && tag.tag !== "tag:yaml.org,2002:str" && ((_a2 = tag.test) == null ? void 0 : _a2.test(str));
      };
      const { compat, tags } = ctx.doc.schema;
      if (tags.some(test) || (compat == null ? void 0 : compat.some(test)))
        return quotedString(value, ctx);
    }
    return implicitKey ? str : foldFlowLines(str, indent, FOLD_FLOW, getFoldOptions(ctx, false));
  }
  function stringifyString(item, ctx, onComment, onChompKeep) {
    const { implicitKey, inFlow } = ctx;
    const ss = typeof item.value === "string" ? item : Object.assign({}, item, { value: String(item.value) });
    let { type } = item;
    if (type !== Scalar.QUOTE_DOUBLE) {
      if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss.value))
        type = Scalar.QUOTE_DOUBLE;
    }
    const _stringify = (_type) => {
      switch (_type) {
        case Scalar.BLOCK_FOLDED:
        case Scalar.BLOCK_LITERAL:
          return implicitKey || inFlow ? quotedString(ss.value, ctx) : blockString(ss, ctx, onComment, onChompKeep);
        case Scalar.QUOTE_DOUBLE:
          return doubleQuotedString(ss.value, ctx);
        case Scalar.QUOTE_SINGLE:
          return singleQuotedString(ss.value, ctx);
        case Scalar.PLAIN:
          return plainString(ss, ctx, onComment, onChompKeep);
        default:
          return null;
      }
    };
    let res = _stringify(type);
    if (res === null) {
      const { defaultKeyType, defaultStringType } = ctx.options;
      const t = implicitKey && defaultKeyType || defaultStringType;
      res = _stringify(t);
      if (res === null)
        throw new Error(`Unsupported default string type ${t}`);
    }
    return res;
  }
  function createStringifyContext(doc, options) {
    const opt = Object.assign({
      blockQuote: true,
      commentString: stringifyComment,
      defaultKeyType: null,
      defaultStringType: "PLAIN",
      directives: null,
      doubleQuotedAsJSON: false,
      doubleQuotedMinMultiLineLength: 40,
      falseStr: "false",
      flowCollectionPadding: true,
      indentSeq: true,
      lineWidth: 80,
      minContentWidth: 20,
      nullStr: "null",
      simpleKeys: false,
      singleQuote: null,
      trueStr: "true",
      verifyAliasOrder: true
    }, doc.schema.toStringOptions, options);
    let inFlow;
    switch (opt.collectionStyle) {
      case "block":
        inFlow = false;
        break;
      case "flow":
        inFlow = true;
        break;
      default:
        inFlow = null;
    }
    return {
      anchors: /* @__PURE__ */ new Set(),
      doc,
      flowCollectionPadding: opt.flowCollectionPadding ? " " : "",
      indent: "",
      indentStep: typeof opt.indent === "number" ? " ".repeat(opt.indent) : "  ",
      inFlow,
      options: opt
    };
  }
  function getTagObject(tags, item) {
    var _a2;
    if (item.tag) {
      const match = tags.filter((t) => t.tag === item.tag);
      if (match.length > 0)
        return match.find((t) => t.format === item.format) ?? match[0];
    }
    let tagObj = void 0;
    let obj;
    if (isScalar(item)) {
      obj = item.value;
      let match = tags.filter((t) => {
        var _a3;
        return (_a3 = t.identify) == null ? void 0 : _a3.call(t, obj);
      });
      if (match.length > 1) {
        const testMatch = match.filter((t) => t.test);
        if (testMatch.length > 0)
          match = testMatch;
      }
      tagObj = match.find((t) => t.format === item.format) ?? match.find((t) => !t.format);
    } else {
      obj = item;
      tagObj = tags.find((t) => t.nodeClass && obj instanceof t.nodeClass);
    }
    if (!tagObj) {
      const name2 = ((_a2 = obj == null ? void 0 : obj.constructor) == null ? void 0 : _a2.name) ?? typeof obj;
      throw new Error(`Tag not resolved for ${name2} value`);
    }
    return tagObj;
  }
  function stringifyProps(node, tagObj, { anchors, doc }) {
    if (!doc.directives)
      return "";
    const props = [];
    const anchor = (isScalar(node) || isCollection(node)) && node.anchor;
    if (anchor && anchorIsValid(anchor)) {
      anchors.add(anchor);
      props.push(`&${anchor}`);
    }
    const tag = node.tag ? node.tag : tagObj.default ? null : tagObj.tag;
    if (tag)
      props.push(doc.directives.tagString(tag));
    return props.join(" ");
  }
  function stringify(item, ctx, onComment, onChompKeep) {
    var _a2;
    if (isPair(item))
      return item.toString(ctx, onComment, onChompKeep);
    if (isAlias(item)) {
      if (ctx.doc.directives)
        return item.toString(ctx);
      if ((_a2 = ctx.resolvedAliases) == null ? void 0 : _a2.has(item)) {
        throw new TypeError(`Cannot stringify circular structure without alias nodes`);
      } else {
        if (ctx.resolvedAliases)
          ctx.resolvedAliases.add(item);
        else
          ctx.resolvedAliases = /* @__PURE__ */ new Set([item]);
        item = item.resolve(ctx.doc);
      }
    }
    let tagObj = void 0;
    const node = isNode(item) ? item : ctx.doc.createNode(item, { onTagObj: (o) => tagObj = o });
    if (!tagObj)
      tagObj = getTagObject(ctx.doc.schema.tags, node);
    const props = stringifyProps(node, tagObj, ctx);
    if (props.length > 0)
      ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
    const str = typeof tagObj.stringify === "function" ? tagObj.stringify(node, ctx, onComment, onChompKeep) : isScalar(node) ? stringifyString(node, ctx, onComment, onChompKeep) : node.toString(ctx, onComment, onChompKeep);
    if (!props)
      return str;
    return isScalar(node) || str[0] === "{" || str[0] === "[" ? `${props} ${str}` : `${props}
${ctx.indent}${str}`;
  }
  function stringifyPair({ key, value }, ctx, onComment, onChompKeep) {
    const { allNullValues, doc, indent, indentStep, options: { commentString, indentSeq, simpleKeys } } = ctx;
    let keyComment = isNode(key) && key.comment || null;
    if (simpleKeys) {
      if (keyComment) {
        throw new Error("With simple keys, key nodes cannot have comments");
      }
      if (isCollection(key) || !isNode(key) && typeof key === "object") {
        const msg = "With simple keys, collection cannot be used as a key value";
        throw new Error(msg);
      }
    }
    let explicitKey = !simpleKeys && (!key || keyComment && value == null && !ctx.inFlow || isCollection(key) || (isScalar(key) ? key.type === Scalar.BLOCK_FOLDED || key.type === Scalar.BLOCK_LITERAL : typeof key === "object"));
    ctx = Object.assign({}, ctx, {
      allNullValues: false,
      implicitKey: !explicitKey && (simpleKeys || !allNullValues),
      indent: indent + indentStep
    });
    let keyCommentDone = false;
    let chompKeep = false;
    let str = stringify(key, ctx, () => keyCommentDone = true, () => chompKeep = true);
    if (!explicitKey && !ctx.inFlow && str.length > 1024) {
      if (simpleKeys)
        throw new Error("With simple keys, single line scalar must not span more than 1024 characters");
      explicitKey = true;
    }
    if (ctx.inFlow) {
      if (allNullValues || value == null) {
        if (keyCommentDone && onComment)
          onComment();
        return str === "" ? "?" : explicitKey ? `? ${str}` : str;
      }
    } else if (allNullValues && !simpleKeys || value == null && explicitKey) {
      str = `? ${str}`;
      if (keyComment && !keyCommentDone) {
        str += lineComment(str, ctx.indent, commentString(keyComment));
      } else if (chompKeep && onChompKeep)
        onChompKeep();
      return str;
    }
    if (keyCommentDone)
      keyComment = null;
    if (explicitKey) {
      if (keyComment)
        str += lineComment(str, ctx.indent, commentString(keyComment));
      str = `? ${str}
${indent}:`;
    } else {
      str = `${str}:`;
      if (keyComment)
        str += lineComment(str, ctx.indent, commentString(keyComment));
    }
    let vsb, vcb, valueComment;
    if (isNode(value)) {
      vsb = !!value.spaceBefore;
      vcb = value.commentBefore;
      valueComment = value.comment;
    } else {
      vsb = false;
      vcb = null;
      valueComment = null;
      if (value && typeof value === "object")
        value = doc.createNode(value);
    }
    ctx.implicitKey = false;
    if (!explicitKey && !keyComment && isScalar(value))
      ctx.indentAtStart = str.length + 1;
    chompKeep = false;
    if (!indentSeq && indentStep.length >= 2 && !ctx.inFlow && !explicitKey && isSeq(value) && !value.flow && !value.tag && !value.anchor) {
      ctx.indent = ctx.indent.substring(2);
    }
    let valueCommentDone = false;
    const valueStr = stringify(value, ctx, () => valueCommentDone = true, () => chompKeep = true);
    let ws = " ";
    if (keyComment || vsb || vcb) {
      ws = vsb ? "\n" : "";
      if (vcb) {
        const cs = commentString(vcb);
        ws += `
${indentComment(cs, ctx.indent)}`;
      }
      if (valueStr === "" && !ctx.inFlow) {
        if (ws === "\n")
          ws = "\n\n";
      } else {
        ws += `
${ctx.indent}`;
      }
    } else if (!explicitKey && isCollection(value)) {
      const vs0 = valueStr[0];
      const nl0 = valueStr.indexOf("\n");
      const hasNewline = nl0 !== -1;
      const flow = ctx.inFlow ?? value.flow ?? value.items.length === 0;
      if (hasNewline || !flow) {
        let hasPropsLine = false;
        if (hasNewline && (vs0 === "&" || vs0 === "!")) {
          let sp0 = valueStr.indexOf(" ");
          if (vs0 === "&" && sp0 !== -1 && sp0 < nl0 && valueStr[sp0 + 1] === "!") {
            sp0 = valueStr.indexOf(" ", sp0 + 1);
          }
          if (sp0 === -1 || nl0 < sp0)
            hasPropsLine = true;
        }
        if (!hasPropsLine)
          ws = `
${ctx.indent}`;
      }
    } else if (valueStr === "" || valueStr[0] === "\n") {
      ws = "";
    }
    str += ws + valueStr;
    if (ctx.inFlow) {
      if (valueCommentDone && onComment)
        onComment();
    } else if (valueComment && !valueCommentDone) {
      str += lineComment(str, ctx.indent, commentString(valueComment));
    } else if (chompKeep && onChompKeep) {
      onChompKeep();
    }
    return str;
  }
  function warn(logLevel, warning) {
    if (logLevel === "debug" || logLevel === "warn") {
      if (typeof process !== "undefined" && process.emitWarning)
        process.emitWarning(warning);
      else
        console.warn(warning);
    }
  }
  const MERGE_KEY = "<<";
  const merge = {
    identify: (value) => value === MERGE_KEY || typeof value === "symbol" && value.description === MERGE_KEY,
    default: "key",
    tag: "tag:yaml.org,2002:merge",
    test: /^<<$/,
    resolve: () => Object.assign(new Scalar(Symbol(MERGE_KEY)), {
      addToJSMap: addMergeToJSMap
    }),
    stringify: () => MERGE_KEY
  };
  const isMergeKey = (ctx, key) => (merge.identify(key) || isScalar(key) && (!key.type || key.type === Scalar.PLAIN) && merge.identify(key.value)) && (ctx == null ? void 0 : ctx.doc.schema.tags.some((tag) => tag.tag === merge.tag && tag.default));
  function addMergeToJSMap(ctx, map2, value) {
    value = ctx && isAlias(value) ? value.resolve(ctx.doc) : value;
    if (isSeq(value))
      for (const it of value.items)
        mergeValue(ctx, map2, it);
    else if (Array.isArray(value))
      for (const it of value)
        mergeValue(ctx, map2, it);
    else
      mergeValue(ctx, map2, value);
  }
  function mergeValue(ctx, map2, value) {
    const source = ctx && isAlias(value) ? value.resolve(ctx.doc) : value;
    if (!isMap(source))
      throw new Error("Merge sources must be maps or map aliases");
    const srcMap = source.toJSON(null, ctx, Map);
    for (const [key, value2] of srcMap) {
      if (map2 instanceof Map) {
        if (!map2.has(key))
          map2.set(key, value2);
      } else if (map2 instanceof Set) {
        map2.add(key);
      } else if (!Object.prototype.hasOwnProperty.call(map2, key)) {
        Object.defineProperty(map2, key, {
          value: value2,
          writable: true,
          enumerable: true,
          configurable: true
        });
      }
    }
    return map2;
  }
  function addPairToJSMap(ctx, map2, { key, value }) {
    if (isNode(key) && key.addToJSMap)
      key.addToJSMap(ctx, map2, value);
    else if (isMergeKey(ctx, key))
      addMergeToJSMap(ctx, map2, value);
    else {
      const jsKey = toJS(key, "", ctx);
      if (map2 instanceof Map) {
        map2.set(jsKey, toJS(value, jsKey, ctx));
      } else if (map2 instanceof Set) {
        map2.add(jsKey);
      } else {
        const stringKey = stringifyKey(key, jsKey, ctx);
        const jsValue = toJS(value, stringKey, ctx);
        if (stringKey in map2)
          Object.defineProperty(map2, stringKey, {
            value: jsValue,
            writable: true,
            enumerable: true,
            configurable: true
          });
        else
          map2[stringKey] = jsValue;
      }
    }
    return map2;
  }
  function stringifyKey(key, jsKey, ctx) {
    if (jsKey === null)
      return "";
    if (typeof jsKey !== "object")
      return String(jsKey);
    if (isNode(key) && (ctx == null ? void 0 : ctx.doc)) {
      const strCtx = createStringifyContext(ctx.doc, {});
      strCtx.anchors = /* @__PURE__ */ new Set();
      for (const node of ctx.anchors.keys())
        strCtx.anchors.add(node.anchor);
      strCtx.inFlow = true;
      strCtx.inStringifyKey = true;
      const strKey = key.toString(strCtx);
      if (!ctx.mapKeyWarned) {
        let jsonStr = JSON.stringify(strKey);
        if (jsonStr.length > 40)
          jsonStr = jsonStr.substring(0, 36) + '..."';
        warn(ctx.doc.options.logLevel, `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`);
        ctx.mapKeyWarned = true;
      }
      return strKey;
    }
    return JSON.stringify(jsKey);
  }
  function createPair(key, value, ctx) {
    const k = createNode(key, void 0, ctx);
    const v = createNode(value, void 0, ctx);
    return new Pair(k, v);
  }
  class Pair {
    constructor(key, value = null) {
      Object.defineProperty(this, NODE_TYPE, { value: PAIR });
      this.key = key;
      this.value = value;
    }
    clone(schema2) {
      let { key, value } = this;
      if (isNode(key))
        key = key.clone(schema2);
      if (isNode(value))
        value = value.clone(schema2);
      return new Pair(key, value);
    }
    toJSON(_, ctx) {
      const pair = (ctx == null ? void 0 : ctx.mapAsMap) ? /* @__PURE__ */ new Map() : {};
      return addPairToJSMap(ctx, pair, this);
    }
    toString(ctx, onComment, onChompKeep) {
      return (ctx == null ? void 0 : ctx.doc) ? stringifyPair(this, ctx, onComment, onChompKeep) : JSON.stringify(this);
    }
  }
  function stringifyCollection(collection, ctx, options) {
    const flow = ctx.inFlow ?? collection.flow;
    const stringify2 = flow ? stringifyFlowCollection : stringifyBlockCollection;
    return stringify2(collection, ctx, options);
  }
  function stringifyBlockCollection({ comment: comment2, items }, ctx, { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment }) {
    const { indent, options: { commentString } } = ctx;
    const itemCtx = Object.assign({}, ctx, { indent: itemIndent, type: null });
    let chompKeep = false;
    const lines = [];
    for (let i = 0; i < items.length; ++i) {
      const item = items[i];
      let comment3 = null;
      if (isNode(item)) {
        if (!chompKeep && item.spaceBefore)
          lines.push("");
        addCommentBefore(ctx, lines, item.commentBefore, chompKeep);
        if (item.comment)
          comment3 = item.comment;
      } else if (isPair(item)) {
        const ik = isNode(item.key) ? item.key : null;
        if (ik) {
          if (!chompKeep && ik.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
        }
      }
      chompKeep = false;
      let str2 = stringify(item, itemCtx, () => comment3 = null, () => chompKeep = true);
      if (comment3)
        str2 += lineComment(str2, itemIndent, commentString(comment3));
      if (chompKeep && comment3)
        chompKeep = false;
      lines.push(blockItemPrefix + str2);
    }
    let str;
    if (lines.length === 0) {
      str = flowChars.start + flowChars.end;
    } else {
      str = lines[0];
      for (let i = 1; i < lines.length; ++i) {
        const line = lines[i];
        str += line ? `
${indent}${line}` : "\n";
      }
    }
    if (comment2) {
      str += "\n" + indentComment(commentString(comment2), indent);
      if (onComment)
        onComment();
    } else if (chompKeep && onChompKeep)
      onChompKeep();
    return str;
  }
  function stringifyFlowCollection({ items }, ctx, { flowChars, itemIndent }) {
    const { indent, indentStep, flowCollectionPadding: fcPadding, options: { commentString } } = ctx;
    itemIndent += indentStep;
    const itemCtx = Object.assign({}, ctx, {
      indent: itemIndent,
      inFlow: true,
      type: null
    });
    let reqNewline = false;
    let linesAtValue = 0;
    const lines = [];
    for (let i = 0; i < items.length; ++i) {
      const item = items[i];
      let comment2 = null;
      if (isNode(item)) {
        if (item.spaceBefore)
          lines.push("");
        addCommentBefore(ctx, lines, item.commentBefore, false);
        if (item.comment)
          comment2 = item.comment;
      } else if (isPair(item)) {
        const ik = isNode(item.key) ? item.key : null;
        if (ik) {
          if (ik.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, ik.commentBefore, false);
          if (ik.comment)
            reqNewline = true;
        }
        const iv = isNode(item.value) ? item.value : null;
        if (iv) {
          if (iv.comment)
            comment2 = iv.comment;
          if (iv.commentBefore)
            reqNewline = true;
        } else if (item.value == null && (ik == null ? void 0 : ik.comment)) {
          comment2 = ik.comment;
        }
      }
      if (comment2)
        reqNewline = true;
      let str = stringify(item, itemCtx, () => comment2 = null);
      if (i < items.length - 1)
        str += ",";
      if (comment2)
        str += lineComment(str, itemIndent, commentString(comment2));
      if (!reqNewline && (lines.length > linesAtValue || str.includes("\n")))
        reqNewline = true;
      lines.push(str);
      linesAtValue = lines.length;
    }
    const { start, end: end2 } = flowChars;
    if (lines.length === 0) {
      return start + end2;
    } else {
      if (!reqNewline) {
        const len = lines.reduce((sum, line) => sum + line.length + 2, 2);
        reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
      }
      if (reqNewline) {
        let str = start;
        for (const line of lines)
          str += line ? `
${indentStep}${indent}${line}` : "\n";
        return `${str}
${indent}${end2}`;
      } else {
        return `${start}${fcPadding}${lines.join(" ")}${fcPadding}${end2}`;
      }
    }
  }
  function addCommentBefore({ indent, options: { commentString } }, lines, comment2, chompKeep) {
    if (comment2 && chompKeep)
      comment2 = comment2.replace(/^\n+/, "");
    if (comment2) {
      const ic = indentComment(commentString(comment2), indent);
      lines.push(ic.trimStart());
    }
  }
  function findPair(items, key) {
    const k = isScalar(key) ? key.value : key;
    for (const it of items) {
      if (isPair(it)) {
        if (it.key === key || it.key === k)
          return it;
        if (isScalar(it.key) && it.key.value === k)
          return it;
      }
    }
    return void 0;
  }
  class YAMLMap extends Collection {
    static get tagName() {
      return "tag:yaml.org,2002:map";
    }
    constructor(schema2) {
      super(MAP, schema2);
      this.items = [];
    }
    /**
     * A generic collection parsing method that can be extended
     * to other node classes that inherit from YAMLMap
     */
    static from(schema2, obj, ctx) {
      const { keepUndefined, replacer } = ctx;
      const map2 = new this(schema2);
      const add2 = (key, value) => {
        if (typeof replacer === "function")
          value = replacer.call(obj, key, value);
        else if (Array.isArray(replacer) && !replacer.includes(key))
          return;
        if (value !== void 0 || keepUndefined)
          map2.items.push(createPair(key, value, ctx));
      };
      if (obj instanceof Map) {
        for (const [key, value] of obj)
          add2(key, value);
      } else if (obj && typeof obj === "object") {
        for (const key of Object.keys(obj))
          add2(key, obj[key]);
      }
      if (typeof schema2.sortMapEntries === "function") {
        map2.items.sort(schema2.sortMapEntries);
      }
      return map2;
    }
    /**
     * Adds a value to the collection.
     *
     * @param overwrite - If not set `true`, using a key that is already in the
     *   collection will throw. Otherwise, overwrites the previous value.
     */
    add(pair, overwrite) {
      var _a2;
      let _pair;
      if (isPair(pair))
        _pair = pair;
      else if (!pair || typeof pair !== "object" || !("key" in pair)) {
        _pair = new Pair(pair, pair == null ? void 0 : pair.value);
      } else
        _pair = new Pair(pair.key, pair.value);
      const prev2 = findPair(this.items, _pair.key);
      const sortEntries = (_a2 = this.schema) == null ? void 0 : _a2.sortMapEntries;
      if (prev2) {
        if (!overwrite)
          throw new Error(`Key ${_pair.key} already set`);
        if (isScalar(prev2.value) && isScalarValue(_pair.value))
          prev2.value.value = _pair.value;
        else
          prev2.value = _pair.value;
      } else if (sortEntries) {
        const i = this.items.findIndex((item) => sortEntries(_pair, item) < 0);
        if (i === -1)
          this.items.push(_pair);
        else
          this.items.splice(i, 0, _pair);
      } else {
        this.items.push(_pair);
      }
    }
    delete(key) {
      const it = findPair(this.items, key);
      if (!it)
        return false;
      const del = this.items.splice(this.items.indexOf(it), 1);
      return del.length > 0;
    }
    get(key, keepScalar) {
      const it = findPair(this.items, key);
      const node = it == null ? void 0 : it.value;
      return (!keepScalar && isScalar(node) ? node.value : node) ?? void 0;
    }
    has(key) {
      return !!findPair(this.items, key);
    }
    set(key, value) {
      this.add(new Pair(key, value), true);
    }
    /**
     * @param ctx - Conversion context, originally set in Document#toJS()
     * @param {Class} Type - If set, forces the returned collection type
     * @returns Instance of Type, Map, or Object
     */
    toJSON(_, ctx, Type) {
      const map2 = Type ? new Type() : (ctx == null ? void 0 : ctx.mapAsMap) ? /* @__PURE__ */ new Map() : {};
      if (ctx == null ? void 0 : ctx.onCreate)
        ctx.onCreate(map2);
      for (const item of this.items)
        addPairToJSMap(ctx, map2, item);
      return map2;
    }
    toString(ctx, onComment, onChompKeep) {
      if (!ctx)
        return JSON.stringify(this);
      for (const item of this.items) {
        if (!isPair(item))
          throw new Error(`Map items must all be pairs; found ${JSON.stringify(item)} instead`);
      }
      if (!ctx.allNullValues && this.hasAllNullValues(false))
        ctx = Object.assign({}, ctx, { allNullValues: true });
      return stringifyCollection(this, ctx, {
        blockItemPrefix: "",
        flowChars: { start: "{", end: "}" },
        itemIndent: ctx.indent || "",
        onChompKeep,
        onComment
      });
    }
  }
  const map = {
    collection: "map",
    default: true,
    nodeClass: YAMLMap,
    tag: "tag:yaml.org,2002:map",
    resolve(map2, onError) {
      if (!isMap(map2))
        onError("Expected a mapping for this tag");
      return map2;
    },
    createNode: (schema2, obj, ctx) => YAMLMap.from(schema2, obj, ctx)
  };
  class YAMLSeq extends Collection {
    static get tagName() {
      return "tag:yaml.org,2002:seq";
    }
    constructor(schema2) {
      super(SEQ, schema2);
      this.items = [];
    }
    add(value) {
      this.items.push(value);
    }
    /**
     * Removes a value from the collection.
     *
     * `key` must contain a representation of an integer for this to succeed.
     * It may be wrapped in a `Scalar`.
     *
     * @returns `true` if the item was found and removed.
     */
    delete(key) {
      const idx = asItemIndex(key);
      if (typeof idx !== "number")
        return false;
      const del = this.items.splice(idx, 1);
      return del.length > 0;
    }
    get(key, keepScalar) {
      const idx = asItemIndex(key);
      if (typeof idx !== "number")
        return void 0;
      const it = this.items[idx];
      return !keepScalar && isScalar(it) ? it.value : it;
    }
    /**
     * Checks if the collection includes a value with the key `key`.
     *
     * `key` must contain a representation of an integer for this to succeed.
     * It may be wrapped in a `Scalar`.
     */
    has(key) {
      const idx = asItemIndex(key);
      return typeof idx === "number" && idx < this.items.length;
    }
    /**
     * Sets a value in this collection. For `!!set`, `value` needs to be a
     * boolean to add/remove the item from the set.
     *
     * If `key` does not contain a representation of an integer, this will throw.
     * It may be wrapped in a `Scalar`.
     */
    set(key, value) {
      const idx = asItemIndex(key);
      if (typeof idx !== "number")
        throw new Error(`Expected a valid index, not ${key}.`);
      const prev2 = this.items[idx];
      if (isScalar(prev2) && isScalarValue(value))
        prev2.value = value;
      else
        this.items[idx] = value;
    }
    toJSON(_, ctx) {
      const seq2 = [];
      if (ctx == null ? void 0 : ctx.onCreate)
        ctx.onCreate(seq2);
      let i = 0;
      for (const item of this.items)
        seq2.push(toJS(item, String(i++), ctx));
      return seq2;
    }
    toString(ctx, onComment, onChompKeep) {
      if (!ctx)
        return JSON.stringify(this);
      return stringifyCollection(this, ctx, {
        blockItemPrefix: "- ",
        flowChars: { start: "[", end: "]" },
        itemIndent: (ctx.indent || "") + "  ",
        onChompKeep,
        onComment
      });
    }
    static from(schema2, obj, ctx) {
      const { replacer } = ctx;
      const seq2 = new this(schema2);
      if (obj && Symbol.iterator in Object(obj)) {
        let i = 0;
        for (let it of obj) {
          if (typeof replacer === "function") {
            const key = obj instanceof Set ? it : String(i++);
            it = replacer.call(obj, key, it);
          }
          seq2.items.push(createNode(it, void 0, ctx));
        }
      }
      return seq2;
    }
  }
  function asItemIndex(key) {
    let idx = isScalar(key) ? key.value : key;
    if (idx && typeof idx === "string")
      idx = Number(idx);
    return typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? idx : null;
  }
  const seq = {
    collection: "seq",
    default: true,
    nodeClass: YAMLSeq,
    tag: "tag:yaml.org,2002:seq",
    resolve(seq2, onError) {
      if (!isSeq(seq2))
        onError("Expected a sequence for this tag");
      return seq2;
    },
    createNode: (schema2, obj, ctx) => YAMLSeq.from(schema2, obj, ctx)
  };
  const string = {
    identify: (value) => typeof value === "string",
    default: true,
    tag: "tag:yaml.org,2002:str",
    resolve: (str) => str,
    stringify(item, ctx, onComment, onChompKeep) {
      ctx = Object.assign({ actualString: true }, ctx);
      return stringifyString(item, ctx, onComment, onChompKeep);
    }
  };
  const nullTag = {
    identify: (value) => value == null,
    createNode: () => new Scalar(null),
    default: true,
    tag: "tag:yaml.org,2002:null",
    test: /^(?:~|[Nn]ull|NULL)?$/,
    resolve: () => new Scalar(null),
    stringify: ({ source }, ctx) => typeof source === "string" && nullTag.test.test(source) ? source : ctx.options.nullStr
  };
  const boolTag = {
    identify: (value) => typeof value === "boolean",
    default: true,
    tag: "tag:yaml.org,2002:bool",
    test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
    resolve: (str) => new Scalar(str[0] === "t" || str[0] === "T"),
    stringify({ source, value }, ctx) {
      if (source && boolTag.test.test(source)) {
        const sv = source[0] === "t" || source[0] === "T";
        if (value === sv)
          return source;
      }
      return value ? ctx.options.trueStr : ctx.options.falseStr;
    }
  };
  function stringifyNumber({ format: format2, minFractionDigits, tag, value }) {
    if (typeof value === "bigint")
      return String(value);
    const num = typeof value === "number" ? value : Number(value);
    if (!isFinite(num))
      return isNaN(num) ? ".nan" : num < 0 ? "-.inf" : ".inf";
    let n = JSON.stringify(value);
    if (!format2 && minFractionDigits && (!tag || tag === "tag:yaml.org,2002:float") && /^\d/.test(n)) {
      let i = n.indexOf(".");
      if (i < 0) {
        i = n.length;
        n += ".";
      }
      let d = minFractionDigits - (n.length - i - 1);
      while (d-- > 0)
        n += "0";
    }
    return n;
  }
  const floatNaN$1 = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
    resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
    stringify: stringifyNumber
  };
  const floatExp$1 = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    format: "EXP",
    test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
    resolve: (str) => parseFloat(str),
    stringify(node) {
      const num = Number(node.value);
      return isFinite(num) ? num.toExponential() : stringifyNumber(node);
    }
  };
  const float$1 = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
    resolve(str) {
      const node = new Scalar(parseFloat(str));
      const dot = str.indexOf(".");
      if (dot !== -1 && str[str.length - 1] === "0")
        node.minFractionDigits = str.length - dot - 1;
      return node;
    },
    stringify: stringifyNumber
  };
  const intIdentify$2 = (value) => typeof value === "bigint" || Number.isInteger(value);
  const intResolve$1 = (str, offset, radix, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str.substring(offset), radix);
  function intStringify$1(node, radix, prefix) {
    const { value } = node;
    if (intIdentify$2(value) && value >= 0)
      return prefix + value.toString(radix);
    return stringifyNumber(node);
  }
  const intOct$1 = {
    identify: (value) => intIdentify$2(value) && value >= 0,
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "OCT",
    test: /^0o[0-7]+$/,
    resolve: (str, _onError, opt) => intResolve$1(str, 2, 8, opt),
    stringify: (node) => intStringify$1(node, 8, "0o")
  };
  const int$1 = {
    identify: intIdentify$2,
    default: true,
    tag: "tag:yaml.org,2002:int",
    test: /^[-+]?[0-9]+$/,
    resolve: (str, _onError, opt) => intResolve$1(str, 0, 10, opt),
    stringify: stringifyNumber
  };
  const intHex$1 = {
    identify: (value) => intIdentify$2(value) && value >= 0,
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "HEX",
    test: /^0x[0-9a-fA-F]+$/,
    resolve: (str, _onError, opt) => intResolve$1(str, 2, 16, opt),
    stringify: (node) => intStringify$1(node, 16, "0x")
  };
  const schema$2 = [
    map,
    seq,
    string,
    nullTag,
    boolTag,
    intOct$1,
    int$1,
    intHex$1,
    floatNaN$1,
    floatExp$1,
    float$1
  ];
  function intIdentify$1(value) {
    return typeof value === "bigint" || Number.isInteger(value);
  }
  const stringifyJSON = ({ value }) => JSON.stringify(value);
  const jsonScalars = [
    {
      identify: (value) => typeof value === "string",
      default: true,
      tag: "tag:yaml.org,2002:str",
      resolve: (str) => str,
      stringify: stringifyJSON
    },
    {
      identify: (value) => value == null,
      createNode: () => new Scalar(null),
      default: true,
      tag: "tag:yaml.org,2002:null",
      test: /^null$/,
      resolve: () => null,
      stringify: stringifyJSON
    },
    {
      identify: (value) => typeof value === "boolean",
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^true$|^false$/,
      resolve: (str) => str === "true",
      stringify: stringifyJSON
    },
    {
      identify: intIdentify$1,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^-?(?:0|[1-9][0-9]*)$/,
      resolve: (str, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str, 10),
      stringify: ({ value }) => intIdentify$1(value) ? value.toString() : JSON.stringify(value)
    },
    {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
      resolve: (str) => parseFloat(str),
      stringify: stringifyJSON
    }
  ];
  const jsonError = {
    default: true,
    tag: "",
    test: /^/,
    resolve(str, onError) {
      onError(`Unresolved plain scalar ${JSON.stringify(str)}`);
      return str;
    }
  };
  const schema$1 = [map, seq].concat(jsonScalars, jsonError);
  const binary = {
    identify: (value) => value instanceof Uint8Array,
    // Buffer inherits from Uint8Array
    default: false,
    tag: "tag:yaml.org,2002:binary",
    /**
     * Returns a Buffer in node and an Uint8Array in browsers
     *
     * To use the resulting buffer as an image, you'll want to do something like:
     *
     *   const blob = new Blob([buffer], { type: 'image/jpeg' })
     *   document.querySelector('#photo').src = URL.createObjectURL(blob)
     */
    resolve(src, onError) {
      if (typeof Buffer === "function") {
        return Buffer.from(src, "base64");
      } else if (typeof atob === "function") {
        const str = atob(src.replace(/[\n\r]/g, ""));
        const buffer = new Uint8Array(str.length);
        for (let i = 0; i < str.length; ++i)
          buffer[i] = str.charCodeAt(i);
        return buffer;
      } else {
        onError("This environment does not support reading binary tags; either Buffer or atob is required");
        return src;
      }
    },
    stringify({ comment: comment2, type, value }, ctx, onComment, onChompKeep) {
      const buf = value;
      let str;
      if (typeof Buffer === "function") {
        str = buf instanceof Buffer ? buf.toString("base64") : Buffer.from(buf.buffer).toString("base64");
      } else if (typeof btoa === "function") {
        let s = "";
        for (let i = 0; i < buf.length; ++i)
          s += String.fromCharCode(buf[i]);
        str = btoa(s);
      } else {
        throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");
      }
      if (!type)
        type = Scalar.BLOCK_LITERAL;
      if (type !== Scalar.QUOTE_DOUBLE) {
        const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
        const n = Math.ceil(str.length / lineWidth);
        const lines = new Array(n);
        for (let i = 0, o = 0; i < n; ++i, o += lineWidth) {
          lines[i] = str.substr(o, lineWidth);
        }
        str = lines.join(type === Scalar.BLOCK_LITERAL ? "\n" : " ");
      }
      return stringifyString({ comment: comment2, type, value: str }, ctx, onComment, onChompKeep);
    }
  };
  function resolvePairs(seq2, onError) {
    if (isSeq(seq2)) {
      for (let i = 0; i < seq2.items.length; ++i) {
        let item = seq2.items[i];
        if (isPair(item))
          continue;
        else if (isMap(item)) {
          if (item.items.length > 1)
            onError("Each pair must have its own sequence indicator");
          const pair = item.items[0] || new Pair(new Scalar(null));
          if (item.commentBefore)
            pair.key.commentBefore = pair.key.commentBefore ? `${item.commentBefore}
${pair.key.commentBefore}` : item.commentBefore;
          if (item.comment) {
            const cn = pair.value ?? pair.key;
            cn.comment = cn.comment ? `${item.comment}
${cn.comment}` : item.comment;
          }
          item = pair;
        }
        seq2.items[i] = isPair(item) ? item : new Pair(item);
      }
    } else
      onError("Expected a sequence for this tag");
    return seq2;
  }
  function createPairs(schema2, iterable, ctx) {
    const { replacer } = ctx;
    const pairs2 = new YAMLSeq(schema2);
    pairs2.tag = "tag:yaml.org,2002:pairs";
    let i = 0;
    if (iterable && Symbol.iterator in Object(iterable))
      for (let it of iterable) {
        if (typeof replacer === "function")
          it = replacer.call(iterable, String(i++), it);
        let key, value;
        if (Array.isArray(it)) {
          if (it.length === 2) {
            key = it[0];
            value = it[1];
          } else
            throw new TypeError(`Expected [key, value] tuple: ${it}`);
        } else if (it && it instanceof Object) {
          const keys = Object.keys(it);
          if (keys.length === 1) {
            key = keys[0];
            value = it[key];
          } else {
            throw new TypeError(`Expected tuple with one key, not ${keys.length} keys`);
          }
        } else {
          key = it;
        }
        pairs2.items.push(createPair(key, value, ctx));
      }
    return pairs2;
  }
  const pairs = {
    collection: "seq",
    default: false,
    tag: "tag:yaml.org,2002:pairs",
    resolve: resolvePairs,
    createNode: createPairs
  };
  class YAMLOMap extends YAMLSeq {
    constructor() {
      super();
      this.add = YAMLMap.prototype.add.bind(this);
      this.delete = YAMLMap.prototype.delete.bind(this);
      this.get = YAMLMap.prototype.get.bind(this);
      this.has = YAMLMap.prototype.has.bind(this);
      this.set = YAMLMap.prototype.set.bind(this);
      this.tag = YAMLOMap.tag;
    }
    /**
     * If `ctx` is given, the return type is actually `Map<unknown, unknown>`,
     * but TypeScript won't allow widening the signature of a child method.
     */
    toJSON(_, ctx) {
      if (!ctx)
        return super.toJSON(_);
      const map2 = /* @__PURE__ */ new Map();
      if (ctx == null ? void 0 : ctx.onCreate)
        ctx.onCreate(map2);
      for (const pair of this.items) {
        let key, value;
        if (isPair(pair)) {
          key = toJS(pair.key, "", ctx);
          value = toJS(pair.value, key, ctx);
        } else {
          key = toJS(pair, "", ctx);
        }
        if (map2.has(key))
          throw new Error("Ordered maps must not include duplicate keys");
        map2.set(key, value);
      }
      return map2;
    }
    static from(schema2, iterable, ctx) {
      const pairs2 = createPairs(schema2, iterable, ctx);
      const omap2 = new this();
      omap2.items = pairs2.items;
      return omap2;
    }
  }
  YAMLOMap.tag = "tag:yaml.org,2002:omap";
  const omap = {
    collection: "seq",
    identify: (value) => value instanceof Map,
    nodeClass: YAMLOMap,
    default: false,
    tag: "tag:yaml.org,2002:omap",
    resolve(seq2, onError) {
      const pairs2 = resolvePairs(seq2, onError);
      const seenKeys = [];
      for (const { key } of pairs2.items) {
        if (isScalar(key)) {
          if (seenKeys.includes(key.value)) {
            onError(`Ordered maps must not include duplicate keys: ${key.value}`);
          } else {
            seenKeys.push(key.value);
          }
        }
      }
      return Object.assign(new YAMLOMap(), pairs2);
    },
    createNode: (schema2, iterable, ctx) => YAMLOMap.from(schema2, iterable, ctx)
  };
  function boolStringify({ value, source }, ctx) {
    const boolObj = value ? trueTag : falseTag;
    if (source && boolObj.test.test(source))
      return source;
    return value ? ctx.options.trueStr : ctx.options.falseStr;
  }
  const trueTag = {
    identify: (value) => value === true,
    default: true,
    tag: "tag:yaml.org,2002:bool",
    test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
    resolve: () => new Scalar(true),
    stringify: boolStringify
  };
  const falseTag = {
    identify: (value) => value === false,
    default: true,
    tag: "tag:yaml.org,2002:bool",
    test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
    resolve: () => new Scalar(false),
    stringify: boolStringify
  };
  const floatNaN = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
    resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
    stringify: stringifyNumber
  };
  const floatExp = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    format: "EXP",
    test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
    resolve: (str) => parseFloat(str.replace(/_/g, "")),
    stringify(node) {
      const num = Number(node.value);
      return isFinite(num) ? num.toExponential() : stringifyNumber(node);
    }
  };
  const float = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
    resolve(str) {
      const node = new Scalar(parseFloat(str.replace(/_/g, "")));
      const dot = str.indexOf(".");
      if (dot !== -1) {
        const f = str.substring(dot + 1).replace(/_/g, "");
        if (f[f.length - 1] === "0")
          node.minFractionDigits = f.length;
      }
      return node;
    },
    stringify: stringifyNumber
  };
  const intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
  function intResolve(str, offset, radix, { intAsBigInt }) {
    const sign = str[0];
    if (sign === "-" || sign === "+")
      offset += 1;
    str = str.substring(offset).replace(/_/g, "");
    if (intAsBigInt) {
      switch (radix) {
        case 2:
          str = `0b${str}`;
          break;
        case 8:
          str = `0o${str}`;
          break;
        case 16:
          str = `0x${str}`;
          break;
      }
      const n2 = BigInt(str);
      return sign === "-" ? BigInt(-1) * n2 : n2;
    }
    const n = parseInt(str, radix);
    return sign === "-" ? -1 * n : n;
  }
  function intStringify(node, radix, prefix) {
    const { value } = node;
    if (intIdentify(value)) {
      const str = value.toString(radix);
      return value < 0 ? "-" + prefix + str.substr(1) : prefix + str;
    }
    return stringifyNumber(node);
  }
  const intBin = {
    identify: intIdentify,
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "BIN",
    test: /^[-+]?0b[0-1_]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 2, 2, opt),
    stringify: (node) => intStringify(node, 2, "0b")
  };
  const intOct = {
    identify: intIdentify,
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "OCT",
    test: /^[-+]?0[0-7_]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 1, 8, opt),
    stringify: (node) => intStringify(node, 8, "0")
  };
  const int = {
    identify: intIdentify,
    default: true,
    tag: "tag:yaml.org,2002:int",
    test: /^[-+]?[0-9][0-9_]*$/,
    resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
    stringify: stringifyNumber
  };
  const intHex = {
    identify: intIdentify,
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "HEX",
    test: /^[-+]?0x[0-9a-fA-F_]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
    stringify: (node) => intStringify(node, 16, "0x")
  };
  class YAMLSet extends YAMLMap {
    constructor(schema2) {
      super(schema2);
      this.tag = YAMLSet.tag;
    }
    add(key) {
      let pair;
      if (isPair(key))
        pair = key;
      else if (key && typeof key === "object" && "key" in key && "value" in key && key.value === null)
        pair = new Pair(key.key, null);
      else
        pair = new Pair(key, null);
      const prev2 = findPair(this.items, pair.key);
      if (!prev2)
        this.items.push(pair);
    }
    /**
     * If `keepPair` is `true`, returns the Pair matching `key`.
     * Otherwise, returns the value of that Pair's key.
     */
    get(key, keepPair) {
      const pair = findPair(this.items, key);
      return !keepPair && isPair(pair) ? isScalar(pair.key) ? pair.key.value : pair.key : pair;
    }
    set(key, value) {
      if (typeof value !== "boolean")
        throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`);
      const prev2 = findPair(this.items, key);
      if (prev2 && !value) {
        this.items.splice(this.items.indexOf(prev2), 1);
      } else if (!prev2 && value) {
        this.items.push(new Pair(key));
      }
    }
    toJSON(_, ctx) {
      return super.toJSON(_, ctx, Set);
    }
    toString(ctx, onComment, onChompKeep) {
      if (!ctx)
        return JSON.stringify(this);
      if (this.hasAllNullValues(true))
        return super.toString(Object.assign({}, ctx, { allNullValues: true }), onComment, onChompKeep);
      else
        throw new Error("Set items must all have null values");
    }
    static from(schema2, iterable, ctx) {
      const { replacer } = ctx;
      const set2 = new this(schema2);
      if (iterable && Symbol.iterator in Object(iterable))
        for (let value of iterable) {
          if (typeof replacer === "function")
            value = replacer.call(iterable, value, value);
          set2.items.push(createPair(value, null, ctx));
        }
      return set2;
    }
  }
  YAMLSet.tag = "tag:yaml.org,2002:set";
  const set = {
    collection: "map",
    identify: (value) => value instanceof Set,
    nodeClass: YAMLSet,
    default: false,
    tag: "tag:yaml.org,2002:set",
    createNode: (schema2, iterable, ctx) => YAMLSet.from(schema2, iterable, ctx),
    resolve(map2, onError) {
      if (isMap(map2)) {
        if (map2.hasAllNullValues(true))
          return Object.assign(new YAMLSet(), map2);
        else
          onError("Set items must all have null values");
      } else
        onError("Expected a mapping for this tag");
      return map2;
    }
  };
  function parseSexagesimal(str, asBigInt) {
    const sign = str[0];
    const parts = sign === "-" || sign === "+" ? str.substring(1) : str;
    const num = (n) => asBigInt ? BigInt(n) : Number(n);
    const res = parts.replace(/_/g, "").split(":").reduce((res2, p) => res2 * num(60) + num(p), num(0));
    return sign === "-" ? num(-1) * res : res;
  }
  function stringifySexagesimal(node) {
    let { value } = node;
    let num = (n) => n;
    if (typeof value === "bigint")
      num = (n) => BigInt(n);
    else if (isNaN(value) || !isFinite(value))
      return stringifyNumber(node);
    let sign = "";
    if (value < 0) {
      sign = "-";
      value *= num(-1);
    }
    const _60 = num(60);
    const parts = [value % _60];
    if (value < 60) {
      parts.unshift(0);
    } else {
      value = (value - parts[0]) / _60;
      parts.unshift(value % _60);
      if (value >= 60) {
        value = (value - parts[0]) / _60;
        parts.unshift(value);
      }
    }
    return sign + parts.map((n) => String(n).padStart(2, "0")).join(":").replace(/000000\d*$/, "");
  }
  const intTime = {
    identify: (value) => typeof value === "bigint" || Number.isInteger(value),
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "TIME",
    test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
    resolve: (str, _onError, { intAsBigInt }) => parseSexagesimal(str, intAsBigInt),
    stringify: stringifySexagesimal
  };
  const floatTime = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    format: "TIME",
    test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
    resolve: (str) => parseSexagesimal(str, false),
    stringify: stringifySexagesimal
  };
  const timestamp = {
    identify: (value) => value instanceof Date,
    default: true,
    tag: "tag:yaml.org,2002:timestamp",
    // If the time zone is omitted, the timestamp is assumed to be specified in UTC. The time part
    // may be omitted altogether, resulting in a date format. In such a case, the time part is
    // assumed to be 00:00:00Z (start of day, UTC).
    test: RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$"),
    resolve(str) {
      const match = str.match(timestamp.test);
      if (!match)
        throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");
      const [, year, month, day, hour, minute, second] = match.map(Number);
      const millisec = match[7] ? Number((match[7] + "00").substr(1, 3)) : 0;
      let date = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
      const tz = match[8];
      if (tz && tz !== "Z") {
        let d = parseSexagesimal(tz, false);
        if (Math.abs(d) < 30)
          d *= 60;
        date -= 6e4 * d;
      }
      return new Date(date);
    },
    stringify: ({ value }) => value.toISOString().replace(/(T00:00:00)?\.000Z$/, "")
  };
  const schema = [
    map,
    seq,
    string,
    nullTag,
    trueTag,
    falseTag,
    intBin,
    intOct,
    int,
    intHex,
    floatNaN,
    floatExp,
    float,
    binary,
    merge,
    omap,
    pairs,
    set,
    intTime,
    floatTime,
    timestamp
  ];
  const schemas = /* @__PURE__ */ new Map([
    ["core", schema$2],
    ["failsafe", [map, seq, string]],
    ["json", schema$1],
    ["yaml11", schema],
    ["yaml-1.1", schema]
  ]);
  const tagsByName = {
    binary,
    bool: boolTag,
    float: float$1,
    floatExp: floatExp$1,
    floatNaN: floatNaN$1,
    floatTime,
    int: int$1,
    intHex: intHex$1,
    intOct: intOct$1,
    intTime,
    map,
    merge,
    null: nullTag,
    omap,
    pairs,
    seq,
    set,
    timestamp
  };
  const coreKnownTags = {
    "tag:yaml.org,2002:binary": binary,
    "tag:yaml.org,2002:merge": merge,
    "tag:yaml.org,2002:omap": omap,
    "tag:yaml.org,2002:pairs": pairs,
    "tag:yaml.org,2002:set": set,
    "tag:yaml.org,2002:timestamp": timestamp
  };
  function getTags(customTags, schemaName, addMergeTag) {
    const schemaTags = schemas.get(schemaName);
    if (schemaTags && !customTags) {
      return addMergeTag && !schemaTags.includes(merge) ? schemaTags.concat(merge) : schemaTags.slice();
    }
    let tags = schemaTags;
    if (!tags) {
      if (Array.isArray(customTags))
        tags = [];
      else {
        const keys = Array.from(schemas.keys()).filter((key) => key !== "yaml11").map((key) => JSON.stringify(key)).join(", ");
        throw new Error(`Unknown schema "${schemaName}"; use one of ${keys} or define customTags array`);
      }
    }
    if (Array.isArray(customTags)) {
      for (const tag of customTags)
        tags = tags.concat(tag);
    } else if (typeof customTags === "function") {
      tags = customTags(tags.slice());
    }
    if (addMergeTag)
      tags = tags.concat(merge);
    return tags.reduce((tags2, tag) => {
      const tagObj = typeof tag === "string" ? tagsByName[tag] : tag;
      if (!tagObj) {
        const tagName = JSON.stringify(tag);
        const keys = Object.keys(tagsByName).map((key) => JSON.stringify(key)).join(", ");
        throw new Error(`Unknown custom tag ${tagName}; use one of ${keys}`);
      }
      if (!tags2.includes(tagObj))
        tags2.push(tagObj);
      return tags2;
    }, []);
  }
  const sortMapEntriesByKey = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  class Schema {
    constructor({ compat, customTags, merge: merge2, resolveKnownTags, schema: schema2, sortMapEntries, toStringDefaults }) {
      this.compat = Array.isArray(compat) ? getTags(compat, "compat") : compat ? getTags(null, compat) : null;
      this.name = typeof schema2 === "string" && schema2 || "core";
      this.knownTags = resolveKnownTags ? coreKnownTags : {};
      this.tags = getTags(customTags, this.name, merge2);
      this.toStringOptions = toStringDefaults ?? null;
      Object.defineProperty(this, MAP, { value: map });
      Object.defineProperty(this, SCALAR$1, { value: string });
      Object.defineProperty(this, SEQ, { value: seq });
      this.sortMapEntries = typeof sortMapEntries === "function" ? sortMapEntries : sortMapEntries === true ? sortMapEntriesByKey : null;
    }
    clone() {
      const copy = Object.create(Schema.prototype, Object.getOwnPropertyDescriptors(this));
      copy.tags = this.tags.slice();
      return copy;
    }
  }
  function stringifyDocument(doc, options) {
    var _a2;
    const lines = [];
    let hasDirectives = options.directives === true;
    if (options.directives !== false && doc.directives) {
      const dir = doc.directives.toString(doc);
      if (dir) {
        lines.push(dir);
        hasDirectives = true;
      } else if (doc.directives.docStart)
        hasDirectives = true;
    }
    if (hasDirectives)
      lines.push("---");
    const ctx = createStringifyContext(doc, options);
    const { commentString } = ctx.options;
    if (doc.commentBefore) {
      if (lines.length !== 1)
        lines.unshift("");
      const cs = commentString(doc.commentBefore);
      lines.unshift(indentComment(cs, ""));
    }
    let chompKeep = false;
    let contentComment = null;
    if (doc.contents) {
      if (isNode(doc.contents)) {
        if (doc.contents.spaceBefore && hasDirectives)
          lines.push("");
        if (doc.contents.commentBefore) {
          const cs = commentString(doc.contents.commentBefore);
          lines.push(indentComment(cs, ""));
        }
        ctx.forceBlockIndent = !!doc.comment;
        contentComment = doc.contents.comment;
      }
      const onChompKeep = contentComment ? void 0 : () => chompKeep = true;
      let body = stringify(doc.contents, ctx, () => contentComment = null, onChompKeep);
      if (contentComment)
        body += lineComment(body, "", commentString(contentComment));
      if ((body[0] === "|" || body[0] === ">") && lines[lines.length - 1] === "---") {
        lines[lines.length - 1] = `--- ${body}`;
      } else
        lines.push(body);
    } else {
      lines.push(stringify(doc.contents, ctx));
    }
    if ((_a2 = doc.directives) == null ? void 0 : _a2.docEnd) {
      if (doc.comment) {
        const cs = commentString(doc.comment);
        if (cs.includes("\n")) {
          lines.push("...");
          lines.push(indentComment(cs, ""));
        } else {
          lines.push(`... ${cs}`);
        }
      } else {
        lines.push("...");
      }
    } else {
      let dc = doc.comment;
      if (dc && chompKeep)
        dc = dc.replace(/^\n+/, "");
      if (dc) {
        if ((!chompKeep || contentComment) && lines[lines.length - 1] !== "")
          lines.push("");
        lines.push(indentComment(commentString(dc), ""));
      }
    }
    return lines.join("\n") + "\n";
  }
  class Document {
    constructor(value, replacer, options) {
      this.commentBefore = null;
      this.comment = null;
      this.errors = [];
      this.warnings = [];
      Object.defineProperty(this, NODE_TYPE, { value: DOC });
      let _replacer = null;
      if (typeof replacer === "function" || Array.isArray(replacer)) {
        _replacer = replacer;
      } else if (options === void 0 && replacer) {
        options = replacer;
        replacer = void 0;
      }
      const opt = Object.assign({
        intAsBigInt: false,
        keepSourceTokens: false,
        logLevel: "warn",
        prettyErrors: true,
        strict: true,
        stringKeys: false,
        uniqueKeys: true,
        version: "1.2"
      }, options);
      this.options = opt;
      let { version } = opt;
      if (options == null ? void 0 : options._directives) {
        this.directives = options._directives.atDocument();
        if (this.directives.yaml.explicit)
          version = this.directives.yaml.version;
      } else
        this.directives = new Directives({ version });
      this.setSchema(version, options);
      this.contents = value === void 0 ? null : this.createNode(value, _replacer, options);
    }
    /**
     * Create a deep copy of this Document and its contents.
     *
     * Custom Node values that inherit from `Object` still refer to their original instances.
     */
    clone() {
      const copy = Object.create(Document.prototype, {
        [NODE_TYPE]: { value: DOC }
      });
      copy.commentBefore = this.commentBefore;
      copy.comment = this.comment;
      copy.errors = this.errors.slice();
      copy.warnings = this.warnings.slice();
      copy.options = Object.assign({}, this.options);
      if (this.directives)
        copy.directives = this.directives.clone();
      copy.schema = this.schema.clone();
      copy.contents = isNode(this.contents) ? this.contents.clone(copy.schema) : this.contents;
      if (this.range)
        copy.range = this.range.slice();
      return copy;
    }
    /** Adds a value to the document. */
    add(value) {
      if (assertCollection(this.contents))
        this.contents.add(value);
    }
    /** Adds a value to the document. */
    addIn(path, value) {
      if (assertCollection(this.contents))
        this.contents.addIn(path, value);
    }
    /**
     * Create a new `Alias` node, ensuring that the target `node` has the required anchor.
     *
     * If `node` already has an anchor, `name` is ignored.
     * Otherwise, the `node.anchor` value will be set to `name`,
     * or if an anchor with that name is already present in the document,
     * `name` will be used as a prefix for a new unique anchor.
     * If `name` is undefined, the generated anchor will use 'a' as a prefix.
     */
    createAlias(node, name2) {
      if (!node.anchor) {
        const prev2 = anchorNames(this);
        node.anchor = // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        !name2 || prev2.has(name2) ? findNewAnchor(name2 || "a", prev2) : name2;
      }
      return new Alias(node.anchor);
    }
    createNode(value, replacer, options) {
      let _replacer = void 0;
      if (typeof replacer === "function") {
        value = replacer.call({ "": value }, "", value);
        _replacer = replacer;
      } else if (Array.isArray(replacer)) {
        const keyToStr = (v) => typeof v === "number" || v instanceof String || v instanceof Number;
        const asStr = replacer.filter(keyToStr).map(String);
        if (asStr.length > 0)
          replacer = replacer.concat(asStr);
        _replacer = replacer;
      } else if (options === void 0 && replacer) {
        options = replacer;
        replacer = void 0;
      }
      const { aliasDuplicateObjects, anchorPrefix, flow, keepUndefined, onTagObj, tag } = options ?? {};
      const { onAnchor, setAnchors, sourceObjects } = createNodeAnchors(
        this,
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        anchorPrefix || "a"
      );
      const ctx = {
        aliasDuplicateObjects: aliasDuplicateObjects ?? true,
        keepUndefined: keepUndefined ?? false,
        onAnchor,
        onTagObj,
        replacer: _replacer,
        schema: this.schema,
        sourceObjects
      };
      const node = createNode(value, tag, ctx);
      if (flow && isCollection(node))
        node.flow = true;
      setAnchors();
      return node;
    }
    /**
     * Convert a key and a value into a `Pair` using the current schema,
     * recursively wrapping all values as `Scalar` or `Collection` nodes.
     */
    createPair(key, value, options = {}) {
      const k = this.createNode(key, null, options);
      const v = this.createNode(value, null, options);
      return new Pair(k, v);
    }
    /**
     * Removes a value from the document.
     * @returns `true` if the item was found and removed.
     */
    delete(key) {
      return assertCollection(this.contents) ? this.contents.delete(key) : false;
    }
    /**
     * Removes a value from the document.
     * @returns `true` if the item was found and removed.
     */
    deleteIn(path) {
      if (isEmptyPath(path)) {
        if (this.contents == null)
          return false;
        this.contents = null;
        return true;
      }
      return assertCollection(this.contents) ? this.contents.deleteIn(path) : false;
    }
    /**
     * Returns item at `key`, or `undefined` if not found. By default unwraps
     * scalar values from their surrounding node; to disable set `keepScalar` to
     * `true` (collections are always returned intact).
     */
    get(key, keepScalar) {
      return isCollection(this.contents) ? this.contents.get(key, keepScalar) : void 0;
    }
    /**
     * Returns item at `path`, or `undefined` if not found. By default unwraps
     * scalar values from their surrounding node; to disable set `keepScalar` to
     * `true` (collections are always returned intact).
     */
    getIn(path, keepScalar) {
      if (isEmptyPath(path))
        return !keepScalar && isScalar(this.contents) ? this.contents.value : this.contents;
      return isCollection(this.contents) ? this.contents.getIn(path, keepScalar) : void 0;
    }
    /**
     * Checks if the document includes a value with the key `key`.
     */
    has(key) {
      return isCollection(this.contents) ? this.contents.has(key) : false;
    }
    /**
     * Checks if the document includes a value at `path`.
     */
    hasIn(path) {
      if (isEmptyPath(path))
        return this.contents !== void 0;
      return isCollection(this.contents) ? this.contents.hasIn(path) : false;
    }
    /**
     * Sets a value in this document. For `!!set`, `value` needs to be a
     * boolean to add/remove the item from the set.
     */
    set(key, value) {
      if (this.contents == null) {
        this.contents = collectionFromPath(this.schema, [key], value);
      } else if (assertCollection(this.contents)) {
        this.contents.set(key, value);
      }
    }
    /**
     * Sets a value in this document. For `!!set`, `value` needs to be a
     * boolean to add/remove the item from the set.
     */
    setIn(path, value) {
      if (isEmptyPath(path)) {
        this.contents = value;
      } else if (this.contents == null) {
        this.contents = collectionFromPath(this.schema, Array.from(path), value);
      } else if (assertCollection(this.contents)) {
        this.contents.setIn(path, value);
      }
    }
    /**
     * Change the YAML version and schema used by the document.
     * A `null` version disables support for directives, explicit tags, anchors, and aliases.
     * It also requires the `schema` option to be given as a `Schema` instance value.
     *
     * Overrides all previously set schema options.
     */
    setSchema(version, options = {}) {
      if (typeof version === "number")
        version = String(version);
      let opt;
      switch (version) {
        case "1.1":
          if (this.directives)
            this.directives.yaml.version = "1.1";
          else
            this.directives = new Directives({ version: "1.1" });
          opt = { resolveKnownTags: false, schema: "yaml-1.1" };
          break;
        case "1.2":
        case "next":
          if (this.directives)
            this.directives.yaml.version = version;
          else
            this.directives = new Directives({ version });
          opt = { resolveKnownTags: true, schema: "core" };
          break;
        case null:
          if (this.directives)
            delete this.directives;
          opt = null;
          break;
        default: {
          const sv = JSON.stringify(version);
          throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
        }
      }
      if (options.schema instanceof Object)
        this.schema = options.schema;
      else if (opt)
        this.schema = new Schema(Object.assign(opt, options));
      else
        throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
    }
    // json & jsonArg are only used from toJSON()
    toJS({ json, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
      const ctx = {
        anchors: /* @__PURE__ */ new Map(),
        doc: this,
        keep: !json,
        mapAsMap: mapAsMap === true,
        mapKeyWarned: false,
        maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
      };
      const res = toJS(this.contents, jsonArg ?? "", ctx);
      if (typeof onAnchor === "function")
        for (const { count, res: res2 } of ctx.anchors.values())
          onAnchor(res2, count);
      return typeof reviver === "function" ? applyReviver(reviver, { "": res }, "", res) : res;
    }
    /**
     * A JSON representation of the document `contents`.
     *
     * @param jsonArg Used by `JSON.stringify` to indicate the array index or
     *   property name.
     */
    toJSON(jsonArg, onAnchor) {
      return this.toJS({ json: true, jsonArg, mapAsMap: false, onAnchor });
    }
    /** A YAML representation of the document. */
    toString(options = {}) {
      if (this.errors.length > 0)
        throw new Error("Document with errors cannot be stringified");
      if ("indent" in options && (!Number.isInteger(options.indent) || Number(options.indent) <= 0)) {
        const s = JSON.stringify(options.indent);
        throw new Error(`"indent" option must be a positive integer, not ${s}`);
      }
      return stringifyDocument(this, options);
    }
  }
  function assertCollection(contents2) {
    if (isCollection(contents2))
      return true;
    throw new Error("Expected a YAML collection as document contents");
  }
  class YAMLError extends Error {
    constructor(name2, pos, code2, message) {
      super();
      this.name = name2;
      this.code = code2;
      this.message = message;
      this.pos = pos;
    }
  }
  class YAMLParseError extends YAMLError {
    constructor(pos, code2, message) {
      super("YAMLParseError", pos, code2, message);
    }
  }
  class YAMLWarning extends YAMLError {
    constructor(pos, code2, message) {
      super("YAMLWarning", pos, code2, message);
    }
  }
  const prettifyError = (src, lc) => (error2) => {
    if (error2.pos[0] === -1)
      return;
    error2.linePos = error2.pos.map((pos) => lc.linePos(pos));
    const { line, col } = error2.linePos[0];
    error2.message += ` at line ${line}, column ${col}`;
    let ci = col - 1;
    let lineStr = src.substring(lc.lineStarts[line - 1], lc.lineStarts[line]).replace(/[\n\r]+$/, "");
    if (ci >= 60 && lineStr.length > 80) {
      const trimStart = Math.min(ci - 39, lineStr.length - 79);
      lineStr = "…" + lineStr.substring(trimStart);
      ci -= trimStart - 1;
    }
    if (lineStr.length > 80)
      lineStr = lineStr.substring(0, 79) + "…";
    if (line > 1 && /^ *$/.test(lineStr.substring(0, ci))) {
      let prev2 = src.substring(lc.lineStarts[line - 2], lc.lineStarts[line - 1]);
      if (prev2.length > 80)
        prev2 = prev2.substring(0, 79) + "…\n";
      lineStr = prev2 + lineStr;
    }
    if (/[^ ]/.test(lineStr)) {
      let count = 1;
      const end2 = error2.linePos[1];
      if (end2 && end2.line === line && end2.col > col) {
        count = Math.max(1, Math.min(end2.col - col, 80 - ci));
      }
      const pointer = " ".repeat(ci) + "^".repeat(count);
      error2.message += `:

${lineStr}
${pointer}
`;
    }
  };
  function resolveProps(tokens, { flow, indicator, next: next2, offset, onError, parentIndent, startOnNewline }) {
    let spaceBefore = false;
    let atNewline = startOnNewline;
    let hasSpace = startOnNewline;
    let comment2 = "";
    let commentSep = "";
    let hasNewline = false;
    let reqSpace = false;
    let tab = null;
    let anchor = null;
    let tag = null;
    let newlineAfterProp = null;
    let comma = null;
    let found = null;
    let start = null;
    for (const token of tokens) {
      if (reqSpace) {
        if (token.type !== "space" && token.type !== "newline" && token.type !== "comma")
          onError(token.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
        reqSpace = false;
      }
      if (tab) {
        if (atNewline && token.type !== "comment" && token.type !== "newline") {
          onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
        }
        tab = null;
      }
      switch (token.type) {
        case "space":
          if (!flow && (indicator !== "doc-start" || (next2 == null ? void 0 : next2.type) !== "flow-collection") && token.source.includes("	")) {
            tab = token;
          }
          hasSpace = true;
          break;
        case "comment": {
          if (!hasSpace)
            onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
          const cb = token.source.substring(1) || " ";
          if (!comment2)
            comment2 = cb;
          else
            comment2 += commentSep + cb;
          commentSep = "";
          atNewline = false;
          break;
        }
        case "newline":
          if (atNewline) {
            if (comment2)
              comment2 += token.source;
            else
              spaceBefore = true;
          } else
            commentSep += token.source;
          atNewline = true;
          hasNewline = true;
          if (anchor || tag)
            newlineAfterProp = token;
          hasSpace = true;
          break;
        case "anchor":
          if (anchor)
            onError(token, "MULTIPLE_ANCHORS", "A node can have at most one anchor");
          if (token.source.endsWith(":"))
            onError(token.offset + token.source.length - 1, "BAD_ALIAS", "Anchor ending in : is ambiguous", true);
          anchor = token;
          if (start === null)
            start = token.offset;
          atNewline = false;
          hasSpace = false;
          reqSpace = true;
          break;
        case "tag": {
          if (tag)
            onError(token, "MULTIPLE_TAGS", "A node can have at most one tag");
          tag = token;
          if (start === null)
            start = token.offset;
          atNewline = false;
          hasSpace = false;
          reqSpace = true;
          break;
        }
        case indicator:
          if (anchor || tag)
            onError(token, "BAD_PROP_ORDER", `Anchors and tags must be after the ${token.source} indicator`);
          if (found)
            onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.source} in ${flow ?? "collection"}`);
          found = token;
          atNewline = indicator === "seq-item-ind" || indicator === "explicit-key-ind";
          hasSpace = false;
          break;
        case "comma":
          if (flow) {
            if (comma)
              onError(token, "UNEXPECTED_TOKEN", `Unexpected , in ${flow}`);
            comma = token;
            atNewline = false;
            hasSpace = false;
            break;
          }
        // else fallthrough
        default:
          onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.type} token`);
          atNewline = false;
          hasSpace = false;
      }
    }
    const last2 = tokens[tokens.length - 1];
    const end2 = last2 ? last2.offset + last2.source.length : offset;
    if (reqSpace && next2 && next2.type !== "space" && next2.type !== "newline" && next2.type !== "comma" && (next2.type !== "scalar" || next2.source !== "")) {
      onError(next2.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
    }
    if (tab && (atNewline && tab.indent <= parentIndent || (next2 == null ? void 0 : next2.type) === "block-map" || (next2 == null ? void 0 : next2.type) === "block-seq"))
      onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
    return {
      comma,
      found,
      spaceBefore,
      comment: comment2,
      hasNewline,
      anchor,
      tag,
      newlineAfterProp,
      end: end2,
      start: start ?? end2
    };
  }
  function containsNewline(key) {
    if (!key)
      return null;
    switch (key.type) {
      case "alias":
      case "scalar":
      case "double-quoted-scalar":
      case "single-quoted-scalar":
        if (key.source.includes("\n"))
          return true;
        if (key.end) {
          for (const st of key.end)
            if (st.type === "newline")
              return true;
        }
        return false;
      case "flow-collection":
        for (const it of key.items) {
          for (const st of it.start)
            if (st.type === "newline")
              return true;
          if (it.sep) {
            for (const st of it.sep)
              if (st.type === "newline")
                return true;
          }
          if (containsNewline(it.key) || containsNewline(it.value))
            return true;
        }
        return false;
      default:
        return true;
    }
  }
  function flowIndentCheck(indent, fc, onError) {
    if ((fc == null ? void 0 : fc.type) === "flow-collection") {
      const end2 = fc.end[0];
      if (end2.indent === indent && (end2.source === "]" || end2.source === "}") && containsNewline(fc)) {
        const msg = "Flow end indicator should be more indented than parent";
        onError(end2, "BAD_INDENT", msg, true);
      }
    }
  }
  function mapIncludes(ctx, items, search) {
    const { uniqueKeys } = ctx.options;
    if (uniqueKeys === false)
      return false;
    const isEqual = typeof uniqueKeys === "function" ? uniqueKeys : (a, b) => a === b || isScalar(a) && isScalar(b) && a.value === b.value;
    return items.some((pair) => isEqual(pair.key, search));
  }
  const startColMsg = "All mapping items must start at the same column";
  function resolveBlockMap({ composeNode: composeNode2, composeEmptyNode: composeEmptyNode2 }, ctx, bm, onError, tag) {
    var _a2;
    const NodeClass = (tag == null ? void 0 : tag.nodeClass) ?? YAMLMap;
    const map2 = new NodeClass(ctx.schema);
    if (ctx.atRoot)
      ctx.atRoot = false;
    let offset = bm.offset;
    let commentEnd = null;
    for (const collItem of bm.items) {
      const { start, key, sep, value } = collItem;
      const keyProps = resolveProps(start, {
        indicator: "explicit-key-ind",
        next: key ?? (sep == null ? void 0 : sep[0]),
        offset,
        onError,
        parentIndent: bm.indent,
        startOnNewline: true
      });
      const implicitKey = !keyProps.found;
      if (implicitKey) {
        if (key) {
          if (key.type === "block-seq")
            onError(offset, "BLOCK_AS_IMPLICIT_KEY", "A block sequence may not be used as an implicit map key");
          else if ("indent" in key && key.indent !== bm.indent)
            onError(offset, "BAD_INDENT", startColMsg);
        }
        if (!keyProps.anchor && !keyProps.tag && !sep) {
          commentEnd = keyProps.end;
          if (keyProps.comment) {
            if (map2.comment)
              map2.comment += "\n" + keyProps.comment;
            else
              map2.comment = keyProps.comment;
          }
          continue;
        }
        if (keyProps.newlineAfterProp || containsNewline(key)) {
          onError(key ?? start[start.length - 1], "MULTILINE_IMPLICIT_KEY", "Implicit keys need to be on a single line");
        }
      } else if (((_a2 = keyProps.found) == null ? void 0 : _a2.indent) !== bm.indent) {
        onError(offset, "BAD_INDENT", startColMsg);
      }
      ctx.atKey = true;
      const keyStart = keyProps.end;
      const keyNode = key ? composeNode2(ctx, key, keyProps, onError) : composeEmptyNode2(ctx, keyStart, start, null, keyProps, onError);
      if (ctx.schema.compat)
        flowIndentCheck(bm.indent, key, onError);
      ctx.atKey = false;
      if (mapIncludes(ctx, map2.items, keyNode))
        onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
      const valueProps = resolveProps(sep ?? [], {
        indicator: "map-value-ind",
        next: value,
        offset: keyNode.range[2],
        onError,
        parentIndent: bm.indent,
        startOnNewline: !key || key.type === "block-scalar"
      });
      offset = valueProps.end;
      if (valueProps.found) {
        if (implicitKey) {
          if ((value == null ? void 0 : value.type) === "block-map" && !valueProps.hasNewline)
            onError(offset, "BLOCK_AS_IMPLICIT_KEY", "Nested mappings are not allowed in compact mappings");
          if (ctx.options.strict && keyProps.start < valueProps.found.offset - 1024)
            onError(keyNode.range, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit block mapping key");
        }
        const valueNode = value ? composeNode2(ctx, value, valueProps, onError) : composeEmptyNode2(ctx, offset, sep, null, valueProps, onError);
        if (ctx.schema.compat)
          flowIndentCheck(bm.indent, value, onError);
        offset = valueNode.range[2];
        const pair = new Pair(keyNode, valueNode);
        if (ctx.options.keepSourceTokens)
          pair.srcToken = collItem;
        map2.items.push(pair);
      } else {
        if (implicitKey)
          onError(keyNode.range, "MISSING_CHAR", "Implicit map keys need to be followed by map values");
        if (valueProps.comment) {
          if (keyNode.comment)
            keyNode.comment += "\n" + valueProps.comment;
          else
            keyNode.comment = valueProps.comment;
        }
        const pair = new Pair(keyNode);
        if (ctx.options.keepSourceTokens)
          pair.srcToken = collItem;
        map2.items.push(pair);
      }
    }
    if (commentEnd && commentEnd < offset)
      onError(commentEnd, "IMPOSSIBLE", "Map comment with trailing content");
    map2.range = [bm.offset, offset, commentEnd ?? offset];
    return map2;
  }
  function resolveBlockSeq({ composeNode: composeNode2, composeEmptyNode: composeEmptyNode2 }, ctx, bs, onError, tag) {
    const NodeClass = (tag == null ? void 0 : tag.nodeClass) ?? YAMLSeq;
    const seq2 = new NodeClass(ctx.schema);
    if (ctx.atRoot)
      ctx.atRoot = false;
    if (ctx.atKey)
      ctx.atKey = false;
    let offset = bs.offset;
    let commentEnd = null;
    for (const { start, value } of bs.items) {
      const props = resolveProps(start, {
        indicator: "seq-item-ind",
        next: value,
        offset,
        onError,
        parentIndent: bs.indent,
        startOnNewline: true
      });
      if (!props.found) {
        if (props.anchor || props.tag || value) {
          if (value && value.type === "block-seq")
            onError(props.end, "BAD_INDENT", "All sequence items must start at the same column");
          else
            onError(offset, "MISSING_CHAR", "Sequence item without - indicator");
        } else {
          commentEnd = props.end;
          if (props.comment)
            seq2.comment = props.comment;
          continue;
        }
      }
      const node = value ? composeNode2(ctx, value, props, onError) : composeEmptyNode2(ctx, props.end, start, null, props, onError);
      if (ctx.schema.compat)
        flowIndentCheck(bs.indent, value, onError);
      offset = node.range[2];
      seq2.items.push(node);
    }
    seq2.range = [bs.offset, offset, commentEnd ?? offset];
    return seq2;
  }
  function resolveEnd(end2, offset, reqSpace, onError) {
    let comment2 = "";
    if (end2) {
      let hasSpace = false;
      let sep = "";
      for (const token of end2) {
        const { source, type } = token;
        switch (type) {
          case "space":
            hasSpace = true;
            break;
          case "comment": {
            if (reqSpace && !hasSpace)
              onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
            const cb = source.substring(1) || " ";
            if (!comment2)
              comment2 = cb;
            else
              comment2 += sep + cb;
            sep = "";
            break;
          }
          case "newline":
            if (comment2)
              sep += source;
            hasSpace = true;
            break;
          default:
            onError(token, "UNEXPECTED_TOKEN", `Unexpected ${type} at node end`);
        }
        offset += source.length;
      }
    }
    return { comment: comment2, offset };
  }
  const blockMsg = "Block collections are not allowed within flow collections";
  const isBlock = (token) => token && (token.type === "block-map" || token.type === "block-seq");
  function resolveFlowCollection({ composeNode: composeNode2, composeEmptyNode: composeEmptyNode2 }, ctx, fc, onError, tag) {
    const isMap2 = fc.start.source === "{";
    const fcName = isMap2 ? "flow map" : "flow sequence";
    const NodeClass = (tag == null ? void 0 : tag.nodeClass) ?? (isMap2 ? YAMLMap : YAMLSeq);
    const coll = new NodeClass(ctx.schema);
    coll.flow = true;
    const atRoot = ctx.atRoot;
    if (atRoot)
      ctx.atRoot = false;
    if (ctx.atKey)
      ctx.atKey = false;
    let offset = fc.offset + fc.start.source.length;
    for (let i = 0; i < fc.items.length; ++i) {
      const collItem = fc.items[i];
      const { start, key, sep, value } = collItem;
      const props = resolveProps(start, {
        flow: fcName,
        indicator: "explicit-key-ind",
        next: key ?? (sep == null ? void 0 : sep[0]),
        offset,
        onError,
        parentIndent: fc.indent,
        startOnNewline: false
      });
      if (!props.found) {
        if (!props.anchor && !props.tag && !sep && !value) {
          if (i === 0 && props.comma)
            onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
          else if (i < fc.items.length - 1)
            onError(props.start, "UNEXPECTED_TOKEN", `Unexpected empty item in ${fcName}`);
          if (props.comment) {
            if (coll.comment)
              coll.comment += "\n" + props.comment;
            else
              coll.comment = props.comment;
          }
          offset = props.end;
          continue;
        }
        if (!isMap2 && ctx.options.strict && containsNewline(key))
          onError(
            key,
            // checked by containsNewline()
            "MULTILINE_IMPLICIT_KEY",
            "Implicit keys of flow sequence pairs need to be on a single line"
          );
      }
      if (i === 0) {
        if (props.comma)
          onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
      } else {
        if (!props.comma)
          onError(props.start, "MISSING_CHAR", `Missing , between ${fcName} items`);
        if (props.comment) {
          let prevItemComment = "";
          loop: for (const st of start) {
            switch (st.type) {
              case "comma":
              case "space":
                break;
              case "comment":
                prevItemComment = st.source.substring(1);
                break loop;
              default:
                break loop;
            }
          }
          if (prevItemComment) {
            let prev2 = coll.items[coll.items.length - 1];
            if (isPair(prev2))
              prev2 = prev2.value ?? prev2.key;
            if (prev2.comment)
              prev2.comment += "\n" + prevItemComment;
            else
              prev2.comment = prevItemComment;
            props.comment = props.comment.substring(prevItemComment.length + 1);
          }
        }
      }
      if (!isMap2 && !sep && !props.found) {
        const valueNode = value ? composeNode2(ctx, value, props, onError) : composeEmptyNode2(ctx, props.end, sep, null, props, onError);
        coll.items.push(valueNode);
        offset = valueNode.range[2];
        if (isBlock(value))
          onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
      } else {
        ctx.atKey = true;
        const keyStart = props.end;
        const keyNode = key ? composeNode2(ctx, key, props, onError) : composeEmptyNode2(ctx, keyStart, start, null, props, onError);
        if (isBlock(key))
          onError(keyNode.range, "BLOCK_IN_FLOW", blockMsg);
        ctx.atKey = false;
        const valueProps = resolveProps(sep ?? [], {
          flow: fcName,
          indicator: "map-value-ind",
          next: value,
          offset: keyNode.range[2],
          onError,
          parentIndent: fc.indent,
          startOnNewline: false
        });
        if (valueProps.found) {
          if (!isMap2 && !props.found && ctx.options.strict) {
            if (sep)
              for (const st of sep) {
                if (st === valueProps.found)
                  break;
                if (st.type === "newline") {
                  onError(st, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
                  break;
                }
              }
            if (props.start < valueProps.found.offset - 1024)
              onError(valueProps.found, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit flow sequence key");
          }
        } else if (value) {
          if ("source" in value && value.source && value.source[0] === ":")
            onError(value, "MISSING_CHAR", `Missing space after : in ${fcName}`);
          else
            onError(valueProps.start, "MISSING_CHAR", `Missing , or : between ${fcName} items`);
        }
        const valueNode = value ? composeNode2(ctx, value, valueProps, onError) : valueProps.found ? composeEmptyNode2(ctx, valueProps.end, sep, null, valueProps, onError) : null;
        if (valueNode) {
          if (isBlock(value))
            onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
        } else if (valueProps.comment) {
          if (keyNode.comment)
            keyNode.comment += "\n" + valueProps.comment;
          else
            keyNode.comment = valueProps.comment;
        }
        const pair = new Pair(keyNode, valueNode);
        if (ctx.options.keepSourceTokens)
          pair.srcToken = collItem;
        if (isMap2) {
          const map2 = coll;
          if (mapIncludes(ctx, map2.items, keyNode))
            onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
          map2.items.push(pair);
        } else {
          const map2 = new YAMLMap(ctx.schema);
          map2.flow = true;
          map2.items.push(pair);
          const endRange = (valueNode ?? keyNode).range;
          map2.range = [keyNode.range[0], endRange[1], endRange[2]];
          coll.items.push(map2);
        }
        offset = valueNode ? valueNode.range[2] : valueProps.end;
      }
    }
    const expectedEnd = isMap2 ? "}" : "]";
    const [ce, ...ee] = fc.end;
    let cePos = offset;
    if (ce && ce.source === expectedEnd)
      cePos = ce.offset + ce.source.length;
    else {
      const name2 = fcName[0].toUpperCase() + fcName.substring(1);
      const msg = atRoot ? `${name2} must end with a ${expectedEnd}` : `${name2} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
      onError(offset, atRoot ? "MISSING_CHAR" : "BAD_INDENT", msg);
      if (ce && ce.source.length !== 1)
        ee.unshift(ce);
    }
    if (ee.length > 0) {
      const end2 = resolveEnd(ee, cePos, ctx.options.strict, onError);
      if (end2.comment) {
        if (coll.comment)
          coll.comment += "\n" + end2.comment;
        else
          coll.comment = end2.comment;
      }
      coll.range = [fc.offset, cePos, end2.offset];
    } else {
      coll.range = [fc.offset, cePos, cePos];
    }
    return coll;
  }
  function resolveCollection(CN2, ctx, token, onError, tagName, tag) {
    const coll = token.type === "block-map" ? resolveBlockMap(CN2, ctx, token, onError, tag) : token.type === "block-seq" ? resolveBlockSeq(CN2, ctx, token, onError, tag) : resolveFlowCollection(CN2, ctx, token, onError, tag);
    const Coll = coll.constructor;
    if (tagName === "!" || tagName === Coll.tagName) {
      coll.tag = Coll.tagName;
      return coll;
    }
    if (tagName)
      coll.tag = tagName;
    return coll;
  }
  function composeCollection(CN2, ctx, token, props, onError) {
    var _a2;
    const tagToken = props.tag;
    const tagName = !tagToken ? null : ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg));
    if (token.type === "block-seq") {
      const { anchor, newlineAfterProp: nl } = props;
      const lastProp = anchor && tagToken ? anchor.offset > tagToken.offset ? anchor : tagToken : anchor ?? tagToken;
      if (lastProp && (!nl || nl.offset < lastProp.offset)) {
        const message = "Missing newline after block sequence props";
        onError(lastProp, "MISSING_CHAR", message);
      }
    }
    const expType = token.type === "block-map" ? "map" : token.type === "block-seq" ? "seq" : token.start.source === "{" ? "map" : "seq";
    if (!tagToken || !tagName || tagName === "!" || tagName === YAMLMap.tagName && expType === "map" || tagName === YAMLSeq.tagName && expType === "seq") {
      return resolveCollection(CN2, ctx, token, onError, tagName);
    }
    let tag = ctx.schema.tags.find((t) => t.tag === tagName && t.collection === expType);
    if (!tag) {
      const kt = ctx.schema.knownTags[tagName];
      if (kt && kt.collection === expType) {
        ctx.schema.tags.push(Object.assign({}, kt, { default: false }));
        tag = kt;
      } else {
        if (kt == null ? void 0 : kt.collection) {
          onError(tagToken, "BAD_COLLECTION_TYPE", `${kt.tag} used for ${expType} collection, but expects ${kt.collection}`, true);
        } else {
          onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, true);
        }
        return resolveCollection(CN2, ctx, token, onError, tagName);
      }
    }
    const coll = resolveCollection(CN2, ctx, token, onError, tagName, tag);
    const res = ((_a2 = tag.resolve) == null ? void 0 : _a2.call(tag, coll, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg), ctx.options)) ?? coll;
    const node = isNode(res) ? res : new Scalar(res);
    node.range = coll.range;
    node.tag = tagName;
    if (tag == null ? void 0 : tag.format)
      node.format = tag.format;
    return node;
  }
  function resolveBlockScalar(ctx, scalar, onError) {
    const start = scalar.offset;
    const header = parseBlockScalarHeader(scalar, ctx.options.strict, onError);
    if (!header)
      return { value: "", type: null, comment: "", range: [start, start, start] };
    const type = header.mode === ">" ? Scalar.BLOCK_FOLDED : Scalar.BLOCK_LITERAL;
    const lines = scalar.source ? splitLines(scalar.source) : [];
    let chompStart = lines.length;
    for (let i = lines.length - 1; i >= 0; --i) {
      const content = lines[i][1];
      if (content === "" || content === "\r")
        chompStart = i;
      else
        break;
    }
    if (chompStart === 0) {
      const value2 = header.chomp === "+" && lines.length > 0 ? "\n".repeat(Math.max(1, lines.length - 1)) : "";
      let end3 = start + header.length;
      if (scalar.source)
        end3 += scalar.source.length;
      return { value: value2, type, comment: header.comment, range: [start, end3, end3] };
    }
    let trimIndent = scalar.indent + header.indent;
    let offset = scalar.offset + header.length;
    let contentStart = 0;
    for (let i = 0; i < chompStart; ++i) {
      const [indent, content] = lines[i];
      if (content === "" || content === "\r") {
        if (header.indent === 0 && indent.length > trimIndent)
          trimIndent = indent.length;
      } else {
        if (indent.length < trimIndent) {
          const message = "Block scalars with more-indented leading empty lines must use an explicit indentation indicator";
          onError(offset + indent.length, "MISSING_CHAR", message);
        }
        if (header.indent === 0)
          trimIndent = indent.length;
        contentStart = i;
        if (trimIndent === 0 && !ctx.atRoot) {
          const message = "Block scalar values in collections must be indented";
          onError(offset, "BAD_INDENT", message);
        }
        break;
      }
      offset += indent.length + content.length + 1;
    }
    for (let i = lines.length - 1; i >= chompStart; --i) {
      if (lines[i][0].length > trimIndent)
        chompStart = i + 1;
    }
    let value = "";
    let sep = "";
    let prevMoreIndented = false;
    for (let i = 0; i < contentStart; ++i)
      value += lines[i][0].slice(trimIndent) + "\n";
    for (let i = contentStart; i < chompStart; ++i) {
      let [indent, content] = lines[i];
      offset += indent.length + content.length + 1;
      const crlf = content[content.length - 1] === "\r";
      if (crlf)
        content = content.slice(0, -1);
      if (content && indent.length < trimIndent) {
        const src = header.indent ? "explicit indentation indicator" : "first line";
        const message = `Block scalar lines must not be less indented than their ${src}`;
        onError(offset - content.length - (crlf ? 2 : 1), "BAD_INDENT", message);
        indent = "";
      }
      if (type === Scalar.BLOCK_LITERAL) {
        value += sep + indent.slice(trimIndent) + content;
        sep = "\n";
      } else if (indent.length > trimIndent || content[0] === "	") {
        if (sep === " ")
          sep = "\n";
        else if (!prevMoreIndented && sep === "\n")
          sep = "\n\n";
        value += sep + indent.slice(trimIndent) + content;
        sep = "\n";
        prevMoreIndented = true;
      } else if (content === "") {
        if (sep === "\n")
          value += "\n";
        else
          sep = "\n";
      } else {
        value += sep + content;
        sep = " ";
        prevMoreIndented = false;
      }
    }
    switch (header.chomp) {
      case "-":
        break;
      case "+":
        for (let i = chompStart; i < lines.length; ++i)
          value += "\n" + lines[i][0].slice(trimIndent);
        if (value[value.length - 1] !== "\n")
          value += "\n";
        break;
      default:
        value += "\n";
    }
    const end2 = start + header.length + scalar.source.length;
    return { value, type, comment: header.comment, range: [start, end2, end2] };
  }
  function parseBlockScalarHeader({ offset, props }, strict, onError) {
    if (props[0].type !== "block-scalar-header") {
      onError(props[0], "IMPOSSIBLE", "Block scalar header not found");
      return null;
    }
    const { source } = props[0];
    const mode = source[0];
    let indent = 0;
    let chomp = "";
    let error2 = -1;
    for (let i = 1; i < source.length; ++i) {
      const ch = source[i];
      if (!chomp && (ch === "-" || ch === "+"))
        chomp = ch;
      else {
        const n = Number(ch);
        if (!indent && n)
          indent = n;
        else if (error2 === -1)
          error2 = offset + i;
      }
    }
    if (error2 !== -1)
      onError(error2, "UNEXPECTED_TOKEN", `Block scalar header includes extra characters: ${source}`);
    let hasSpace = false;
    let comment2 = "";
    let length = source.length;
    for (let i = 1; i < props.length; ++i) {
      const token = props[i];
      switch (token.type) {
        case "space":
          hasSpace = true;
        // fallthrough
        case "newline":
          length += token.source.length;
          break;
        case "comment":
          if (strict && !hasSpace) {
            const message = "Comments must be separated from other tokens by white space characters";
            onError(token, "MISSING_CHAR", message);
          }
          length += token.source.length;
          comment2 = token.source.substring(1);
          break;
        case "error":
          onError(token, "UNEXPECTED_TOKEN", token.message);
          length += token.source.length;
          break;
        /* istanbul ignore next should not happen */
        default: {
          const message = `Unexpected token in block scalar header: ${token.type}`;
          onError(token, "UNEXPECTED_TOKEN", message);
          const ts = token.source;
          if (ts && typeof ts === "string")
            length += ts.length;
        }
      }
    }
    return { mode, indent, chomp, comment: comment2, length };
  }
  function splitLines(source) {
    const split = source.split(/\n( *)/);
    const first2 = split[0];
    const m = first2.match(/^( *)/);
    const line0 = (m == null ? void 0 : m[1]) ? [m[1], first2.slice(m[1].length)] : ["", first2];
    const lines = [line0];
    for (let i = 1; i < split.length; i += 2)
      lines.push([split[i], split[i + 1]]);
    return lines;
  }
  function resolveFlowScalar(scalar, strict, onError) {
    const { offset, type, source, end: end2 } = scalar;
    let _type;
    let value;
    const _onError = (rel, code2, msg) => onError(offset + rel, code2, msg);
    switch (type) {
      case "scalar":
        _type = Scalar.PLAIN;
        value = plainValue(source, _onError);
        break;
      case "single-quoted-scalar":
        _type = Scalar.QUOTE_SINGLE;
        value = singleQuotedValue(source, _onError);
        break;
      case "double-quoted-scalar":
        _type = Scalar.QUOTE_DOUBLE;
        value = doubleQuotedValue(source, _onError);
        break;
      /* istanbul ignore next should not happen */
      default:
        onError(scalar, "UNEXPECTED_TOKEN", `Expected a flow scalar value, but found: ${type}`);
        return {
          value: "",
          type: null,
          comment: "",
          range: [offset, offset + source.length, offset + source.length]
        };
    }
    const valueEnd = offset + source.length;
    const re = resolveEnd(end2, valueEnd, strict, onError);
    return {
      value,
      type: _type,
      comment: re.comment,
      range: [offset, valueEnd, re.offset]
    };
  }
  function plainValue(source, onError) {
    let badChar = "";
    switch (source[0]) {
      /* istanbul ignore next should not happen */
      case "	":
        badChar = "a tab character";
        break;
      case ",":
        badChar = "flow indicator character ,";
        break;
      case "%":
        badChar = "directive indicator character %";
        break;
      case "|":
      case ">": {
        badChar = `block scalar indicator ${source[0]}`;
        break;
      }
      case "@":
      case "`": {
        badChar = `reserved character ${source[0]}`;
        break;
      }
    }
    if (badChar)
      onError(0, "BAD_SCALAR_START", `Plain value cannot start with ${badChar}`);
    return foldLines(source);
  }
  function singleQuotedValue(source, onError) {
    if (source[source.length - 1] !== "'" || source.length === 1)
      onError(source.length, "MISSING_CHAR", "Missing closing 'quote");
    return foldLines(source.slice(1, -1)).replace(/''/g, "'");
  }
  function foldLines(source) {
    let first2, line;
    try {
      first2 = new RegExp("(.*?)(?<![ 	])[ 	]*\r?\n", "sy");
      line = new RegExp("[ 	]*(.*?)(?:(?<![ 	])[ 	]*)?\r?\n", "sy");
    } catch {
      first2 = /(.*?)[ \t]*\r?\n/sy;
      line = /[ \t]*(.*?)[ \t]*\r?\n/sy;
    }
    let match = first2.exec(source);
    if (!match)
      return source;
    let res = match[1];
    let sep = " ";
    let pos = first2.lastIndex;
    line.lastIndex = pos;
    while (match = line.exec(source)) {
      if (match[1] === "") {
        if (sep === "\n")
          res += sep;
        else
          sep = "\n";
      } else {
        res += sep + match[1];
        sep = " ";
      }
      pos = line.lastIndex;
    }
    const last2 = /[ \t]*(.*)/sy;
    last2.lastIndex = pos;
    match = last2.exec(source);
    return res + sep + ((match == null ? void 0 : match[1]) ?? "");
  }
  function doubleQuotedValue(source, onError) {
    let res = "";
    for (let i = 1; i < source.length - 1; ++i) {
      const ch = source[i];
      if (ch === "\r" && source[i + 1] === "\n")
        continue;
      if (ch === "\n") {
        const { fold, offset } = foldNewline(source, i);
        res += fold;
        i = offset;
      } else if (ch === "\\") {
        let next2 = source[++i];
        const cc = escapeCodes[next2];
        if (cc)
          res += cc;
        else if (next2 === "\n") {
          next2 = source[i + 1];
          while (next2 === " " || next2 === "	")
            next2 = source[++i + 1];
        } else if (next2 === "\r" && source[i + 1] === "\n") {
          next2 = source[++i + 1];
          while (next2 === " " || next2 === "	")
            next2 = source[++i + 1];
        } else if (next2 === "x" || next2 === "u" || next2 === "U") {
          const length = { x: 2, u: 4, U: 8 }[next2];
          res += parseCharCode(source, i + 1, length, onError);
          i += length;
        } else {
          const raw = source.substr(i - 1, 2);
          onError(i - 1, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
          res += raw;
        }
      } else if (ch === " " || ch === "	") {
        const wsStart = i;
        let next2 = source[i + 1];
        while (next2 === " " || next2 === "	")
          next2 = source[++i + 1];
        if (next2 !== "\n" && !(next2 === "\r" && source[i + 2] === "\n"))
          res += i > wsStart ? source.slice(wsStart, i + 1) : ch;
      } else {
        res += ch;
      }
    }
    if (source[source.length - 1] !== '"' || source.length === 1)
      onError(source.length, "MISSING_CHAR", 'Missing closing "quote');
    return res;
  }
  function foldNewline(source, offset) {
    let fold = "";
    let ch = source[offset + 1];
    while (ch === " " || ch === "	" || ch === "\n" || ch === "\r") {
      if (ch === "\r" && source[offset + 2] !== "\n")
        break;
      if (ch === "\n")
        fold += "\n";
      offset += 1;
      ch = source[offset + 1];
    }
    if (!fold)
      fold = " ";
    return { fold, offset };
  }
  const escapeCodes = {
    "0": "\0",
    // null character
    a: "\x07",
    // bell character
    b: "\b",
    // backspace
    e: "\x1B",
    // escape character
    f: "\f",
    // form feed
    n: "\n",
    // line feed
    r: "\r",
    // carriage return
    t: "	",
    // horizontal tab
    v: "\v",
    // vertical tab
    N: "",
    // Unicode next line
    _: " ",
    // Unicode non-breaking space
    L: "\u2028",
    // Unicode line separator
    P: "\u2029",
    // Unicode paragraph separator
    " ": " ",
    '"': '"',
    "/": "/",
    "\\": "\\",
    "	": "	"
  };
  function parseCharCode(source, offset, length, onError) {
    const cc = source.substr(offset, length);
    const ok = cc.length === length && /^[0-9a-fA-F]+$/.test(cc);
    const code2 = ok ? parseInt(cc, 16) : NaN;
    if (isNaN(code2)) {
      const raw = source.substr(offset - 2, length + 2);
      onError(offset - 2, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
      return raw;
    }
    return String.fromCodePoint(code2);
  }
  function composeScalar(ctx, token, tagToken, onError) {
    const { value, type, comment: comment2, range } = token.type === "block-scalar" ? resolveBlockScalar(ctx, token, onError) : resolveFlowScalar(token, ctx.options.strict, onError);
    const tagName = tagToken ? ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg)) : null;
    let tag;
    if (ctx.options.stringKeys && ctx.atKey) {
      tag = ctx.schema[SCALAR$1];
    } else if (tagName)
      tag = findScalarTagByName(ctx.schema, value, tagName, tagToken, onError);
    else if (token.type === "scalar")
      tag = findScalarTagByTest(ctx, value, token, onError);
    else
      tag = ctx.schema[SCALAR$1];
    let scalar;
    try {
      const res = tag.resolve(value, (msg) => onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg), ctx.options);
      scalar = isScalar(res) ? res : new Scalar(res);
    } catch (error2) {
      const msg = error2 instanceof Error ? error2.message : String(error2);
      onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg);
      scalar = new Scalar(value);
    }
    scalar.range = range;
    scalar.source = value;
    if (type)
      scalar.type = type;
    if (tagName)
      scalar.tag = tagName;
    if (tag.format)
      scalar.format = tag.format;
    if (comment2)
      scalar.comment = comment2;
    return scalar;
  }
  function findScalarTagByName(schema2, value, tagName, tagToken, onError) {
    var _a2;
    if (tagName === "!")
      return schema2[SCALAR$1];
    const matchWithTest = [];
    for (const tag of schema2.tags) {
      if (!tag.collection && tag.tag === tagName) {
        if (tag.default && tag.test)
          matchWithTest.push(tag);
        else
          return tag;
      }
    }
    for (const tag of matchWithTest)
      if ((_a2 = tag.test) == null ? void 0 : _a2.test(value))
        return tag;
    const kt = schema2.knownTags[tagName];
    if (kt && !kt.collection) {
      schema2.tags.push(Object.assign({}, kt, { default: false, test: void 0 }));
      return kt;
    }
    onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, tagName !== "tag:yaml.org,2002:str");
    return schema2[SCALAR$1];
  }
  function findScalarTagByTest({ atKey, directives, schema: schema2 }, value, token, onError) {
    const tag = schema2.tags.find((tag2) => {
      var _a2;
      return (tag2.default === true || atKey && tag2.default === "key") && ((_a2 = tag2.test) == null ? void 0 : _a2.test(value));
    }) || schema2[SCALAR$1];
    if (schema2.compat) {
      const compat = schema2.compat.find((tag2) => {
        var _a2;
        return tag2.default && ((_a2 = tag2.test) == null ? void 0 : _a2.test(value));
      }) ?? schema2[SCALAR$1];
      if (tag.tag !== compat.tag) {
        const ts = directives.tagString(tag.tag);
        const cs = directives.tagString(compat.tag);
        const msg = `Value may be parsed as either ${ts} or ${cs}`;
        onError(token, "TAG_RESOLVE_FAILED", msg, true);
      }
    }
    return tag;
  }
  function emptyScalarPosition(offset, before2, pos) {
    if (before2) {
      if (pos === null)
        pos = before2.length;
      for (let i = pos - 1; i >= 0; --i) {
        let st = before2[i];
        switch (st.type) {
          case "space":
          case "comment":
          case "newline":
            offset -= st.source.length;
            continue;
        }
        st = before2[++i];
        while ((st == null ? void 0 : st.type) === "space") {
          offset += st.source.length;
          st = before2[++i];
        }
        break;
      }
    }
    return offset;
  }
  const CN = { composeNode, composeEmptyNode };
  function composeNode(ctx, token, props, onError) {
    const atKey = ctx.atKey;
    const { spaceBefore, comment: comment2, anchor, tag } = props;
    let node;
    let isSrcToken = true;
    switch (token.type) {
      case "alias":
        node = composeAlias(ctx, token, onError);
        if (anchor || tag)
          onError(token, "ALIAS_PROPS", "An alias node must not specify any properties");
        break;
      case "scalar":
      case "single-quoted-scalar":
      case "double-quoted-scalar":
      case "block-scalar":
        node = composeScalar(ctx, token, tag, onError);
        if (anchor)
          node.anchor = anchor.source.substring(1);
        break;
      case "block-map":
      case "block-seq":
      case "flow-collection":
        node = composeCollection(CN, ctx, token, props, onError);
        if (anchor)
          node.anchor = anchor.source.substring(1);
        break;
      default: {
        const message = token.type === "error" ? token.message : `Unsupported token (type: ${token.type})`;
        onError(token, "UNEXPECTED_TOKEN", message);
        node = composeEmptyNode(ctx, token.offset, void 0, null, props, onError);
        isSrcToken = false;
      }
    }
    if (anchor && node.anchor === "")
      onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
    if (atKey && ctx.options.stringKeys && (!isScalar(node) || typeof node.value !== "string" || node.tag && node.tag !== "tag:yaml.org,2002:str")) {
      const msg = "With stringKeys, all keys must be strings";
      onError(tag ?? token, "NON_STRING_KEY", msg);
    }
    if (spaceBefore)
      node.spaceBefore = true;
    if (comment2) {
      if (token.type === "scalar" && token.source === "")
        node.comment = comment2;
      else
        node.commentBefore = comment2;
    }
    if (ctx.options.keepSourceTokens && isSrcToken)
      node.srcToken = token;
    return node;
  }
  function composeEmptyNode(ctx, offset, before2, pos, { spaceBefore, comment: comment2, anchor, tag, end: end2 }, onError) {
    const token = {
      type: "scalar",
      offset: emptyScalarPosition(offset, before2, pos),
      indent: -1,
      source: ""
    };
    const node = composeScalar(ctx, token, tag, onError);
    if (anchor) {
      node.anchor = anchor.source.substring(1);
      if (node.anchor === "")
        onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
    }
    if (spaceBefore)
      node.spaceBefore = true;
    if (comment2) {
      node.comment = comment2;
      node.range[2] = end2;
    }
    return node;
  }
  function composeAlias({ options }, { offset, source, end: end2 }, onError) {
    const alias = new Alias(source.substring(1));
    if (alias.source === "")
      onError(offset, "BAD_ALIAS", "Alias cannot be an empty string");
    if (alias.source.endsWith(":"))
      onError(offset + source.length - 1, "BAD_ALIAS", "Alias ending in : is ambiguous", true);
    const valueEnd = offset + source.length;
    const re = resolveEnd(end2, valueEnd, options.strict, onError);
    alias.range = [offset, valueEnd, re.offset];
    if (re.comment)
      alias.comment = re.comment;
    return alias;
  }
  function composeDoc(options, directives, { offset, start, value, end: end2 }, onError) {
    const opts = Object.assign({ _directives: directives }, options);
    const doc = new Document(void 0, opts);
    const ctx = {
      atKey: false,
      atRoot: true,
      directives: doc.directives,
      options: doc.options,
      schema: doc.schema
    };
    const props = resolveProps(start, {
      indicator: "doc-start",
      next: value ?? (end2 == null ? void 0 : end2[0]),
      offset,
      onError,
      parentIndent: 0,
      startOnNewline: true
    });
    if (props.found) {
      doc.directives.docStart = true;
      if (value && (value.type === "block-map" || value.type === "block-seq") && !props.hasNewline)
        onError(props.end, "MISSING_CHAR", "Block collection cannot start on same line with directives-end marker");
    }
    doc.contents = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, start, null, props, onError);
    const contentEnd = doc.contents.range[2];
    const re = resolveEnd(end2, contentEnd, false, onError);
    if (re.comment)
      doc.comment = re.comment;
    doc.range = [offset, contentEnd, re.offset];
    return doc;
  }
  function getErrorPos(src) {
    if (typeof src === "number")
      return [src, src + 1];
    if (Array.isArray(src))
      return src.length === 2 ? src : [src[0], src[1]];
    const { offset, source } = src;
    return [offset, offset + (typeof source === "string" ? source.length : 1)];
  }
  function parsePrelude(prelude) {
    var _a2;
    let comment2 = "";
    let atComment = false;
    let afterEmptyLine = false;
    for (let i = 0; i < prelude.length; ++i) {
      const source = prelude[i];
      switch (source[0]) {
        case "#":
          comment2 += (comment2 === "" ? "" : afterEmptyLine ? "\n\n" : "\n") + (source.substring(1) || " ");
          atComment = true;
          afterEmptyLine = false;
          break;
        case "%":
          if (((_a2 = prelude[i + 1]) == null ? void 0 : _a2[0]) !== "#")
            i += 1;
          atComment = false;
          break;
        default:
          if (!atComment)
            afterEmptyLine = true;
          atComment = false;
      }
    }
    return { comment: comment2, afterEmptyLine };
  }
  class Composer {
    constructor(options = {}) {
      this.doc = null;
      this.atDirectives = false;
      this.prelude = [];
      this.errors = [];
      this.warnings = [];
      this.onError = (source, code2, message, warning) => {
        const pos = getErrorPos(source);
        if (warning)
          this.warnings.push(new YAMLWarning(pos, code2, message));
        else
          this.errors.push(new YAMLParseError(pos, code2, message));
      };
      this.directives = new Directives({ version: options.version || "1.2" });
      this.options = options;
    }
    decorate(doc, afterDoc) {
      const { comment: comment2, afterEmptyLine } = parsePrelude(this.prelude);
      if (comment2) {
        const dc = doc.contents;
        if (afterDoc) {
          doc.comment = doc.comment ? `${doc.comment}
${comment2}` : comment2;
        } else if (afterEmptyLine || doc.directives.docStart || !dc) {
          doc.commentBefore = comment2;
        } else if (isCollection(dc) && !dc.flow && dc.items.length > 0) {
          let it = dc.items[0];
          if (isPair(it))
            it = it.key;
          const cb = it.commentBefore;
          it.commentBefore = cb ? `${comment2}
${cb}` : comment2;
        } else {
          const cb = dc.commentBefore;
          dc.commentBefore = cb ? `${comment2}
${cb}` : comment2;
        }
      }
      if (afterDoc) {
        Array.prototype.push.apply(doc.errors, this.errors);
        Array.prototype.push.apply(doc.warnings, this.warnings);
      } else {
        doc.errors = this.errors;
        doc.warnings = this.warnings;
      }
      this.prelude = [];
      this.errors = [];
      this.warnings = [];
    }
    /**
     * Current stream status information.
     *
     * Mostly useful at the end of input for an empty stream.
     */
    streamInfo() {
      return {
        comment: parsePrelude(this.prelude).comment,
        directives: this.directives,
        errors: this.errors,
        warnings: this.warnings
      };
    }
    /**
     * Compose tokens into documents.
     *
     * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
     * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
     */
    *compose(tokens, forceDoc = false, endOffset = -1) {
      for (const token of tokens)
        yield* this.next(token);
      yield* this.end(forceDoc, endOffset);
    }
    /** Advance the composer by one CST token. */
    *next(token) {
      switch (token.type) {
        case "directive":
          this.directives.add(token.source, (offset, message, warning) => {
            const pos = getErrorPos(token);
            pos[0] += offset;
            this.onError(pos, "BAD_DIRECTIVE", message, warning);
          });
          this.prelude.push(token.source);
          this.atDirectives = true;
          break;
        case "document": {
          const doc = composeDoc(this.options, this.directives, token, this.onError);
          if (this.atDirectives && !doc.directives.docStart)
            this.onError(token, "MISSING_CHAR", "Missing directives-end/doc-start indicator line");
          this.decorate(doc, false);
          if (this.doc)
            yield this.doc;
          this.doc = doc;
          this.atDirectives = false;
          break;
        }
        case "byte-order-mark":
        case "space":
          break;
        case "comment":
        case "newline":
          this.prelude.push(token.source);
          break;
        case "error": {
          const msg = token.source ? `${token.message}: ${JSON.stringify(token.source)}` : token.message;
          const error2 = new YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg);
          if (this.atDirectives || !this.doc)
            this.errors.push(error2);
          else
            this.doc.errors.push(error2);
          break;
        }
        case "doc-end": {
          if (!this.doc) {
            const msg = "Unexpected doc-end without preceding document";
            this.errors.push(new YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg));
            break;
          }
          this.doc.directives.docEnd = true;
          const end2 = resolveEnd(token.end, token.offset + token.source.length, this.doc.options.strict, this.onError);
          this.decorate(this.doc, true);
          if (end2.comment) {
            const dc = this.doc.comment;
            this.doc.comment = dc ? `${dc}
${end2.comment}` : end2.comment;
          }
          this.doc.range[2] = end2.offset;
          break;
        }
        default:
          this.errors.push(new YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", `Unsupported token ${token.type}`));
      }
    }
    /**
     * Call at end of input to yield any remaining document.
     *
     * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
     * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
     */
    *end(forceDoc = false, endOffset = -1) {
      if (this.doc) {
        this.decorate(this.doc, true);
        yield this.doc;
        this.doc = null;
      } else if (forceDoc) {
        const opts = Object.assign({ _directives: this.directives }, this.options);
        const doc = new Document(void 0, opts);
        if (this.atDirectives)
          this.onError(endOffset, "MISSING_CHAR", "Missing directives-end indicator line");
        doc.range = [0, endOffset, endOffset];
        this.decorate(doc, false);
        yield doc;
      }
    }
  }
  const BOM = "\uFEFF";
  const DOCUMENT = "";
  const FLOW_END = "";
  const SCALAR = "";
  function tokenType(source) {
    switch (source) {
      case BOM:
        return "byte-order-mark";
      case DOCUMENT:
        return "doc-mode";
      case FLOW_END:
        return "flow-error-end";
      case SCALAR:
        return "scalar";
      case "---":
        return "doc-start";
      case "...":
        return "doc-end";
      case "":
      case "\n":
      case "\r\n":
        return "newline";
      case "-":
        return "seq-item-ind";
      case "?":
        return "explicit-key-ind";
      case ":":
        return "map-value-ind";
      case "{":
        return "flow-map-start";
      case "}":
        return "flow-map-end";
      case "[":
        return "flow-seq-start";
      case "]":
        return "flow-seq-end";
      case ",":
        return "comma";
    }
    switch (source[0]) {
      case " ":
      case "	":
        return "space";
      case "#":
        return "comment";
      case "%":
        return "directive-line";
      case "*":
        return "alias";
      case "&":
        return "anchor";
      case "!":
        return "tag";
      case "'":
        return "single-quoted-scalar";
      case '"':
        return "double-quoted-scalar";
      case "|":
      case ">":
        return "block-scalar-header";
    }
    return null;
  }
  function isEmpty(ch) {
    switch (ch) {
      case void 0:
      case " ":
      case "\n":
      case "\r":
      case "	":
        return true;
      default:
        return false;
    }
  }
  const hexDigits = new Set("0123456789ABCDEFabcdef");
  const tagChars = new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()");
  const flowIndicatorChars = new Set(",[]{}");
  const invalidAnchorChars = new Set(" ,[]{}\n\r	");
  const isNotAnchorChar = (ch) => !ch || invalidAnchorChars.has(ch);
  class Lexer {
    constructor() {
      this.atEnd = false;
      this.blockScalarIndent = -1;
      this.blockScalarKeep = false;
      this.buffer = "";
      this.flowKey = false;
      this.flowLevel = 0;
      this.indentNext = 0;
      this.indentValue = 0;
      this.lineEndPos = null;
      this.next = null;
      this.pos = 0;
    }
    /**
     * Generate YAML tokens from the `source` string. If `incomplete`,
     * a part of the last line may be left as a buffer for the next call.
     *
     * @returns A generator of lexical tokens
     */
    *lex(source, incomplete = false) {
      if (source) {
        if (typeof source !== "string")
          throw TypeError("source is not a string");
        this.buffer = this.buffer ? this.buffer + source : source;
        this.lineEndPos = null;
      }
      this.atEnd = !incomplete;
      let next2 = this.next ?? "stream";
      while (next2 && (incomplete || this.hasChars(1)))
        next2 = yield* this.parseNext(next2);
    }
    atLineEnd() {
      let i = this.pos;
      let ch = this.buffer[i];
      while (ch === " " || ch === "	")
        ch = this.buffer[++i];
      if (!ch || ch === "#" || ch === "\n")
        return true;
      if (ch === "\r")
        return this.buffer[i + 1] === "\n";
      return false;
    }
    charAt(n) {
      return this.buffer[this.pos + n];
    }
    continueScalar(offset) {
      let ch = this.buffer[offset];
      if (this.indentNext > 0) {
        let indent = 0;
        while (ch === " ")
          ch = this.buffer[++indent + offset];
        if (ch === "\r") {
          const next2 = this.buffer[indent + offset + 1];
          if (next2 === "\n" || !next2 && !this.atEnd)
            return offset + indent + 1;
        }
        return ch === "\n" || indent >= this.indentNext || !ch && !this.atEnd ? offset + indent : -1;
      }
      if (ch === "-" || ch === ".") {
        const dt = this.buffer.substr(offset, 3);
        if ((dt === "---" || dt === "...") && isEmpty(this.buffer[offset + 3]))
          return -1;
      }
      return offset;
    }
    getLine() {
      let end2 = this.lineEndPos;
      if (typeof end2 !== "number" || end2 !== -1 && end2 < this.pos) {
        end2 = this.buffer.indexOf("\n", this.pos);
        this.lineEndPos = end2;
      }
      if (end2 === -1)
        return this.atEnd ? this.buffer.substring(this.pos) : null;
      if (this.buffer[end2 - 1] === "\r")
        end2 -= 1;
      return this.buffer.substring(this.pos, end2);
    }
    hasChars(n) {
      return this.pos + n <= this.buffer.length;
    }
    setNext(state) {
      this.buffer = this.buffer.substring(this.pos);
      this.pos = 0;
      this.lineEndPos = null;
      this.next = state;
      return null;
    }
    peek(n) {
      return this.buffer.substr(this.pos, n);
    }
    *parseNext(next2) {
      switch (next2) {
        case "stream":
          return yield* this.parseStream();
        case "line-start":
          return yield* this.parseLineStart();
        case "block-start":
          return yield* this.parseBlockStart();
        case "doc":
          return yield* this.parseDocument();
        case "flow":
          return yield* this.parseFlowCollection();
        case "quoted-scalar":
          return yield* this.parseQuotedScalar();
        case "block-scalar":
          return yield* this.parseBlockScalar();
        case "plain-scalar":
          return yield* this.parsePlainScalar();
      }
    }
    *parseStream() {
      let line = this.getLine();
      if (line === null)
        return this.setNext("stream");
      if (line[0] === BOM) {
        yield* this.pushCount(1);
        line = line.substring(1);
      }
      if (line[0] === "%") {
        let dirEnd = line.length;
        let cs = line.indexOf("#");
        while (cs !== -1) {
          const ch = line[cs - 1];
          if (ch === " " || ch === "	") {
            dirEnd = cs - 1;
            break;
          } else {
            cs = line.indexOf("#", cs + 1);
          }
        }
        while (true) {
          const ch = line[dirEnd - 1];
          if (ch === " " || ch === "	")
            dirEnd -= 1;
          else
            break;
        }
        const n = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
        yield* this.pushCount(line.length - n);
        this.pushNewline();
        return "stream";
      }
      if (this.atLineEnd()) {
        const sp = yield* this.pushSpaces(true);
        yield* this.pushCount(line.length - sp);
        yield* this.pushNewline();
        return "stream";
      }
      yield DOCUMENT;
      return yield* this.parseLineStart();
    }
    *parseLineStart() {
      const ch = this.charAt(0);
      if (!ch && !this.atEnd)
        return this.setNext("line-start");
      if (ch === "-" || ch === ".") {
        if (!this.atEnd && !this.hasChars(4))
          return this.setNext("line-start");
        const s = this.peek(3);
        if ((s === "---" || s === "...") && isEmpty(this.charAt(3))) {
          yield* this.pushCount(3);
          this.indentValue = 0;
          this.indentNext = 0;
          return s === "---" ? "doc" : "stream";
        }
      }
      this.indentValue = yield* this.pushSpaces(false);
      if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1)))
        this.indentNext = this.indentValue;
      return yield* this.parseBlockStart();
    }
    *parseBlockStart() {
      const [ch0, ch1] = this.peek(2);
      if (!ch1 && !this.atEnd)
        return this.setNext("block-start");
      if ((ch0 === "-" || ch0 === "?" || ch0 === ":") && isEmpty(ch1)) {
        const n = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
        this.indentNext = this.indentValue + 1;
        this.indentValue += n;
        return yield* this.parseBlockStart();
      }
      return "doc";
    }
    *parseDocument() {
      yield* this.pushSpaces(true);
      const line = this.getLine();
      if (line === null)
        return this.setNext("doc");
      let n = yield* this.pushIndicators();
      switch (line[n]) {
        case "#":
          yield* this.pushCount(line.length - n);
        // fallthrough
        case void 0:
          yield* this.pushNewline();
          return yield* this.parseLineStart();
        case "{":
        case "[":
          yield* this.pushCount(1);
          this.flowKey = false;
          this.flowLevel = 1;
          return "flow";
        case "}":
        case "]":
          yield* this.pushCount(1);
          return "doc";
        case "*":
          yield* this.pushUntil(isNotAnchorChar);
          return "doc";
        case '"':
        case "'":
          return yield* this.parseQuotedScalar();
        case "|":
        case ">":
          n += yield* this.parseBlockScalarHeader();
          n += yield* this.pushSpaces(true);
          yield* this.pushCount(line.length - n);
          yield* this.pushNewline();
          return yield* this.parseBlockScalar();
        default:
          return yield* this.parsePlainScalar();
      }
    }
    *parseFlowCollection() {
      let nl, sp;
      let indent = -1;
      do {
        nl = yield* this.pushNewline();
        if (nl > 0) {
          sp = yield* this.pushSpaces(false);
          this.indentValue = indent = sp;
        } else {
          sp = 0;
        }
        sp += yield* this.pushSpaces(true);
      } while (nl + sp > 0);
      const line = this.getLine();
      if (line === null)
        return this.setNext("flow");
      if (indent !== -1 && indent < this.indentNext && line[0] !== "#" || indent === 0 && (line.startsWith("---") || line.startsWith("...")) && isEmpty(line[3])) {
        const atFlowEndMarker = indent === this.indentNext - 1 && this.flowLevel === 1 && (line[0] === "]" || line[0] === "}");
        if (!atFlowEndMarker) {
          this.flowLevel = 0;
          yield FLOW_END;
          return yield* this.parseLineStart();
        }
      }
      let n = 0;
      while (line[n] === ",") {
        n += yield* this.pushCount(1);
        n += yield* this.pushSpaces(true);
        this.flowKey = false;
      }
      n += yield* this.pushIndicators();
      switch (line[n]) {
        case void 0:
          return "flow";
        case "#":
          yield* this.pushCount(line.length - n);
          return "flow";
        case "{":
        case "[":
          yield* this.pushCount(1);
          this.flowKey = false;
          this.flowLevel += 1;
          return "flow";
        case "}":
        case "]":
          yield* this.pushCount(1);
          this.flowKey = true;
          this.flowLevel -= 1;
          return this.flowLevel ? "flow" : "doc";
        case "*":
          yield* this.pushUntil(isNotAnchorChar);
          return "flow";
        case '"':
        case "'":
          this.flowKey = true;
          return yield* this.parseQuotedScalar();
        case ":": {
          const next2 = this.charAt(1);
          if (this.flowKey || isEmpty(next2) || next2 === ",") {
            this.flowKey = false;
            yield* this.pushCount(1);
            yield* this.pushSpaces(true);
            return "flow";
          }
        }
        // fallthrough
        default:
          this.flowKey = false;
          return yield* this.parsePlainScalar();
      }
    }
    *parseQuotedScalar() {
      const quote = this.charAt(0);
      let end2 = this.buffer.indexOf(quote, this.pos + 1);
      if (quote === "'") {
        while (end2 !== -1 && this.buffer[end2 + 1] === "'")
          end2 = this.buffer.indexOf("'", end2 + 2);
      } else {
        while (end2 !== -1) {
          let n = 0;
          while (this.buffer[end2 - 1 - n] === "\\")
            n += 1;
          if (n % 2 === 0)
            break;
          end2 = this.buffer.indexOf('"', end2 + 1);
        }
      }
      const qb = this.buffer.substring(0, end2);
      let nl = qb.indexOf("\n", this.pos);
      if (nl !== -1) {
        while (nl !== -1) {
          const cs = this.continueScalar(nl + 1);
          if (cs === -1)
            break;
          nl = qb.indexOf("\n", cs);
        }
        if (nl !== -1) {
          end2 = nl - (qb[nl - 1] === "\r" ? 2 : 1);
        }
      }
      if (end2 === -1) {
        if (!this.atEnd)
          return this.setNext("quoted-scalar");
        end2 = this.buffer.length;
      }
      yield* this.pushToIndex(end2 + 1, false);
      return this.flowLevel ? "flow" : "doc";
    }
    *parseBlockScalarHeader() {
      this.blockScalarIndent = -1;
      this.blockScalarKeep = false;
      let i = this.pos;
      while (true) {
        const ch = this.buffer[++i];
        if (ch === "+")
          this.blockScalarKeep = true;
        else if (ch > "0" && ch <= "9")
          this.blockScalarIndent = Number(ch) - 1;
        else if (ch !== "-")
          break;
      }
      return yield* this.pushUntil((ch) => isEmpty(ch) || ch === "#");
    }
    *parseBlockScalar() {
      let nl = this.pos - 1;
      let indent = 0;
      let ch;
      loop: for (let i2 = this.pos; ch = this.buffer[i2]; ++i2) {
        switch (ch) {
          case " ":
            indent += 1;
            break;
          case "\n":
            nl = i2;
            indent = 0;
            break;
          case "\r": {
            const next2 = this.buffer[i2 + 1];
            if (!next2 && !this.atEnd)
              return this.setNext("block-scalar");
            if (next2 === "\n")
              break;
          }
          // fallthrough
          default:
            break loop;
        }
      }
      if (!ch && !this.atEnd)
        return this.setNext("block-scalar");
      if (indent >= this.indentNext) {
        if (this.blockScalarIndent === -1)
          this.indentNext = indent;
        else {
          this.indentNext = this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
        }
        do {
          const cs = this.continueScalar(nl + 1);
          if (cs === -1)
            break;
          nl = this.buffer.indexOf("\n", cs);
        } while (nl !== -1);
        if (nl === -1) {
          if (!this.atEnd)
            return this.setNext("block-scalar");
          nl = this.buffer.length;
        }
      }
      let i = nl + 1;
      ch = this.buffer[i];
      while (ch === " ")
        ch = this.buffer[++i];
      if (ch === "	") {
        while (ch === "	" || ch === " " || ch === "\r" || ch === "\n")
          ch = this.buffer[++i];
        nl = i - 1;
      } else if (!this.blockScalarKeep) {
        do {
          let i2 = nl - 1;
          let ch2 = this.buffer[i2];
          if (ch2 === "\r")
            ch2 = this.buffer[--i2];
          const lastChar = i2;
          while (ch2 === " ")
            ch2 = this.buffer[--i2];
          if (ch2 === "\n" && i2 >= this.pos && i2 + 1 + indent > lastChar)
            nl = i2;
          else
            break;
        } while (true);
      }
      yield SCALAR;
      yield* this.pushToIndex(nl + 1, true);
      return yield* this.parseLineStart();
    }
    *parsePlainScalar() {
      const inFlow = this.flowLevel > 0;
      let end2 = this.pos - 1;
      let i = this.pos - 1;
      let ch;
      while (ch = this.buffer[++i]) {
        if (ch === ":") {
          const next2 = this.buffer[i + 1];
          if (isEmpty(next2) || inFlow && flowIndicatorChars.has(next2))
            break;
          end2 = i;
        } else if (isEmpty(ch)) {
          let next2 = this.buffer[i + 1];
          if (ch === "\r") {
            if (next2 === "\n") {
              i += 1;
              ch = "\n";
              next2 = this.buffer[i + 1];
            } else
              end2 = i;
          }
          if (next2 === "#" || inFlow && flowIndicatorChars.has(next2))
            break;
          if (ch === "\n") {
            const cs = this.continueScalar(i + 1);
            if (cs === -1)
              break;
            i = Math.max(i, cs - 2);
          }
        } else {
          if (inFlow && flowIndicatorChars.has(ch))
            break;
          end2 = i;
        }
      }
      if (!ch && !this.atEnd)
        return this.setNext("plain-scalar");
      yield SCALAR;
      yield* this.pushToIndex(end2 + 1, true);
      return inFlow ? "flow" : "doc";
    }
    *pushCount(n) {
      if (n > 0) {
        yield this.buffer.substr(this.pos, n);
        this.pos += n;
        return n;
      }
      return 0;
    }
    *pushToIndex(i, allowEmpty) {
      const s = this.buffer.slice(this.pos, i);
      if (s) {
        yield s;
        this.pos += s.length;
        return s.length;
      } else if (allowEmpty)
        yield "";
      return 0;
    }
    *pushIndicators() {
      switch (this.charAt(0)) {
        case "!":
          return (yield* this.pushTag()) + (yield* this.pushSpaces(true)) + (yield* this.pushIndicators());
        case "&":
          return (yield* this.pushUntil(isNotAnchorChar)) + (yield* this.pushSpaces(true)) + (yield* this.pushIndicators());
        case "-":
        // this is an error
        case "?":
        // this is an error outside flow collections
        case ":": {
          const inFlow = this.flowLevel > 0;
          const ch1 = this.charAt(1);
          if (isEmpty(ch1) || inFlow && flowIndicatorChars.has(ch1)) {
            if (!inFlow)
              this.indentNext = this.indentValue + 1;
            else if (this.flowKey)
              this.flowKey = false;
            return (yield* this.pushCount(1)) + (yield* this.pushSpaces(true)) + (yield* this.pushIndicators());
          }
        }
      }
      return 0;
    }
    *pushTag() {
      if (this.charAt(1) === "<") {
        let i = this.pos + 2;
        let ch = this.buffer[i];
        while (!isEmpty(ch) && ch !== ">")
          ch = this.buffer[++i];
        return yield* this.pushToIndex(ch === ">" ? i + 1 : i, false);
      } else {
        let i = this.pos + 1;
        let ch = this.buffer[i];
        while (ch) {
          if (tagChars.has(ch))
            ch = this.buffer[++i];
          else if (ch === "%" && hexDigits.has(this.buffer[i + 1]) && hexDigits.has(this.buffer[i + 2])) {
            ch = this.buffer[i += 3];
          } else
            break;
        }
        return yield* this.pushToIndex(i, false);
      }
    }
    *pushNewline() {
      const ch = this.buffer[this.pos];
      if (ch === "\n")
        return yield* this.pushCount(1);
      else if (ch === "\r" && this.charAt(1) === "\n")
        return yield* this.pushCount(2);
      else
        return 0;
    }
    *pushSpaces(allowTabs) {
      let i = this.pos - 1;
      let ch;
      do {
        ch = this.buffer[++i];
      } while (ch === " " || allowTabs && ch === "	");
      const n = i - this.pos;
      if (n > 0) {
        yield this.buffer.substr(this.pos, n);
        this.pos = i;
      }
      return n;
    }
    *pushUntil(test) {
      let i = this.pos;
      let ch = this.buffer[i];
      while (!test(ch))
        ch = this.buffer[++i];
      return yield* this.pushToIndex(i, false);
    }
  }
  class LineCounter {
    constructor() {
      this.lineStarts = [];
      this.addNewLine = (offset) => this.lineStarts.push(offset);
      this.linePos = (offset) => {
        let low = 0;
        let high = this.lineStarts.length;
        while (low < high) {
          const mid = low + high >> 1;
          if (this.lineStarts[mid] < offset)
            low = mid + 1;
          else
            high = mid;
        }
        if (this.lineStarts[low] === offset)
          return { line: low + 1, col: 1 };
        if (low === 0)
          return { line: 0, col: offset };
        const start = this.lineStarts[low - 1];
        return { line: low, col: offset - start + 1 };
      };
    }
  }
  function includesToken(list2, type) {
    for (let i = 0; i < list2.length; ++i)
      if (list2[i].type === type)
        return true;
    return false;
  }
  function findNonEmptyIndex(list2) {
    for (let i = 0; i < list2.length; ++i) {
      switch (list2[i].type) {
        case "space":
        case "comment":
        case "newline":
          break;
        default:
          return i;
      }
    }
    return -1;
  }
  function isFlowToken(token) {
    switch (token == null ? void 0 : token.type) {
      case "alias":
      case "scalar":
      case "single-quoted-scalar":
      case "double-quoted-scalar":
      case "flow-collection":
        return true;
      default:
        return false;
    }
  }
  function getPrevProps(parent2) {
    switch (parent2.type) {
      case "document":
        return parent2.start;
      case "block-map": {
        const it = parent2.items[parent2.items.length - 1];
        return it.sep ?? it.start;
      }
      case "block-seq":
        return parent2.items[parent2.items.length - 1].start;
      /* istanbul ignore next should not happen */
      default:
        return [];
    }
  }
  function getFirstKeyStartProps(prev2) {
    var _a2;
    if (prev2.length === 0)
      return [];
    let i = prev2.length;
    loop: while (--i >= 0) {
      switch (prev2[i].type) {
        case "doc-start":
        case "explicit-key-ind":
        case "map-value-ind":
        case "seq-item-ind":
        case "newline":
          break loop;
      }
    }
    while (((_a2 = prev2[++i]) == null ? void 0 : _a2.type) === "space") {
    }
    return prev2.splice(i, prev2.length);
  }
  function fixFlowSeqItems(fc) {
    if (fc.start.type === "flow-seq-start") {
      for (const it of fc.items) {
        if (it.sep && !it.value && !includesToken(it.start, "explicit-key-ind") && !includesToken(it.sep, "map-value-ind")) {
          if (it.key)
            it.value = it.key;
          delete it.key;
          if (isFlowToken(it.value)) {
            if (it.value.end)
              Array.prototype.push.apply(it.value.end, it.sep);
            else
              it.value.end = it.sep;
          } else
            Array.prototype.push.apply(it.start, it.sep);
          delete it.sep;
        }
      }
    }
  }
  class Parser {
    /**
     * @param onNewLine - If defined, called separately with the start position of
     *   each new line (in `parse()`, including the start of input).
     */
    constructor(onNewLine) {
      this.atNewLine = true;
      this.atScalar = false;
      this.indent = 0;
      this.offset = 0;
      this.onKeyLine = false;
      this.stack = [];
      this.source = "";
      this.type = "";
      this.lexer = new Lexer();
      this.onNewLine = onNewLine;
    }
    /**
     * Parse `source` as a YAML stream.
     * If `incomplete`, a part of the last line may be left as a buffer for the next call.
     *
     * Errors are not thrown, but yielded as `{ type: 'error', message }` tokens.
     *
     * @returns A generator of tokens representing each directive, document, and other structure.
     */
    *parse(source, incomplete = false) {
      if (this.onNewLine && this.offset === 0)
        this.onNewLine(0);
      for (const lexeme of this.lexer.lex(source, incomplete))
        yield* this.next(lexeme);
      if (!incomplete)
        yield* this.end();
    }
    /**
     * Advance the parser by the `source` of one lexical token.
     */
    *next(source) {
      this.source = source;
      if (this.atScalar) {
        this.atScalar = false;
        yield* this.step();
        this.offset += source.length;
        return;
      }
      const type = tokenType(source);
      if (!type) {
        const message = `Not a YAML token: ${source}`;
        yield* this.pop({ type: "error", offset: this.offset, message, source });
        this.offset += source.length;
      } else if (type === "scalar") {
        this.atNewLine = false;
        this.atScalar = true;
        this.type = "scalar";
      } else {
        this.type = type;
        yield* this.step();
        switch (type) {
          case "newline":
            this.atNewLine = true;
            this.indent = 0;
            if (this.onNewLine)
              this.onNewLine(this.offset + source.length);
            break;
          case "space":
            if (this.atNewLine && source[0] === " ")
              this.indent += source.length;
            break;
          case "explicit-key-ind":
          case "map-value-ind":
          case "seq-item-ind":
            if (this.atNewLine)
              this.indent += source.length;
            break;
          case "doc-mode":
          case "flow-error-end":
            return;
          default:
            this.atNewLine = false;
        }
        this.offset += source.length;
      }
    }
    /** Call at end of input to push out any remaining constructions */
    *end() {
      while (this.stack.length > 0)
        yield* this.pop();
    }
    get sourceToken() {
      const st = {
        type: this.type,
        offset: this.offset,
        indent: this.indent,
        source: this.source
      };
      return st;
    }
    *step() {
      const top = this.peek(1);
      if (this.type === "doc-end" && (!top || top.type !== "doc-end")) {
        while (this.stack.length > 0)
          yield* this.pop();
        this.stack.push({
          type: "doc-end",
          offset: this.offset,
          source: this.source
        });
        return;
      }
      if (!top)
        return yield* this.stream();
      switch (top.type) {
        case "document":
          return yield* this.document(top);
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
          return yield* this.scalar(top);
        case "block-scalar":
          return yield* this.blockScalar(top);
        case "block-map":
          return yield* this.blockMap(top);
        case "block-seq":
          return yield* this.blockSequence(top);
        case "flow-collection":
          return yield* this.flowCollection(top);
        case "doc-end":
          return yield* this.documentEnd(top);
      }
      yield* this.pop();
    }
    peek(n) {
      return this.stack[this.stack.length - n];
    }
    *pop(error2) {
      const token = error2 ?? this.stack.pop();
      if (!token) {
        const message = "Tried to pop an empty stack";
        yield { type: "error", offset: this.offset, source: "", message };
      } else if (this.stack.length === 0) {
        yield token;
      } else {
        const top = this.peek(1);
        if (token.type === "block-scalar") {
          token.indent = "indent" in top ? top.indent : 0;
        } else if (token.type === "flow-collection" && top.type === "document") {
          token.indent = 0;
        }
        if (token.type === "flow-collection")
          fixFlowSeqItems(token);
        switch (top.type) {
          case "document":
            top.value = token;
            break;
          case "block-scalar":
            top.props.push(token);
            break;
          case "block-map": {
            const it = top.items[top.items.length - 1];
            if (it.value) {
              top.items.push({ start: [], key: token, sep: [] });
              this.onKeyLine = true;
              return;
            } else if (it.sep) {
              it.value = token;
            } else {
              Object.assign(it, { key: token, sep: [] });
              this.onKeyLine = !it.explicitKey;
              return;
            }
            break;
          }
          case "block-seq": {
            const it = top.items[top.items.length - 1];
            if (it.value)
              top.items.push({ start: [], value: token });
            else
              it.value = token;
            break;
          }
          case "flow-collection": {
            const it = top.items[top.items.length - 1];
            if (!it || it.value)
              top.items.push({ start: [], key: token, sep: [] });
            else if (it.sep)
              it.value = token;
            else
              Object.assign(it, { key: token, sep: [] });
            return;
          }
          /* istanbul ignore next should not happen */
          default:
            yield* this.pop();
            yield* this.pop(token);
        }
        if ((top.type === "document" || top.type === "block-map" || top.type === "block-seq") && (token.type === "block-map" || token.type === "block-seq")) {
          const last2 = token.items[token.items.length - 1];
          if (last2 && !last2.sep && !last2.value && last2.start.length > 0 && findNonEmptyIndex(last2.start) === -1 && (token.indent === 0 || last2.start.every((st) => st.type !== "comment" || st.indent < token.indent))) {
            if (top.type === "document")
              top.end = last2.start;
            else
              top.items.push({ start: last2.start });
            token.items.splice(-1, 1);
          }
        }
      }
    }
    *stream() {
      switch (this.type) {
        case "directive-line":
          yield { type: "directive", offset: this.offset, source: this.source };
          return;
        case "byte-order-mark":
        case "space":
        case "comment":
        case "newline":
          yield this.sourceToken;
          return;
        case "doc-mode":
        case "doc-start": {
          const doc = {
            type: "document",
            offset: this.offset,
            start: []
          };
          if (this.type === "doc-start")
            doc.start.push(this.sourceToken);
          this.stack.push(doc);
          return;
        }
      }
      yield {
        type: "error",
        offset: this.offset,
        message: `Unexpected ${this.type} token in YAML stream`,
        source: this.source
      };
    }
    *document(doc) {
      if (doc.value)
        return yield* this.lineEnd(doc);
      switch (this.type) {
        case "doc-start": {
          if (findNonEmptyIndex(doc.start) !== -1) {
            yield* this.pop();
            yield* this.step();
          } else
            doc.start.push(this.sourceToken);
          return;
        }
        case "anchor":
        case "tag":
        case "space":
        case "comment":
        case "newline":
          doc.start.push(this.sourceToken);
          return;
      }
      const bv = this.startBlockValue(doc);
      if (bv)
        this.stack.push(bv);
      else {
        yield {
          type: "error",
          offset: this.offset,
          message: `Unexpected ${this.type} token in YAML document`,
          source: this.source
        };
      }
    }
    *scalar(scalar) {
      if (this.type === "map-value-ind") {
        const prev2 = getPrevProps(this.peek(2));
        const start = getFirstKeyStartProps(prev2);
        let sep;
        if (scalar.end) {
          sep = scalar.end;
          sep.push(this.sourceToken);
          delete scalar.end;
        } else
          sep = [this.sourceToken];
        const map2 = {
          type: "block-map",
          offset: scalar.offset,
          indent: scalar.indent,
          items: [{ start, key: scalar, sep }]
        };
        this.onKeyLine = true;
        this.stack[this.stack.length - 1] = map2;
      } else
        yield* this.lineEnd(scalar);
    }
    *blockScalar(scalar) {
      switch (this.type) {
        case "space":
        case "comment":
        case "newline":
          scalar.props.push(this.sourceToken);
          return;
        case "scalar":
          scalar.source = this.source;
          this.atNewLine = true;
          this.indent = 0;
          if (this.onNewLine) {
            let nl = this.source.indexOf("\n") + 1;
            while (nl !== 0) {
              this.onNewLine(this.offset + nl);
              nl = this.source.indexOf("\n", nl) + 1;
            }
          }
          yield* this.pop();
          break;
        /* istanbul ignore next should not happen */
        default:
          yield* this.pop();
          yield* this.step();
      }
    }
    *blockMap(map2) {
      var _a2;
      const it = map2.items[map2.items.length - 1];
      switch (this.type) {
        case "newline":
          this.onKeyLine = false;
          if (it.value) {
            const end2 = "end" in it.value ? it.value.end : void 0;
            const last2 = Array.isArray(end2) ? end2[end2.length - 1] : void 0;
            if ((last2 == null ? void 0 : last2.type) === "comment")
              end2 == null ? void 0 : end2.push(this.sourceToken);
            else
              map2.items.push({ start: [this.sourceToken] });
          } else if (it.sep) {
            it.sep.push(this.sourceToken);
          } else {
            it.start.push(this.sourceToken);
          }
          return;
        case "space":
        case "comment":
          if (it.value) {
            map2.items.push({ start: [this.sourceToken] });
          } else if (it.sep) {
            it.sep.push(this.sourceToken);
          } else {
            if (this.atIndentedComment(it.start, map2.indent)) {
              const prev2 = map2.items[map2.items.length - 2];
              const end2 = (_a2 = prev2 == null ? void 0 : prev2.value) == null ? void 0 : _a2.end;
              if (Array.isArray(end2)) {
                Array.prototype.push.apply(end2, it.start);
                end2.push(this.sourceToken);
                map2.items.pop();
                return;
              }
            }
            it.start.push(this.sourceToken);
          }
          return;
      }
      if (this.indent >= map2.indent) {
        const atMapIndent = !this.onKeyLine && this.indent === map2.indent;
        const atNextItem = atMapIndent && (it.sep || it.explicitKey) && this.type !== "seq-item-ind";
        let start = [];
        if (atNextItem && it.sep && !it.value) {
          const nl = [];
          for (let i = 0; i < it.sep.length; ++i) {
            const st = it.sep[i];
            switch (st.type) {
              case "newline":
                nl.push(i);
                break;
              case "space":
                break;
              case "comment":
                if (st.indent > map2.indent)
                  nl.length = 0;
                break;
              default:
                nl.length = 0;
            }
          }
          if (nl.length >= 2)
            start = it.sep.splice(nl[1]);
        }
        switch (this.type) {
          case "anchor":
          case "tag":
            if (atNextItem || it.value) {
              start.push(this.sourceToken);
              map2.items.push({ start });
              this.onKeyLine = true;
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              it.start.push(this.sourceToken);
            }
            return;
          case "explicit-key-ind":
            if (!it.sep && !it.explicitKey) {
              it.start.push(this.sourceToken);
              it.explicitKey = true;
            } else if (atNextItem || it.value) {
              start.push(this.sourceToken);
              map2.items.push({ start, explicitKey: true });
            } else {
              this.stack.push({
                type: "block-map",
                offset: this.offset,
                indent: this.indent,
                items: [{ start: [this.sourceToken], explicitKey: true }]
              });
            }
            this.onKeyLine = true;
            return;
          case "map-value-ind":
            if (it.explicitKey) {
              if (!it.sep) {
                if (includesToken(it.start, "newline")) {
                  Object.assign(it, { key: null, sep: [this.sourceToken] });
                } else {
                  const start2 = getFirstKeyStartProps(it.start);
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: start2, key: null, sep: [this.sourceToken] }]
                  });
                }
              } else if (it.value) {
                map2.items.push({ start: [], key: null, sep: [this.sourceToken] });
              } else if (includesToken(it.sep, "map-value-ind")) {
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start, key: null, sep: [this.sourceToken] }]
                });
              } else if (isFlowToken(it.key) && !includesToken(it.sep, "newline")) {
                const start2 = getFirstKeyStartProps(it.start);
                const key = it.key;
                const sep = it.sep;
                sep.push(this.sourceToken);
                delete it.key;
                delete it.sep;
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: start2, key, sep }]
                });
              } else if (start.length > 0) {
                it.sep = it.sep.concat(start, this.sourceToken);
              } else {
                it.sep.push(this.sourceToken);
              }
            } else {
              if (!it.sep) {
                Object.assign(it, { key: null, sep: [this.sourceToken] });
              } else if (it.value || atNextItem) {
                map2.items.push({ start, key: null, sep: [this.sourceToken] });
              } else if (includesToken(it.sep, "map-value-ind")) {
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: [], key: null, sep: [this.sourceToken] }]
                });
              } else {
                it.sep.push(this.sourceToken);
              }
            }
            this.onKeyLine = true;
            return;
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar": {
            const fs = this.flowScalar(this.type);
            if (atNextItem || it.value) {
              map2.items.push({ start, key: fs, sep: [] });
              this.onKeyLine = true;
            } else if (it.sep) {
              this.stack.push(fs);
            } else {
              Object.assign(it, { key: fs, sep: [] });
              this.onKeyLine = true;
            }
            return;
          }
          default: {
            const bv = this.startBlockValue(map2);
            if (bv) {
              if (atMapIndent && bv.type !== "block-seq") {
                map2.items.push({ start });
              }
              this.stack.push(bv);
              return;
            }
          }
        }
      }
      yield* this.pop();
      yield* this.step();
    }
    *blockSequence(seq2) {
      var _a2;
      const it = seq2.items[seq2.items.length - 1];
      switch (this.type) {
        case "newline":
          if (it.value) {
            const end2 = "end" in it.value ? it.value.end : void 0;
            const last2 = Array.isArray(end2) ? end2[end2.length - 1] : void 0;
            if ((last2 == null ? void 0 : last2.type) === "comment")
              end2 == null ? void 0 : end2.push(this.sourceToken);
            else
              seq2.items.push({ start: [this.sourceToken] });
          } else
            it.start.push(this.sourceToken);
          return;
        case "space":
        case "comment":
          if (it.value)
            seq2.items.push({ start: [this.sourceToken] });
          else {
            if (this.atIndentedComment(it.start, seq2.indent)) {
              const prev2 = seq2.items[seq2.items.length - 2];
              const end2 = (_a2 = prev2 == null ? void 0 : prev2.value) == null ? void 0 : _a2.end;
              if (Array.isArray(end2)) {
                Array.prototype.push.apply(end2, it.start);
                end2.push(this.sourceToken);
                seq2.items.pop();
                return;
              }
            }
            it.start.push(this.sourceToken);
          }
          return;
        case "anchor":
        case "tag":
          if (it.value || this.indent <= seq2.indent)
            break;
          it.start.push(this.sourceToken);
          return;
        case "seq-item-ind":
          if (this.indent !== seq2.indent)
            break;
          if (it.value || includesToken(it.start, "seq-item-ind"))
            seq2.items.push({ start: [this.sourceToken] });
          else
            it.start.push(this.sourceToken);
          return;
      }
      if (this.indent > seq2.indent) {
        const bv = this.startBlockValue(seq2);
        if (bv) {
          this.stack.push(bv);
          return;
        }
      }
      yield* this.pop();
      yield* this.step();
    }
    *flowCollection(fc) {
      const it = fc.items[fc.items.length - 1];
      if (this.type === "flow-error-end") {
        let top;
        do {
          yield* this.pop();
          top = this.peek(1);
        } while (top && top.type === "flow-collection");
      } else if (fc.end.length === 0) {
        switch (this.type) {
          case "comma":
          case "explicit-key-ind":
            if (!it || it.sep)
              fc.items.push({ start: [this.sourceToken] });
            else
              it.start.push(this.sourceToken);
            return;
          case "map-value-ind":
            if (!it || it.value)
              fc.items.push({ start: [], key: null, sep: [this.sourceToken] });
            else if (it.sep)
              it.sep.push(this.sourceToken);
            else
              Object.assign(it, { key: null, sep: [this.sourceToken] });
            return;
          case "space":
          case "comment":
          case "newline":
          case "anchor":
          case "tag":
            if (!it || it.value)
              fc.items.push({ start: [this.sourceToken] });
            else if (it.sep)
              it.sep.push(this.sourceToken);
            else
              it.start.push(this.sourceToken);
            return;
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar": {
            const fs = this.flowScalar(this.type);
            if (!it || it.value)
              fc.items.push({ start: [], key: fs, sep: [] });
            else if (it.sep)
              this.stack.push(fs);
            else
              Object.assign(it, { key: fs, sep: [] });
            return;
          }
          case "flow-map-end":
          case "flow-seq-end":
            fc.end.push(this.sourceToken);
            return;
        }
        const bv = this.startBlockValue(fc);
        if (bv)
          this.stack.push(bv);
        else {
          yield* this.pop();
          yield* this.step();
        }
      } else {
        const parent2 = this.peek(2);
        if (parent2.type === "block-map" && (this.type === "map-value-ind" && parent2.indent === fc.indent || this.type === "newline" && !parent2.items[parent2.items.length - 1].sep)) {
          yield* this.pop();
          yield* this.step();
        } else if (this.type === "map-value-ind" && parent2.type !== "flow-collection") {
          const prev2 = getPrevProps(parent2);
          const start = getFirstKeyStartProps(prev2);
          fixFlowSeqItems(fc);
          const sep = fc.end.splice(1, fc.end.length);
          sep.push(this.sourceToken);
          const map2 = {
            type: "block-map",
            offset: fc.offset,
            indent: fc.indent,
            items: [{ start, key: fc, sep }]
          };
          this.onKeyLine = true;
          this.stack[this.stack.length - 1] = map2;
        } else {
          yield* this.lineEnd(fc);
        }
      }
    }
    flowScalar(type) {
      if (this.onNewLine) {
        let nl = this.source.indexOf("\n") + 1;
        while (nl !== 0) {
          this.onNewLine(this.offset + nl);
          nl = this.source.indexOf("\n", nl) + 1;
        }
      }
      return {
        type,
        offset: this.offset,
        indent: this.indent,
        source: this.source
      };
    }
    startBlockValue(parent2) {
      switch (this.type) {
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
          return this.flowScalar(this.type);
        case "block-scalar-header":
          return {
            type: "block-scalar",
            offset: this.offset,
            indent: this.indent,
            props: [this.sourceToken],
            source: ""
          };
        case "flow-map-start":
        case "flow-seq-start":
          return {
            type: "flow-collection",
            offset: this.offset,
            indent: this.indent,
            start: this.sourceToken,
            items: [],
            end: []
          };
        case "seq-item-ind":
          return {
            type: "block-seq",
            offset: this.offset,
            indent: this.indent,
            items: [{ start: [this.sourceToken] }]
          };
        case "explicit-key-ind": {
          this.onKeyLine = true;
          const prev2 = getPrevProps(parent2);
          const start = getFirstKeyStartProps(prev2);
          start.push(this.sourceToken);
          return {
            type: "block-map",
            offset: this.offset,
            indent: this.indent,
            items: [{ start, explicitKey: true }]
          };
        }
        case "map-value-ind": {
          this.onKeyLine = true;
          const prev2 = getPrevProps(parent2);
          const start = getFirstKeyStartProps(prev2);
          return {
            type: "block-map",
            offset: this.offset,
            indent: this.indent,
            items: [{ start, key: null, sep: [this.sourceToken] }]
          };
        }
      }
      return null;
    }
    atIndentedComment(start, indent) {
      if (this.type !== "comment")
        return false;
      if (this.indent <= indent)
        return false;
      return start.every((st) => st.type === "newline" || st.type === "space");
    }
    *documentEnd(docEnd) {
      if (this.type !== "doc-mode") {
        if (docEnd.end)
          docEnd.end.push(this.sourceToken);
        else
          docEnd.end = [this.sourceToken];
        if (this.type === "newline")
          yield* this.pop();
      }
    }
    *lineEnd(token) {
      switch (this.type) {
        case "comma":
        case "doc-start":
        case "doc-end":
        case "flow-seq-end":
        case "flow-map-end":
        case "map-value-ind":
          yield* this.pop();
          yield* this.step();
          break;
        case "newline":
          this.onKeyLine = false;
        // fallthrough
        case "space":
        case "comment":
        default:
          if (token.end)
            token.end.push(this.sourceToken);
          else
            token.end = [this.sourceToken];
          if (this.type === "newline")
            yield* this.pop();
      }
    }
  }
  function parseOptions(options) {
    const prettyErrors = options.prettyErrors !== false;
    const lineCounter = options.lineCounter || prettyErrors && new LineCounter() || null;
    return { lineCounter, prettyErrors };
  }
  function parseDocument(source, options = {}) {
    const { lineCounter, prettyErrors } = parseOptions(options);
    const parser = new Parser(lineCounter == null ? void 0 : lineCounter.addNewLine);
    const composer = new Composer(options);
    let doc = null;
    for (const _doc of composer.compose(parser.parse(source), true, source.length)) {
      if (!doc)
        doc = _doc;
      else if (doc.options.logLevel !== "silent") {
        doc.errors.push(new YAMLParseError(_doc.range.slice(0, 2), "MULTIPLE_DOCS", "Source contains multiple documents; please use YAML.parseAllDocuments()"));
        break;
      }
    }
    if (prettyErrors && lineCounter) {
      doc.errors.forEach(prettifyError(source, lineCounter));
      doc.warnings.forEach(prettifyError(source, lineCounter));
    }
    return doc;
  }
  function parse(src, reviver, options) {
    let _reviver = void 0;
    const doc = parseDocument(src, options);
    if (!doc)
      return null;
    doc.warnings.forEach((warning) => warn(doc.options.logLevel, warning));
    if (doc.errors.length > 0) {
      if (doc.options.logLevel !== "silent")
        throw doc.errors[0];
      else
        doc.errors = [];
    }
    return doc.toJS(Object.assign({ reviver: _reviver }, options));
  }
  const name$4 = "frontmatter";
  const pluginFrontmatter = definePlugin({
    name: name$4,
    transform(transformHooks) {
      transformHooks.beforeParse.tap((_md, context) => {
        var _a2;
        const { content } = context;
        if (!/^---\r?\n/.test(content)) return;
        const match = /\n---\r?\n/.exec(content);
        if (!match) return;
        const raw = content.slice(4, match.index).trimEnd();
        let frontmatter;
        try {
          frontmatter = parse(raw.replace(/\r?\n|\r/g, "\n"));
          if (frontmatter == null ? void 0 : frontmatter.markmap) {
            frontmatter.markmap = normalizeMarkmapJsonOptions(
              frontmatter.markmap
            );
          }
        } catch {
          return;
        }
        context.frontmatter = frontmatter;
        context.parserOptions = {
          ...context.parserOptions,
          ...(_a2 = frontmatter == null ? void 0 : frontmatter.markmap) == null ? void 0 : _a2.htmlParser
        };
        context.frontmatterInfo = {
          lines: content.slice(0, match.index).split("\n").length + 1,
          offset: match.index + match[0].length
        };
      });
      return {};
    }
  });
  function normalizeMarkmapJsonOptions(options) {
    if (!options) return;
    ["color", "extraJs", "extraCss"].forEach((key) => {
      if (options[key] != null) options[key] = normalizeStringArray(options[key]);
    });
    ["duration", "maxWidth", "initialExpandLevel"].forEach((key) => {
      if (options[key] != null) options[key] = normalizeNumber(options[key]);
    });
    return options;
  }
  function normalizeStringArray(value) {
    let result;
    if (typeof value === "string") result = [value];
    else if (Array.isArray(value))
      result = value.filter((item) => item && typeof item === "string");
    return (result == null ? void 0 : result.length) ? result : void 0;
  }
  function normalizeNumber(value) {
    if (isNaN(+value)) return;
    return +value;
  }
  function patchJSItem(urlBuilder, item) {
    if (item.type === "script" && item.data.src) {
      return {
        ...item,
        data: {
          ...item.data,
          src: urlBuilder.getFullUrl(item.data.src)
        }
      };
    }
    return item;
  }
  function patchCSSItem(urlBuilder, item) {
    if (item.type === "stylesheet" && item.data.href) {
      return {
        ...item,
        data: {
          ...item.data,
          href: urlBuilder.getFullUrl(item.data.href)
        }
      };
    }
    return item;
  }
  const name$3 = "hljs";
  const preloadScripts$1 = [
    `@highlightjs/cdn-assets@${"11.11.1"}/highlight.min.js`
  ].map((path) => buildJSItem(path));
  const styles$1 = [
    `@highlightjs/cdn-assets@${"11.11.1"}/styles/default.min.css`
  ].map((path) => buildCSSItem(path));
  const config$1 = {
    versions: {
      hljs: "11.11.1"
    },
    preloadScripts: preloadScripts$1,
    styles: styles$1
  };
  const plugin$2 = definePlugin({
    name: name$3,
    config: config$1,
    transform(transformHooks) {
      var _a2, _b, _c;
      let loading;
      const preloadScripts2 = ((_b = (_a2 = plugin$2.config) == null ? void 0 : _a2.preloadScripts) == null ? void 0 : _b.map(
        (item) => patchJSItem(transformHooks.transformer.urlBuilder, item)
      )) || [];
      const autoload = () => {
        loading || (loading = loadJS(preloadScripts2));
        return loading;
      };
      let enableFeature = noop;
      transformHooks.parser.tap((md) => {
        md.set({
          highlight: (str, language) => {
            enableFeature();
            const { hljs } = window;
            if (hljs) {
              return hljs.highlightAuto(str, language ? [language] : void 0).value;
            }
            autoload().then(() => {
              transformHooks.retransform.call();
            });
            return str;
          }
        });
      });
      transformHooks.beforeParse.tap((_, context) => {
        enableFeature = () => {
          context.features[name$3] = true;
        };
      });
      return {
        styles: (_c = plugin$2.config) == null ? void 0 : _c.styles
      };
    }
  });
  function addDefaultVersions(paths, name2, version) {
    return paths.map((path) => {
      if (typeof path === "string" && !path.includes("://")) {
        if (!path.startsWith("npm:")) {
          path = `npm:${path}`;
        }
        const prefixLength = 4 + name2.length;
        if (path.startsWith(`npm:${name2}/`)) {
          path = `${path.slice(0, prefixLength)}@${version}${path.slice(
            prefixLength
          )}`;
        }
      }
      return path;
    });
  }
  var define_define_KATEX_RESOURCES_default = ["katex@0.16.18/dist/fonts/KaTeX_AMS-Regular.woff2", "katex@0.16.18/dist/fonts/KaTeX_Caligraphic-Bold.woff2", "katex@0.16.18/dist/fonts/KaTeX_Caligraphic-Regular.woff2", "katex@0.16.18/dist/fonts/KaTeX_Fraktur-Bold.woff2", "katex@0.16.18/dist/fonts/KaTeX_Fraktur-Regular.woff2", "katex@0.16.18/dist/fonts/KaTeX_Main-Bold.woff2", "katex@0.16.18/dist/fonts/KaTeX_Main-BoldItalic.woff2", "katex@0.16.18/dist/fonts/KaTeX_Main-Italic.woff2", "katex@0.16.18/dist/fonts/KaTeX_Main-Regular.woff2", "katex@0.16.18/dist/fonts/KaTeX_Math-BoldItalic.woff2", "katex@0.16.18/dist/fonts/KaTeX_Math-Italic.woff2", "katex@0.16.18/dist/fonts/KaTeX_SansSerif-Bold.woff2", "katex@0.16.18/dist/fonts/KaTeX_SansSerif-Italic.woff2", "katex@0.16.18/dist/fonts/KaTeX_SansSerif-Regular.woff2", "katex@0.16.18/dist/fonts/KaTeX_Script-Regular.woff2", "katex@0.16.18/dist/fonts/KaTeX_Size1-Regular.woff2", "katex@0.16.18/dist/fonts/KaTeX_Size2-Regular.woff2", "katex@0.16.18/dist/fonts/KaTeX_Size3-Regular.woff2", "katex@0.16.18/dist/fonts/KaTeX_Size4-Regular.woff2", "katex@0.16.18/dist/fonts/KaTeX_Typewriter-Regular.woff2"];
  const name$2 = "katex";
  const preloadScripts = [
    `katex@${"0.16.18"}/dist/katex.min.js`
  ].map((path) => buildJSItem(path));
  const webfontloader = buildJSItem(
    `webfontloader@${"1.6.28"}/webfontloader.js`
  );
  webfontloader.data.defer = true;
  const styles = [`katex@${"0.16.18"}/dist/katex.min.css`].map(
    (path) => buildCSSItem(path)
  );
  const config = {
    versions: {
      katex: "0.16.18",
      webfontloader: "1.6.28"
    },
    preloadScripts,
    scripts: [
      {
        type: "iife",
        data: {
          fn: (getMarkmap) => {
            window.WebFontConfig = {
              custom: {
                families: [
                  "KaTeX_AMS",
                  "KaTeX_Caligraphic:n4,n7",
                  "KaTeX_Fraktur:n4,n7",
                  "KaTeX_Main:n4,n7,i4,i7",
                  "KaTeX_Math:i4,i7",
                  "KaTeX_Script",
                  "KaTeX_SansSerif:n4,n7,i4",
                  "KaTeX_Size1",
                  "KaTeX_Size2",
                  "KaTeX_Size3",
                  "KaTeX_Size4",
                  "KaTeX_Typewriter"
                ]
              },
              active: () => {
                getMarkmap().refreshHook.call();
              }
            };
          },
          getParams({ getMarkmap }) {
            return [getMarkmap];
          }
        }
      },
      webfontloader
    ],
    styles,
    resources: define_define_KATEX_RESOURCES_default
  };
  function getDefaultExportFromCjs(x) {
    return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
  }
  var dist = {};
  var hasRequiredDist;
  function requireDist() {
    if (hasRequiredDist) return dist;
    hasRequiredDist = 1;
    var __importDefault = dist && dist.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(dist, "__esModule", { value: true });
    const katex_1 = __importDefault(require$$0);
    function isValidInlineDelim(state, pos) {
      const prevChar = state.src[pos - 1];
      const char = state.src[pos];
      const nextChar = state.src[pos + 1];
      if (char !== "$") {
        return { can_open: false, can_close: false };
      }
      let canOpen = false;
      let canClose = false;
      if (prevChar !== "$" && prevChar !== "\\" && (prevChar === void 0 || isWhitespace2(prevChar) || !isWordCharacterOrNumber(prevChar))) {
        canOpen = true;
      }
      if (nextChar !== "$" && (nextChar == void 0 || isWhitespace2(nextChar) || !isWordCharacterOrNumber(nextChar))) {
        canClose = true;
      }
      return { can_open: canOpen, can_close: canClose };
    }
    function isWhitespace2(char) {
      return /^\s$/u.test(char);
    }
    function isWordCharacterOrNumber(char) {
      return /^[\w\d]$/u.test(char);
    }
    function isValidBlockDelim(state, pos) {
      const prevChar = state.src[pos - 1];
      const char = state.src[pos];
      const nextChar = state.src[pos + 1];
      const nextCharPlus1 = state.src[pos + 2];
      if (char === "$" && prevChar !== "$" && prevChar !== "\\" && nextChar === "$" && nextCharPlus1 !== "$") {
        return { can_open: true, can_close: true };
      }
      return { can_open: false, can_close: false };
    }
    function inlineMath(state, silent) {
      if (state.src[state.pos] !== "$") {
        return false;
      }
      const lastToken = state.tokens.at(-1);
      if ((lastToken == null ? void 0 : lastToken.type) === "html_inline") {
        if (/^<\w+.+[^/]>$/.test(lastToken.content)) {
          return false;
        }
      }
      let res = isValidInlineDelim(state, state.pos);
      if (!res.can_open) {
        if (!silent) {
          state.pending += "$";
        }
        state.pos += 1;
        return true;
      }
      let start = state.pos + 1;
      let match = start;
      let pos;
      while ((match = state.src.indexOf("$", match)) !== -1) {
        pos = match - 1;
        while (state.src[pos] === "\\") {
          pos -= 1;
        }
        if ((match - pos) % 2 == 1) {
          break;
        }
        match += 1;
      }
      if (match === -1) {
        if (!silent) {
          state.pending += "$";
        }
        state.pos = start;
        return true;
      }
      if (match - start === 0) {
        if (!silent) {
          state.pending += "$$";
        }
        state.pos = start + 1;
        return true;
      }
      res = isValidInlineDelim(state, match);
      if (!res.can_close) {
        if (!silent) {
          state.pending += "$";
        }
        state.pos = start;
        return true;
      }
      if (!silent) {
        const token = state.push("math_inline", "math", 0);
        token.markup = "$";
        token.content = state.src.slice(start, match);
      }
      state.pos = match + 1;
      return true;
    }
    function blockMath(state, start, end2, silent) {
      var lastLine, next2, lastPos, found = false, token, pos = state.bMarks[start] + state.tShift[start], max = state.eMarks[start];
      if (pos + 2 > max) {
        return false;
      }
      if (state.src.slice(pos, pos + 2) !== "$$") {
        return false;
      }
      pos += 2;
      let firstLine = state.src.slice(pos, max);
      if (silent) {
        return true;
      }
      if (firstLine.trim().slice(-2) === "$$") {
        firstLine = firstLine.trim().slice(0, -2);
        found = true;
      }
      for (next2 = start; !found; ) {
        next2++;
        if (next2 >= end2) {
          break;
        }
        pos = state.bMarks[next2] + state.tShift[next2];
        max = state.eMarks[next2];
        if (pos < max && state.tShift[next2] < state.blkIndent) {
          break;
        }
        if (state.src.slice(pos, max).trim().slice(-2) === "$$") {
          lastPos = state.src.slice(0, max).lastIndexOf("$$");
          lastLine = state.src.slice(pos, lastPos);
          found = true;
        } else if (state.src.slice(pos, max).trim().includes("$$")) {
          lastPos = state.src.slice(0, max).trim().indexOf("$$");
          lastLine = state.src.slice(pos, lastPos);
          found = true;
        }
      }
      state.line = next2 + 1;
      token = state.push("math_block", "math", 0);
      token.block = true;
      token.content = (firstLine && firstLine.trim() ? firstLine + "\n" : "") + state.getLines(start + 1, next2, state.tShift[start], true) + (lastLine && lastLine.trim() ? lastLine : "");
      token.map = [start, state.line];
      token.markup = "$$";
      return true;
    }
    function blockBareMath(state, start, end2, silent) {
      const startPos = state.bMarks[start] + state.tShift[start];
      const startMax = state.eMarks[start];
      const firstLine = state.src.slice(startPos, startMax);
      const beginMatch = firstLine.match(/^\s*\\begin\s*\{([^{}]+)\}/);
      if (!beginMatch) {
        return false;
      }
      if (start > 0) {
        const previousStart = state.bMarks[start - 1] + state.tShift[start - 1];
        const previousEnd = state.eMarks[start - 1];
        const previousLine = state.src.slice(previousStart, previousEnd);
        if (!/^\s*$/.test(previousLine)) {
          return false;
        }
      }
      if (silent) {
        return true;
      }
      const beginEndStack = [];
      let next2 = start;
      let lastLine;
      let found = false;
      outer: for (; !found; next2++) {
        if (next2 >= end2) {
          break;
        }
        const pos = state.bMarks[next2] + state.tShift[next2];
        const max = state.eMarks[next2];
        if (pos < max && state.tShift[next2] < state.blkIndent) {
          break;
        }
        const line = state.src.slice(pos, max);
        for (const match of line.matchAll(/(\\begin|\\end)\s*\{([^{}]+)\}/g)) {
          if (match[1] === "\\begin") {
            beginEndStack.push(match[2].trim());
          } else if (match[1] === "\\end") {
            beginEndStack.pop();
            if (!beginEndStack.length) {
              lastLine = state.src.slice(pos, max);
              found = true;
              break outer;
            }
          }
        }
      }
      state.line = next2 + 1;
      const token = state.push("math_block", "math", 0);
      token.block = true;
      token.content = (state.getLines(start, next2, state.tShift[start], true) + (lastLine ?? "")).trim();
      token.map = [start, state.line];
      token.markup = "$$";
      return true;
    }
    function inlineMathBlock(state, silent) {
      var start, match, token, res, pos;
      if (state.src.slice(state.pos, state.pos + 2) !== "$$") {
        return false;
      }
      res = isValidBlockDelim(state, state.pos);
      if (!res.can_open) {
        if (!silent) {
          state.pending += "$$";
        }
        state.pos += 2;
        return true;
      }
      start = state.pos + 2;
      match = start;
      while ((match = state.src.indexOf("$$", match)) !== -1) {
        pos = match - 1;
        while (state.src[pos] === "\\") {
          pos -= 1;
        }
        if ((match - pos) % 2 == 1) {
          break;
        }
        match += 2;
      }
      if (match === -1) {
        if (!silent) {
          state.pending += "$$";
        }
        state.pos = start;
        return true;
      }
      if (match - start === 0) {
        if (!silent) {
          state.pending += "$$$$";
        }
        state.pos = start + 2;
        return true;
      }
      res = isValidBlockDelim(state, match);
      if (!res.can_close) {
        if (!silent) {
          state.pending += "$$";
        }
        state.pos = start;
        return true;
      }
      if (!silent) {
        token = state.push("math_block", "math", 0);
        token.block = true;
        token.markup = "$$";
        token.content = state.src.slice(start, match);
      }
      state.pos = match + 2;
      return true;
    }
    function inlineBareBlock(state, silent) {
      const text2 = state.src.slice(state.pos);
      if (!/^\n\\begin/.test(text2)) {
        return false;
      }
      state.pos += 1;
      if (silent) {
        return true;
      }
      const lines = text2.split(/\n/g).slice(1);
      let foundLine;
      const beginEndStack = [];
      outer: for (var i = 0; i < lines.length; ++i) {
        const line = lines[i];
        for (const match of line.matchAll(/(\\begin|\\end)\s*\{([^{}]+)\}/g)) {
          if (match[1] === "\\begin") {
            beginEndStack.push(match[2].trim());
          } else if (match[1] === "\\end") {
            beginEndStack.pop();
            if (!beginEndStack.length) {
              foundLine = i;
              break outer;
            }
          }
        }
      }
      if (typeof foundLine === "undefined") {
        return false;
      }
      const endIndex = lines.slice(0, foundLine + 1).reduce((p, c) => p + c.length, 0) + foundLine + 1;
      const token = state.push("math_inline_bare_block", "math", 0);
      token.block = true;
      token.markup = "$$";
      token.content = text2.slice(1, endIndex);
      state.pos = state.pos + endIndex;
      return true;
    }
    function handleMathInHtml(state, mathType, mathMarkup, mathRegex) {
      const tokens = state.tokens;
      for (let index2 = tokens.length - 1; index2 >= 0; index2--) {
        const currentToken = tokens[index2];
        const newTokens = [];
        if (currentToken.type !== "html_block") {
          continue;
        }
        const content = currentToken.content;
        for (const match of content.matchAll(mathRegex)) {
          if (!match.groups) {
            continue;
          }
          const html_before_math = match.groups.html_before_math;
          const math = match.groups.math;
          const html_after_math = match.groups.html_after_math;
          if (html_before_math) {
            newTokens.push({ ...currentToken, type: "html_block", map: null, content: html_before_math });
          }
          if (math) {
            newTokens.push({
              ...currentToken,
              type: mathType,
              map: null,
              content: math,
              markup: mathMarkup,
              block: true,
              tag: "math"
            });
          }
          if (html_after_math) {
            newTokens.push({ ...currentToken, type: "html_block", map: null, content: html_after_math });
          }
        }
        if (newTokens.length > 0) {
          tokens.splice(index2, 1, ...newTokens);
        }
      }
      return true;
    }
    function escapeHtml2(unsafe) {
      return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
    function default_1(md, options) {
      const katex = (options == null ? void 0 : options.katex) ?? katex_1.default;
      const enableBareBlocks = options == null ? void 0 : options.enableBareBlocks;
      const enableMathBlockInHtml = options == null ? void 0 : options.enableMathBlockInHtml;
      const enableMathInlineInHtml = options == null ? void 0 : options.enableMathInlineInHtml;
      const enableFencedBlocks = options == null ? void 0 : options.enableFencedBlocks;
      md.inline.ruler.after("escape", "math_inline", inlineMath);
      md.inline.ruler.after("escape", "math_inline_block", inlineMathBlock);
      if (enableBareBlocks) {
        md.inline.ruler.before("text", "math_inline_bare_block", inlineBareBlock);
      }
      md.block.ruler.after("blockquote", "math_block", (state, start, end2, silent) => {
        if (enableBareBlocks && blockBareMath(state, start, end2, silent)) {
          return true;
        }
        return blockMath(state, start, end2, silent);
      }, {
        alt: ["paragraph", "reference", "blockquote", "list"]
      });
      const math_block_within_html_regex = /(?<html_before_math>[\s\S]*?)\$\$(?<math>[\s\S]+?)\$\$(?<html_after_math>(?:(?!\$\$[\s\S]+?\$\$)[\s\S])*)/gm;
      const math_inline_within_html_regex = /(?<html_before_math>[\s\S]*?)\$(?<math>.*?)\$(?<html_after_math>(?:(?!\$.*?\$)[\s\S])*)/gm;
      if (enableMathBlockInHtml) {
        md.core.ruler.push("math_block_in_html_block", (state) => {
          return handleMathInHtml(state, "math_block", "$$", math_block_within_html_regex);
        });
      }
      if (enableMathInlineInHtml) {
        md.core.ruler.push("math_inline_in_html_block", (state) => {
          return handleMathInHtml(state, "math_inline", "$", math_inline_within_html_regex);
        });
      }
      const katexInline = (latex) => {
        const displayMode = /\\begin\{(align|equation|gather|cd|alignat)\}/ig.test(latex);
        try {
          return katex.renderToString(latex, { ...options, displayMode });
        } catch (error2) {
          if (options == null ? void 0 : options.throwOnError) {
            console.log(error2);
          }
          return `<span class="katex-error" title="${escapeHtml2(latex)}">${escapeHtml2(error2 + "")}</span>`;
        }
      };
      const inlineRenderer = (tokens, idx) => {
        const content = tokens[idx].content;
        const hasBacktick = content.length > 2 && content[0] === "`" && content[content.length - 1] === "`";
        const sanitized = hasBacktick ? content.slice(1, -1) : content;
        return katexInline(sanitized);
      };
      const katexBlockRenderer = (latex) => {
        try {
          return `<p class="katex-block">${katex.renderToString(latex, { ...options, displayMode: true })}</p>`;
        } catch (error2) {
          if (options == null ? void 0 : options.throwOnError) {
            console.log(error2);
          }
          return `<p class="katex-block katex-error" title="${escapeHtml2(latex)}">${escapeHtml2(error2 + "")}</p>`;
        }
      };
      const blockRenderer = (tokens, idx) => {
        return katexBlockRenderer(tokens[idx].content) + "\n";
      };
      md.renderer.rules.math_inline = inlineRenderer;
      md.renderer.rules.math_inline_block = blockRenderer;
      md.renderer.rules.math_inline_bare_block = blockRenderer;
      md.renderer.rules.math_block = blockRenderer;
      if (enableFencedBlocks) {
        const mathLanguageId = "math";
        const originalFenceRenderer = md.renderer.rules.fence;
        md.renderer.rules.fence = function(tokens, idx, options2, env, self) {
          const token = tokens[idx];
          if (token.info.trim().toLowerCase() === mathLanguageId && enableFencedBlocks) {
            return katexBlockRenderer(token.content) + "\n";
          } else {
            return (originalFenceRenderer == null ? void 0 : originalFenceRenderer.call(this, tokens, idx, options2, env, self)) || "";
          }
        };
      }
    }
    dist.default = default_1;
    return dist;
  }
  var distExports = requireDist();
  const katexPluginModule = /* @__PURE__ */ getDefaultExportFromCjs(distExports);
  function interop(mod) {
    return mod.default || mod;
  }
  const katexPlugin = interop(katexPluginModule);
  const plugin$1 = definePlugin({
    name: name$2,
    config,
    transform(transformHooks) {
      var _a2, _b, _c, _d;
      let loading;
      const preloadScripts2 = ((_b = (_a2 = plugin$1.config) == null ? void 0 : _a2.preloadScripts) == null ? void 0 : _b.map(
        (item) => patchJSItem(transformHooks.transformer.urlBuilder, item)
      )) || [];
      const autoload = () => {
        loading || (loading = loadJS(preloadScripts2));
        return loading;
      };
      const renderKatex = (source, displayMode) => {
        const { katex } = window;
        if (katex) {
          return katex.renderToString(source, {
            displayMode,
            throwOnError: false
          });
        }
        autoload().then(() => {
          transformHooks.retransform.call();
        });
        return source;
      };
      let enableFeature = noop;
      transformHooks.parser.tap((md) => {
        md.use(katexPlugin);
        ["math_block", "math_inline"].forEach((key) => {
          const fn = (tokens, idx) => {
            enableFeature();
            const result = renderKatex(tokens[idx].content, !!tokens[idx].block);
            return result;
          };
          md.renderer.rules[key] = fn;
        });
      });
      transformHooks.beforeParse.tap((_, context) => {
        enableFeature = () => {
          context.features[name$2] = true;
        };
      });
      transformHooks.afterParse.tap((_, context) => {
        var _a3;
        const markmap = (_a3 = context.frontmatter) == null ? void 0 : _a3.markmap;
        if (markmap) {
          ["extraJs", "extraCss"].forEach((key) => {
            var _a4, _b2;
            const value = markmap[key];
            if (value) {
              markmap[key] = addDefaultVersions(
                value,
                name$2,
                ((_b2 = (_a4 = plugin$1.config) == null ? void 0 : _a4.versions) == null ? void 0 : _b2.katex) || ""
              );
            }
          });
        }
      });
      return {
        styles: (_c = plugin$1.config) == null ? void 0 : _c.styles,
        scripts: (_d = plugin$1.config) == null ? void 0 : _d.scripts
      };
    }
  });
  const name$1 = "npmUrl";
  const pluginNpmUrl = definePlugin({
    name: name$1,
    transform(transformHooks) {
      transformHooks.afterParse.tap((_, context) => {
        const { frontmatter } = context;
        const markmap = frontmatter == null ? void 0 : frontmatter.markmap;
        if (markmap) {
          ["extraJs", "extraCss"].forEach((key) => {
            const value = markmap[key];
            if (value) {
              markmap[key] = value.map((path) => {
                if (path.startsWith("npm:")) {
                  return transformHooks.transformer.urlBuilder.getFullUrl(
                    path.slice(4)
                  );
                }
                return path;
              });
            }
          });
        }
      });
      return {};
    }
  });
  const name = "sourceLines";
  const plugin = definePlugin({
    name,
    transform(transformHooks) {
      let frontmatterLines = 0;
      transformHooks.beforeParse.tap((_md, context) => {
        var _a2;
        frontmatterLines = ((_a2 = context.frontmatterInfo) == null ? void 0 : _a2.lines) || 0;
      });
      transformHooks.parser.tap((md) => {
        md.renderer.renderAttrs = wrapFunction(
          md.renderer.renderAttrs,
          (renderAttrs, token) => {
            if (token.block && token.map) {
              const lineRange = token.map.map((line) => line + frontmatterLines);
              token.attrSet("data-lines", lineRange.join(","));
            }
            return renderAttrs(token);
          }
        );
        if (md.renderer.rules.fence) {
          md.renderer.rules.fence = wrapFunction(
            md.renderer.rules.fence,
            (fence2, tokens, idx, ...rest) => {
              let result = fence2(tokens, idx, ...rest);
              const token = tokens[idx];
              if (result.startsWith("<pre>") && token.map) {
                const lineRange = token.map.map(
                  (line) => line + frontmatterLines
                );
                result = result.slice(0, 4) + ` data-lines="${lineRange.join(",")}"` + result.slice(4);
              }
              return result;
            }
          );
        }
      });
      return {};
    }
  });
  const plugins = [
    pluginFrontmatter,
    plugin$1,
    plugin$2,
    pluginNpmUrl,
    plugin$3,
    plugin
  ];
  const builtInPlugins = plugins;
  function cleanNode(node) {
    while (!node.content && node.children.length === 1) {
      node = node.children[0];
    }
    while (node.children.length === 1 && !node.children[0].content) {
      node = {
        ...node,
        children: node.children[0].children
      };
    }
    return {
      ...node,
      children: node.children.map(cleanNode)
    };
  }
  class Transformer {
    constructor(plugins2 = builtInPlugins) {
      this.assetsMap = {};
      this.urlBuilder = new UrlBuilder();
      this.hooks = createTransformHooks(this);
      this.plugins = plugins2.map(
        (plugin2) => typeof plugin2 === "function" ? plugin2() : plugin2
      );
      const assetsMap = {};
      for (const { name: name2, transform } of this.plugins) {
        assetsMap[name2] = transform(this.hooks);
      }
      this.assetsMap = assetsMap;
      const md = initializeMarkdownIt();
      this.md = md;
      this.hooks.parser.call(md);
    }
    transform(content, fallbackParserOptions) {
      var _a2;
      const context = {
        content,
        features: {},
        parserOptions: fallbackParserOptions
      };
      this.hooks.beforeParse.call(this.md, context);
      let { content: rawContent } = context;
      if (context.frontmatterInfo)
        rawContent = rawContent.slice(context.frontmatterInfo.offset);
      const html2 = this.md.render(rawContent, {});
      this.hooks.afterParse.call(this.md, context);
      const root2 = cleanNode(buildTree(html2, context.parserOptions));
      root2.content || (root2.content = `${((_a2 = context.frontmatter) == null ? void 0 : _a2.title) || ""}`);
      return { ...context, root: root2 };
    }
    resolveJS(item) {
      return patchJSItem(this.urlBuilder, item);
    }
    resolveCSS(item) {
      return patchCSSItem(this.urlBuilder, item);
    }
    /**
     * Get all assets from enabled plugins or filter them by plugin names as keys.
     */
    getAssets(keys) {
      const styles2 = [];
      const scripts = [];
      keys ?? (keys = this.plugins.map((plugin2) => plugin2.name));
      for (const assets of keys.map((key) => this.assetsMap[key])) {
        if (assets) {
          if (assets.styles) styles2.push(...assets.styles);
          if (assets.scripts) scripts.push(...assets.scripts);
        }
      }
      return {
        styles: styles2.map((item) => this.resolveCSS(item)),
        scripts: scripts.map((item) => this.resolveJS(item))
      };
    }
    /**
     * Get used assets by features object returned by `transform`.
     */
    getUsedAssets(features) {
      const keys = this.plugins.map((plugin2) => plugin2.name).filter((name2) => features[name2]);
      return this.getAssets(keys);
    }
  }
  const transformerVersions = {
    "markmap-lib": "0.18.12"
  };
  exports.Transformer = Transformer;
  exports.builtInPlugins = builtInPlugins;
  exports.patchCSSItem = patchCSSItem;
  exports.patchJSItem = patchJSItem;
  exports.transformerVersions = transformerVersions;
  Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
})(this.markmap = this.markmap || {}, window.katex);
