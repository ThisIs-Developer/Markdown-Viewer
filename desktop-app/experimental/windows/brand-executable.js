const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// neu sets OriginalFilename to its staging binaryName. Set the final filename
// after packaging, preserving all other resources, including the embedded app.
async function brandExecutable(file) {
  const { NtExecutable, NtExecutableResource } = await import('pe-library');
  const { Resource } = await import('resedit');
  const binary = NtExecutable.from(fs.readFileSync(file));
  const resources = NtExecutableResource.from(binary);
  const fingerprints = entries => entries.filter(entry => entry.type !== 16).map(entry =>
    [entry.type, entry.id, entry.lang, crypto.createHash('sha256').update(Buffer.from(entry.bin)).digest('hex')].join(':')).sort();
  const before = fingerprints(resources.entries);
  const originalKeys = new Set(resources.entries.filter(entry => entry.type !== 16).map(entry => [entry.type, entry.id, entry.lang].join(':')));
  const versions = Resource.VersionInfo.fromEntries(resources.entries);
  if (!versions.length) throw new Error('The packaged executable has no version resource.');
  for (const version of versions) {
    const appVersion = require('../../package.json').version;
    version.setFileVersion(appVersion);
    version.setProductVersion(appVersion);
    for (const language of version.getAllLanguagesForStringValues()) {
      version.setStringValues(language, {
        ProductName: 'Markdown Viewer', FileDescription: 'Markdown Viewer',
        OriginalFilename: path.basename(file)
      });
      version.removeStringValue(language, 'CompanyName');
    }
    version.outputToResourceEntries(resources.entries);
  }
  resources.outputResource(binary);
  const result = binary.generate();
  const after = fingerprints(NtExecutableResource.from(NtExecutable.from(result)).entries.filter(entry => originalKeys.has([entry.type, entry.id, entry.lang].join(':'))));
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Branding changed a non-version resource.');
  fs.writeFileSync(file, Buffer.from(result));
}
module.exports = { brandExecutable };
