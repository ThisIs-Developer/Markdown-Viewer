(function(target) {
  'use strict';
  async function digest(content) {
    const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(content));
    return Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,'0')).join('');
  }
  function equal(a,b) {
    if(a===b)return true;
    if(!a || !b || typeof a!=='object' || typeof b!=='object' || Array.isArray(a)!==Array.isArray(b))return false;
    const keys=Object.keys(a);return keys.length===Object.keys(b).length && keys.every(key=>Object.prototype.hasOwnProperty.call(b,key) && equal(a[key],b[key]));
  }
  function markdownName(value) {
    let name=String(value).trim();
    if(!name || /[\\/\u0000-\u001f\u007f:*?"<>|]/.test(name) || name==='.' || name==='..')throw new Error('Enter a valid Markdown filename without path separators.');
    if(/\.[^.]+$/.test(name) && !/\.md$/i.test(name))throw new Error('Only .md files can be created.');
    name=/\.md$/i.test(name)?name.slice(0,-3)+'.md':name+'.md';
    if(!name.slice(0,-3).trim() || /[. ]$/.test(name.slice(0,-3)) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])\.md$/i.test(name) || new TextEncoder().encode(name).byteLength>200)throw new Error('Choose a shorter, portable Markdown filename.');
    return name;
  }
  target.MarkdownCloudModel=Object.freeze({MAX_BYTES:20*1024*1024,digest,equal,markdownName,isAccountId:id=>typeof id==='string' && /^[a-zA-Z0-9._-]{1,128}$/.test(id)});
})(globalThis);
