# Build Configuration Reference

## visual-builder/package.json

```json
{
  "name": "my-divi-plugin",
  "version": "1.0.0",
  "description": "Custom Divi 5 module plugin",
  "main": "src/index.jsx",
  "author": "Your Name",
  "license": "GPL2",
  "private": true,
  "devDependencies": {
    "@babel/core": "^7.21.0",
    "@babel/preset-env": "^7.20.2",
    "@babel/preset-react": "^7.18.6",
    "babel-loader": "^9.1.2",
    "thread-loader": "^3.0.4",
    "webpack": "^5.75.0",
    "webpack-cli": "^5.0.1"
  },
  "scripts": {
    "start": "NODE_ENV=development webpack -w --config webpack.config.js --progress",
    "build": "NODE_ENV=production webpack --config webpack.config.js --progress"
  }
}
```

**Windows note:** If you get `'NODE_ENV' is not recognized`, install `win-node-env`:
```bash
npm install --save-optional win-node-env
```

---

## visual-builder/webpack.config.js

```js
const path = require('path');

module.exports = {
  // Entry point — the JSX file that registers your module.
  entry: {
    bundle: './src/index.jsx',
  },

  // Divi already loads these in the browser. Registering them as externals
  // prevents webpack from bundling them and keeps the output small.
  externals: {
    // Use the array form when your module uses react-dom (hooks, portals, etc.)
    react:      ['vendor', 'React'],
    'react-dom': ['vendor', 'ReactDOM'],

    // If you only use React (no react-dom), the shorthand is fine:
    // react: 'React',
  },

  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: [
          // Parallelises babel work across CPU cores — faster on large codebases.
          {
            loader: 'thread-loader',
            options: { workers: -1 },
          },
          // Transpiles modern JS + JSX to browser-compatible ES5.
          {
            loader: 'babel-loader',
            options: {
              compact: false,
              presets: [
                ['@babel/preset-env', {
                  modules: false,
                  targets: '> 5%',
                }],
                '@babel/preset-react',
              ],
              cacheDirectory: false,
            },
          },
        ],
      },
    ],
  },

  resolve: {
    extensions: ['.js', '.jsx'],
  },

  output: {
    // This filename must match the 'src' path in register_package_build() / wp_enqueue_script().
    filename: 'my-divi-plugin.js',
    path: path.resolve(__dirname, 'build'),
  },
};
```

---

## TypeScript variant (`@divi/*` package imports)

If you author in TypeScript and import the Divi packages by name
(`import { registerModule } from '@divi/module-library'`) rather than reading
`window.divi.*`, map every Divi/vendor package to its runtime global via `externals`
so webpack doesn't bundle them:

```js
module.exports = {
  externals: {
    react:                  'React',
    'react-dom':            'ReactDOM',
    '@wordpress/hooks':     'window.vendor.wp.hooks',
    '@divi/module':         'window.divi.module',
    '@divi/module-library': 'window.divi.moduleLibrary',
    '@divi/rest':           'window.divi.rest',
    lodash:                 'window.vendor.lodash',
  },
};
```

These are provided as globals at runtime — listing them as externals is required, or
the bundle ships a duplicate React/Divi and breaks the editor. Use `.ts`/`.tsx`
extensions in `resolve.extensions` and a TS-aware loader (`ts-loader` or
`babel-loader` with `@babel/preset-typescript`).

---

## Build commands

```bash
# 1. Install dependencies (run once, or when package.json changes)
cd visual-builder
npm install

# 2. Development mode — watches for changes, rebuilds automatically
npm run start

# 3. Production build — minified, ready to ship
npm run build
```

Build output:
```
visual-builder/build/my-divi-plugin.js    ← enqueue this in PHP
visual-builder/node_modules/              ← git-ignore this
visual-builder/package-lock.json         ← commit this
```

---

## .gitignore additions

```
/visual-builder/node_modules/
/visual-builder/build/
```

Commit `package.json`, `package-lock.json`, and `webpack.config.js`.
Only commit the build output if your plugin is distributed without a build step.
