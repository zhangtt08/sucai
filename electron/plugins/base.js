class SourcePlugin {
  get name() { throw new Error('Not implemented'); }
  get displayName() { throw new Error('Not implemented'); }
  get supportedTypes() { return ['image']; }
  isConfigured() { return true; }
  async search(_query, _mediaType, _page, _perPage) { throw new Error('Not implemented'); }
  async download(_item, _destPath, _onProgress) { throw new Error('Not implemented'); }
}

module.exports = { SourcePlugin };
