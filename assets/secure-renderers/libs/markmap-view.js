(function(exports, d32) {
  "use strict";
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
  const uniqId = Math.random().toString(36).slice(2, 8);
  let globalIndex = 0;
  function getId() {
    globalIndex += 1;
    return `mm-${uniqId}-${globalIndex}`;
  }
  function noop() {
  }
  function walkTree(tree, callback) {
    const walk = (item, parent) => callback(
      item,
      () => {
        var _a;
        return (_a = item.children) == null ? void 0 : _a.map((child) => walk(child, item));
      },
      parent
    );
    return walk(tree);
  }
  function addClass(className, ...rest) {
    const classList = (className || "").split(" ").filter(Boolean);
    rest.forEach((item) => {
      if (item && classList.indexOf(item) < 0) classList.push(item);
    });
    return classList.join(" ");
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
      let data = cache[key];
      if (!data) {
        data = {
          value: fn(...args)
        };
        cache[key] = data;
      }
      return data.value;
    };
  }
  function debounce(fn, time) {
    const state = {
      timer: 0
    };
    function reset() {
      if (state.timer) {
        window.clearTimeout(state.timer);
        state.timer = 0;
      }
    }
    function run() {
      reset();
      if (state.args) state.result = fn(...state.args);
    }
    return function debounced(...args) {
      reset();
      state.args = args;
      state.timer = window.setTimeout(run, time);
      return state.result;
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
  function h(type, props, ...children) {
    props = Object.assign({}, props, {
      children: children.length === 1 ? children[0] : children
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
  function insertDom(parent, nodes) {
    if (!Array.isArray(nodes)) nodes = [nodes];
    nodes = nodes.filter(Boolean);
    if (nodes.length) parent.append(...nodes);
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
  function setDOMAttribute(el, attr, value, isSVG) {
    attr = attrMap[attr] || attr;
    if (value === true) {
      el.setAttribute(attr, "");
    } else if (value === false) {
      el.removeAttribute(attr);
    } else {
      const namespace = isSVG ? NS_ATTRS[attr] : void 0;
      if (namespace !== void 0) {
        el.setAttributeNS(namespace, attr, value);
      } else {
        el.setAttribute(attr, value);
      }
    }
  }
  function flatten(arr) {
    return arr.reduce((prev, item) => prev.concat(item), []);
  }
  function mountChildren(children, env) {
    return Array.isArray(children) ? flatten(children.map((child) => mountChildren(child, env))) : mount(children, env);
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
          const children = mountChildren(props.children, env);
          insertDom(node, children);
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
        const children = mountChildren(props.children, childEnv);
        if (children != null) insertDom(node, children);
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
  const cssCache = {};
  async function loadJSItem(item, context) {
    var _a;
    const src = item.type === "script" && ((_a = item.data) == null ? void 0 : _a.src) || "";
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
  async function loadCSSItem(item) {
    const url = item.type === "stylesheet" && item.data.href || "";
    item.loaded || (item.loaded = cssCache[url]);
    if (!item.loaded) {
      const deferred = defer();
      item.loaded = deferred.promise;
      if (url) cssCache[url] = item.loaded;
      if (item.type === "style") {
        document.head.append(
          hm("style", {
            textContent: item.data
          })
        );
        deferred.resolve();
      } else if (url) {
        document.head.append(
          hm("link", {
            rel: "stylesheet",
            ...item.data
          })
        );
        fetch(url).then((res) => {
          if (res.ok) return res.text();
          throw res;
        }).then(() => deferred.resolve(), deferred.reject);
      }
    }
    await item.loaded;
  }
  async function loadJS(items, context) {
    items.forEach((item) => {
      var _a;
      if (item.type === "script" && ((_a = item.data) == null ? void 0 : _a.src)) {
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
  async function loadCSS(items) {
    await Promise.all(items.map((item) => loadCSSItem(item)));
  }
  const isMacintosh = typeof navigator !== "undefined" && navigator.userAgent.includes("Macintosh");
  const defaultColorFn = d32.scaleOrdinal(d32.schemeCategory10);
  const lineWidthFactory = (baseWidth = 1, deltaWidth = 3, k = 2) => (node) => baseWidth + deltaWidth / k ** node.state.depth;
  const defaultOptions = {
    autoFit: false,
    duration: 500,
    embedGlobalCSS: true,
    fitRatio: 0.95,
    maxInitialScale: 2,
    scrollForPan: isMacintosh,
    initialExpandLevel: -1,
    zoom: true,
    pan: true,
    toggleRecursively: false,
    color: (node) => {
      var _a;
      return defaultColorFn(`${((_a = node.state) == null ? void 0 : _a.path) || ""}`);
    },
    lineWidth: lineWidthFactory(),
    maxWidth: 0,
    nodeMinHeight: 16,
    paddingX: 8,
    spacingHorizontal: 80,
    spacingVertical: 5
  };
  function deriveOptions(jsonOptions) {
    const derivedOptions = {};
    const options = { ...jsonOptions };
    const { color, colorFreezeLevel, lineWidth } = options;
    if ((color == null ? void 0 : color.length) === 1) {
      const solidColor = color[0];
      derivedOptions.color = () => solidColor;
    } else if (color == null ? void 0 : color.length) {
      const colorFn = d32.scaleOrdinal(color);
      derivedOptions.color = (node) => colorFn(`${node.state.path}`);
    }
    if (colorFreezeLevel) {
      const color2 = derivedOptions.color || defaultOptions.color;
      derivedOptions.color = (node) => {
        node = {
          ...node,
          state: {
            ...node.state,
            path: node.state.path.split(".").slice(0, colorFreezeLevel).join(".")
          }
        };
        return color2(node);
      };
    }
    if (lineWidth) {
      const args = Array.isArray(lineWidth) ? lineWidth : [lineWidth, 0, 1];
      derivedOptions.lineWidth = lineWidthFactory(
        ...args
      );
    }
    const numberKeys = [
      "duration",
      "fitRatio",
      "initialExpandLevel",
      "maxInitialScale",
      "maxWidth",
      "nodeMinHeight",
      "paddingX",
      "spacingHorizontal",
      "spacingVertical"
    ];
    numberKeys.forEach((key) => {
      const value = options[key];
      if (typeof value === "number") derivedOptions[key] = value;
    });
    const booleanKeys = ["zoom", "pan"];
    booleanKeys.forEach((key) => {
      const value = options[key];
      if (value != null) derivedOptions[key] = !!value;
    });
    return derivedOptions;
  }
  function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i) | 0;
    }
    return (hash >>> 0).toString(36);
  }
  function childSelector(filter) {
    if (typeof filter === "string") {
      const selector = filter;
      filter = (el) => el.matches(selector);
    }
    const filterFn = filter;
    return function selector() {
      let nodes = Array.from(this.childNodes);
      if (filterFn) nodes = nodes.filter((node) => filterFn(node));
      return nodes;
    };
  }
  function count(node) {
    var sum = 0, children = node.children, i = children && children.length;
    if (!i) sum = 1;
    else while (--i >= 0) sum += children[i].value;
    node.value = sum;
  }
  function node_count() {
    return this.eachAfter(count);
  }
  function node_each(callback) {
    var node = this, current, next = [node], children, i, n;
    do {
      current = next.reverse(), next = [];
      while (node = current.pop()) {
        callback(node), children = node.children;
        if (children) for (i = 0, n = children.length; i < n; ++i) {
          next.push(children[i]);
        }
      }
    } while (next.length);
    return this;
  }
  function node_eachBefore(callback) {
    var node = this, nodes = [node], children, i;
    while (node = nodes.pop()) {
      callback(node), children = node.children;
      if (children) for (i = children.length - 1; i >= 0; --i) {
        nodes.push(children[i]);
      }
    }
    return this;
  }
  function node_eachAfter(callback) {
    var node = this, nodes = [node], next = [], children, i, n;
    while (node = nodes.pop()) {
      next.push(node), children = node.children;
      if (children) for (i = 0, n = children.length; i < n; ++i) {
        nodes.push(children[i]);
      }
    }
    while (node = next.pop()) {
      callback(node);
    }
    return this;
  }
  function node_sum(value) {
    return this.eachAfter(function(node) {
      var sum = +value(node.data) || 0, children = node.children, i = children && children.length;
      while (--i >= 0) sum += children[i].value;
      node.value = sum;
    });
  }
  function node_sort(compare) {
    return this.eachBefore(function(node) {
      if (node.children) {
        node.children.sort(compare);
      }
    });
  }
  function node_path(end) {
    var start = this, ancestor = leastCommonAncestor(start, end), nodes = [start];
    while (start !== ancestor) {
      start = start.parent;
      nodes.push(start);
    }
    var k = nodes.length;
    while (end !== ancestor) {
      nodes.splice(k, 0, end);
      end = end.parent;
    }
    return nodes;
  }
  function leastCommonAncestor(a, b) {
    if (a === b) return a;
    var aNodes = a.ancestors(), bNodes = b.ancestors(), c = null;
    a = aNodes.pop();
    b = bNodes.pop();
    while (a === b) {
      c = a;
      a = aNodes.pop();
      b = bNodes.pop();
    }
    return c;
  }
  function node_ancestors() {
    var node = this, nodes = [node];
    while (node = node.parent) {
      nodes.push(node);
    }
    return nodes;
  }
  function node_descendants() {
    var nodes = [];
    this.each(function(node) {
      nodes.push(node);
    });
    return nodes;
  }
  function node_leaves() {
    var leaves = [];
    this.eachBefore(function(node) {
      if (!node.children) {
        leaves.push(node);
      }
    });
    return leaves;
  }
  function node_links() {
    var root = this, links = [];
    root.each(function(node) {
      if (node !== root) {
        links.push({ source: node.parent, target: node });
      }
    });
    return links;
  }
  function hierarchy(data, children) {
    var root = new Node$1(data), valued = +data.value && (root.value = data.value), node, nodes = [root], child, childs, i, n;
    if (children == null) children = defaultChildren;
    while (node = nodes.pop()) {
      if (valued) node.value = +node.data.value;
      if ((childs = children(node.data)) && (n = childs.length)) {
        node.children = new Array(n);
        for (i = n - 1; i >= 0; --i) {
          nodes.push(child = node.children[i] = new Node$1(childs[i]));
          child.parent = node;
          child.depth = node.depth + 1;
        }
      }
    }
    return root.eachBefore(computeHeight);
  }
  function node_copy() {
    return hierarchy(this).eachBefore(copyData);
  }
  function defaultChildren(d) {
    return d.children;
  }
  function copyData(node) {
    node.data = node.data.data;
  }
  function computeHeight(node) {
    var height = 0;
    do
      node.height = height;
    while ((node = node.parent) && node.height < ++height);
  }
  function Node$1(data) {
    this.data = data;
    this.depth = this.height = 0;
    this.parent = null;
  }
  Node$1.prototype = hierarchy.prototype = {
    constructor: Node$1,
    count: node_count,
    each: node_each,
    eachAfter: node_eachAfter,
    eachBefore: node_eachBefore,
    sum: node_sum,
    sort: node_sort,
    path: node_path,
    ancestors: node_ancestors,
    descendants: node_descendants,
    leaves: node_leaves,
    links: node_links,
    copy: node_copy
  };
  const version$1 = "2.1.2";
  const packageInfo = {
    version: version$1
  };
  const { version } = packageInfo;
  const defaults = Object.freeze({
    children: (data) => data.children,
    nodeSize: (node) => node.data.size,
    spacing: 0
  });
  function flextree(options) {
    const opts = Object.assign({}, defaults, options);
    function accessor(name) {
      const opt = opts[name];
      return typeof opt === "function" ? opt : () => opt;
    }
    function layout(tree) {
      const wtree = wrap(getWrapper(), tree, (node) => node.children);
      wtree.update();
      return wtree.data;
    }
    function getFlexNode() {
      const nodeSize = accessor("nodeSize");
      const spacing = accessor("spacing");
      return class FlexNode extends hierarchy.prototype.constructor {
        constructor(data) {
          super(data);
        }
        copy() {
          const c = wrap(this.constructor, this, (node) => node.children);
          c.each((node) => node.data = node.data.data);
          return c;
        }
        get size() {
          return nodeSize(this);
        }
        spacing(oNode) {
          return spacing(this, oNode);
        }
        get nodes() {
          return this.descendants();
        }
        get xSize() {
          return this.size[0];
        }
        get ySize() {
          return this.size[1];
        }
        get top() {
          return this.y;
        }
        get bottom() {
          return this.y + this.ySize;
        }
        get left() {
          return this.x - this.xSize / 2;
        }
        get right() {
          return this.x + this.xSize / 2;
        }
        get root() {
          const ancs = this.ancestors();
          return ancs[ancs.length - 1];
        }
        get numChildren() {
          return this.hasChildren ? this.children.length : 0;
        }
        get hasChildren() {
          return !this.noChildren;
        }
        get noChildren() {
          return this.children === null;
        }
        get firstChild() {
          return this.hasChildren ? this.children[0] : null;
        }
        get lastChild() {
          return this.hasChildren ? this.children[this.numChildren - 1] : null;
        }
        get extents() {
          return (this.children || []).reduce(
            (acc, kid) => FlexNode.maxExtents(acc, kid.extents),
            this.nodeExtents
          );
        }
        get nodeExtents() {
          return {
            top: this.top,
            bottom: this.bottom,
            left: this.left,
            right: this.right
          };
        }
        static maxExtents(e0, e1) {
          return {
            top: Math.min(e0.top, e1.top),
            bottom: Math.max(e0.bottom, e1.bottom),
            left: Math.min(e0.left, e1.left),
            right: Math.max(e0.right, e1.right)
          };
        }
      };
    }
    function getWrapper() {
      const FlexNode = getFlexNode();
      const nodeSize = accessor("nodeSize");
      const spacing = accessor("spacing");
      return class extends FlexNode {
        constructor(data) {
          super(data);
          Object.assign(this, {
            x: 0,
            y: 0,
            relX: 0,
            prelim: 0,
            shift: 0,
            change: 0,
            lExt: this,
            lExtRelX: 0,
            lThr: null,
            rExt: this,
            rExtRelX: 0,
            rThr: null
          });
        }
        get size() {
          return nodeSize(this.data);
        }
        spacing(oNode) {
          return spacing(this.data, oNode.data);
        }
        get x() {
          return this.data.x;
        }
        set x(v) {
          this.data.x = v;
        }
        get y() {
          return this.data.y;
        }
        set y(v) {
          this.data.y = v;
        }
        update() {
          layoutChildren(this);
          resolveX(this);
          return this;
        }
      };
    }
    function wrap(FlexClass, treeData, children) {
      const _wrap = (data, parent) => {
        const node = new FlexClass(data);
        Object.assign(node, {
          parent,
          depth: parent === null ? 0 : parent.depth + 1,
          height: 0,
          length: 1
        });
        const kidsData = children(data) || [];
        node.children = kidsData.length === 0 ? null : kidsData.map((kd) => _wrap(kd, node));
        if (node.children) {
          Object.assign(node, node.children.reduce(
            (hl, kid) => ({
              height: Math.max(hl.height, kid.height + 1),
              length: hl.length + kid.length
            }),
            node
          ));
        }
        return node;
      };
      return _wrap(treeData, null);
    }
    Object.assign(layout, {
      nodeSize(arg) {
        return arguments.length ? (opts.nodeSize = arg, layout) : opts.nodeSize;
      },
      spacing(arg) {
        return arguments.length ? (opts.spacing = arg, layout) : opts.spacing;
      },
      children(arg) {
        return arguments.length ? (opts.children = arg, layout) : opts.children;
      },
      hierarchy(treeData, children) {
        const kids = typeof children === "undefined" ? opts.children : children;
        return wrap(getFlexNode(), treeData, kids);
      },
      dump(tree) {
        const nodeSize = accessor("nodeSize");
        const _dump = (i0) => (node) => {
          const i1 = i0 + "  ";
          const i2 = i0 + "    ";
          const { x, y } = node;
          const size = nodeSize(node);
          const kids = node.children || [];
          const kdumps = kids.length === 0 ? " " : `,${i1}children: [${i2}${kids.map(_dump(i2)).join(i2)}${i1}],${i0}`;
          return `{ size: [${size.join(", ")}],${i1}x: ${x}, y: ${y}${kdumps}},`;
        };
        return _dump("\n")(tree);
      }
    });
    return layout;
  }
  flextree.version = version;
  const layoutChildren = (w, y = 0) => {
    w.y = y;
    (w.children || []).reduce((acc, kid) => {
      const [i, lastLows] = acc;
      layoutChildren(kid, w.y + w.ySize);
      const lowY = (i === 0 ? kid.lExt : kid.rExt).bottom;
      if (i !== 0) separate(w, i, lastLows);
      const lows = updateLows(lowY, i, lastLows);
      return [i + 1, lows];
    }, [0, null]);
    shiftChange(w);
    positionRoot(w);
    return w;
  };
  const resolveX = (w, prevSum, parentX) => {
    if (typeof prevSum === "undefined") {
      prevSum = -w.relX - w.prelim;
      parentX = 0;
    }
    const sum = prevSum + w.relX;
    w.relX = sum + w.prelim - parentX;
    w.prelim = 0;
    w.x = parentX + w.relX;
    (w.children || []).forEach((k) => resolveX(k, sum, w.x));
    return w;
  };
  const shiftChange = (w) => {
    (w.children || []).reduce((acc, child) => {
      const [lastShiftSum, lastChangeSum] = acc;
      const shiftSum = lastShiftSum + child.shift;
      const changeSum = lastChangeSum + shiftSum + child.change;
      child.relX += changeSum;
      return [shiftSum, changeSum];
    }, [0, 0]);
  };
  const separate = (w, i, lows) => {
    const lSib = w.children[i - 1];
    const curSubtree = w.children[i];
    let rContour = lSib;
    let rSumMods = lSib.relX;
    let lContour = curSubtree;
    let lSumMods = curSubtree.relX;
    let isFirst = true;
    while (rContour && lContour) {
      if (rContour.bottom > lows.lowY) lows = lows.next;
      const dist = rSumMods + rContour.prelim - (lSumMods + lContour.prelim) + rContour.xSize / 2 + lContour.xSize / 2 + rContour.spacing(lContour);
      if (dist > 0 || dist < 0 && isFirst) {
        lSumMods += dist;
        moveSubtree(curSubtree, dist);
        distributeExtra(w, i, lows.index, dist);
      }
      isFirst = false;
      const rightBottom = rContour.bottom;
      const leftBottom = lContour.bottom;
      if (rightBottom <= leftBottom) {
        rContour = nextRContour(rContour);
        if (rContour) rSumMods += rContour.relX;
      }
      if (rightBottom >= leftBottom) {
        lContour = nextLContour(lContour);
        if (lContour) lSumMods += lContour.relX;
      }
    }
    if (!rContour && lContour) setLThr(w, i, lContour, lSumMods);
    else if (rContour && !lContour) setRThr(w, i, rContour, rSumMods);
  };
  const moveSubtree = (subtree, distance) => {
    subtree.relX += distance;
    subtree.lExtRelX += distance;
    subtree.rExtRelX += distance;
  };
  const distributeExtra = (w, curSubtreeI, leftSibI, dist) => {
    const curSubtree = w.children[curSubtreeI];
    const n = curSubtreeI - leftSibI;
    if (n > 1) {
      const delta = dist / n;
      w.children[leftSibI + 1].shift += delta;
      curSubtree.shift -= delta;
      curSubtree.change -= dist - delta;
    }
  };
  const nextLContour = (w) => {
    return w.hasChildren ? w.firstChild : w.lThr;
  };
  const nextRContour = (w) => {
    return w.hasChildren ? w.lastChild : w.rThr;
  };
  const setLThr = (w, i, lContour, lSumMods) => {
    const firstChild = w.firstChild;
    const lExt = firstChild.lExt;
    const curSubtree = w.children[i];
    lExt.lThr = lContour;
    const diff = lSumMods - lContour.relX - firstChild.lExtRelX;
    lExt.relX += diff;
    lExt.prelim -= diff;
    firstChild.lExt = curSubtree.lExt;
    firstChild.lExtRelX = curSubtree.lExtRelX;
  };
  const setRThr = (w, i, rContour, rSumMods) => {
    const curSubtree = w.children[i];
    const rExt = curSubtree.rExt;
    const lSib = w.children[i - 1];
    rExt.rThr = rContour;
    const diff = rSumMods - rContour.relX - curSubtree.rExtRelX;
    rExt.relX += diff;
    rExt.prelim -= diff;
    curSubtree.rExt = lSib.rExt;
    curSubtree.rExtRelX = lSib.rExtRelX;
  };
  const positionRoot = (w) => {
    if (w.hasChildren) {
      const k0 = w.firstChild;
      const kf = w.lastChild;
      const prelim = (k0.prelim + k0.relX - k0.xSize / 2 + kf.relX + kf.prelim + kf.xSize / 2) / 2;
      Object.assign(w, {
        prelim,
        lExt: k0.lExt,
        lExtRelX: k0.lExtRelX,
        rExt: kf.rExt,
        rExtRelX: kf.rExtRelX
      });
    }
  };
  const updateLows = (lowY, index, lastLows) => {
    while (lastLows !== null && lowY >= lastLows.lowY)
      lastLows = lastLows.next;
    return {
      lowY,
      index,
      next: lastLows
    };
  };
  const css = ".markmap {\n  --markmap-max-width: 9999px;\n  --markmap-a-color: #0097e6;\n  --markmap-a-hover-color: #00a8ff;\n  --markmap-code-bg: #f0f0f0;\n  --markmap-code-color: #555;\n  --markmap-highlight-bg: #ffeaa7;\n  --markmap-table-border: 1px solid currentColor;\n  --markmap-font: 300 16px/20px sans-serif;\n  --markmap-circle-open-bg: #fff;\n  --markmap-text-color: #333;\n  --markmap-highlight-node-bg: #ff02;\n\n  font: var(--markmap-font);\n  color: var(--markmap-text-color);\n}\n\n  .markmap-link {\n    fill: none;\n  }\n\n  .markmap-node > circle {\n      cursor: pointer;\n    }\n\n  .markmap-foreign {\n    display: inline-block;\n  }\n\n  .markmap-foreign p {\n      margin: 0;\n    }\n\n  .markmap-foreign a {\n      color: var(--markmap-a-color);\n    }\n\n  .markmap-foreign a:hover {\n        color: var(--markmap-a-hover-color);\n      }\n\n  .markmap-foreign code {\n      padding: 0.25em;\n      font-size: calc(1em - 2px);\n      color: var(--markmap-code-color);\n      background-color: var(--markmap-code-bg);\n      border-radius: 2px;\n    }\n\n  .markmap-foreign pre {\n      margin: 0;\n    }\n\n  .markmap-foreign pre > code {\n        display: block;\n      }\n\n  .markmap-foreign del {\n      text-decoration: line-through;\n    }\n\n  .markmap-foreign em {\n      font-style: italic;\n    }\n\n  .markmap-foreign strong {\n      font-weight: bold;\n    }\n\n  .markmap-foreign mark {\n      background: var(--markmap-highlight-bg);\n    }\n\n  .markmap-foreign table,\n    .markmap-foreign th,\n    .markmap-foreign td {\n      border-collapse: collapse;\n      border: var(--markmap-table-border);\n    }\n\n  .markmap-foreign img {\n      display: inline-block;\n    }\n\n  .markmap-foreign svg {\n      fill: currentColor;\n    }\n\n  .markmap-foreign > div {\n      width: var(--markmap-max-width);\n      text-align: left;\n    }\n\n  .markmap-foreign > div > div {\n        display: inline-block;\n      }\n\n  .markmap-highlight rect {\n    fill: var(--markmap-highlight-node-bg);\n  }\n\n.markmap-dark .markmap {\n  --markmap-code-bg: #1a1b26;\n  --markmap-code-color: #ddd;\n  --markmap-circle-open-bg: #444;\n  --markmap-text-color: #eee;\n}\n";
  const globalCSS = css;
  const SELECTOR_NODE = "g.markmap-node";
  const SELECTOR_LINK = "path.markmap-link";
  const SELECTOR_HIGHLIGHT = "g.markmap-highlight";
  const linkShape = d32.linkHorizontal();
  function minBy(numbers, by) {
    const index = d32.minIndex(numbers, by);
    return numbers[index];
  }
  function stopPropagation(e) {
    e.stopPropagation();
  }
  const refreshHook = new Hook();
  class Markmap {
    constructor(svg, opts) {
      this.options = { ...defaultOptions };
      this._disposeList = [];
      this.handleZoom = (e) => {
        const { transform } = e;
        this.g.attr("transform", transform);
      };
      this.handlePan = (e) => {
        e.preventDefault();
        const transform = d32.zoomTransform(this.svg.node());
        const newTransform = transform.translate(
          -e.deltaX / transform.k,
          -e.deltaY / transform.k
        );
        this.svg.call(this.zoom.transform, newTransform);
      };
      this.handleClick = (e, d) => {
        let recursive = this.options.toggleRecursively;
        if (isMacintosh ? e.metaKey : e.ctrlKey) recursive = !recursive;
        this.toggleNode(d, recursive);
      };
      this.ensureView = this.ensureVisible;
      this.svg = svg.datum ? svg : d32.select(svg);
      this.styleNode = this.svg.append("style");
      this.zoom = d32.zoom().filter((event) => {
        if (this.options.scrollForPan) {
          if (event.type === "wheel") return event.ctrlKey && !event.button;
        }
        return (!event.ctrlKey || event.type === "wheel") && !event.button;
      }).on("zoom", this.handleZoom);
      this.setOptions(opts);
      this.state = {
        id: this.options.id || this.svg.attr("id") || getId(),
        rect: { x1: 0, y1: 0, x2: 0, y2: 0 }
      };
      this.g = this.svg.append("g");
      this.g.append("g").attr("class", "markmap-highlight");
      this._observer = new ResizeObserver(
        debounce(() => {
          this.renderData();
        }, 100)
      );
      this._disposeList.push(
        refreshHook.tap(() => {
          this.setData();
        }),
        () => this._observer.disconnect()
      );
    }
    getStyleContent() {
      const { style } = this.options;
      const { id } = this.state;
      const styleText = typeof style === "function" ? style(id) : "";
      return [this.options.embedGlobalCSS && css, styleText].filter(Boolean).join("\n");
    }
    updateStyle() {
      this.svg.attr(
        "class",
        addClass(this.svg.attr("class"), "markmap", this.state.id)
      );
      const style = this.getStyleContent();
      this.styleNode.text(style);
    }
    async toggleNode(data, recursive = false) {
      var _a, _b;
      const fold = ((_a = data.payload) == null ? void 0 : _a.fold) ? 0 : 1;
      if (recursive) {
        walkTree(data, (item, next) => {
          item.payload = {
            ...item.payload,
            fold
          };
          next();
        });
      } else {
        data.payload = {
          ...data.payload,
          fold: ((_b = data.payload) == null ? void 0 : _b.fold) ? 0 : 1
        };
      }
      await this.renderData(data);
    }
    _initializeData(node) {
      let nodeId = 0;
      const { color, initialExpandLevel } = this.options;
      let foldRecursively = 0;
      let depth = 0;
      walkTree(node, (item, next, parent) => {
        var _a, _b, _c, _d;
        depth += 1;
        item.children = (_a = item.children) == null ? void 0 : _a.map((child) => ({ ...child }));
        nodeId += 1;
        item.state = {
          ...item.state,
          depth,
          id: nodeId,
          rect: {
            x: 0,
            y: 0,
            width: 0,
            height: 0
          },
          size: [0, 0]
        };
        item.state.key = [(_b = parent == null ? void 0 : parent.state) == null ? void 0 : _b.id, item.state.id].filter(Boolean).join(".") + simpleHash(item.content);
        item.state.path = [(_c = parent == null ? void 0 : parent.state) == null ? void 0 : _c.path, item.state.id].filter(Boolean).join(".");
        color(item);
        const isFoldRecursively = ((_d = item.payload) == null ? void 0 : _d.fold) === 2;
        if (isFoldRecursively) {
          foldRecursively += 1;
        } else if (foldRecursively || initialExpandLevel >= 0 && item.state.depth >= initialExpandLevel) {
          item.payload = { ...item.payload, fold: 1 };
        }
        next();
        if (isFoldRecursively) foldRecursively -= 1;
        depth -= 1;
      });
      return node;
    }
    _relayout() {
      if (!this.state.data) return;
      this.g.selectAll(childSelector(SELECTOR_NODE)).selectAll(
        childSelector("foreignObject")
      ).each(function(d) {
        var _a;
        const el = (_a = this.firstChild) == null ? void 0 : _a.firstChild;
        const newSize = [el.scrollWidth, el.scrollHeight];
        d.state.size = newSize;
      });
      const { lineWidth, paddingX, spacingHorizontal, spacingVertical } = this.options;
      const layout = flextree({}).children((d) => {
        var _a;
        if (!((_a = d.payload) == null ? void 0 : _a.fold)) return d.children;
      }).nodeSize((node) => {
        const [width, height] = node.data.state.size;
        return [height, width + (width ? paddingX * 2 : 0) + spacingHorizontal];
      }).spacing((a, b) => {
        return (a.parent === b.parent ? spacingVertical : spacingVertical * 2) + lineWidth(a.data);
      });
      const tree = layout.hierarchy(this.state.data);
      layout(tree);
      const fnodes = tree.descendants();
      fnodes.forEach((fnode) => {
        const node = fnode.data;
        node.state.rect = {
          x: fnode.y,
          y: fnode.x - fnode.xSize / 2,
          width: fnode.ySize - spacingHorizontal,
          height: fnode.xSize
        };
      });
      this.state.rect = {
        x1: d32.min(fnodes, (fnode) => fnode.data.state.rect.x) || 0,
        y1: d32.min(fnodes, (fnode) => fnode.data.state.rect.y) || 0,
        x2: d32.max(
          fnodes,
          (fnode) => fnode.data.state.rect.x + fnode.data.state.rect.width
        ) || 0,
        y2: d32.max(
          fnodes,
          (fnode) => fnode.data.state.rect.y + fnode.data.state.rect.height
        ) || 0
      };
    }
    setOptions(opts) {
      this.options = {
        ...this.options,
        ...opts
      };
      if (this.options.zoom) {
        this.svg.call(this.zoom);
      } else {
        this.svg.on(".zoom", null);
      }
      if (this.options.pan) {
        this.svg.on("wheel", this.handlePan);
      } else {
        this.svg.on("wheel", null);
      }
    }
    async setData(data, opts) {
      if (opts) this.setOptions(opts);
      if (data) this.state.data = this._initializeData(data);
      if (!this.state.data) return;
      this.updateStyle();
      await this.renderData();
    }
    async setHighlight(node) {
      this.state.highlight = node || void 0;
      await this.renderData();
    }
    _getHighlightRect(highlight) {
      const svgNode = this.svg.node();
      const transform = d32.zoomTransform(svgNode);
      const padding = 4 / transform.k;
      const rect = {
        ...highlight.state.rect
      };
      rect.x -= padding;
      rect.y -= padding;
      rect.width += 2 * padding;
      rect.height += 2 * padding;
      return rect;
    }
    async renderData(originData) {
      const { paddingX, autoFit, color, maxWidth, lineWidth } = this.options;
      const rootNode = this.state.data;
      if (!rootNode) return;
      const nodeMap = {};
      const parentMap = {};
      const nodes = [];
      walkTree(rootNode, (item, next, parent) => {
        var _a;
        if (!((_a = item.payload) == null ? void 0 : _a.fold)) next();
        nodeMap[item.state.id] = item;
        if (parent) parentMap[item.state.id] = parent.state.id;
        nodes.push(item);
      });
      const originMap = {};
      const sourceRectMap = {};
      const setOriginNode = (originNode) => {
        if (!originNode || originMap[originNode.state.id]) return;
        walkTree(originNode, (item, next) => {
          originMap[item.state.id] = originNode.state.id;
          next();
        });
      };
      const getOriginSourceRect = (node) => {
        const rect = sourceRectMap[originMap[node.state.id]];
        return rect || rootNode.state.rect;
      };
      const getOriginTargetRect = (node) => (nodeMap[originMap[node.state.id]] || rootNode).state.rect;
      sourceRectMap[rootNode.state.id] = rootNode.state.rect;
      if (originData) setOriginNode(originData);
      let { highlight } = this.state;
      if (highlight && !nodeMap[highlight.state.id]) highlight = void 0;
      let highlightNodes = this.g.selectAll(childSelector(SELECTOR_HIGHLIGHT)).selectAll(childSelector("rect")).data(highlight ? [this._getHighlightRect(highlight)] : []).join("rect").attr("x", (d) => d.x).attr("y", (d) => d.y).attr("width", (d) => d.width).attr("height", (d) => d.height);
      const mmG = this.g.selectAll(childSelector(SELECTOR_NODE)).each((d) => {
        sourceRectMap[d.state.id] = d.state.rect;
      }).data(nodes, (d) => d.state.key);
      const mmGEnter = mmG.enter().append("g").attr("data-depth", (d) => d.state.depth).attr("data-path", (d) => d.state.path).each((d) => {
        setOriginNode(nodeMap[parentMap[d.state.id]]);
      });
      const mmGExit = mmG.exit().each((d) => {
        setOriginNode(nodeMap[parentMap[d.state.id]]);
      });
      const mmGMerge = mmG.merge(mmGEnter).attr(
        "class",
        (d) => {
          var _a;
          return ["markmap-node", ((_a = d.payload) == null ? void 0 : _a.fold) && "markmap-fold"].filter(Boolean).join(" ");
        }
      );
      const mmLine = mmGMerge.selectAll(childSelector("line")).data(
        (d) => [d],
        (d) => d.state.key
      );
      const mmLineEnter = mmLine.enter().append("line").attr("stroke", (d) => color(d)).attr("stroke-width", 0);
      const mmLineMerge = mmLine.merge(mmLineEnter);
      const mmCircle = mmGMerge.selectAll(childSelector("circle")).data(
        (d) => {
          var _a;
          return ((_a = d.children) == null ? void 0 : _a.length) ? [d] : [];
        },
        (d) => d.state.key
      );
      const mmCircleEnter = mmCircle.enter().append("circle").attr("stroke-width", 0).attr("r", 0).on("click", (e, d) => this.handleClick(e, d)).on("mousedown", stopPropagation);
      const mmCircleMerge = mmCircleEnter.merge(mmCircle).attr("stroke", (d) => color(d)).attr(
        "fill",
        (d) => {
          var _a;
          return ((_a = d.payload) == null ? void 0 : _a.fold) && d.children ? color(d) : "var(--markmap-circle-open-bg)";
        }
      );
      const observer = this._observer;
      const mmFo = mmGMerge.selectAll(childSelector("foreignObject")).data(
        (d) => [d],
        (d) => d.state.key
      );
      const mmFoEnter = mmFo.enter().append("foreignObject").attr("class", "markmap-foreign").attr("x", paddingX).attr("y", 0).style("opacity", 0).on("mousedown", stopPropagation).on("dblclick", stopPropagation);
      mmFoEnter.append("xhtml:div").append("xhtml:div").html((d) => d.content).attr("xmlns", "http://www.w3.org/1999/xhtml");
      mmFoEnter.each(function() {
        var _a;
        const el = (_a = this.firstChild) == null ? void 0 : _a.firstChild;
        observer.observe(el);
      });
      const mmFoExit = mmGExit.selectAll(
        childSelector("foreignObject")
      );
      mmFoExit.each(function() {
        var _a;
        const el = (_a = this.firstChild) == null ? void 0 : _a.firstChild;
        observer.unobserve(el);
      });
      const mmFoMerge = mmFoEnter.merge(mmFo);
      const links = nodes.flatMap(
        (node) => {
          var _a;
          return ((_a = node.payload) == null ? void 0 : _a.fold) ? [] : node.children.map((child) => ({ source: node, target: child }));
        }
      );
      const mmPath = this.g.selectAll(childSelector(SELECTOR_LINK)).data(links, (d) => d.target.state.key);
      const mmPathExit = mmPath.exit();
      const mmPathEnter = mmPath.enter().insert("path", "g").attr("class", "markmap-link").attr("data-depth", (d) => d.target.state.depth).attr("data-path", (d) => d.target.state.path).attr("d", (d) => {
        const originRect = getOriginSourceRect(d.target);
        const pathOrigin = [
          originRect.x + originRect.width,
          originRect.y + originRect.height
        ];
        return linkShape({ source: pathOrigin, target: pathOrigin });
      }).attr("stroke-width", 0);
      const mmPathMerge = mmPathEnter.merge(mmPath);
      this.svg.style(
        "--markmap-max-width",
        maxWidth ? `${maxWidth}px` : null
      );
      await new Promise(requestAnimationFrame);
      this._relayout();
      highlightNodes = highlightNodes.data(highlight ? [this._getHighlightRect(highlight)] : []).join("rect");
      this.transition(highlightNodes).attr("x", (d) => d.x).attr("y", (d) => d.y).attr("width", (d) => d.width).attr("height", (d) => d.height);
      mmGEnter.attr("transform", (d) => {
        const originRect = getOriginSourceRect(d);
        return `translate(${originRect.x + originRect.width - d.state.rect.width},${originRect.y + originRect.height - d.state.rect.height})`;
      });
      this.transition(mmGExit).attr("transform", (d) => {
        const targetRect = getOriginTargetRect(d);
        const targetX = targetRect.x + targetRect.width - d.state.rect.width;
        const targetY = targetRect.y + targetRect.height - d.state.rect.height;
        return `translate(${targetX},${targetY})`;
      }).remove();
      this.transition(mmGMerge).attr(
        "transform",
        (d) => `translate(${d.state.rect.x},${d.state.rect.y})`
      );
      const mmLineExit = mmGExit.selectAll(
        childSelector("line")
      );
      this.transition(mmLineExit).attr("x1", (d) => d.state.rect.width).attr("stroke-width", 0);
      mmLineEnter.attr("x1", (d) => d.state.rect.width).attr("x2", (d) => d.state.rect.width);
      mmLineMerge.attr("y1", (d) => d.state.rect.height + lineWidth(d) / 2).attr("y2", (d) => d.state.rect.height + lineWidth(d) / 2);
      this.transition(mmLineMerge).attr("x1", -1).attr("x2", (d) => d.state.rect.width + 2).attr("stroke", (d) => color(d)).attr("stroke-width", lineWidth);
      const mmCircleExit = mmGExit.selectAll(
        childSelector("circle")
      );
      this.transition(mmCircleExit).attr("r", 0).attr("stroke-width", 0);
      mmCircleMerge.attr("cx", (d) => d.state.rect.width).attr("cy", (d) => d.state.rect.height + lineWidth(d) / 2);
      this.transition(mmCircleMerge).attr("r", 6).attr("stroke-width", "1.5");
      this.transition(mmFoExit).style("opacity", 0);
      mmFoMerge.attr("width", (d) => Math.max(0, d.state.rect.width - paddingX * 2)).attr("height", (d) => d.state.rect.height);
      this.transition(mmFoMerge).style("opacity", 1);
      this.transition(mmPathExit).attr("d", (d) => {
        const targetRect = getOriginTargetRect(d.target);
        const pathTarget = [
          targetRect.x + targetRect.width,
          targetRect.y + targetRect.height + lineWidth(d.target) / 2
        ];
        return linkShape({ source: pathTarget, target: pathTarget });
      }).attr("stroke-width", 0).remove();
      this.transition(mmPathMerge).attr("stroke", (d) => color(d.target)).attr("stroke-width", (d) => lineWidth(d.target)).attr("d", (d) => {
        const origSource = d.source;
        const origTarget = d.target;
        const source = [
          origSource.state.rect.x + origSource.state.rect.width,
          origSource.state.rect.y + origSource.state.rect.height + lineWidth(origSource) / 2
        ];
        const target = [
          origTarget.state.rect.x,
          origTarget.state.rect.y + origTarget.state.rect.height + lineWidth(origTarget) / 2
        ];
        return linkShape({ source, target });
      });
      if (autoFit) this.fit();
    }
    transition(sel) {
      const { duration } = this.options;
      return sel.transition().duration(duration);
    }
    /**
     * Fit the content to the viewport.
     */
    async fit(maxScale = this.options.maxInitialScale) {
      const svgNode = this.svg.node();
      const { width: offsetWidth, height: offsetHeight } = svgNode.getBoundingClientRect();
      const { fitRatio } = this.options;
      const { x1, y1, x2, y2 } = this.state.rect;
      const naturalWidth = x2 - x1;
      const naturalHeight = y2 - y1;
      const scale = Math.min(
        offsetWidth / naturalWidth * fitRatio,
        offsetHeight / naturalHeight * fitRatio,
        maxScale
      );
      const initialZoom = d32.zoomIdentity.translate(
        (offsetWidth - naturalWidth * scale) / 2 - x1 * scale,
        (offsetHeight - naturalHeight * scale) / 2 - y1 * scale
      ).scale(scale);
      return this.transition(this.svg).call(this.zoom.transform, initialZoom).end().catch(noop);
    }
    findElement(node) {
      let result;
      this.g.selectAll(childSelector(SELECTOR_NODE)).each(function walk(d) {
        if (d === node) {
          result = {
            data: d,
            g: this
          };
        }
      });
      return result;
    }
    /**
     * Pan the content to make the provided node visible in the viewport.
     */
    async ensureVisible(node, padding) {
      var _a;
      const itemData = (_a = this.findElement(node)) == null ? void 0 : _a.data;
      if (!itemData) return;
      const svgNode = this.svg.node();
      const relRect = svgNode.getBoundingClientRect();
      const transform = d32.zoomTransform(svgNode);
      const [left, right] = [
        itemData.state.rect.x,
        itemData.state.rect.x + itemData.state.rect.width + 2
      ].map((x) => x * transform.k + transform.x);
      const [top, bottom] = [
        itemData.state.rect.y,
        itemData.state.rect.y + itemData.state.rect.height
      ].map((y) => y * transform.k + transform.y);
      const pd = {
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        ...padding
      };
      const dxs = [pd.left - left, relRect.width - pd.right - right];
      const dys = [pd.top - top, relRect.height - pd.bottom - bottom];
      const dx = dxs[0] * dxs[1] > 0 ? minBy(dxs, Math.abs) / transform.k : 0;
      const dy = dys[0] * dys[1] > 0 ? minBy(dys, Math.abs) / transform.k : 0;
      if (dx || dy) {
        const newTransform = transform.translate(dx, dy);
        return this.transition(this.svg).call(this.zoom.transform, newTransform).end().catch(noop);
      }
    }
    async centerNode(node, padding) {
      var _a;
      const itemData = (_a = this.findElement(node)) == null ? void 0 : _a.data;
      if (!itemData) return;
      const svgNode = this.svg.node();
      const relRect = svgNode.getBoundingClientRect();
      const transform = d32.zoomTransform(svgNode);
      const x = (itemData.state.rect.x + itemData.state.rect.width / 2) * transform.k + transform.x;
      const y = (itemData.state.rect.y + itemData.state.rect.height / 2) * transform.k + transform.y;
      const pd = {
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        ...padding
      };
      const cx = (pd.left + relRect.width - pd.right) / 2;
      const cy = (pd.top + relRect.height - pd.bottom) / 2;
      const dx = (cx - x) / transform.k;
      const dy = (cy - y) / transform.k;
      if (dx || dy) {
        const newTransform = transform.translate(dx, dy);
        return this.transition(this.svg).call(this.zoom.transform, newTransform).end().catch(noop);
      }
    }
    /**
     * Scale content with it pinned at the center of the viewport.
     */
    async rescale(scale) {
      const svgNode = this.svg.node();
      const { width: offsetWidth, height: offsetHeight } = svgNode.getBoundingClientRect();
      const halfWidth = offsetWidth / 2;
      const halfHeight = offsetHeight / 2;
      const transform = d32.zoomTransform(svgNode);
      const newTransform = transform.translate(
        (halfWidth - transform.x) * (1 - scale) / transform.k,
        (halfHeight - transform.y) * (1 - scale) / transform.k
      ).scale(scale);
      return this.transition(this.svg).call(this.zoom.transform, newTransform).end().catch(noop);
    }
    destroy() {
      this.svg.on(".zoom", null);
      this.svg.html(null);
      this._disposeList.forEach((fn) => {
        fn();
      });
    }
    static create(svg, opts, data = null) {
      const mm = new Markmap(svg, opts);
      if (data) {
        mm.setData(data).then(() => {
          mm.fit();
        });
      }
      return mm;
    }
  }
  exports.Markmap = Markmap;
  exports.childSelector = childSelector;
  exports.defaultColorFn = defaultColorFn;
  exports.defaultOptions = defaultOptions;
  exports.deriveOptions = deriveOptions;
  exports.globalCSS = globalCSS;
  exports.isMacintosh = isMacintosh;
  exports.lineWidthFactory = lineWidthFactory;
  exports.loadCSS = loadCSS;
  exports.loadJS = loadJS;
  exports.refreshHook = refreshHook;
  exports.simpleHash = simpleHash;
  Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
})(this.markmap = this.markmap || {}, d3);
