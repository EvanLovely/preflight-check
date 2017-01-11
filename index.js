#!/usr/bin/env node
const fs = require('fs');
const debug = require('debug')('preflight-check');
const path = require('path');
const chalk = require('chalk');
const glob = require('glob');
const inquirer = require('inquirer');
const exec = require('child_process').exec;
const series = require('async').series;
const checksum = require('checksum');
const config = require('rc')('preflight-check', {
  sets: [],
});

const changedSets = [];
const checksumsDataPath = path.join(__dirname, './checksums.json');
debug(`checksums.json path: ${checksumsDataPath}`);
let checksums;

try {
  checksums = JSON.parse(fs.readFileSync(checksumsDataPath, { encoding: 'utf8' }));
  debug(`${Object.keys(checksums).length} checksums read from file: ${Object.keys(checksums)}`);
} catch (e) {
  checksums = {};
}

function sh(cmd, cb) {
  const child = exec(cmd, { encoding: 'utf8' });
  child.stdout.on('data', data => process.stdout.write(data));
  child.stderr.on('data', data => process.stdout.write(data));

  child.on('close', (code) => {
    if (code > 0) {
      process.stdout.write(chalk.red(`Error with code ${code} after running: "${cmd}" \n`));
    }
    if (typeof cb === 'function') cb(code);
  });
}

function writeChecksumsFile() {
  debug(`Writing ${Object.keys(checksums).length} checksums to file.`);
  fs.writeFileSync(checksumsDataPath, JSON.stringify(checksums, null, '  '));
}

function updateChecksumsFile(set) {
  checksums[set.file] = set.sum;
  writeChecksumsFile();
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

function executeCmd(set, cb) {
  const cmd = Array.isArray(set.cmd) ? set.cmd.join(' && ') : set.cmd;
  process.stdout.write('-------------\n');
  process.stdout.write(`Running: ${cmd}\n`);
  process.stdout.write('-------------\n');
  sh(cmd, (code) => {
    process.stdout.write('\n-------------\n');
    if (code === 0) {
      process.stdout.write(`${chalk.green('Success')} running: ${cmd}\n`);
      updateChecksumsFile(set);
    } else {
      process.stdout.write(`${chalk.red('Failed')} running: ${cmd}\n`);
    }
    process.stdout.write('=============\n');
    set.code = code;
    cb(null, set);
  });
}

function handleChangedSets(sets) {
  debug(`need updates: ${sets.map(set => set.file)}`);
  process.stdout.write(chalk.blue.bold(`The ${sets.length} files below have changed since last run and would like to run these commands:\n\n`));
  sets.forEach((set, i) => {
    const linePrefix = set.title ? `${i + 1}) ${set.title}` : `${i + 1})`;
    const cmd = Array.isArray(set.cmd) ? set.cmd.join(' && ') : set.cmd;
    process.stdout.write(chalk.underline(`${linePrefix} ${chalk.bold(set.file)}\n`));
    process.stdout.write('Command to run: ');
    process.stdout.write(chalk.dim(cmd));
    process.stdout.write('\n\n');
  });

  inquirer.prompt([{
    type: 'checkbox',
    name: 'setsToUpdate',
    message: 'Which commands to run?:',
    choices: sets.map((set, i) => ({
      name: `${i + 1}) ${set.title ? set.title : set.file}`,
      value: set,
    })),
    default: sets,
  }]).then((answers) => {
    // console.log(answers);
    const sets = answers.setsToUpdate;
    if (sets.length) {
      const tasks = sets.map((set) => {
        return (cb) => {
          executeCmd(set, cb);
        };
      });
      series(tasks, (err, results) => {
        process.stdout.write(chalk.bold('All Done! Summary:\n'));
        results.forEach((result) => {
          const message = `${result.title ? result.title + ' ' : ''} Command: ${result.cmd}\n`;
          if (result.code === 0) {
            process.stdout.write(chalk.green(`Success: ${message}`));
          } else {
            process.stdout.write(chalk.red(`Failed: ${message}`));
          }
        });
        writeChecksumsFile();
      });
    }
  });
}

function getChecksum(set) {
  return new Promise((resolve, reject) => {
    checksum.file(set.file, (err, sum) => {
      if (err) {
        reject(err);
      }
      set.sum = sum; // eslint-disable-line no-param-reassign
      resolve(set);
    });
  });
}

function go() {
  const promises = [];
  config.sets.forEach((set) => {
    // @todo add support for `set.file` to be an array
    if (glob.hasMagic(set.file)) {
      glob.sync(set.file, {}).forEach((file) => {
        const setData = Object.assign({}, set);
        setData.originalFile = set.file;
        setData.file = file;
        promises.push(getChecksum(setData));
      });
    } else {
      promises.push(getChecksum(set));
    }
  });

  Promise.all(promises).then((values) => {
    values.forEach(compareFile);
    const uniqueSets = [];
    changedSets.forEach((set) => {
      if (uniqueSets.some(item => set.cmd === item.cmd)) {
        return false;
      }
      if (set.originalFile) {
        set.file = set.originalFile; // eslint-disable-line no-param-reassign
      }
      uniqueSets.push(set);
      return true;
    });

    if (uniqueSets.length) {
      handleChangedSets(uniqueSets);
    } else {
      writeChecksumsFile();
      process.stdout.write('All preflight files checked, no updates needed.\n');
    }
  }, (reason) => {
    process.stdout.write('Checksum check failed; reason:\n', reason);
  });
}

go();
