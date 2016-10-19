#!/usr/bin/env node
'use strict';
var exec = require('child_process').execSync;
var path = require('path');
var semver = require('semver');
var inquirer = require('inquirer');
var debug = require('debug')('dependency-preflight');
var config = require('rc')('dependency-preflight', {
  askBeforeUpdating: true,
  sets: [
    {
      type: 'npm',
      file: 'package.json',
      cmd: 'npm update',
      devDeps: true,
      updateNonSemver: false
    }
  ]
});

debug(`CWD: ${process.cwd()}`);

function sh(cmd, log, directory) {
  var result = '';
  try {
    debug(`Running ${cmd} in ${process.cwd()}`);
    result = exec(cmd, {
      cwd: directory || process.cwd(),
      encoding: 'utf8'
    });
  } catch (e) {
    if (e.status !== 0) {
      console.error(`Error running "${cmd}" with code ${e.status}`);
    }
  } finally {
    if (log) {
      console.log(result);
    }
  }
}

function checkDeps(dep, deps, workingDir, folder, manifestFile, opt) {
  var ver = deps[dep];
  var depPath = path.join(workingDir, folder, dep);
  var pkgPath = path.join(depPath, manifestFile);
  debug(`Looking at ${dep} asking for ${ver}`);
  debug(`Looking at: ${pkgPath}`);
  var installedPkg = require(pkgPath);
  var info;
  if (semver.validRange(ver) || semver.valid(ver)) {
    debug(`Installed version is ${installedPkg.version}`);
    if (semver.satisfies(installedPkg.version, ver)) {
      debug(`No update needed: ${dep} is good; wants ${ver} and has ${installedPkg.version}`);
      info = {
        needsUpdate: false,
        validSemver: true,
        name: dep,
        installedVersion: installedPkg.version,
        requestedVersion: ver
      };
    } else {
      debug(`Needs update: ${dep} wants ${ver} but has ${installedPkg.version}`);
      info = {
        needsUpdate: true,
        validSemver: true,
        name: dep,
        installedVersion: installedPkg.version,
        requestedVersion: ver
      };
    }
  } else {
    debug(`Not valid: ${ver} for ${dep}`);
    info = {
      needsUpdate: opt.updateNonSemver,
      validSemver: false,
      name: dep,
      installedVersion: installedPkg.version,
      requestedVersion: ver
    }
  }
  // debug(info);
  debug('------');
  return info;
}

function checkNpm(opt) {
  var pkg = require(path.join(process.cwd(), opt.file));
  var deps = pkg.dependencies;
  if (opt.devDeps) {
    Object.assign(deps, pkg.devDependencies);
  }
  return Object.keys(deps).map(dep => checkDeps(dep, deps, process.cwd(), 'node_modules', 'package.json', opt));
}

function updateNpm(item) {
  var updateCommand = `${item.set.cmd} ${item.deps.map(dep => dep.name).join(' ')}`;
  var workingDirectory = path.dirname(path.join(process.cwd(), item.set.file));
  debug(`About to run: "${updateCommand}" in ${workingDirectory}`);
  return sh(updateCommand, true, workingDirectory);
}

var toUpdate = config.sets.map(set => {
  if (set.type === 'npm') {
    var npmResults = checkNpm(set);
    // console.log(npmResults);
    var npmToUpdate = npmResults.filter(item => item.needsUpdate);
    if (npmToUpdate.length) {
      console.log(`Checked ${npmResults.length} npm deps. ${npmToUpdate.length} want updates: ${npmToUpdate.map(item => item.name).join(', ')}`);
      return {
        set: set,
        deps: npmToUpdate
      };
    } else {
      console.log(`Checked ${npmResults.length} npm deps. All up to date.`);
      return {};
    }
  }
}).filter(item => item.deps);

if (toUpdate.length) {
  if (config.askBeforeUpdating) {
    inquirer.prompt([
      {
        type: 'confirm',
        name: 'update',
        message: 'Want to update these?'
      }
    ]).then(answers => {
      if (answers.update) {
        toUpdate.forEach(updateNpm);
      }
    });
  } else {
    console.log('askBeforeUpdating disabled; updating...');
    toUpdate.forEach(updateNpm);
  }
}
