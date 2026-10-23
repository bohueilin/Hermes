import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const verifierURL = new URL('../src/model/software-delivery-verify.js', import.meta.url);
const contractURL = new URL('../src/model/software-delivery-contract.js', import.meta.url);
const engineURL = new URL('../src/model/software-delivery.js', import.meta.url);

function absoluteImports(source, origin) {
  return source.replace(/(from\s*['"])(\.\.?\/[^'"]+)(['"])/g, (_, before, path, after) => `${before}${new URL(path, origin).href}${after}`);
}

test('compiled transitive verifier imports stay inside the schema and canonical encoding allowlist', () => {
  const graphProgram = `
    import { SourceTextModule } from 'node:vm';
    import { readFileSync } from 'node:fs';
    const root = ${JSON.stringify(verifierURL.href)};
    const allowed = new Set([
      root, ${JSON.stringify(contractURL.href)},
      ${JSON.stringify(new URL('../src/core/canon.js', import.meta.url).href)},
      ${JSON.stringify(new URL('../src/core/sha256.js', import.meta.url).href)}
    ]);
    const seen = new Set();
    function inspect(url) {
      if (!allowed.has(url)) throw Error('independence violation: ' + url);
      if (seen.has(url)) return;
      seen.add(url);
      const source = readFileSync(new URL(url), 'utf8');
      const module = new SourceTextModule(source, { identifier: url });
      for (const specifier of module.dependencySpecifiers) inspect(new URL(specifier, url).href);
      if (/\\bimport\\s*\\(/.test(source)) throw Error('dynamic imports not allowed');
    }
    inspect(root);
    console.log(JSON.stringify([...seen].sort()));
  `;
  const result = spawnSync(process.execPath, ['--experimental-vm-modules', '--input-type=module', '-e', graphProgram], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).length, 4);
});

test('independent replay allocator meets all Oct12 exact capped-round and cursor-persistence fixtures', async () => {
  const source = absoluteImports(await readFile(verifierURL, 'utf8'), verifierURL) + '\nexport { verifyAllocation };';
  const { verifyAllocation } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const evaluate = (ids, eligible, cursor, budget, limits) => verifyAllocation(ids, cursor, budget, eligible.map((id, i) => ({ id, remaining_bytes: limits[i], cap_bytes: limits[i] })));
  const fixtures = [
    [['A', 'B'], ['A', 'B'], 'A', 10, [1, 99], [1, 9], 0, 'A'],
    [['A', 'B'], ['A', 'B'], 'A', 10, [1, 4], [1, 4], 5, 'A'],
    [['A', 'B', 'C'], ['A', 'B', 'C'], 'A', 6, [1, 99, 99], [1, 3, 2], 0, 'C'],
    [['A', 'B', 'C'], ['A', 'B', 'C'], 'C', 6, [1, 99, 99], [1, 2, 3], 0, 'A'],
    [['A', 'B', 'C'], ['A', 'B', 'C'], 'B', 10, [1, 2, 99], [1, 2, 7], 0, 'B'],
    [['A', 'B', 'C'], ['B', 'C'], 'B', 1, [99, 99], [1, 0], 0, 'C'],
    [['A', 'B', 'C', 'D'], ['A', 'B'], 'A', 1, [99, 99], [1, 0], 0, 'B'],
    [['A', 'B', 'C', 'D'], ['A', 'C'], 'B', 1, [99, 99], [0, 1], 0, 'D'],
    [['A', 'B', 'C', 'D'], ['A', 'B'], 'D', 1, [99, 99], [1, 0], 0, 'B'],
    [['A', 'B', 'C', 'D'], ['B', 'D'], 'B', 1, [99, 99], [1, 0], 0, 'C'],
  ];
  for (const [ids, eligible, cursor, budget, limits, awards, unused, next] of fixtures) {
    assert.deepEqual(evaluate(ids, eligible, cursor, budget, limits), { awards, unused, cursor: next });
  }
  let cursor = 'A'; const totals = [0, 0];
  for (let slot = 0; slot < 10; slot++) {
    const result = evaluate(['A', 'B'], ['A', 'B'], cursor, 1, [99, 99]);
    assert.deepEqual(result.awards, slot % 2 ? [0, 1] : [1, 0]);
    result.awards.forEach((amount, i) => { totals[i] += amount; }); cursor = result.cursor;
  }
  assert.deepEqual(totals, [5, 5]); assert.equal(cursor, 'A');
  for (let slot = 0; slot < 100; slot++) assert.deepEqual(evaluate(['A', 'B', 'C', 'D'], [], 'D', 10, []), { awards: [], unused: 10, cursor: 'D' });
});

