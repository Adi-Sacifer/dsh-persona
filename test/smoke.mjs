/**
 * Offline smoke test for dsh-persona.
 *
 * 全部离线：装一个假的 `ctx.systemPrompt` 跑 `apply()`，再用临时配置文件验证
 * 「bundle 配置 > 配置文件 > 默认值」的优先级。不需要启动宿主。
 *
 * Run: node test/smoke.mjs
 */

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  DEFAULTS,
  EARLY_ORDER,
  LATE_ORDER,
  PRESETS,
  apply,
  buildLateText,
  configPath,
  inject,
  name as pluginName,
  resolveConfig,
} from '../index.js';

// 隔离：绝不读用户真实的配置文件
const sandbox = mkdtempSync(join(tmpdir(), 'dsh-persona-test-'));
const configFile = join(sandbox, 'persona.config.json');
process.env.DSH_PERSONA_CONFIG = configFile;

const writeConfig = (value) => writeFileSync(configFile, JSON.stringify(value), 'utf8');
const clearConfig = () => rmSync(configFile, { force: true });

const checks = [];
const check = (label, fn) => {
  fn();
  checks.push(label);
};

const mount = (config) => {
  const sections = [];
  const disposed = [];
  const cleanups = [];
  const ctx = {
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
  return { sections, disposed, cleanups };
};

check('plugin identity', () => {
  assert.equal(pluginName, 'persona');
  assert.deepEqual(inject, ['systemPrompt']);
  assert.ok(LATE_ORDER > 10200, 'late section sits after the deployment persona suffix');
  assert.ok(EARLY_ORDER < 0, 'early section sits before the deployment persona prefix');
});

check('开箱默认是中性人设，不是任何私人称呼', () => {
  clearConfig();
  const cfg = resolveConfig({});
  assert.equal(cfg.userName, '朋友');
  assert.equal(cfg.assistantName, '小助手');
  assert.equal(cfg.userMark, '');
  const text = buildLateText(cfg);
  assert.ok(text.includes('「小助手」') && text.includes('「朋友」'));
  assert.ok(!text.includes('猫猫') && !text.includes('大肥鱼'));
});

check('配置文件生效（向导写的那份）', () => {
  writeConfig(PRESETS.fishcat);
  const cfg = resolveConfig({});
  assert.equal(cfg.assistantName, '大肥鱼');
  const text = buildLateText(cfg);
  assert.ok(text.includes('大肥鱼🐟'), 'assistant name + mark');
  assert.ok(text.includes('猫猫₍^. .^₎⟆'), 'user name + mark');
  clearConfig();
});

check('优先级：bundle 配置 > 配置文件 > 默认值', () => {
  writeConfig({ userName: '来自文件' });
  assert.equal(resolveConfig({}).userName, '来自文件');
  assert.equal(resolveConfig({ userName: '来自 bundle' }).userName, '来自 bundle');
  clearConfig();
  assert.equal(resolveConfig({}).userName, DEFAULTS.userName);
});

check('注册两段段落：名称与 order', () => {
  const { sections } = mount({ userName: '测试' });
  assert.deepEqual(
    sections.map((s) => [s.name, s.order]),
    [
      ['local:persona-prefix', EARLY_ORDER],
      ['local:persona-suffix', LATE_ORDER],
    ],
  );
  for (const section of sections) {
    assert.ok(!section.text.includes('{{'), `${section.name} 不含 {{…}} 变量组`);
  }
});

check('小尾巴留空时不会拖出多余空格', () => {
  const { sections } = mount({ userName: '小明', assistantName: '阿助', userMark: '', assistantMark: '' });
  const late = sections[1].text;
  assert.ok(late.includes('「阿助」') && late.includes('「小明」'));
  assert.ok(!late.includes('「小明 」') && !late.includes('「 小明」'));
});

check('三个语气产出不同文本', () => {
  const texts = ['warm', 'lively', 'calm'].map((tone) => buildLateText(resolveConfig({ tone })));
  assert.equal(new Set(texts).size, 3);
});

check('emojiInChat=false 时不提颜文字', () => {
  const text = buildLateText(resolveConfig({ emojiInChat: false }));
  assert.ok(!text.includes('颜文字'));
  assert.ok(!text.includes('不要只贴表情'));
});

check('strictWorkOutput=false 时不再约束正式产出', () => {
  const text = buildLateText(resolveConfig({ strictWorkOutput: false }));
  assert.ok(!text.includes('对外产出'));
});

check('extra 追加到最后一行', () => {
  const text = buildLateText(resolveConfig({ extra: '回答尽量分点。' }));
  assert.equal(text.trimEnd().split('\n').at(-1), '- 回答尽量分点。');
});

check('enabled=false 时完全不注册', () => {
  assert.equal(mount({ enabled: false }).sections.length, 0);
});

check('非法 tone 回落到默认值', () => {
  assert.equal(resolveConfig({ tone: '乱写的' }).tone, DEFAULTS.tone);
  assert.equal(resolveConfig({ userName: 42 }).userName, DEFAULTS.userName);
});

check('释放会撤销两段段落', () => {
  const { cleanups, disposed } = mount({});
  assert.equal(cleanups.length, 1, '通过 ctx.effect 注册');
  cleanups[0]();
  assert.deepEqual(disposed, ['local:persona-prefix', 'local:persona-suffix']);
});

check('注册抛异常被吃住，不拖垮宿主', () => {
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

check('configPath 尊重 DSH_PERSONA_CONFIG 与 DSH_HOME', () => {
  assert.equal(configPath({ DSH_PERSONA_CONFIG: 'C:\\x\\y.json' }), 'C:\\x\\y.json');
  assert.ok(configPath({ DSH_HOME: 'C:\\dsh' }).endsWith(join('C:\\dsh', 'persona.config.json')));
});

rmSync(sandbox, { recursive: true, force: true });

for (const label of checks) console.log('PASS  ' + label);
console.log(`PASS  ${checks.length}/${checks.length} checks`);
