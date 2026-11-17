// Tests for the Android app's transport to its native core (session 27,
// js/native.js) that need no browser and no device: a stub bridge in place
// of the app's `DriftloomNative`, the real CoreHost and Output on it.
// Run with:  node test/native.test.mjs
//
// What they pin down: the page's player posts the worklet's very messages
// over the bridge (an `init` first, carrying what a worklet's
// processorOptions carry), hears the worklet's messages back as from a port,
// and keeps the core's clock as its context's; the WebView makes no node and
// no audio; Diagnostics says the native core with the stream's underruns.

let failures = 0;
function check(label, condition, detail = '') {
  console.log(condition ? `  pass  ${label}` : `  FAIL  ${label} ${detail}`);
  if (!condition) failures++;
}

class Bridge extends EventTarget {
  constructor() {
    super();
    this.sent = [];
  }
  postMessage(text) { this.sent.push(JSON.parse(text)); }
  // A batch from the core, as the app posts it.
  hear(batch) {
    const e = new Event('message');
    e.data = JSON.stringify(batch);
    this.dispatchEvent(e);
  }
}
const bridge = new Bridge();
globalThis.DriftloomNative = bridge;
// Any node the page tried to make would be the WebView's own audio.
let nodes = 0;
globalThis.AudioWorkletNode = class { constructor() { nodes++; } };

const { nativeBridge, NativeContext } = await import('../js/native.js');
const { CoreHost, coreUnsupported, loadCore } = await import('../js/core.js');
const { Output } = await import('../js/output.js');
const { MediaBridge } = await import('../js/media.js');

console.log('\nThe bridge chosen when the app puts it in the page');
check('found', nativeBridge() === bridge);
check('the core is supported without a worklet', coreUnsupported() === null);

const ctx = new NativeContext(bridge);
check('a stand-in context, on the core\'s clock', ctx.native && ctx.currentTime === 0 && ctx.state === 'suspended');
const core = await loadCore(ctx);
check('loadCore gives the bridge\'s port, nothing fetched', core.port === ctx.port && !core.bytes);

console.log('\nThe page\'s player over it');
const output = new Output(ctx, 'lite', { core, layout: 1 });
const host = output.core;
check('a host with no node: nothing for the WebView to play', host.native && host.node === null && output.output === null && nodes === 0);
check('init first, with the worklet\'s options', bridge.sent[0] && bridge.sent[0].type === 'init' && bridge.sent[0].quality === 'lite' && bridge.sent[0].layout === 1, JSON.stringify(bridge.sent[0]));
host.playLoad(2693262067, { vibes: [[3, null]], length: 'endless' }, 0, true);
host.playTrack(2, 8, { seed: 5, ask: {}, fade: 1, track: [1, 2] });
host.playJump(1, 12.5);
output.setLayout(2);
output.silence(1.5);
const sent = bridge.sent.slice(1);
check('the worklet\'s messages, as the worklet takes them', sent[0].type === 'playLoad' && sent[0].seed === 2693262067 && sent[0].ask.length === 'endless' && sent[0].resumed === true
  && sent[1].type === 'playTrack' && sent[1].arm.track[1] === 2 && sent[2].type === 'playJump' && sent[2].at === 12.5
  && sent[3].type === 'layout' && sent[3].channels === 2 && sent[4].type === 'param' && sent[4].time === 1.5, JSON.stringify(sent));

let events = null;
let picks = null;
host.onevents = (m) => { events = m; };
host.onpicks = (m) => { picks = m; };
let busy = null;
host.onbusy = (b) => { busy = b; };
const probe = host.probe();
const id = bridge.sent.at(-1).id;
bridge.hear([
  { type: 'events', events: [1.25, 0, 3, 3], grids: [{ at: 0, grid: [[1], [], [], [], []] }], trackEnd: -1, lost: 0, refused: 0, place: null },
  { type: 'picks', tag: 4, met: true, why: null },
  { type: 'cost', late: 0, missed: 0, dropped: 0, droppedBy: [0, 0, 0], ms: [10, 0], seconds: [2, 0], player: { state: 3, step: 4, time: 1.4 }, busy: { max: 0.1, behind: 0, windows: 8, seconds: 2 } },
  { type: 'probe', id, late: 0, missed: 0, dropped: 0, droppedBy: [0, 0, 0], about: 'name=x\n', lanes: 2, player: { state: 3, step: 4, time: 1.4 } },
  { type: 'native', time: 2.5, running: true, rate: 44100, latency: 0.02, underruns: 0, burst: 96, buffer: 192, capacity: 1920, channels: 2, performance: 12, sharing: 1, policy: 1, priority: 2, reopens: 0, busiest: 0.12, mean: 0.03, level: 0.1, sounding: 2.4, layout: 2 },
]);
const answered = await probe;
check('the events, as from the worklet\'s port', events && events.events[0] === 1.25 && events.grids[0].grid[0][0] === 1);
check('the picks\' answer', picks && picks.tag === 4 && picks.met === true);
check('the cost and busy reports', host.cost.ms[0] === 10 && busy && busy.windows === 8 && host.playerAt.step === 4);
check('the probe answered by number', answered && answered.about === 'name=x\n' && answered.lanes === 2);
check('the clock, the rate and the latency are the core\'s', ctx.currentTime >= 2.5 && ctx.currentTime < 3 && ctx.sampleRate === 44100 && ctx.outputLatency === 0.02 && ctx.state === 'running');
const t1 = ctx.currentTime;
bridge.hear([{ type: 'native', time: 2.0, running: true, rate: 44100, underruns: 3 }]);
check('the clock never goes back', ctx.currentTime >= t1);
check('Diagnostics: the native core with the stream\'s underruns', /^native \(the core's player\)\s+late: 0\s+missed: 0\s+dropped: 0\s+underruns: 3\s+player: playing, step 4/.test(output.engineReport()), output.engineReport());
check('Diagnostics: the stream', /^running, 44100 Hz/.test(ctx.streamReport()), ctx.streamReport());

bridge.hear([{ type: 'failed', message: 'the stream did not open' }]);
check('a stream that can\'t open: the page hears it failed', host.failed === 'the stream did not open');

console.log('\nThe rest of the page');
{
  let rang = 0;
  ctx.alarm(ctx.currentTime - 1, () => { rang++; });
  check('an alarm on the core\'s clock, due: rung', rang === 1);
  const media = new MediaBridge(ctx);
  media.attach(output.output);
  check('no keepalive element: the WebView plays nothing', media.mode === 'native' && media.audio === null);
  host.dispose();
  check('dispose goes to the core', bridge.sent.at(-1).type === 'dispose');
  const again = new CoreHost(ctx, core, { quality: 'full', layout: 2 });
  check('a new player starts with init again', bridge.sent.at(-1).type === 'init' && bridge.sent.at(-1).quality === 'full' && again.port === ctx.port);
}

if (failures) {
  console.log(`\n${failures} failed`);
  process.exit(1);
}
console.log('\nAll good.');
process.exit(0);
