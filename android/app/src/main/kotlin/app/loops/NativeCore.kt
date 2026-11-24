package app.loops

/**
 * The core, native, on Android's own audio (session 26, queue item 107b):
 * the bridge to `libdriftloom.so` (android/native). One engine a process,
 * made at the first [start] at the device's rate; an AAudio stream at high
 * priority renders it. Every call here only queues a command or reads a
 * count: the audio thread takes the commands at its next callback, through a
 * lock-free queue, as the page's worklet takes its messages.
 *
 * The page drives it through [send] and [drain] (session 27, PageBridge);
 * the debug screen (NativeTestActivity, debug builds) and the instrumented
 * tests through the rest.
 */
object NativeCore {
    init {
        System.loadLibrary("driftloom")
    }

    /** Open and start the stream (the engine too, the first time: the full mix, or lite's). Null, or why not. */
    @JvmStatic external fun start(full: Boolean): String?

    /** Stop and close the stream. The engine is kept: a start plays on from it. */
    @JvmStatic external fun stop()

    /** Close the stream and open another, as a device change (headphones in or out) does. Null, or why not. */
    @JvmStatic external fun reopen(): String?

    /** A loop from its seed, with a request as text ("peaceful,bpm=70-85", or ""). Null, or the core's refusal. */
    @JvmStatic external fun load(seed: Long, request: String): String?

    /** Go on after a pause. True if it was queued. */
    @JvmStatic external fun play(): Boolean

    /** Stop deciding steps; what was played rings out. */
    @JvmStatic external fun pause(): Boolean

    /** A loop of the core's own, crossfading in (needs [draws] first). */
    @JvmStatic external fun next(): Boolean

    /** The listener's volume, 0 to 1. */
    @JvmStatic external fun volume(volume: Double): Boolean

    /** The seed the core draws its own loops from (Next's), new each start as the page's is. */
    @JvmStatic external fun draws(seed: Long): Boolean

    /** Forget the busiest callback so far, the watch's figures and the time played with the screen off. */
    @JvmStatic external fun resetBusiest(): Boolean

    /** The phone's screen went on or off (session 30g): the time played with it off is counted from here. */
    @JvmStatic external fun screen(on: Boolean)

    /** The figures, in [Figures]'s order (android/native/src/lib.rs, COUNTS). */
    @JvmStatic external fun counts(): DoubleArray

    /** The name of the loop heard last ("" before one). */
    @JvmStatic external fun name(): String

    /**
     * The loop a hash line names (core/golden/seeds.hashes's, or
     * tools/player-wasm.mjs's), rendered again offline through the same
     * engine path the stream plays, [chunk] frames a callback: its own line,
     * the same as the given one when the samples are the same, bit for bit.
     */
    @JvmStatic external fun renderLine(line: String, chunk: Int): String

    /**
     * A message from the page (js/core.js's, as the worklet takes it; `init` starts the stream and the
     * page's player). Null, or a batch to post back at once (the `failed` message).
     */
    @JvmStatic external fun send(message: String): String?

    /** What is due to the page now (a JSON array of the worklet's messages), or null. */
    @JvmStatic external fun drain(): String?

    /** The page went: its player is let go, as a closed tab's worklet is. */
    @JvmStatic external fun pageGone()

    /** The figures now. */
    fun figures(): Figures = Figures(counts())
}

/** The engine's and the stream's figures, by name (the array's order is android/native/src/lib.rs's COUNTS). */
class Figures(private val v: DoubleArray) {
    private fun at(i: Int) = if (i < v.size) v[i] else 0.0

    /** Notes the core took late, left out and dropped since it started: 0 unless something is wrong. */
    val late get() = at(0).toLong()
    val missed get() = at(1).toLong()
    val dropped get() = at(2).toLong()
    /** AAudio's underruns, every stream since the engine started. */
    val underruns get() = at(3).toLong()
    val callbacks get() = at(4).toLong()
    val frames get() = at(5).toLong()
    /**
     * The busiest callback: its time, and as a share of its block's deadline: the time its frames take to
     * play, or a burst's if it asked for fewer (a few frames topping the buffer up still have a burst's time).
     */
    val busiestMs get() = at(6)
    val busiestShare get() = at(7)
    /** All the callbacks' time over the time their frames play: the share of real time the audio thread renders. */
    val meanShare get() = at(8)
    val rate get() = at(9).toInt()
    val burst get() = at(10).toInt()
    val buffer get() = at(11).toInt()
    val capacity get() = at(12).toInt()
    val channels get() = at(13).toInt()
    /** AAudio's performance mode (12 low latency, 10 none) and sharing mode (1 shared, 0 exclusive). */
    val performance get() = at(14).toInt()
    val sharing get() = at(15).toInt()
    /** The callback thread's scheduling: 1 SCHED_FIFO, 2 SCHED_RR, 0 normal; -1 before its first callback. */
    val policy get() = at(16).toInt()
    val priority get() = at(17).toInt()
    val reopens get() = at(18).toLong()
    /** The player: 0 idle, 1 loading, 2 its first pass drawn, 3 playing. */
    val state get() = at(19).toInt()
    val seed get() = at(20).toLong()
    val running get() = at(21) != 0.0
    val busiestFrames get() = at(22).toLong()
    val refused get() = at(23).toLong()
    val collisions get() = at(24).toLong()
    val engine get() = at(25) != 0.0
    /** Callbacks over their deadline, and times the speaker's playhead fell behind the clock (session 30g, watch.rs). */
    val over get() = at(26).toLong()
    val behind get() = at(27).toLong()
    /** Seconds played with the screen off. */
    val offSeconds get() = at(28)

    /** The scheduling policy in words. */
    val policyName get() = when (policy) {
        -1 -> "not yet"
        0 -> "normal"
        1 -> "SCHED_FIFO"
        2 -> "SCHED_RR"
        else -> "policy $policy"
    }

    /** Every figure on one line, for the logs and the tests' reports. */
    override fun toString(): String =
        "underruns=$underruns late=$late missed=$missed dropped=$dropped " +
            "busiest=${"%.3f".format(busiestMs)}ms (${"%.1f".format(busiestShare * 100)}% of its block's deadline, $busiestFrames frames asked) " +
            "mean=${"%.2f".format(meanShare * 100)}% callbacks=$callbacks frames=$frames " +
            "rate=$rate burst=$burst buffer=$buffer/$capacity channels=$channels performance=$performance sharing=$sharing " +
            "thread=$policyName/$priority reopens=$reopens state=$state seed=$seed refused=$refused collisions=$collisions " +
            "over=$over behind=$behind off=${"%.1f".format(offSeconds)}s"
}
