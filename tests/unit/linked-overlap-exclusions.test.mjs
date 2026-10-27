import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../../script.js', import.meta.url), 'utf8');
function setup() {
  const context = {window:{NL_OS:'Windows'}, documentOrganization:{linkedLocations:[
    {id:'parent', path:'C:/Parent', excludedPaths:[]},
    {id:'child', path:'C:/Parent/Sub', excludedPaths:[]},
    {id:'sibling', path:'C:/Parent-Other', excludedPaths:[]}
  ]}};
  const pathStart = source.indexOf('  function normalizeLinkedSourcePath(');
  const pathEnd = source.indexOf('  async function assertOutsideManagedVault(', pathStart);
  const helpersStart = source.indexOf('  function getLinkedLocation(');
  const helpersEnd = source.indexOf('  const LINKED_FOLDER_SCAN_LIMITS', helpersStart);
  vm.runInNewContext(source.slice(pathStart, pathEnd) + source.slice(helpersStart, helpersEnd) +
    '\nthis.add = addLinkedSourceExclusions; this.rollback = rollbackLinkedSourceExclusions; this.roots = getOverlappingLinkedLocationIds;', context);
  return context;
}

test('source exclusions cover each overlapping root, preserve case, and respect path boundaries', () => {
  const context = setup();
  const added = context.add('C:\\PARENT\\Sub\\Note.md');
  assert.deepEqual(JSON.parse(JSON.stringify(added)), [
    {locationId:'parent', path:'Sub/Note.md'}, {locationId:'child', path:'Note.md'}
  ]);
  assert.deepEqual(Array.from(context.roots('C:/Parent/Sub')), ['parent', 'child']);
  assert.equal(context.documentOrganization.linkedLocations[2].excludedPaths.length, 0);
  assert.equal(context.add('c:/parent/sub/note.md').length, 0);
});

test('rollback removes only exclusions added by this operation', () => {
  const context = setup();
  const [parent, child] = context.documentOrganization.linkedLocations;
  parent.excludedPaths = ['Sub/Note.md'];
  const added = context.add('C:/Parent/Sub/Note.md');
  child.excludedPaths.push('keep.md');
  context.rollback(added);
  assert.deepEqual(Array.from(parent.excludedPaths), ['Sub/Note.md']);
  assert.deepEqual(Array.from(child.excludedPaths), ['keep.md']);
});

test('UNC source exclusions match case aliases without folding POSIX paths', () => {
  const context = setup();
  context.documentOrganization.linkedLocations = [
    {id:'unc', path:'\\\\Server\\Share\\Notes', excludedPaths:[]},
    {id:'unix', path:'/Documents/Notes', excludedPaths:[]}
  ];
  assert.equal(context.add('\\\\SERVER\\SHARE\\notes\\File.md')[0].path, 'File.md');
  assert.equal(context.add('/documents/notes/File.md').length, 0);
});
