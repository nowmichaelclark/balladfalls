package app.loops

import android.app.Activity
import android.graphics.Color
import android.graphics.Typeface
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.InputType
import android.view.Gravity
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.SeekBar
import android.widget.TextView
import kotlin.random.Random

/**
 * The native audio test (debug builds only, its own launcher
 * icon): the core played by the app's own library on an AAudio stream, no
 * page involved. "Play the test" starts the stream, loads the golden loop
 * and plays it; the two numbers to send back are at the top (underruns, and
 * the busiest callback as a share of its deadline). "Check the samples"
 * renders the golden loop offline through the same path and says whether its
 * hash is the web's. Plain views, no layout files: it goes when the page
 * plays the core itself.
 */
class NativeTestActivity : Activity() {

    private val ui = Handler(Looper.getMainLooper())
    private lateinit var headline: TextView
    private lateinit var details: TextView
    private lateinit var golden: TextView
    private lateinit var seed: EditText
    private lateinit var request: EditText
    private var message = ""

    private val tick = object : Runnable {
        override fun run() {
            show()
            ui.postDelayed(this, 500)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Five minutes of listening without the screen going off.
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        val dark = Color.parseColor("#160830")
        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 48, 32, 48)
            setBackgroundColor(dark)
        }
        fun text(size: Float, mono: Boolean = false) = TextView(this).apply {
            textSize = size
            setTextColor(Color.WHITE)
            if (mono) typeface = Typeface.MONOSPACE
            setPadding(0, 12, 0, 12)
        }
        fun row(vararg views: android.view.View) = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            for (v in views) addView(v, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        }
        fun button(label: String, action: () -> Unit) = Button(this).apply {
            text = label
            isAllCaps = false
            setOnClickListener { action() }
        }

        column.addView(text(20f).apply { text = getString(R.string.native_test_label) })
        headline = text(22f)
        column.addView(headline)

        seed = EditText(this).apply {
            inputType = InputType.TYPE_CLASS_NUMBER
            setTextColor(Color.WHITE)
            hint = "seed"
            setText(goldenSeed().toString())
        }
        request = EditText(this).apply {
            inputType = InputType.TYPE_CLASS_TEXT
            setTextColor(Color.WHITE)
            hint = "request (\"peaceful,bpm=70-85\"), or empty"
        }
        column.addView(row(text(14f).apply { text = "Seed" }, seed))
        column.addView(row(text(14f).apply { text = "Request" }, request))

        column.addView(button("Play the test") { playTest() })
        column.addView(row(
            button("Start") { say(NativeCore.start(true) ?: "stream started") },
            button("Stop") { NativeCore.stop(); say("stream stopped") },
            button("Load") { load() },
        ))
        column.addView(row(
            button("Play") { NativeCore.play() },
            button("Pause") { NativeCore.pause() },
            button("Next") { NativeCore.next() },
        ))
        column.addView(row(
            button("Reopen") { say(NativeCore.reopen() ?: "stream reopened") },
            button("Reset busiest") { NativeCore.resetBusiest() },
        ))
        column.addView(text(14f).apply { text = "Volume" })
        column.addView(SeekBar(this).apply {
            max = 100
            progress = 85
            setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(bar: SeekBar, value: Int, fromUser: Boolean) {
                    if (fromUser) NativeCore.volume(value / 100.0)
                }
                override fun onStartTrackingTouch(bar: SeekBar) {}
                override fun onStopTrackingTouch(bar: SeekBar) {}
            })
        })
        column.addView(button("Check the samples (the golden loop, offline)") { checkGolden() })
        golden = text(13f, mono = true)
        column.addView(golden)
        details = text(13f, mono = true)
        column.addView(details)

        setContentView(ScrollView(this).apply { setBackgroundColor(dark); addView(column) })
    }

    override fun onResume() {
        super.onResume()
        ui.post(tick)
    }

    override fun onPause() {
        ui.removeCallbacks(tick)
        super.onPause()
    }

    override fun onDestroy() {
        NativeCore.stop()
        super.onDestroy()
    }

    private fun goldenSeed(): Long =
        BuildConfig.GOLDEN_LINE.split(' ').first { it.startsWith("seed=") }.substringAfter('=').toLong()

    private fun say(text: String) {
        message = text
        show()
    }

    private fun load() {
        val s = seed.text.toString().toLongOrNull() ?: goldenSeed()
        say(NativeCore.load(s, request.text.toString()) ?: "loading $s")
    }

    private fun playTest() {
        val why = NativeCore.start(true)
        if (why != null) {
            say(why)
            return
        }
        NativeCore.draws(Random.nextLong(1, 1L shl 32))
        NativeCore.resetBusiest()
        load()
    }

    private fun checkGolden() {
        golden.text = "rendering the golden loop offline..."
        Thread {
            val want = BuildConfig.GOLDEN_LINE
            val got = NativeCore.renderLine(want, 192)
            val verdict = if (got == want) "same samples as the web's (bit for bit)" else "DIFFERS from the web's:\n$got\nwanted\n$want"
            ui.post { golden.text = verdict }
        }.start()
    }

    private fun show() {
        val f = NativeCore.figures()
        headline.text = if (!f.engine) {
            "Not started. Press \"Play the test\"."
        } else {
            "Underruns: ${f.underruns}\n" +
                "Busiest block: ${"%.1f".format(f.busiestShare * 100)}% of its deadline (${"%.2f".format(f.busiestMs)} ms)\n" +
                "Late notes: ${f.late}   missed: ${f.missed}   dropped: ${f.dropped}"
        }
        val minutes = if (f.rate > 0) f.frames.toDouble() / f.rate / 60 else 0.0
        details.text = buildString {
            if (message.isNotEmpty()) append(message).append("\n\n")
            append("loop: ").append(NativeCore.name().ifEmpty { "-" }).append("  seed ").append(f.seed)
            append("  state ").append(f.state).append('\n')
            append("played: ").append("%.1f".format(minutes)).append(" min, ").append(f.callbacks).append(" callbacks\n")
            append("audio thread busy: ").append("%.2f".format(f.meanShare * 100)).append("% of the time\n")
            append("stream: ").append(if (f.running) "running" else "stopped").append(", ").append(f.rate).append(" Hz, ")
            append(f.channels).append(" ch, burst ").append(f.burst).append(", buffer ").append(f.buffer).append(" of ").append(f.capacity).append('\n')
            append("performance mode ").append(f.performance).append(if (f.performance == 12) " (low latency)" else "")
            append(", sharing ").append(f.sharing).append(if (f.sharing == 1) " (shared)" else "").append('\n')
            append("audio thread: ").append(f.policyName).append(", priority ").append(f.priority).append('\n')
            append("reopens: ").append(f.reopens).append("  refused: ").append(f.refused).append("  collisions: ").append(f.collisions)
        }
    }
}
