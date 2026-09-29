/**
 * Offline smoke test for dsh-fish-persona.
 *
 * It installs a mock `ctx.systemPrompt`, runs `apply()`, and checks the exact
 * contribution: two sections, the expected orders and names, the persona markers
 * in the text, and working disposal. No harness and no restart required.
 *
 * Run: node test/smoke.mjs
 */

import assert from 'node:assert/strict';

import { apply, inject, name as pluginName, EARLY_ORDER, LATE_ORDER } from '../index.js';

const checks = [];
const check = (label, fn) => {
  fn();
  checks.push(label);
};

// ── one mount, recorded ──────────────────────────────────────────────────────
const mount = (config) => {
  const sections = [];
  const disposed = [];
  const cleanups = [];
  const ctx = {
    cleanups,
    effect(callback) {
      cleanups.push(callback());
    },
    systemPrompt: {
      section(spec) {
        sections.push(spec);
        return () => disposed.push(spec.name);
      },
    },
  };
  apply(ctx, config);
  return { sections, disposed, cleanups, ctx };
};

check('plugin identity', () => {
  assert.equal(pluginName, 'fish-persona');
  assert.deepEqual(inject, ['systemPrompt']);
});

check('contributes exactly two sections, in order', () => {
  const { sections } = mount();
  assert.equal(sections.length, 2);
  assert.deepEqual(
    sections.map((s) => [s.name, s.order]),
    [
      ['local:fish-persona-prefix', EARLY_ORDER],
      ['local:fish-persona-suffix', LATE_ORDER],
    ],
  );
  assert.ok(EARLY_ORDER < 0, 'early section sits before the deployment persona prefix');
  assert.ok(LATE_ORDER > 10200, 'late section sits after the deployment persona suffix');
});

check('text carries the markers and no template groups', () => {
  const { sections } = mount();
  const all = sections.map((s) => s.text).join('\n');
  for (const marker of ['大肥鱼🐟', '猫猫₍^. .^₎⟆']) assert.ok(all.includes(marker), marker);
  assert.ok(all.includes('官腔'), 'ban on bureaucratic filler');
  assert.ok(all.includes('emoji'), 'work-output boundary');
  for (const section of sections) {
    assert.ok(!section.text.includes('{{'), `${section.name} has no {{…}} groups`);
    assert.equal(typeof section.text, 'string');
  }
});

check('config overrides and disable switch work', () => {
  const custom = mount({ earlyOrder: -400, lateOrder: 11000, lateText: 'custom late' });
  assert.deepEqual(custom.sections.map((s) => s.order), [-400, 11000]);
  assert.equal(custom.sections[1].text, 'custom late');
  assert.equal(mount({ enabled: false }).sections.length, 0);
});

check('disposal releases both sections', () => {
  const { cleanups, disposed } = mount();
  assert.equal(cleanups.length, 1, 'registration ran through ctx.effect');
  cleanups[0]();
  assert.deepEqual(disposed, ['local:fish-persona-prefix', 'local:fish-persona-suffix']);
});

check('a throwing registry is contained, not fatal', () => {
  const ctx = {
    effect(callback) {
      callback();
    },
    systemPrompt: {
      section() {
        throw new Error('boom');
      },
    },
  };
  apply(ctx, {});
});

for (const label of checks) console.log('PASS  ' + label);
console.log(`PASS  ${checks.length}/${checks.length} checks`);
