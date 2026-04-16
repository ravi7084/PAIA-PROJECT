/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Command Runner Utility              ║
 * ║   Executes CLI commands securely             ║
 * ╚══════════════════════════════════════════════╝
 */

const { exec, spawn } = require('child_process');
const logger = require('./logger');

/**
 * Runs a CLI command using spawn for better path handling (especially Windows spaces).
 * @param {string} cmd - The executable name or path.
 * @param {string[]} args - Array of arguments.
 * @returns {Promise<string>} - Resolution with stdout.
 */
const runExecutable = (cmd, args) => {
  return new Promise((resolve, reject) => {
    logger.info(`Spawning: ${cmd} ${args.join(' ')}`);
    const child = spawn(cmd, args, { maxBuffer: 10 * 1024 * 1024 });
    let stdout = '';
    let stderr = '';

    // Set a 5-minute timeout (300,000 ms)
    const timeout = setTimeout(() => {
      logger.warn(`Process timed out after 5 minutes: ${cmd}`);
      child.kill('SIGKILL');
      // Resolve with what we have so far instead of rejecting
      resolve(stdout);
    }, 5 * 60 * 1000);

    child.stdout.on('data', (data) => { stdout += data; });
    child.stderr.on('data', (data) => { stderr += data; });

    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0 && code !== null) {
        logger.error(`Process exited with code ${code}. Stderr: ${stderr}`);
        return reject(new Error(stderr || `Process exited with code ${code}`));
      }
      resolve(stdout);
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      logger.error(`Spawn error: ${err.message}`);
      reject(err);
    });
  });
};

/**
 * Runs a CLI command and returns stdout as a Promise.
 */
const runCommand = (command) => {
  return new Promise((resolve, reject) => {
    logger.info(`Executing command: ${command}`);
    
    exec(command, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        logger.error(`Command failed: ${command}\nError: ${error.message}`);
        return reject(new Error(error.message));
      }
      
      if (stderr && !stdout) {
        logger.warn(`Command stderr: ${stderr}`);
        return resolve(stderr);
      }
      
      resolve(stdout);
    });
  });
};

module.exports = { runCommand, runExecutable };
