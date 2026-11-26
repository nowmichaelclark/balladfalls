package app.loops

import android.os.Bundle
import android.util.Log
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.FixMethodOrder
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.MethodSorters

/**
 * The core, native, on the device (CI runs these on
 * its emulator, android/emulator-native.sh). In name order: the samples
 * first, then a device change, then five minutes of play.
 *
 * Arguments (`am instrument -e NAME VALUE`): `wasm`, a line
 * tools/player-wasm.mjs printed for js/dlplayer.wasm (spaces as `_`), held
 * as the golden line is; `seconds`, how long the play test plays (300).
 * Each test reports its figures as instrumentation status (`report`), which
 * the CI script copies into the run's summary.
 */
@RunWith(AndroidJUnit4::class)
@FixMethodOrder(MethodSorters.NAME_ASCENDING)
class NativeCoreTest {

    private val args: Bundle = InstrumentationRegistry.getArguments()

    private fun report(key: String, value: String) {
        Log.i("driftloom", "$key: $value")
        InstrumentationRegistry.getInstrumentation().sendStatus(0, Bundle().apply { putString(key, value) })
    }

    private fun seedOf(line: String): Long = line.split(' ').first { it.startsWith("seed=") }.substringAfter('=').toLong()

    /**
     * The golden loop, and the web's own line if CI gave one, rendered
     * offline through the JNI and the engine's own path at a callback's size:
     * the same samples, bit for bit, as every target and js/dlplayer.wasm.
     */
    @Test
    fun a_theSamplesAreTheWebs() {
        val lines = mutableListOf(BuildConfig.GOLDEN_LINE)
        args.getString("wasm")?.let { lines += it.replace('_', ' ') }
        for ((i, want) in lines.withIndex()) {
            val got = NativeCore.renderLine(want, 192)
            report("line$i", got)
            assertEquals(want, got)
        }
    }

    /**
     * A device change, as AAudio reports one: the stream closed and another
     * opened (the same path the error callback takes), and the loop plays on
     * through it with nothing late.
     */
    @Test
    fun b_aDeviceChangeReopensTheStream() {
        assertNull(NativeCore.start(true))
        assertNull(NativeCore.load(seedOf(BuildConfig.GOLDEN_LINE), ""))
        Thread.sleep(5_000)
        val before = NativeCore.figures()
        assertNull(NativeCore.reopen())
        Thread.sleep(5_000)
        val after = NativeCore.figures()
        report("reopen", after.toString())
        NativeCore.stop()
        assertTrue("the stream runs again", after.running)
        assertEquals(before.reopens + 1, after.reopens)
        assertTrue("callbacks go on after the reopen", after.callbacks > before.callbacks + 100)
        assertEquals("late notes", 0L, after.late)
        assertEquals(3, after.state)
    }

    /**
     * Five minutes of a seed playing natively: no underrun reported by
     * AAudio, no note late, missed or dropped; and the busiest callback's
     * time against its deadline, measured here, on this device (an emulator
     * in CI: its figures say nothing about a phone's).
     */
    @Test
    fun c_aSeedPlaysFiveMinutes() {
        val seconds = args.getString("seconds")?.toLongOrNull() ?: 300L
        assertNull(NativeCore.start(true))
        val before = NativeCore.figures()
        assertTrue(NativeCore.draws(20261117))
        assertTrue(NativeCore.resetBusiest())
        assertNull(NativeCore.load(seedOf(BuildConfig.GOLDEN_LINE), ""))
        var left = seconds
        while (left > 0) {
            val step = minOf(left, 30L)
            Thread.sleep(step * 1_000)
            left -= step
            report("at${seconds - left}s", NativeCore.figures().toString())
        }
        val after = NativeCore.figures()
        NativeCore.stop()
        report("played", after.toString())
        report("underruns", (after.underruns - before.underruns).toString())
        report("busiest", "%.4f".format(after.busiestShare))
        report("mean", "%.4f".format(after.meanShare))
        val played = (after.frames - before.frames).toDouble() / after.rate
        assertTrue("it played ${"%.1f".format(played)} s of $seconds", played > seconds * 0.95)
        assertEquals("underruns", before.underruns, after.underruns)
        assertEquals("late notes", before.late, after.late)
        assertEquals("missed notes", before.missed, after.missed)
        assertEquals("dropped notes", before.dropped, after.dropped)
        assertEquals("collisions", 0L, after.collisions)
        assertEquals("playing at the end", 3, after.state)
    }
}
