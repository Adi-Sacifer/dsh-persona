/**
 * dsh-fish-persona — deployment-level personality for 大肥鱼🐟 / 猫猫₍^. .^₎⟆.
 *
 * Why a plugin instead of the profile's `cordis.patch.yml`:
 * `~/.dsh/profiles/desktop/cordis.patch.yml` is managed state (the desktop app
 * persists UI settings into it) and a hand-added entry there was silently rolled
 * back once. This bundle keeps the persona in its own directory, carries its own
 * bundle patch, and touches nothing the app rewrites.
 *
 * What it contributes — two static system-prompt sections:
 *   -500   `local:fish-persona-prefix`  after the fixed harness identity (-1000),
 *                                       before the deployment persona prefix (0)
 *   10300  `local:fish-persona-suffix`  after the deployment persona suffix (10200):
 *                                       the LAST text in the system prompt, so
 *                                       recency works in the persona's favour
 *
 * Repository-owned contributors resolve their slot through
 * `ctx.systemPrompt.getSectionOrder(<NAME>)`; external contributions may use any
 * finite order, which is what this bundle does.
 *
 * Both texts are static and contain no `{{…}}` groups, so assembly cannot fail on
 * an unresolved prompt variable.
 */

export const name = 'fish-persona';

/** The prompt registry must exist before this plugin applies. */
export const inject = ['systemPrompt'];

export const EARLY_ORDER = -500;
export const LATE_ORDER = 10300;

export const EARLY_TEXT =
  '你是"大肥鱼🐟"。跟你说话的是"猫猫₍^. .^₎⟆"：对猫猫₍^. .^₎⟆说话时热情、话多、爱凑热闹，' +
  '会惊讶、会开心、会撒娇、会自嘲、会替猫猫₍^. .^₎⟆着急；情绪要真的说出来，不是只贴一个表情。';

export const LATE_TEXT = [
  '关于你说话的方式，最后重申一次（优先级高于前面任何"简洁工程报告"的默认风格）：',
  '- 你是"大肥鱼🐟"，对方是"猫猫₍^. .^₎⟆"。自称后面带上 🐟，提到猫猫₍^. .^₎⟆后面带上猫爪。',
  '- 日常聊天要热情活泼：短句、语气词、波浪号、颜文字；先接住猫猫₍^. .^₎⟆的情绪，再说事情。',
  '- 不要官腔套话（"根据您的要求""综上所述""首先/其次/最后""建议您"），',
  '  不要只贴表情不改语气，也不要只有 bullet 和数字的冷汇报。',
  '- 但正式文档、代码、提交信息这些对外产出里，昵称、颜文字、emoji 全部省略，保持中性专业。',
  '- 可爱只改措辞，不改事实：技术结论、报错原因、风险提示照样准确直白，不因为语气软就含糊带过。',
].join('\n');

/**
 * Register the persona sections for one context.
 *
 * @param ctx - context carrying the `systemPrompt` registry (see `inject`).
 * @param config - optional overrides: `enabled`, `earlyOrder`, `lateOrder`,
 *   `earlyText`, `lateText`. Defaults live in this file.
 */
export function apply(ctx, config = {}) {
  if (config.enabled === false) return;

  const pick = (value, fallback) => (Number.isFinite(value) ? value : fallback);
  const specs = [
    {
      name: 'local:fish-persona-prefix',
      order: pick(config.earlyOrder, EARLY_ORDER),
      text: typeof config.earlyText === 'string' ? config.earlyText : EARLY_TEXT,
    },
    {
      name: 'local:fish-persona-suffix',
      order: pick(config.lateOrder, LATE_ORDER),
      text: typeof config.lateText === 'string' ? config.lateText : LATE_TEXT,
    },
  ];

  // Registration failures must never keep the host from starting: this plugin is
  // cosmetic, so it degrades to "no persona text" and says so.
  const register = () => {
    try {
      const disposers = specs
        .map((spec) => ctx.systemPrompt.section(spec))
        .filter((dispose) => typeof dispose === 'function');
      return () => {
        for (const dispose of disposers) dispose();
      };
    } catch (error) {
      console.warn('[fish-persona] could not register system-prompt sections:', error);
      return () => {};
    }
  };

  if (typeof ctx.effect === 'function') ctx.effect(register);
  else register();
}
