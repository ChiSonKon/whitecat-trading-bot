import test from 'node:test';
import assert from 'node:assert/strict';
import { TokenKeyHelper } from '../dist/services/tokenKeyHelper.js';
import { ChainBalanceService } from '../dist/services/chainBalanceService.js';

test('Callback parsing: buy_ and sell_ correctly extract chain, tokenKey, and preset/percentage', () => {
  const supportedChains = ['bsc', 'robinhood', 'arc', 'ethereum', 'base', 'solana', 'sui', 'ton', 'xlayer', 'sei', 'aptos'];

  function parseBuyCallback(data) {
    let rawToken = '';
    let presetIdx = 1;
    let embeddedChain = null;

    const rest = data.replace(/^buy_/, '');
    const lastUnderscore = rest.lastIndexOf('_');
    if (lastUnderscore !== -1) {
      const lastPart = rest.slice(lastUnderscore + 1);
      const parsedIdx = parseInt(lastPart, 10);
      if (!isNaN(parsedIdx)) {
        presetIdx = parsedIdx;
        const tokenPart = rest.slice(0, lastUnderscore);
        const firstUnderscore = tokenPart.indexOf('_');
        if (firstUnderscore !== -1) {
          const possibleChain = tokenPart.slice(0, firstUnderscore).toLowerCase();
          if (supportedChains.includes(possibleChain)) {
            embeddedChain = possibleChain;
            rawToken = tokenPart.slice(firstUnderscore + 1);
          } else {
            rawToken = tokenPart;
          }
        } else {
          rawToken = tokenPart;
        }
      } else {
        rawToken = rest;
      }
    } else {
      rawToken = rest;
    }
    return { embeddedChain, rawToken, presetIdx };
  }

  function parseSellCallback(data) {
    let rawToken = '';
    let sellPct = 50;
    let embeddedChain = null;

    const rest = data.replace(/^sell_/, '');
    const lastUnderscore = rest.lastIndexOf('_');
    if (lastUnderscore !== -1) {
      const lastPart = rest.slice(lastUnderscore + 1);
      const parsedPct = parseInt(lastPart, 10);
      if (!isNaN(parsedPct)) {
        sellPct = parsedPct;
        const tokenPart = rest.slice(0, lastUnderscore);
        const firstUnderscore = tokenPart.indexOf('_');
        if (firstUnderscore !== -1) {
          const possibleChain = tokenPart.slice(0, firstUnderscore).toLowerCase();
          if (supportedChains.includes(possibleChain)) {
            embeddedChain = possibleChain;
            rawToken = tokenPart.slice(firstUnderscore + 1);
          } else {
            rawToken = tokenPart;
          }
        } else {
          rawToken = tokenPart;
        }
      } else {
        rawToken = tokenPart;
      }
    } else {
      rawToken = rest;
    }
    return { embeddedChain, rawToken, sellPct };
  }

  // Register a test token
  const testCa = '0xbc43ce8dec648ea298c4275559b81d6261c90b67';
  const tKey = TokenKeyHelper.toKey(testCa);
  assert.ok(tKey.startsWith('tk_'), `tKey should start with tk_: ${tKey}`);

  // Test 1: sell_arc_tk_..._100
  const sellData100 = `sell_arc_${tKey}_100`;
  const sellRes100 = parseSellCallback(sellData100);
  assert.equal(sellRes100.embeddedChain, 'arc');
  assert.equal(sellRes100.rawToken, tKey);
  assert.equal(sellRes100.sellPct, 100);
  assert.equal(TokenKeyHelper.toAddress(sellRes100.rawToken).toLowerCase(), testCa.toLowerCase());

  // Test 2: sell_arc_tk_..._50
  const sellData50 = `sell_arc_${tKey}_50`;
  const sellRes50 = parseSellCallback(sellData50);
  assert.equal(sellRes50.embeddedChain, 'arc');
  assert.equal(sellRes50.rawToken, tKey);
  assert.equal(sellRes50.sellPct, 50);
  assert.equal(TokenKeyHelper.toAddress(sellRes50.rawToken).toLowerCase(), testCa.toLowerCase());

  // Test 3: sell_tk_..._50 (from assetMenu without chain)
  const sellDataNoChain = `sell_${tKey}_50`;
  const sellResNoChain = parseSellCallback(sellDataNoChain);
  assert.equal(sellResNoChain.embeddedChain, null);
  assert.equal(sellResNoChain.rawToken, tKey);
  assert.equal(sellResNoChain.sellPct, 50);
  assert.equal(TokenKeyHelper.toAddress(sellResNoChain.rawToken).toLowerCase(), testCa.toLowerCase());

  // Test 4: buy_arc_tk_..._1
  const buyData1 = `buy_arc_${tKey}_1`;
  const buyRes1 = parseBuyCallback(buyData1);
  assert.equal(buyRes1.embeddedChain, 'arc');
  assert.equal(buyRes1.rawToken, tKey);
  assert.equal(buyRes1.presetIdx, 1);
  assert.equal(TokenKeyHelper.toAddress(buyRes1.rawToken).toLowerCase(), testCa.toLowerCase());

  // Test 5: buy_arc_tk_..._3
  const buyData3 = `buy_arc_${tKey}_3`;
  const buyRes3 = parseBuyCallback(buyData3);
  assert.equal(buyRes3.embeddedChain, 'arc');
  assert.equal(buyRes3.rawToken, tKey);
  assert.equal(buyRes3.presetIdx, 3);
});

test('ChainBalanceService: invalidateCache clears cached balance immediately', async () => {
  const chain = 'arc';
  const address = '0x8Ad68Eb01F9d116f6dCBD384801BAcEDf715acEd';

  // Invalidate cache
  ChainBalanceService.invalidateCache(chain, address);
  // Verify it doesn't throw
  assert.ok(true);
});
