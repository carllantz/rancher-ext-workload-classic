const config = require('@rancher/shell/vue.config'); // eslint-disable-line @typescript-eslint/no-var-requires

const base = config(__dirname, {
  excludes: [],
  // excludes: ['fleet', 'example']
});

/**
 * `@vue/cli-plugin-typescript` is a root devDependency only so that
 * `@vue/cli-service` can resolve it during `yarn build-pkg`. Its webpack
 * contributions are unwanted here:
 *
 *  - it registers its own `ts` and `tsx` ts-loader rules, which overlap the
 *    shell's own `/\.tsx?$/` rule, so every .ts file is handed to two
 *    ts-loader instances configured against different tsconfigs. That is what
 *    produces `[tsl] ERROR TS6059 ... not under 'rootDir'` on each compile.
 *
 *  - it registers a fork-ts-checker that type-checks against a tsconfig this
 *    project does not use, reporting TS2593/TS2304 for the Jest globals in
 *    utils/__tests__ -- files that are not part of the application at all.
 *
 * Dropping both leaves the shell's own ts rule, which is correctly configured.
 * Type safety is unaffected: it is enforced by
 * `tsc -p pkg/workload-classic/tsconfig.json` and by ts-jest under `yarn test`.
 *
 * Safe because no single-file component in pkg/ uses `lang="ts"`, so nothing
 * depends on the deleted rules' `appendTsSuffixTo`.
 */
module.exports = {
  ...base,
  chainWebpack(chain) {
    chain.module.rules.delete('ts');
    chain.module.rules.delete('tsx');
    chain.plugins.delete('fork-ts-checker');
  },
};
