import { importTypes } from '@rancher/auto-import';
import { IPlugin } from '@shell/core/types';

// Init the package
export default function(plugin: IPlugin): void {
  // Auto-imports list/ and l10n/ by folder convention
  importTypes(plugin);

  // Provide plugin metadata from package.json
  plugin.metadata = require('./package.json');

  // The module exports `init(plugin, store)`; the shell calls it during load.
  plugin.addProduct(require('./config/workload-classic'));
}
