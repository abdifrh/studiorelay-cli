import {copyFile} from 'node:fs/promises';
await copyFile(new URL('../src/contracts.d.ts',import.meta.url),new URL('../dist/contracts.d.ts',import.meta.url));
