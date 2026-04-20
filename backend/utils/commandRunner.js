/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Command Runner Utility              ║
 * ║   Executes CLI commands securely             ║
 * ╚══════════════════════════════════════════════╝
 */

const { exec, spawn } = require('child_process');
const logger = require('./logger');
const path = require('path');

/**
 * Runs a CLI command using spawn for better path handling (especially Windows spaces).
 * @param {string} cmd - The executable name or path.
 * @param {string[]} args - Array of arguments.
 * @param {Object} options - { timeout, stopCondition }
 * @returns {Promise<string>} - Resolution with stdout.
 */
const runExecutable = (cmd, args, options = {}) => {
  const { timeout: timeoutMs = 5 * 60 * 1000, stopCondition = null } = options;

  return new Promise((resolve, reject) => {
    logger.info(`Spawning: ${cmd} ${args.join(' ')}`);
    const child = spawn(cmd, args, { maxBuffer: 10 * 1024 * 1024 });
    let stdout = '';
    let stderr = '';
    let isFinished = false;

    const cleanupAndResolve = (code = 0) => {
      if (isFinished) return;
      isFinished = true;
      clearTimeout(timeout);
      resolve(stdout);
    };

    // Set timeout
    const timeout = setTimeout(() => {
      logger.warn(`Process timed out after ${timeoutMs / 60000} minutes: ${cmd}`);
      child.kill('SIGKILL');
      cleanupAndResolve();
    }, timeoutMs);

    child.stdout.on('data', (data) => { 
      stdout += data; 
      // Check stop condition in real-time
      if (stopCondition && stopCondition(stdout)) {
        logger.info(`Stop condition met for ${cmd}. Killing process early.`);
        child.kill('SIGKILL');
        cleanupAndResolve();
      }
    });

    child.stderr.on('data', (data) => { stderr += data; });

    child.on('close', (code) => {
      if (isFinished) return;
      isFinished = true;
      clearTimeout(timeout);

      if (code !== 0 && code !== null) {
        logger.error(`Process exited with code ${code}. Stderr: ${stderr}`);
        return reject(new Error(stderr || `Process exited with code ${code}`));
      }
      resolve(stdout);
    });

    child.on('error', (err) => {
      if (isFinished) return;
      isFinished = true;
      clearTimeout(timeout);
      logger.error(`Spawn error: ${err.message}`);
      reject(err);
    });
  });
};

/**
 * Executes a command remotely via SSH if enabled, otherwise locally.
 * @param {string} cmd - Executable name or path
 * @param {string[]} args - Arguments
 * @param {Object} options - Standard runExecutable options
 */
const runRemoteExecutable = (cmd, args, options = {}) => {
  const isRemote = process.env.REMOTE_SCANNER_ENABLED === 'true';
  const remoteIp = process.env.REMOTE_SCANNER_IP;
  const remoteUser = process.env.REMOTE_SCANNER_USER || 'kali';

  if (isRemote && remoteIp) {
    // Wrap IPv6 addresses in brackets if they contain colons and aren't already wrapped
    let formattedIp = remoteIp;
    if (remoteIp.includes(':') && !remoteIp.startsWith('[') && !remoteIp.endsWith(']')) {
      formattedIp = `[${remoteIp}]`;
    }

    // If it's a full Windows path, extract just the binary name for Linux
    // e.g. "C:\\...\\nikto.pl" -> "nikto"
    let cleanCmd = cmd;
    if (cmd.includes('\\') || cmd.includes('/')) {
      cleanCmd = path.basename(cmd).replace('.exe', '').replace('.pl', '');
    }

    const remoteCmdStr = `${cleanCmd} ${args.join(' ')}`;
    logger.info(`⚡ [Remote Phase] Routing to Kali [${remoteUser}@${remoteIp}]: ${remoteCmdStr}`);
    
    // Windows native 'ssh' executable
    const sshArgs = [
      '-o', 'BatchMode=yes',
      '-o', 'ConnectTimeout=10',
      '-o', 'StrictHostKeyChecking=no', // Avoid manual confirmation prompts
      `${remoteUser}@${formattedIp}`,
      remoteCmdStr
    ];
    
    return runExecutable('ssh', sshArgs, options);
  }

  // Fallback to local Windows execution
  return runExecutable(cmd, args, options);
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

module.exports = { runCommand, runExecutable, runRemoteExecutable };
