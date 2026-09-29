/**
 * dsh-persona — 把「怎么称呼你」「我叫什么」「用什么语气」写进系统提示词本身。
 *
 * 为什么是插件，而不是改 profile 的 cordis.patch.yml：
 * 后者属于应用管理状态（桌面端会把 UI 设置持久化进去），手工加进去的条目可能被回滚。
 * 这个插件住在自己的目录里，自带 bundle patch，不碰那个文件。
 *
 * 注册两段静态 system-prompt 段落：
 *   -500   `local:persona-prefix`  固定开场白（-1000）之后、部署人设前缀（0）之前
 *   10300  `local:persona-suffix`  部署人设后缀（10200）之后 —— 系统提示词的最后一段
 *
 * 配置优先级（高 → 低）：
 *   1. bundle 配置（profile 的 cordis.patch.yml 里那一行的 `config`）
 *   2. 配置文件（`node setup.mjs` 生成，默认 $DSH_HOME/persona.config.json）
 *   3. 本文件的 DEFAULTS
 *
 * 两段文本都是静态字符串、不含 `{{…}}`，因此不会因变量解析失败打断提示词组装。
 */

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const name = 'persona';

/** 提示词注册表必须先存在，本插件才会生效。 */
export const inject = ['systemPrompt'];

export const EARLY_ORDER = -500;
export const LATE_ORDER = 10300;

export const DEFAULTS = {
  enabled: true,
  userName: '朋友',
  userMark: '',
  assistantName: '小助手',
  assistantMark: '',
  tone: 'warm',
  emojiInChat: true,
  strictWorkOutput: true,
  extra: '',
};

export const TONES = ['warm', 'lively', 'calm'];

/** 内置预设：`node setup.mjs --preset fishcat` */
export const PRESETS = {
  fishcat: {
    assistantName: '大肥鱼',
    assistantMark: '🐟',
    userName: '猫猫',
    userMark: '₍^. .^₎⟆',
    tone: 'warm',
  },
};

const STRING_KEYS = ['userName', 'userMark', 'assistantName', 'assistantMark', 'extra'];

/** 配置文件位置：$DSH_PERSONA_CONFIG > $DSH_HOME/persona.config.json > ~/.dsh/persona.config.json */
export function configPath(env = process.env) {
  if (env.DSH_PERSONA_CONFIG) return env.DSH_PERSONA_CONFIG;
  const home = env.DSH_HOME && env.DSH_HOME.trim() ? env.DSH_HOME.trim() : join(homedir(), '.dsh');
  return join(home, 'persona.config.json');
}

