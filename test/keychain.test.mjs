import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Entry} from '@napi-rs/keyring';
test('native keychain module loads on this OS',()=>assert.equal(typeof Entry,'function'));
test('isolated disposable credential roundtrip',{skip:process.env.STUDIORELAY_TEST_KEYCHAIN!=='1'},()=>{const entry=new Entry('StudioRelay CLI tests',randomUUID(),{linux:{store:'secret-service'}});const value=randomUUID();try{entry.setPassword(value);assert.equal(entry.getPassword(),value);}finally{entry.deletePassword();}});
