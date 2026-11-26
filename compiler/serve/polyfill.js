/**
 * Node 18 has WebCrypto at `require('node:crypto').webcrypto` but not as the
 * `globalThis.crypto` global the MCP SDK uses (added in Node 19/20).
 */
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) globalThis.crypto = webcrypto;
