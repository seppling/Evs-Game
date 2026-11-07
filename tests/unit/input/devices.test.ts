import { expect, test } from 'vitest';
import { DeviceManager, Keyboard, mergeInputs, P1_KEYS, PadAssigner, readGamepad, readKeyboard, type GamepadLike } from '../../../src/input/devices';
import { btn, NEUTRAL } from '../../../src/input/types';

function pad(index: number, pressed: number[], axes: number[] = [0, 0], connected = true): GamepadLike {
  return {
    index, connected, mapping: 'standard', axes,
    buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i), value: pressed.includes(i) ? 1 : 0 })),
  };
}
const key = (type: string, code: string) => Object.assign(new Event(type, { cancelable: true }), { code });

test('pad buttons map to the standard layout', () => expect(readGamepad(pad(0, [2, 7]))).toMatchObject({ buttons: btn('LP', 'HK') }));
test('triggers count as pressed above half travel', () => {
  const p = pad(0, []);
  (p.buttons as { pressed: boolean; value: number }[])[7] = { pressed: false, value: 0.8 };
  expect(readGamepad(p).buttons).toBe(btn('HK'));
});
test('stick: dead zone 0.5, and up is +1', () => {
  expect(readGamepad(pad(0, [], [0.3, -0.4]))).toMatchObject({ x: 0, y: 0 });
  expect(readGamepad(pad(0, [], [0.9, -0.9]))).toMatchObject({ x: 1, y: 1 });
});
test('d-pad works', () => expect(readGamepad(pad(0, [13, 14]))).toMatchObject({ x: -1, y: -1 }));
test('Start is read', () => expect(readGamepad(pad(0, [9])).start).toBe(true));
test('REVIEW FOCUS: left+right and up+down cancel to neutral', () => {
  expect(readKeyboard(new Set(['KeyA', 'KeyD', 'KeyW', 'KeyS']), P1_KEYS)).toMatchObject({ x: 0, y: 0 });
  expect(mergeInputs({ ...NEUTRAL, x: 1 }, { ...NEUTRAL, x: -1 }).x).toBe(0);
});
test('keyboard layout maps buttons', () =>
  expect(readKeyboard(new Set(['KeyU', 'KeyL', 'KeyD']), P1_KEYS)).toMatchObject({ x: 1, buttons: btn('LP', 'HK') }));
test('REVIEW FOCUS: blur releases every held key', () => {
  const t = new EventTarget(); const k = new Keyboard(t);
  t.dispatchEvent(key('keydown', 'KeyD')); expect(k.down.has('KeyD')).toBe(true);
  t.dispatchEvent(new Event('blur')); expect(k.down.size).toBe(0);
});
test('REVIEW FOCUS: mapped keys do not scroll the page', () => {
  const t = new EventTarget(); new Keyboard(t); const e = key('keydown', 'ArrowDown');
  t.dispatchEvent(e); expect(e.defaultPrevented).toBe(true);
  const other = key('keydown', 'KeyZ'); t.dispatchEvent(other); expect(other.defaultPrevented).toBe(false);
});
test('pads join in Start order; the same pad cannot take both slots', () => {
  const a = new PadAssigner();
  a.update([null, pad(1, [9])]);
  a.update([pad(0, []), pad(1, [9])]);
  expect(a.slots).toEqual([1, null]);
  a.update([pad(0, [9]), pad(1, [])]);
  expect(a.slots).toEqual([1, 0]);
});
test('disconnect is reported; reconnecting restores the slot', () => {
  const a = new PadAssigner();
  a.update([pad(0, [9])]); a.update([null]); expect(a.disconnected()).toEqual([0]);
  a.update([pad(0, [])]); expect(a.disconnected()).toEqual([]);
});
test('a free pad pressing Start takes over a disconnected slot', () => {
  const a = new PadAssigner();
  a.update([pad(0, [9])]); a.update([null, pad(1, [9])]);
  expect(a.slots).toEqual([1, null]); expect(a.disconnected()).toEqual([]);
});
test('DeviceManager reports a Start edge only once', () => {
  const t = new EventTarget(); const pads = [pad(0, [9])]; const d = new DeviceManager(t, () => pads);
  expect(d.poll().startPressed).toBe(true); expect(d.poll().startPressed).toBe(false);
});
test('DeviceManager gives each player their keyboard layout plus their pad', () => {
  const t = new EventTarget(); let pads: (GamepadLike | null)[] = [pad(0, [9])]; const d = new DeviceManager(t, () => pads);
  d.poll(); pads = [pad(0, [2])]; t.dispatchEvent(key('keydown', 'ArrowLeft'));
  const { inputs } = d.poll();
  expect(inputs[0]).toMatchObject({ buttons: btn('LP') }); expect(inputs[1]).toMatchObject({ x: -1 });
});
test('a key tapped between two polls still registers for exactly one poll', () => {
  const t = new EventTarget(); const d = new DeviceManager(t, () => []);
  d.poll();
  t.dispatchEvent(key('keydown', 'Enter')); t.dispatchEvent(key('keyup', 'Enter'));
  t.dispatchEvent(key('keydown', 'KeyU')); t.dispatchEvent(key('keyup', 'KeyU'));
  const first = d.poll();
  expect(first.startPressed).toBe(true);
  expect(first.inputs[0].buttons).toBe(btn('LP'));
  const second = d.poll();
  expect(second.startPressed).toBe(false);
  expect(second.inputs[0].buttons).toBe(0);
});
