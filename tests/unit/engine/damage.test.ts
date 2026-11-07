import { expect, test } from 'vitest';
import { scalePercent } from '../../../src/engine/combat';
import type { Defs } from '../../../src/engine/types';
import { fightPair, motion, raw, setAttack, tickN } from '../helpers';

test('scalePercent', () => expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => scalePercent(n, false))).toEqual([100, 100, 80, 70, 60, 50, 40, 40, 40]));
test('supers never scale below 50%', () => expect(scalePercent(9, true)).toBe(50));
test('blocked Karate Wave deals 25% chip', () => {
  const c = fightPair('mohawk-man', 'spin-kicker', 400, 900); motion(c, 0, [2, 3, 6], 'HP'); tickN(c, 120, raw(), raw(6));
  expect(c.fs[1].health).toBe(950 - 22);
});
test('chip damage can KO', () => {
  const c = fightPair('mohawk-man', 'spin-kicker', 400, 900); c.fs[1].health = 10; motion(c, 0, [2, 3, 6], 'HP'); tickN(c, 120, raw(), raw(6));
  expect(c.fs[1]).toMatchObject({ health: 0, ko: true });
});
test('the 4th hit of a combo deals 70%', () => {
  const c = fightPair('mohawk-man', 'spin-kicker', 900, 980); c.fs[1].action = 'hitstun'; c.fs[1].stunTicks = 30; c.fs[1].comboHits = 3;
  tickN(c, 1, raw(5, 'HP')); tickN(c, 9); expect(c.fs[1].health).toBe(950 - 70); expect(c.fs[1].comboHits).toBe(4);
});
test('a fresh hit starts a new combo at 100%', () => {
  const c = fightPair('mohawk-man', 'spin-kicker', 900, 980); c.fs[1].comboHits = 5;
  tickN(c, 1, raw(5, 'HP')); tickN(c, 9); expect(c.fs[1].health).toBe(850); expect(c.fs[1].comboHits).toBe(1);
});
test('meter: attacker +40 for a light hit, defender +15 for taking 30', () => {
  const c = fightPair('mohawk-man', 'spin-kicker', 900, 980); tickN(c, 1, raw(5, 'LP')); tickN(c, 4);
  expect(c.fs[0].meter).toBe(40); expect(c.fs[1].meter).toBe(15);
});
test('meter: a special hit gives +100', () => {
  const c = fightPair('mohawk-man', 'spin-kicker', 400, 900); motion(c, 0, [2, 3, 6], 'HP'); tickN(c, 120);
  expect(c.fs[0].meter).toBe(100);
});
test('Easy specials deal 85% damage; the option can turn it off', () => {
  for (const [easyDamage, hp] of [[true, 950 - 76], [false, 950 - 90]] as const) {
    const c = fightPair('mohawk-man', 'spin-kicker', 400, 900); c.easy = [true, false]; c.easyDamage = easyDamage;
    tickN(c, 1, raw(5, 'SPECIAL')); tickN(c, 120); expect(c.fs[1].health).toBe(hp);
  }
});
test('Rising Chop startup is invulnerable to strikes', () => {
  const c = fightPair('mohawk-man', 'spin-kicker', 900, 980);
  setAttack(c.fs[0], 'rising-chop-heavy', 0); setAttack(c.fs[1], 'stand-hp', 9);
  tickN(c, 1); expect(c.fs[0].health).toBe(1000);
});
test('upperInvuln: mids miss, lows connect', () => {
  for (const [press, hold, hp] of [[raw(5, 'HP'), raw(), 950], [raw(2, 'MK'), raw(2), 890]] as const) {
    const c = fightPair('mohawk-man', 'spin-kicker', 900, 980); const defs = structuredClone(c.defs) as Defs;
    for (const f of defs[1].moves['throw-forward']!.frames) f.flags = ['upperInvuln'];
    const w = { ...c, defs }; setAttack(w.fs[1], 'throw-forward', 4);
    tickN(w, 1, press); tickN(w, 10, hold); expect(w.fs[1].health).toBe(hp);
  }
});
test('a fireball that flies off without hitting gains 30 meter', () => {
  const c = fightPair('mohawk-man', 'spin-kicker', 1500, 1700); c.fs[1].action = 'down'; c.fs[1].ko = true;
  motion(c, 0, [2, 3, 6], 'HP'); tickN(c, 80); expect(c.projectiles).toHaveLength(0); expect(c.fs[0].meter).toBe(30);
});
