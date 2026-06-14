#!/usr/bin/env node
/**
 * list-local-sites.js — discover Local (localwp.com) sites on this machine.
 *
 * Usage: node list-local-sites.js [--json]
 *
 * Reads Local's sites.json and prints each site's id, name, domain, path and a
 * "likely running" heuristic (presence of the site's mysql socket in Local's run dir).
 * Exits 2 with a clear message if Local's data directory cannot be found.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

function localDataDir() {
  if (process.env.LOCAL_DATA_DIR) return process.env.LOCAL_DATA_DIR;
  switch (process.platform) {
    case 'darwin':
      return path.join(os.homedir(), 'Library', 'Application Support', 'Local');
    case 'win32':
      return path.join(process.env.APPDATA || '', 'Local');
    default:
      return path.join(os.homedir(), '.config', 'Local');
  }
}

function expandHome(p) {
  if (!p) return p;
  return p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p;
}

function main() {
  const dataDir = localDataDir();
  const sitesFile = path.join(dataDir, 'sites.json');

  if (!fs.existsSync(sitesFile)) {
    console.error(
      `Could not find Local's sites.json at: ${sitesFile}\n` +
        `Is Local installed? Override the data dir with LOCAL_DATA_DIR if it lives elsewhere.`
    );
    process.exit(2);
  }

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(sitesFile, 'utf8'));
  } catch (e) {
    console.error(`Failed to parse ${sitesFile}: ${e.message}`);
    process.exit(2);
  }

  // sites.json is an object keyed by site id. Field names have varied across
  // Local versions, so read defensively.
  const sites = Object.entries(raw).map(([id, s]) => {
    const sitePath = expandHome(s.path || s.sitePath || '');
    const domain = s.domain || s.host || (s.name ? `${s.name}.local` : '');
    // Heuristic: Local creates run/<id>/mysql/mysqld.sock while a site is running (macOS/Linux).
    const sock = path.join(dataDir, 'run', id, 'mysql', 'mysqld.sock');
    const likelyRunning = fs.existsSync(sock) || fs.existsSync(path.join(dataDir, 'run', id));
    return {
      id,
      name: s.name || id,
      domain,
      path: sitePath,
      publicDir: sitePath ? path.join(sitePath, 'app', 'public') : '',
      sshEntry: path.join(dataDir, 'ssh-entry', `${id}.sh`),
      likelyRunning,
    };
  });

  sites.sort((a, b) => a.name.localeCompare(b.name));

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(sites, null, 2));
  } else {
    for (const s of sites) {
      console.log(
        `${s.likelyRunning ? '[running?]' : '[stopped ]'} ${s.name}  —  ${s.domain}\n` +
          `           id: ${s.id}\n           path: ${s.path}`
      );
    }
    if (!sites.length) console.log('No Local sites found.');
  }
}

main();
