import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
const directory = '.expo/integration-edge';
mkdirSync(directory, { recursive: true });
writeFileSync(
  `${directory}/public-key.json`,
  JSON.stringify(pair.publicKey.export({ format: 'jwk' })),
);
writeFileSync(
  `${directory}/local.env`,
  [
    `CRON_SECRET=${randomUUID()}`,
    'CLOUDFLARE_STREAM_SIGNING_KEY_ID=local-smoke-key',
    `CLOUDFLARE_STREAM_SIGNING_JWK_BASE64=${Buffer.from(JSON.stringify(pair.privateKey.export({ format: 'jwk' }))).toString('base64')}`,
    'CLOUDFLARE_STREAM_PLAYBACK_HOST=customer-local-smoke.cloudflarestream.com',
    'STREAM_MAX_UPLOAD_BYTES=1048576',
    'STREAM_MAX_DURATION_SECONDS=60',
  ].join('\n'),
);
console.log(
  'Prepared temporary local signing keys and Edge smoke configuration in .expo/integration-edge.',
);
