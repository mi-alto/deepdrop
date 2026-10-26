import { randomBytes, scryptSync } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Run locally: credentials never appear in command arguments, history or output.
if (!process.stdin.isTTY) {
  console.error('Run this setup in an interactive terminal.');
  process.exit(1);
}
function hiddenInput(prompt) {
  process.stdout.write(prompt);
  return new Promise((resolve, reject) => {
    let value = '';
    const finish = (error) => {
      process.stdin.removeListener('data', onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
      if (error) reject(error); else resolve(value);
    };
    const onData = (chunk) => {
      for (const character of chunk.toString()) {
        if (character === '\u0003') return finish(new Error('Cancelled.'));
        if (character === '\r' || character === '\n') return finish();
        if (character === '\u007f' || character === '\b') value = Array.from(value).slice(0,-1).join('');
        else if (character >= ' ') value += character;
        if (value.length > 256) return finish(new Error('Maximum password length: 256 characters.'));
      }
    };
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', onData);
  });
}
try {
  const password = await hiddenInput('New administrator password (16–256 characters, hidden): ');
  if (password.length < 16) throw new Error('Use at least 16 characters.');
  const confirmation = await hiddenInput('Repeat administrator password: ');
  if (password !== confirmation) throw new Error('Passwords do not match.');
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password,salt,64,{N:32768,r:8,p:3,maxmem:64*1024*1024}).toString('hex');
  const values = {
    ADMIN_PASSWORD_HASH:`scrypt-v2:${salt}:${hash}`,
    SESSION_SECRET:randomBytes(32).toString('hex'),
    FILE_ENCRYPTION_KEY:randomBytes(32).toString('hex'),
    CRON_SECRET:randomBytes(32).toString('hex'),
  };
  const destination = fileURLToPath(new URL('../.env.production.secrets',import.meta.url));
  await writeFile(destination,Object.entries(values).map(([key,value])=>`${key}=${value}`).join('\n')+'\n',{flag:'wx',mode:0o600});
  console.log(`Created: ${destination}`);
  console.log('Import this file into Vercel → DeepDrop → Environment Variables, Production only, as sensitive values.');
  console.log('Keep a secure backup of FILE_ENCRYPTION_KEY. The file is excluded from Git.');
} catch (error) {
  console.error(error.code === 'EEXIST' ? 'Setup file already exists. It was not overwritten. Keep existing keys to preserve access to stored files.' : error.message);
  process.exitCode = 1;
}
