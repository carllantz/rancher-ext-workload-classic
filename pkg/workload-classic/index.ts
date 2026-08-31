import { importTypes } from '@rancher/auto-import';
// Populates the formatter map that SortableTable resolves cell components from.
//
// FORMATTERS lives in @shell/components/SortableTable/sortable-config as an empty
// module-level object; the host dashboard fills it from its own formatters plugin.
// Rancher's extension build (@rancher/shell/pkg/vue.config.js) externalises only
// jquery, jszip and js-yaml, so an extension bundles its OWN copy of both
// SortableTable and sortable-config -- and that copy's map is never populated.
//
// The visible effect is that no formatter resolves, so SortableTable sets
// needRef=false and never attaches ref="column". updateDelayedColumns() then
// bails on an undefined $refs.column, and delayLoading columns (Restarts,
// Health) spin forever. Importing the plugin for its side effect fills our copy.
import '@shell/plugins/formatters';
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
