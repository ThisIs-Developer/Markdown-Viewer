// Shared WebDAV protocol. Authentication and account identity belong to provider adapters.
(function (target) {
  'use strict';
  const MAX_BYTES = 20 * 1024 * 1024;
  const MAX_LIST_BYTES = 4 * 1024 * 1024;
  function fail(message, code) { return Object.assign(new Error(message), { code }); }
  function serverUrl(value) {
    const url = new URL(String(value).trim());
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) ||
        url.username || url.password || url.search || url.hash || /[\\\u0000-\u001f]/.test(String(value))) {
      throw fail('Use an HTTPS server URL, without credentials, query or fragment.', 'URL');
    }
    return url.href.replace(/\/+$/, '');
  }
  function sameServer(value, base) {
    if (typeof value !== 'string' || !value || /[\\\u0000-\u001f]/.test(value)) throw fail('Invalid server URL.', 'URL');
    const url = new URL(value, base.replace(/\/+$/, '') + '/');
    if (url.origin !== new URL(base).origin || url.username || url.password || url.hash ||
        (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) {
      throw fail('The server returned an unexpected URL. No credentials were forwarded.', 'URL');
    }
    return url.href;
  }
  function validatePath(value) {
    const path=String(value).replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i,'').split(/[?#]/)[0];
    for(const part of path.split('/')) {
      let decoded;try {decoded=decodeURIComponent(part);}catch(_){throw fail('Invalid encoded remote path.','PATH');}
      if(decoded==='.' || decoded==='..' || /%[a-f0-9]{2}/i.test(decoded) || /[\\/\u0000-\u001f\u007f]/.test(decoded))throw fail('Unsupported remote path.','PATH');
    }
  }
  function rootUrl(value) {
    validatePath(value);
    const root=serverUrl(value)+'/';
    documentUrl(root,root);return root;
  }
  function documentUrl(value, root, base=root) {
    validatePath(value);
    if(typeof value!=='string' || /[\\\u0000-\u001f]/.test(value))throw fail('Invalid remote reference.','PATH');
    const url=new URL(value,base),scope=new URL(root);
    if(url.origin!==scope.origin || url.username || url.password || url.hash || url.search)throw fail('The file is outside this account.','PATH');
    if(url.pathname===scope.pathname.replace(/\/$/,''))return scope.href;
    if(!url.pathname.startsWith(scope.pathname))throw fail('The file is outside this account.','PATH');
    const parts = url.pathname.split('/');
    for (const part of parts) {
      const decoded = decodeURIComponent(part);
      if (/[\\/\u0000-\u001f]/.test(decoded) || decoded === '.' || decoded === '..') throw fail('Unsupported remote path.', 'PATH');
    }
    return url.href;
  }
  function bytes(text) { return new TextEncoder().encode(text).byteLength; }
  function assertContent(text) {
    if (typeof text !== 'string' || bytes(text) > MAX_BYTES) throw fail('The document exceeds the 20 MiB limit.', 'SIZE');
    return text;
  }
  function header(response, key) {
    const pairs = Array.isArray(response.headers) ? response.headers : Object.entries(response.headers || {});
    const found = pairs.find(([name]) => name.toLowerCase() === key.toLowerCase());
    return found ? String(found[1]).trim() : '';
  }
  function strongEtag(value) { return typeof value === 'string' && /^"[^"\r\n]+"$/.test(value); }
  async function digest(content) {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
    return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
  }
  function checked(response, allowed) {
    if (!response || !allowed.includes(response.status)) {
      const status = response && response.status;
      const message = status === 401 ? 'Access expired. Connect again.' : status === 403 ? 'The server denied access.' :
        status === 404 ? 'The remote file or folder was not found.' : status === 412 ? 'The server file changed. Your draft was kept.' :
        status >= 300 && status < 400 ? 'The server redirected this request. Use its final HTTPS base URL.' : 'WebDAV request failed (HTTP ' + status + ').';
      throw Object.assign(fail(message, status === 412 ? 'CONFLICT' : 'HTTP'), { httpStatus:status });
    }
    return response;
  }
  function davResponses(xml, Parser) {
    if (typeof xml !== 'string' || bytes(xml) > MAX_LIST_BYTES || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw fail('Invalid or oversized folder listing.', 'LISTING');
    const doc = new Parser().parseFromString(xml, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length || doc.documentElement.localName !== 'multistatus' || doc.documentElement.namespaceURI !== 'DAV:') {
      throw fail('The server did not return a WebDAV folder listing.', 'LISTING');
    }
    const responses = [...doc.getElementsByTagNameNS('DAV:', 'response')];
    if (responses.length > 1001) throw fail('This folder exceeds the 1,000-entry limit. Choose a smaller folder.', 'SIZE');
    return responses;
  }
  function davProperty(response, name) {
    const props = [...response.getElementsByTagNameNS('DAV:', 'propstat')].filter(prop => {
      const status = prop.getElementsByTagNameNS('DAV:', 'status')[0];
      return status && /\s200(?:\s|$)/.test(status.textContent);
    });
    return props.flatMap(prop => [...prop.getElementsByTagNameNS('DAV:', 'prop')])
      .flatMap(prop => [...prop.getElementsByTagNameNS('DAV:', name)])[0];
  }
  function parseFileEtag(xml, root, href, Parser = DOMParser) {
    const expected = new URL(documentUrl(href, root));
    const matches = davResponses(xml, Parser).filter(response => {
      const node = [...response.children].find(child => child.localName === 'href' && child.namespaceURI === 'DAV:');
      if (!node) return false;
      const actual = new URL(documentUrl(node.textContent, root, href));
      return actual.origin === expected.origin && decodeURIComponent(actual.pathname) === decodeURIComponent(expected.pathname);
    });
    if (matches.length !== 1 || !davProperty(matches[0], 'resourcetype') || davProperty(matches[0], 'collection')) throw fail('Cannot determine the file version from the WebDAV server.', 'ETAG');
    const value = davProperty(matches[0], 'getetag')?.textContent.trim() || '';
    // WebDAV metadata is authoritative. Never strip W/ from a weak HTTP validator.
    return strongEtag(value) ? value : '';
  }
  function parseListing(xml, root, current, Parser = DOMParser) {
    const responses = davResponses(xml, Parser);
    const entries = [];
    const seen = new Set();
    for (const response of responses) {
      const hrefNode = [...response.children].find(node => node.localName === 'href' && node.namespaceURI === 'DAV:');
      if (!hrefNode) continue;
      const href = documentUrl(hrefNode.textContent, root, current);
      if (href.replace(/\/$/, '') === current.replace(/\/$/, '')) continue;
      const prefix = new URL(current).pathname.replace(/\/?$/, '/');
      const relative = new URL(href).pathname.slice(prefix.length).replace(/\/$/, '');
      if (!new URL(href).pathname.startsWith(prefix) || !relative || relative.includes('/')) continue;
      const value = name => davProperty(response, name);
      const directory = Boolean(value('collection'));
      const name = decodeURIComponent(relative);
      if (!directory && !/\.(md|markdown)$/i.test(name)) continue;
      if (seen.has(href)) continue;
      seen.add(href);
      entries.push({ href, name, directory, etag: value('getetag')?.textContent || '' });
    }
    return entries.sort((a, b) => Number(b.directory) - Number(a.directory) || a.name.localeCompare(b.name, undefined, { numeric: true }));
  }
  function parseCollection(xml,root,Parser=DOMParser) {
    const expected=new URL(rootUrl(root));
    const matches=davResponses(xml,Parser).filter(response=>{
      const node=[...response.children].find(child=>child.localName==='href' && child.namespaceURI==='DAV:');
      if(!node)return false;
      const actual=new URL(documentUrl(node.textContent,root,root));
      return decodeURIComponent(actual.pathname).replace(/\/$/,'')===decodeURIComponent(expected.pathname).replace(/\/$/,'');
    });
    if(matches.length!==1 || !davProperty(matches[0],'collection'))throw fail('The WebDAV URL must identify an accessible folder.','COLLECTION');
    return true;
  }
  class Client {
    #request;
    #auth;
    constructor(root, request, auth) {
      this.root=rootUrl(root);this.#request=request;this.#auth=auth;
    }
    scope(url) {return documentUrl(url,this.root);}
    async call(url,method,options={}) {
      return this.#request({url:this.scope(url),method,...options,auth:this.#auth});
    }
    async rememberAccount(metadata,store) {
      if(this.#auth?.credentialId)return metadata;
      if(!this.#auth?.username || !this.#auth?.password)throw fail('Connect before remembering this account.','ACCOUNT');
      const record=await store({...metadata,loginName:this.#auth.username,appPassword:this.#auth.password});
      if(Object.entries(metadata).some(([key,value])=>record[key]!==value))throw fail('The account could not be securely remembered.','ACCOUNT');
      this.#auth={credentialId:metadata.id};return record;
    }
    async identify() {
      const response=checked(await this.call(this.root,'PROPFIND',{
        headers:{Depth:'0'},contentType:'application/xml; charset=utf-8',maxBytes:256*1024,
        body:'<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/></d:prop></d:propfind>'
      }),[207]);
      parseCollection(response.body,this.root);return this;
    }
    async list(href = this.root) {
      const url = documentUrl(href, this.root);
      const res = checked(await this.call(url, 'PROPFIND', {
        headers: { Depth: '1' }, contentType: 'application/xml; charset=utf-8', maxBytes: MAX_LIST_BYTES,
        body: '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/><d:getetag/></d:prop></d:propfind>'
      }), [207]);
      return parseListing(res.body, this.root, url);
    }
    async read(href) {
      const url = documentUrl(href, this.root);
      const res = checked(await this.call(url, 'GET', { headers: { 'Accept-Encoding': 'identity' }, maxBytes: MAX_BYTES }), [200]);
      const content = assertContent(res.body);
      const etag = header(res, 'etag');
      if (strongEtag(etag)) return { content, etag };
      // Compression/proxies may weaken or omit the GET header. Obtain the actual
      // DAV file version, then bind a new read to it rather than reusing a listing's ETag.
      const version = await this.fileEtag(url);
      if (!version) return { content, etag: '' };
      const bound = checked(await this.call(url, 'GET', {
        headers: { 'Accept-Encoding': 'identity', 'If-Match': version }, maxBytes: MAX_BYTES
      }), [200]);
      const boundContent = assertContent(bound.body);
      const after = await this.fileEtag(url);
      const responseEtag = header(bound, 'etag');
      if (after !== version || (strongEtag(responseEtag) && responseEtag !== version)) {
        throw fail('The WebDAV file changed while it was being read. Your draft was kept; check the server version again.', 'CONFLICT');
      }
      return { content: boundContent, etag: version };
    }
    async fileEtag(href) {
      const url = documentUrl(href, this.root);
      const res = checked(await this.call(url, 'PROPFIND', {
        headers: { Depth: '0' }, contentType: 'application/xml; charset=utf-8', maxBytes: 256 * 1024,
        body: '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:getetag/><d:resourcetype/></d:prop></d:propfind>'
      }), [207]);
      return parseFileEtag(res.body, this.root, url);
    }
    markdownFile(href) {
      const url = documentUrl(href, this.root);
      const name = decodeURIComponent(new URL(url).pathname.split('/').pop());
      if (!name || !/\.md$/i.test(name)) throw fail('Only Markdown .md files can be created or deleted.', 'PATH');
      return url;
    }
    async createFolder(href) {
      const url=documentUrl(href,this.root);
      if(url===this.root || !url.endsWith('/'))throw fail('Choose a new child folder.','PATH');
      let response;
      try{response=await this.call(url,'MKCOL',{headers:{'If-None-Match':'*'},maxBytes:256*1024});}
      catch(_){throw fail('Folder creation is unconfirmed. Check the server before retrying.','UNCERTAIN');}
      if([405,412].includes(response.status))throw fail('The destination folder already exists. Choose another name; nothing was merged.','CONFLICT');
      if(response.status!==201)throw fail('Folder creation could not be confirmed. No automatic retry was made.','UNCERTAIN');
      try{const result=checked(await this.call(url,'PROPFIND',{headers:{Depth:'0'},contentType:'application/xml; charset=utf-8',maxBytes:256*1024,body:'<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/></d:prop></d:propfind>'}),[207]);parseCollection(result.body,url);}
      catch(_){throw fail('The created folder could not be verified. Check the server before retrying.','UNCERTAIN');}
      return url;
    }
    async create(href, content = '') {
      const url = this.markdownFile(href); assertContent(content);
      let response;
      try { response = await this.call(url, 'PUT', { headers:{'If-None-Match':'*'}, contentType:'text/markdown; charset=utf-8', body:content, maxBytes:256*1024 }); }
      catch (_) { throw fail('File creation is unconfirmed. Your local draft was kept. Check the server before trying again.', 'UNCERTAIN'); }
      if (response.status === 412) throw fail('A file already exists with this name. Nothing was overwritten.', 'CONFLICT');
      if (![200,201,204].includes(response.status)) throw fail('File creation is unconfirmed. Your local draft was kept.', 'UNCERTAIN');
      try {
        const saved = await this.read(url);
        if (saved.content !== content || !strongEtag(saved.etag)) throw new Error();
        return saved;
      } catch (_) { throw fail('The new file could not be verified. Your local draft was kept; check the server.', 'UNCERTAIN'); }
    }
    async remove(href, etag) {
      const url = this.markdownFile(href);
      if (!strongEtag(etag)) throw fail('Safe deletion requires a strong server ETag. Your draft was kept.', 'ETAG');
      // DAV resourcetype must identify a file, never a collection named *.md.
      if (await this.fileEtag(url) !== etag) throw fail('The server file changed. Nothing was deleted; review its latest version.', 'CONFLICT');
      let response;
      try { response = await this.call(url, 'DELETE', {headers:{'If-Match':etag}, maxBytes:256*1024}); }
      catch (_) { throw fail('Deletion is unconfirmed. Your local draft was kept. Check the server before any further action.', 'UNCERTAIN'); }
      if (response.status === 412) throw fail('The server file changed. Nothing was deleted.', 'CONFLICT');
      if (![200,204].includes(response.status)) throw fail('Deletion is unconfirmed. Your local draft was kept.', 'UNCERTAIN');
      try { await this.fileEtag(url); }
      catch (error) { if (error.httpStatus === 404) return; throw fail('Deletion could not be verified. Your local draft was kept.', 'UNCERTAIN'); }
      throw fail('The server still lists this file. Your local draft was kept; check the server.', 'UNCERTAIN');
    }
    async save(href, etag, content) {
      assertContent(content);
      if (!strongEtag(etag)) throw fail('Safe saving requires a strong server ETag. Your draft was kept.', 'ETAG');
      let response;
      try {
        response = await this.call(documentUrl(href, this.root), 'PUT', {
          headers: { 'If-Match': etag }, contentType: 'text/markdown; charset=utf-8', body: content, maxBytes: 256 * 1024
        });
      } catch (_) { throw fail('Save outcome is unknown. Check the server version before saving again. Your draft was kept.', 'UNCERTAIN'); }
      if (response.status === 412) checked(response, [200, 201, 204]);
      if (![200, 201, 204].includes(response.status)) {
        throw fail('The upload was not confirmed. Check the server version before saving again. Your draft was kept.', 'UNCERTAIN');
      }
      try {
        const saved = await this.read(href);
        if (saved.content !== content || !strongEtag(saved.etag)) throw new Error();
        return saved;
      } catch (_) { throw fail('The upload could not be verified. Check the server version before saving again. Your draft was kept.', 'UNCERTAIN'); }
    }
    disconnect() { this.#auth = undefined; }
  }
  target.MarkdownWebDAV=Object.freeze({Client,serverUrl,rootUrl,sameServer,documentUrl,parseListing,parseFileEtag,parseCollection,strongEtag,digest,checked,fail,MAX_BYTES});
})(globalThis);