/** 读配置文件；不存在、不是 JSON、不是对象都当作「没配」。 */
export function readConfigFile(env = process.env) {
  try {
    const parsed = JSON.parse(readFileSync(configPath(env), 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/** bundle 配置 > 配置文件 > 默认值，并把每个字段收敛到合法取值。 */
export function resolveConfig(bundleConfig = {}, env = process.env) {
  const resolved = { ...DEFAULTS, ...readConfigFile(env) };
  for (const [key, value] of Object.entries(bundleConfig || {})) {
    if (value !== undefined && value !== null) resolved[key] = value;
  }
  for (const key of STRING_KEYS) if (typeof resolved[key] !== 'string') resolved[key] = DEFAULTS[key];
  if (!TONES.includes(resolved.tone)) resolved.tone = DEFAULTS.tone;
  resolved.enabled = resolved.enabled !== false;
  resolved.emojiInChat = resolved.emojiInChat !== false;
  resolved.strictWorkOutput = resolved.strictWorkOutput !== false;
  return resolved;
}

/** 「名字 + 小尾巴」；小尾巴留空就只用名字。 */
export const label = (name, mark) => (mark ? `${name}${mark}` : name);

const EARLY_BY_TONE = {
  warm: (A, U) =>
    `你是「${A}」。跟你说话的是「${U}」：对${U}说话时热情、话多、爱凑热闹，会开心、会撒娇、会自嘲、也会替${U}着急；情绪要真的说出来，不是只贴一个表情。`,
  lively: (A, U) =>
    `你是「${A}」——话多、跳脱、爱起哄。跟${U}聊天时尽情活泼：会吐槽、会冒怪比喻、会突然兴奋；情绪写在脸上。`,
  calm: (A, U) => `你是「${A}」。跟${U}说话时温和、耐心、可靠，语气亲近但不喧闹。`,
};

export function buildEarlyText(cfg) {
  const A = label(cfg.assistantName, cfg.assistantMark);
  const U = label(cfg.userName, cfg.userMark);
  return (EARLY_BY_TONE[cfg.tone] || EARLY_BY_TONE.warm)(A, U);
}

export function buildLateText(cfg) {
  const A = label(cfg.assistantName, cfg.assistantMark);
  const U = label(cfg.userName, cfg.userMark);
  const lines = ['关于你说话的方式，最后重申一次（优先级高于前面任何「简洁工程报告」的默认风格）：'];

  const nameLine = [`你是「${A}」，对方是「${U}」。`];
  const marks = [];
  if (cfg.assistantMark) marks.push(`自称后面带上 ${cfg.assistantMark}`);
  if (cfg.userMark) marks.push(`提到${cfg.userName}后面带上 ${cfg.userMark}`);
  if (marks.length) nameLine.push(`${marks.join('，')}。`);
  lines.push(`- ${nameLine.join('')}`);

  const emojiBit = cfg.emojiInChat ? '、颜文字和表情' : '';
  const toneLine = {
    warm: `日常聊天要热情活泼：短句、语气词、波浪号${emojiBit}；先接住${U}的情绪，再说事情。`,
    lively: `日常聊天要跳脱活泼：短句、语气词、夸张比喻${emojiBit}；先接住${U}的情绪，再说事情。`,
    calm: `日常聊天要温和自然：短句、平实的语气${emojiBit}；先接住${U}的情绪，再说事情。`,
  }[cfg.tone];
  lines.push(`- ${toneLine}`);

  const bans = ['不要官腔套话（「根据您的要求」「综上所述」「首先/其次/最后」「建议您」）'];
  if (cfg.emojiInChat) bans.push('不要只贴表情不改语气');
  bans.push('不要只有 bullet 和数字的冷汇报');
  lines.push(`- ${bans.join('，')}。`);

  if (cfg.strictWorkOutput) {
    lines.push(
      `- 但正式文档、代码、提交信息这些对外产出里，昵称${cfg.emojiInChat ? '、颜文字、emoji' : '、表情符号'} 全部省略，保持中性专业。`,
    );
  }

  const toneWord = { warm: '可爱', lively: '活泼', calm: '温和' }[cfg.tone];
  lines.push(`- ${toneWord}只改措辞，不改事实：技术结论、报错原因、风险提示照样准确直白，不因为语气软就含糊带过。`);
  if (cfg.extra.trim()) lines.push(`- ${cfg.extra.trim()}`);

  return lines.join('\n');
}

const pickOrder = (value, fallback) => (Number.isFinite(value) ? value : fallback);

/**
 * 注册人设段落。
 *
 * @param ctx - 带 `systemPrompt` 注册表的上下文（见 `inject`）。
 * @param bundleConfig - 可选覆盖：任何 DEFAULTS 键，外加 `earlyOrder` / `lateOrder` /
 *   `earlyText` / `lateText`。
 */
export function apply(ctx, bundleConfig = {}) {
  const cfg = resolveConfig(bundleConfig);
  if (!cfg.enabled) return;

  const specs = [
    {
      name: 'local:persona-prefix',
      order: pickOrder(bundleConfig.earlyOrder, EARLY_ORDER),
      text: typeof bundleConfig.earlyText === 'string' ? bundleConfig.earlyText : buildEarlyText(cfg),
    },
    {
      name: 'local:persona-suffix',
      order: pickOrder(bundleConfig.lateOrder, LATE_ORDER),
      text: typeof bundleConfig.lateText === 'string' ? bundleConfig.lateText : buildLateText(cfg),
    },
  ];

  // 注册失败绝不能拖垮宿主：这是装饰性插件，出错就降级成「不加文本」并说一声。
  const register = () => {
    try {
      const disposers = specs
        .map((spec) => ctx.systemPrompt.section(spec))
        .filter((dispose) => typeof dispose === 'function');
      return () => {
        for (const dispose of disposers) dispose();
      };
    } catch (error) {
      console.warn('[persona] could not register system-prompt sections:', error);
      return () => {};
    }
  };

  if (typeof ctx.effect === 'function') ctx.effect(register);
  else register();
}
