/* The numbers and shapes src/jni.rs and src/aaudio.rs write by hand, held to
 * the NDK's own headers (queue item 107b). build.sh compiles this before
 * every build, for each ABI; nothing is linked or run. A slot or a constant
 * that differs fails the build here, never on a device. */

#include <stddef.h>
#include <stdint.h>
#include <sched.h>
#include <jni.h>
#include <aaudio/AAudio.h>

/* src/jni.rs: the function table's slots. */
#define SLOT(name, n) _Static_assert(offsetof(struct JNINativeInterface, name) == (n) * sizeof(void *), "jni.rs: " #name " is not slot " #n)
SLOT(NewStringUTF, 167);
SLOT(GetStringUTFChars, 169);
SLOT(ReleaseStringUTFChars, 170);
SLOT(NewDoubleArray, 182);
SLOT(SetDoubleArrayRegion, 214);
_Static_assert(sizeof(jboolean) == 1 && sizeof(jint) == 4 && sizeof(jlong) == 8 && sizeof(jdouble) == 8 && sizeof(jsize) == 4, "jni.rs: the primitive types");

/* src/aaudio.rs: the constants. */
_Static_assert(AAUDIO_UNSPECIFIED == 0, "aaudio.rs: UNSPECIFIED");
_Static_assert(AAUDIO_DIRECTION_OUTPUT == 0, "aaudio.rs: DIRECTION_OUTPUT");
_Static_assert(AAUDIO_FORMAT_PCM_FLOAT == 2, "aaudio.rs: FORMAT_PCM_FLOAT");
_Static_assert(AAUDIO_SHARING_MODE_SHARED == 1, "aaudio.rs: SHARING_MODE_SHARED");
_Static_assert(AAUDIO_PERFORMANCE_MODE_POWER_SAVING == 11, "aaudio.rs: PERFORMANCE_MODE_POWER_SAVING");
_Static_assert(AAUDIO_CALLBACK_RESULT_CONTINUE == 0, "aaudio.rs: CALLBACK_RESULT_CONTINUE");
_Static_assert(AAUDIO_OK == 0, "aaudio.rs: OK");
_Static_assert(AAUDIO_ERROR_DISCONNECTED == -899, "aaudio.rs: ERROR_DISCONNECTED");
_Static_assert(sizeof(aaudio_result_t) == 4 && sizeof(aaudio_format_t) == 4, "aaudio.rs: the enums are 32 bits");

/* src/aaudio.rs: sched_getparam's struct is one int. */
_Static_assert(sizeof(struct sched_param) == sizeof(int), "aaudio.rs: sched_param");

/* src/aaudio.rs: every function's shape, as declared there (i32 for each
   aaudio_*_t). An incompatible pointer is an error with -Werror. */
typedef aaudio_data_callback_result_t (*data_callback)(AAudioStream *, void *, void *, int32_t);
typedef void (*error_callback)(AAudioStream *, void *, aaudio_result_t);
static data_callback const data_shape = (AAudioStream_dataCallback)0;
static error_callback const error_shape = (AAudioStream_errorCallback)0;
static aaudio_result_t (*const f01)(AAudioStreamBuilder **) = AAudio_createStreamBuilder;
static const char *(*const f02)(aaudio_result_t) = AAudio_convertResultToText;
static void (*const f03)(AAudioStreamBuilder *, aaudio_direction_t) = AAudioStreamBuilder_setDirection;
static void (*const f04)(AAudioStreamBuilder *, aaudio_sharing_mode_t) = AAudioStreamBuilder_setSharingMode;
static void (*const f05)(AAudioStreamBuilder *, aaudio_performance_mode_t) = AAudioStreamBuilder_setPerformanceMode;
static void (*const f06)(AAudioStreamBuilder *, aaudio_format_t) = AAudioStreamBuilder_setFormat;
static void (*const f07)(AAudioStreamBuilder *, int32_t) = AAudioStreamBuilder_setChannelCount;
static void (*const f08)(AAudioStreamBuilder *, int32_t) = AAudioStreamBuilder_setSampleRate;
static void (*const f09)(AAudioStreamBuilder *, data_callback, void *) = AAudioStreamBuilder_setDataCallback;
static void (*const f10)(AAudioStreamBuilder *, error_callback, void *) = AAudioStreamBuilder_setErrorCallback;
static aaudio_result_t (*const f11)(AAudioStreamBuilder *, AAudioStream **) = AAudioStreamBuilder_openStream;
static aaudio_result_t (*const f12)(AAudioStreamBuilder *) = AAudioStreamBuilder_delete;
static aaudio_result_t (*const f13)(AAudioStream *) = AAudioStream_requestStart;
static aaudio_result_t (*const f14)(AAudioStream *) = AAudioStream_requestStop;
static aaudio_result_t (*const f15)(AAudioStream *) = AAudioStream_close;
static int32_t (*const f16)(AAudioStream *) = AAudioStream_getSampleRate;
static int32_t (*const f17)(AAudioStream *) = AAudioStream_getChannelCount;
static aaudio_format_t (*const f18)(AAudioStream *) = AAudioStream_getFormat;
static int32_t (*const f19)(AAudioStream *) = AAudioStream_getFramesPerBurst;
static int32_t (*const f20)(AAudioStream *) = AAudioStream_getBufferSizeInFrames;
static int32_t (*const f21)(AAudioStream *) = AAudioStream_getBufferCapacityInFrames;
static int32_t (*const f22)(AAudioStream *) = AAudioStream_getXRunCount;
static aaudio_performance_mode_t (*const f23)(AAudioStream *) = AAudioStream_getPerformanceMode;
static aaudio_sharing_mode_t (*const f24)(AAudioStream *) = AAudioStream_getSharingMode;
static void (*const f25)(AAudioStreamBuilder *, int32_t) = AAudioStreamBuilder_setFramesPerDataCallback;
static int32_t (*const f26)(AAudioStream *) = AAudioStream_getFramesPerDataCallback;
