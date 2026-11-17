//! A small lock-free queue: one writer, one reader, a fixed number of slots.
//!
//! The way the page's commands reach the worklet (a message port), for a
//! native host: the app's thread writes a command, the audio thread reads it
//! at the start of its next callback. Neither side ever waits for the other,
//! nothing is allocated after it is made, and a full queue refuses the
//! command (the writer hears so) rather than block the audio thread.

use std::cell::UnsafeCell;
use std::mem::MaybeUninit;
use std::sync::atomic::{AtomicUsize, Ordering};

/// `N` slots of `T`. `T` is `Copy`, so a slot never needs dropping.
pub struct Ring<T: Copy, const N: usize> {
    slots: [UnsafeCell<MaybeUninit<T>>; N],
    /// The next slot to read: the reader's alone to move.
    head: AtomicUsize,
    /// The next slot to write: the writer's alone to move.
    tail: AtomicUsize,
}

// SAFETY: a slot is written only by the one writer, before `tail` passes it
// (Release), and read only by the one reader, after it sees that `tail`
// (Acquire); the callers keep to one writer and one reader at a time
// (`push` and `pop`'s contracts).
unsafe impl<T: Copy + Send, const N: usize> Sync for Ring<T, N> {}

impl<T: Copy, const N: usize> Ring<T, N> {
    /// An empty queue.
    pub const fn new() -> Self {
        Ring { slots: [const { UnsafeCell::new(MaybeUninit::uninit()) }; N], head: AtomicUsize::new(0), tail: AtomicUsize::new(0) }
    }

    /// Put `value` at the back. False if every slot is taken: the reader
    /// has not caught up, and the value is not queued.
    ///
    /// # Safety
    ///
    /// No other thread calls `push` at the same time (the engine holds a
    /// writer's mutex on the app's side; the audio thread never pushes).
    pub unsafe fn push(&self, value: T) -> bool {
        let tail = self.tail.load(Ordering::Relaxed);
        let head = self.head.load(Ordering::Acquire);
        if tail.wrapping_sub(head) >= N {
            return false;
        }
        // SAFETY: the slot is past the reader's head, so the reader is not
        // looking at it, and this is the only writer (the contract).
        unsafe { (*self.slots[tail % N].get()).write(value) };
        self.tail.store(tail.wrapping_add(1), Ordering::Release);
        true
    }

    /// Take the value at the front, if any.
    ///
    /// # Safety
    ///
    /// No other thread calls `pop` at the same time (only the thread that
    /// renders the engine does).
    pub unsafe fn pop(&self) -> Option<T> {
        let head = self.head.load(Ordering::Relaxed);
        let tail = self.tail.load(Ordering::Acquire);
        if head == tail {
            return None;
        }
        // SAFETY: the writer finished this slot before publishing `tail`
        // past it (Acquire above), and will not touch it until `head` moves.
        let value = unsafe { (*self.slots[head % N].get()).assume_init_read() };
        self.head.store(head.wrapping_add(1), Ordering::Release);
        Some(value)
    }
}

impl<T: Copy, const N: usize> Default for Ring<T, N> {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::Ring;
    use std::sync::Arc;

    #[test]
    fn holds_its_slots_in_order_and_refuses_past_them() {
        let r: Ring<u32, 4> = Ring::new();
        // SAFETY: one thread is both the writer and the reader.
        unsafe {
            for i in 0..4 {
                assert!(r.push(i));
            }
            assert!(!r.push(9), "a full queue refuses");
            assert_eq!(r.pop(), Some(0));
            assert!(r.push(4));
            for i in 1..5 {
                assert_eq!(r.pop(), Some(i));
            }
            assert_eq!(r.pop(), None);
        }
    }

    #[test]
    fn a_writer_and_a_reader_on_two_threads_lose_nothing() {
        const COUNT: u64 = 200_000;
        let r: Arc<Ring<u64, 8>> = Arc::new(Ring::new());
        let w = Arc::clone(&r);
        let writer = std::thread::spawn(move || {
            let mut i = 0;
            while i < COUNT {
                // SAFETY: the only writer.
                if unsafe { w.push(i) } {
                    i += 1;
                } else {
                    std::hint::spin_loop();
                }
            }
        });
        let mut want = 0;
        while want < COUNT {
            // SAFETY: the only reader.
            if let Some(v) = unsafe { r.pop() } {
                assert_eq!(v, want);
                want += 1;
            } else {
                std::hint::spin_loop();
            }
        }
        writer.join().unwrap();
    }
}
