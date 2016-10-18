# Dependency Preflight

Checks installed dependencies versus those listed in manifest file.

Supports:

- Npm: checking `node_modules/` against `package.json`

# Installation

    npm install dependency-preflight --save

## Usage

Create a file called `.dependency-preflightrc` containing the below content or pass in command line arguments as outlined in [`rc`](https://www.npmjs.com/package/rc).

```json
{
  "askBeforeUpdating": true,
  "sets": [
    {
      "type": "npm",
      "file": "package.json",
      "cmd": "npm update",
      "devDeps": true,
      "updateNonSemver": false
    }
  ]
}
```

For each item in the `sets`, this will check each dependency (and optionally the devDependency) to ensure the installed version matches the requested semver style version in the file. If `askBeforeUpdating` is enabled, it will show updates needed and ask if you want to execute the `cmd` followed by the dependency name (i.e. if `gulp` need an update, then `npm update gulp` would run). The `updateNonSemver` refers to non-semver style versions like `gitHubUser/repo#branch`.

To ensure this is ran, before starting, placing it as a prestart hook in `package.json` could work well:
 
```json
{
  "scripts": {
    "prestart": "dependency-preflight",
    "start": "gulp"
  }
}
```

# Troubleshooting

This uses the [`debug`](https://www.npmjs.com/package/debug) module; simply run this to see extra debugging info:

    DEBUG=dependency-preflight ./node_modules/.bin/dependency-preflight
