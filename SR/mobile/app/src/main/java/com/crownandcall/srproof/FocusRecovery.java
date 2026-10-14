package com.crownandcall.srproof;

/** Audio-focus policy, serialized on the service Handler. No timers or caller guessing. */
final class FocusRecovery {
    enum Action { NONE, PAUSE, RESUME }
    private boolean waiting;
    boolean waiting() { return waiting; }
    void cancel() { waiting = false; }
    Action change(int focus, boolean playing, boolean paused) {
        // Android AudioManager constants: GAIN=1, LOSS=-1, TRANSIENT=-2, CAN_DUCK=-3.
        if (focus == -3) {
            waiting = waiting || playing;
            return playing ? Action.PAUSE : Action.NONE;
        }
        if (focus < 0) { waiting = false; return Action.PAUSE; }
        if (focus == 1) {
            boolean resume = waiting && paused;
            waiting = false;
            return resume ? Action.RESUME : Action.NONE;
        }
        return Action.NONE;
    }
}
