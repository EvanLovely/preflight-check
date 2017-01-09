# Preflight Check

Checks if files (like `package.json`) have changed since last run, and if so it runs a command (like installing dependencies).

# Installation

    npm install preflight-check --save

## Usage

Create a file called `.preflight-checkrc` containing the below content or pass in command line arguments as outlined in [`rc`](https://www.npmjs.com/package/rc).

```json
{
  "sets": [
    {
      "file": "package.json",
      "cmd": "npm install"
    }, {
      "file": "path/to/theme/bower.json",
      "cmd": [
        "cd path/to/theme/",
        "bower install"
      ]
    }
  ]
}
```

For each item in the `sets`, this will check (via `checksum`) to see if the file has changed since last run. If it has, then it will show updates needed and ask if you want to execute the `cmd` for that set. You can use a string or an array of strings for the `cmd`, if it's an array, then it will join each of them together with ` && `.

To ensure this is ran, before starting, placing it as a prestart hook in `package.json` could work well:

```json
{
  "scripts": {
    "prestart": "preflight-check",
    "start": "gulp"
  }
}
```

# Troubleshooting

This uses the [`debug`](https://www.npmjs.com/package/debug) module; simply run this to see extra debugging info:

    DEBUG=preflight-check ./node_modules/.bin/preflight-check
