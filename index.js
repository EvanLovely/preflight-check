#!/usr/bin/env node
'use strict';
const fs = require('fs');
const debug = require('debug')('dependency-preflight');
const path = require('path');
const inquirer = require('inquirer');
const execSync = require('child_process').execSync;
const checksum = require('checksum');
const config = require('rc')('dependency-preflight', {
  sets: []
});

const changedSets = [];
const checksumsDataPath = path.join(__dirname, './checksums.json');
debug(`checksums.json path: ${checksumsDataPath}`);
let checksums;

try {
  checksums = require(checksumsDataPath);
  debug(`${Object.keys(checksums).length} checksums read from file: ${Object.keys(checksums)}`);
} catch (e) {
  checksums = {};
}

function compareFile(value) {
  if (!checksums[value.file]) {
    debug(`${value.file} not already in checksums.json, adding...`);
    checksums[value.file] = value.sum;
  } else if (checksums[value.file] !== value.sum) {
    debug(`${value.file} has different sum than what is in checksums.json`);
    changedSets.push(value);
  } else {
    debug(`${value.file} has same sum than what is in checksums.json`);
  }
}

function handleChangedSets(sets) {
  debug(`need updates: `, sets.map(set => set.file));
  inquirer.prompt([{
    type: 'checkbox',
    name: 'setsToUpdate',
    message: 'Suggested updates:',
    choices: sets.map(set => ({
      name: `${set.file} changed; will run: ${set.cmd}`,
      value: set,
    })),
    default: sets,
  }]).then((answers) => {
    // console.log(answers);
    answers.setsToUpdate.forEach(set => {
      const cmd = Array.isArray(set.cmd) ? set.cmd.join(' && ') : set.cmd;
      console.log('-------------');
      console.log(`Running: ${cmd}`);
      console.log('-------------');
      try {
        const updateCmd = execSync(cmd, {encoding: 'utf8'});
        console.log(updateCmd);
        updateChecksumsFile(set);
      } catch (e) {
        console.log(e);
      }
      console.log('-------------');
      console.log(`Done running: ${cmd}`);
      console.log('=============');
    });
  });
}

function updateChecksumsFile(set) {
  checksums[set.file] = set.sum;
  writeChecksumsFile();
}

function writeChecksumsFile() {
  debug(`Writing ${Object.keys(checksums).length} checksums to file.`);
  fs.writeFileSync(checksumsDataPath, JSON.stringify(checksums, null, '  '));
}

function go() {
  const promises = [];
  config.sets.forEach(set => {
    const thisPromise = new Promise((resolve, reject) => {
      checksum.file(set.file, (err, sum) => {
        if (err) {
          reject(err);
        }
        set.sum = sum;
        resolve(set);
      });
    });
    promises.push(thisPromise);
  });

  Promise.all(promises).then(values => {
    values.forEach(compareFile);
    if (changedSets.length) {
      handleChangedSets(changedSets);
    } else {
      writeChecksumsFile();
      console.log('all is up to date');
    }
  }, reason => {
    console.log('reason', reason);
  });

}

go();
