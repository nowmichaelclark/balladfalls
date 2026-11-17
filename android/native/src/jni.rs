//! The few JNI calls the bridge makes, by hand: no crate, five slots of the
//! JVM's function table. Their numbers are the ones in `jni.h`'s
//! `JNINativeInterface`, and `abi-check.c` holds them to the NDK's own header
//! at every build (`build.sh`), so a wrong one never reaches a device.

use std::ffi::{CString, c_char, c_void};
use std::ptr;

/// `JNIEnv *`: a pointer to the pointer to the function table.
pub type Env = *mut *const *const c_void;
/// Any Java object, as JNI passes it.
pub type Object = *mut c_void;
/// `jboolean`.
pub type Boolean = u8;
/// `jint`.
pub type Int = i32;
/// `jlong`.
pub type Long = i64;
/// `jdouble`.
pub type Double = f64;

/// The table's slots, as `abi-check.c` checks them.
pub const NEW_STRING_UTF: usize = 167;
pub const GET_STRING_UTF_CHARS: usize = 169;
pub const RELEASE_STRING_UTF_CHARS: usize = 170;
pub const NEW_DOUBLE_ARRAY: usize = 182;
pub const SET_DOUBLE_ARRAY_REGION: usize = 214;

/// The function in slot `n` of `env`'s table.
///
/// # Safety
///
/// `env` is the `JNIEnv *` a JNI call was given, on its own thread.
unsafe fn slot(env: Env, n: usize) -> *const c_void {
    // SAFETY: a JVM's table is at least as long as jni.h's (229 slots and on).
    unsafe { *(*env).add(n) }
}

/// A Java string of `text` (plain ASCII from the core; a NUL is dropped).
///
/// # Safety
///
/// `env` as for `slot`.
pub unsafe fn new_string(env: Env, text: &str) -> Object {
    let Ok(text) = CString::new(text.replace('\0', "")) else { return ptr::null_mut() };
    // SAFETY: slot 167 is `jstring NewStringUTF(JNIEnv *, const char *)`.
    unsafe {
        let f: unsafe extern "system" fn(Env, *const c_char) -> Object = std::mem::transmute(slot(env, NEW_STRING_UTF));
        f(env, text.as_ptr())
    }
}

/// A Java string's text, or `None` for a null one.
///
/// # Safety
///
/// `env` as for `slot`; `s` a `jstring` or null.
pub unsafe fn string(env: Env, s: Object) -> Option<String> {
    if s.is_null() {
        return None;
    }
    // SAFETY: slots 169 and 170 are `const char *GetStringUTFChars(JNIEnv *,
    // jstring, jboolean *)` and `void ReleaseStringUTFChars(JNIEnv *,
    // jstring, const char *)`; the chars are NUL-terminated and kept until
    // released.
    unsafe {
        let get: unsafe extern "system" fn(Env, Object, *mut Boolean) -> *const c_char = std::mem::transmute(slot(env, GET_STRING_UTF_CHARS));
        let release: unsafe extern "system" fn(Env, Object, *const c_char) = std::mem::transmute(slot(env, RELEASE_STRING_UTF_CHARS));
        let chars = get(env, s, ptr::null_mut());
        if chars.is_null() {
            return None;
        }
        let text = std::ffi::CStr::from_ptr(chars).to_string_lossy().into_owned();
        release(env, s, chars);
        Some(text)
    }
}

/// A Java `double[]` of `values`.
///
/// # Safety
///
/// `env` as for `slot`.
pub unsafe fn new_doubles(env: Env, values: &[f64]) -> Object {
    let Ok(n) = i32::try_from(values.len()) else { return ptr::null_mut() };
    // SAFETY: slots 182 and 214 are `jdoubleArray NewDoubleArray(JNIEnv *,
    // jsize)` and `void SetDoubleArrayRegion(JNIEnv *, jdoubleArray, jsize,
    // jsize, const jdouble *)`.
    unsafe {
        let new: unsafe extern "system" fn(Env, i32) -> Object = std::mem::transmute(slot(env, NEW_DOUBLE_ARRAY));
        let set: unsafe extern "system" fn(Env, Object, i32, i32, *const f64) = std::mem::transmute(slot(env, SET_DOUBLE_ARRAY_REGION));
        let array = new(env, n);
        if !array.is_null() {
            set(env, array, 0, n, values.as_ptr());
        }
        array
    }
}
