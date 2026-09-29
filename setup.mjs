#!/usr/bin/env node
/**
 * dsh-persona 设置向导 —— 一次问几个问题，把「称呼 + 语气」写进配置文件。
 * 改完只要重启 DSH 就生效，不需要重装插件（配置文件在插件外面）。
 *
 *   node setup.mjs                        交互式向导（需要终端）
 *   node setup.mjs --show                 打印当前配置 + 会写进提示词的文本
 *   node setup.mjs --set userName=小明    只改一项，可重复
 *   node setup.mjs --set tone=calm --set strictWorkOutput=false
 *   node setup.mjs --preset fishcat       套用内置预设
 *   node setup.mjs --reset                删除配置文件，恢复默认
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createInterface } from 'node:readline/promises';

import { DEFAULTS, PRESETS, TONES, buildLateText, configPath, readConfigFile, resolveConfig } from './index.js';

const KEYS = Object.keys(DEFAULTS);
const BOOL_KEYS = ['enabled', 'emojiInChat', 'strictWorkOutput'];
const TONE_CHOICES = { 1: 'warm', 2: 'lively', 3: 'calm' };

const args = process.argv.slice(2);
const hasFlag = (flag) => args.includes(flag);
const valuesOf = (flag) => args.filter((_, i) => args[i - 1] === flag);

function printCurrent(withPreview = false) {
  const cfg = resolveConfig({});
  const path = configPath();
  console.log(`配置文件：${path}`);
  console.log(existsSync(path) ? '（已存在）' : '（还没有，下面是默认值）');
  console.log('');
  for (const key of KEYS) console.log(`  ${key.padEnd(18)} ${JSON.stringify(cfg[key])}`);
  if (withPreview) {
    console.log('\n──── 会写进系统提示词的最后一段 ────\n');
    console.log(buildLateText(cfg));
  }
  console.log('\n重启 DSH 后生效。');
}

function save(patch) {
  const path = configPath();
  const next = { ...readConfigFile(), ...patch };
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(next, null, 2) + '\n', 'utf8');
  return path;
}

function parseSet(pairs) {
  const patch = {};
  for (const pair of pairs) {
    const at = pair.indexOf('=');
    if (at < 1) throw new Error(`--set 需要 key=value 形式，收到：${pair}`);
    const key = pair.slice(0, at).trim();
    let value = pair.slice(at + 1).trim();
    if (!KEYS.includes(key)) throw new Error(`未知配置项：${key}\n可用：${KEYS.join(', ')}`);
    if (BOOL_KEYS.includes(key)) value = value !== 'false' && value !== '0' && value !== '';
    else if (key === 'tone' && !TONES.includes(value)) throw new Error(`tone 只能是：${TONES.join(' / ')}`);
    patch[key] = value;
  }
  return patch;
}

function printHelp() {
  console.log(`dsh-persona 设置向导

  node setup.mjs                        交互式向导
  node setup.mjs --show                 查看当前配置和最终的提示词文本
  node setup.mjs --set key=value        改一项（可重复）
  node setup.mjs --preset fishcat       内置预设
  node setup.mjs --reset                恢复默认

可配置项：
${KEYS.map((k) => `  ${k.padEnd(18)} ${JSON.stringify(DEFAULTS[k])}`).join('\n')}
  tone 可选：${TONES.join(' / ')}`);
}

async function wizard() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.log('这里不是交互终端，改用参数方式：\n');
    printHelp();
    return;
  }

  const cfg = resolveConfig({});
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = async (question, fallback = '') => {
    const hint = fallback ? `（默认：${fallback}）` : '（可留空）';
    const answer = (await rl.question(`${question}${hint}\n> `)).trim();
    return answer || fallback;
  };

  try {
    console.log('\n回答几个问题就行，之后想改随时再跑一次。\n');
    const userName = await ask('① 我该怎么称呼你？', cfg.userName);
    const userMark = await ask(`② 「${userName}」后面要跟个小尾巴吗？比如颜文字或 emoji`, cfg.userMark);
    const assistantName = await ask('③ 你想叫我什么？', cfg.assistantName);
    const assistantMark = await ask(`④ 「${assistantName}」后面要跟点什么？`, cfg.assistantMark);
    console.log('\n⑤ 语气：1) 热情  2) 跳脱  3) 温和');
    const toneAnswer = (await rl.question(`（默认：${TONES.indexOf(cfg.tone) + 1}）\n> `)).trim();
    const tone = TONE_CHOICES[toneAnswer] || cfg.tone;
    const work = (await rl.question('⑥ 正式文档、代码、提交信息里保持中性专业？（Y/n）\n> ')).trim().toLowerCase();
    const extra = await ask('⑦ 还有什么想让我记住的？（会追加到提示词最后）', cfg.extra);

    const path = save({
      userName,
      userMark,
      assistantName,
      assistantMark,
      tone,
      strictWorkOutput: work !== 'n',
      extra,
    });

    console.log(`\n✅ 已写入：${path}\n`);
    console.log('──── 之后每次对话，系统提示词的最后一段会是 ────\n');
    console.log(buildLateText(resolveConfig({})));
    console.log('\n重启 DSH 后生效。');
  } finally {
    rl.close();
  }
}

async function main() {
  if (hasFlag('--help') || hasFlag('-h')) return printHelp();

  if (hasFlag('--reset')) {
    const path = configPath();
    rmSync(path, { force: true });
    console.log(`已删除 ${path}，恢复默认人设（${DEFAULTS.assistantName} / ${DEFAULTS.userName}）。`);
    return undefined;
  }

  const sets = valuesOf('--set');
  if (sets.length) {
    console.log(`已写入：${save(parseSet(sets))}\n`);
    return printCurrent(true);
  }

  const presets = valuesOf('--preset');
  if (presets.length) {
    const preset = PRESETS[presets[0]];
    if (!preset) throw new Error(`没有这个预设：${presets[0]}（可用：${Object.keys(PRESETS).join(', ')}）`);
    console.log(`已写入预设 ${presets[0]}：${save(preset)}\n`);
    return printCurrent(true);
  }

  if (hasFlag('--show')) return printCurrent(true);
  return wizard();
}

try {
  await main();
} catch (error) {
  console.error(`✗ ${error && error.message ? error.message : error}`);
  process.exitCode = 1;
}