async function mutatedSuite(name, before, after, setup) {
  const original = await readFile(verifierURL, 'utf8');
  assert.equal(original.split(before).length, 2, `${name}: mutation applied exactly once`);
  const changed = original.replace(before, after);
  assert.notEqual(changed, original);
  const directory = await mkdtemp(join(tmpdir(), 'nf04-verifier-mutation-'));
  try {
    const mutatedPath = join(directory, 'mutant.mjs');
    await writeFile(mutatedPath, absoluteImports(changed, verifierURL));
    const testPath = join(directory, 'discriminating.test.mjs');
    await writeFile(testPath, `
      import test from 'node:test'; import assert from 'node:assert/strict';
      import { verifyDelivery } from ${JSON.stringify(pathToFileURL(mutatedPath).href)};
      import { runDelivery } from ${JSON.stringify(engineURL.href)};
      import { deliveryInput } from ${JSON.stringify(contractURL.href)};
      test(${JSON.stringify(name)}, () => {
        const input = deliveryInput('default'); input.H_ms = 2000;
        input.requests.forEach(r => {r.deadline_ms=2000;r.check_ms=0;r.activation_ms=0;});
        ${setup}
        const result = verifyDelivery(runDelivery(input, 'repeated'));
        console.log('MUTATION_EXECUTED:' + ${JSON.stringify(name)} + ':' + result.errors.join(','));
        assert.equal(result.ok, true, result.errors.join(','));
      });
    `);
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const run = spawnSync(process.execPath, ['--test', testPath], { encoding: 'utf8', timeout: 20000, env });
    assert.equal(run.status, 1, `${name}: discriminating suite must fail\n${run.stdout}\n${run.stderr}`);
    assert.match(run.stdout, new RegExp(`MUTATION_EXECUTED:${name}:mismatch-`));
    assert.match(run.stdout, /# fail 1/);
    return run.stdout;
  } finally { await rm(directory, { recursive: true, force: true }); }
}

test('wrong residual cursor verifier variant is applied, executed, and fails the correct-record suite', async () => {
  const output = await mutatedSuite('wrong-cursor', 'next = (candidate + 1) % ids.length', 'next = candidate', `input.artifact.size_bytes=100; input.requests.pop(); input.resources.wan.aggregate_Bps=4;`);
  assert.match(output, /mismatch-cursor-out/);
});

test('early local verifier variant is applied, executed, and fails the store-forward suite', async () => {
  const output = await mutatedSuite('early-local', '(repeated ? state.outcome.wan_completed_ms !== null : depotComplete !== null)', '(repeated ? true : depotComplete !== null)', `input.artifact.size_bytes=100; input.resources.wan.aggregate_Bps=4;`);
  assert.match(output, /mismatch-eligibility-local-0/);
});

test('a separately mutated engine actually executes wrong conserved allocation and premature local delivery; verifier rejects both', async () => {
  // Narrow anchors supplied by the producer author. No producer helper or
  // expectation enters verifier code or its independently derived fixtures.
  const source = await readFile(engineURL, 'utf8');
  const variants = [
    ['allocation', 'const start=universe.indexOf(next);', 'const start=(universe.indexOf(next)+1)%universe.length;', 'grant'],
    ['store-forward', "arrived&&(policy==='cold'?cacheComplete!==null:state.outcome.wan_completed_ms!==null);", 'arrived;', 'eligibility'],
  ];
  const directory = await mkdtemp(join(tmpdir(), 'nf04-engine-mutation-'));
  try {
    for (const [name, before, after, reason] of variants) {
      assert.equal(source.split(before).length, 2, `${name}: mutation applies once`);
      const changed = source.replace(before, after); assert.notEqual(changed, source);
      const file = join(directory, `${name}.mjs`);
      await writeFile(file, absoluteImports(changed, engineURL));
      const { runDelivery } = await import(pathToFileURL(file).href);
      const { deliveryInput } = await import(contractURL.href);
      const { verifyDelivery } = await import(verifierURL.href);
      const input = deliveryInput(); input.H_ms = 2000; input.requests.pop();
      input.artifact.size_bytes = 100; input.resources.wan.aggregate_Bps = 4;
      input.requests.forEach(row => { row.deadline_ms = 2000; row.check_ms = 0; row.activation_ms = 0; });
      const mutantRecord = runDelivery(input, 'repeated');
      // Prove mutated logic executed, beyond proving text replacement.
      if (name === 'allocation') assert.deepEqual(mutantRecord.resources[0].eligible.map(row => row.grant_bytes), [1, 2, 1]);
      else assert.equal(mutantRecord.resources[1].eligible.length, 3);
      const verification = verifyDelivery(mutantRecord);
      assert.equal(verification.ok, false);
      assert.match(verification.errors.join(' '), new RegExp(reason));
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
