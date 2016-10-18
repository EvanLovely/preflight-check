#!/usr/bin/env node
'use strict';
var exec = require('child_process').execSync;
var path = require('path');
var semver = require('semver');
var debug = require('debug')('dependency-preflight');
var config = require('rc')('dependency-preflight', {
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

function sh(cmd, log) {
  var result = '';
  try {
    debug(`Running ${cmd} in ${process.cwd()}`);
    result = exec(cmd, { encoding: 'utf8' });
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

function checkNpmDeps(dep, pkg) {
  var ver = pkg.dependencies[dep];
  var depPath = path.join(process.cwd(), 'node_modules', dep);
  var pkgPath = path.join(depPath, 'package.json');
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
      needsUpdate: false,
      validSemver: false,
      name: dep,
      installedVersion: installedPkg.version,
      requestedVersion: ver
    }
  }
  debug(info);
  return info;
}

function checkNpm(opt) {
  var results = [];
  var pkg = require(path.join(process.cwd(), opt.file));
  var deps = Object.keys(pkg.dependencies).map(dep => checkNpmDeps(dep, pkg));
  if (opt.devDeps) {
    var devDeps = Object.keys(pkg.devDependencies).map(dep => checkNpmDeps(dep, pkg));
    results = [].concat(deps, devDeps);
  } else {
    results = deps;
  }
  return results;
}

var toUpdate = config.sets.map(set => {
  if (set.type === 'npm') {
    var npmResults = checkNpm(set);
    // console.log(npmResults);
    var npmToUpdate = npmResults.filter(item => item.needsUpdate);
    console.log(`npm check done. ${npmToUpdate.length} want updates: ${npmToUpdate.map(item => item.name).join(', ')}`);
    return {
      set: set,
      deps: npmToUpdate
    };
  }
});

