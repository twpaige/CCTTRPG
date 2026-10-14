package com.crownandcall.srproof;

import java.util.*;

/** Process-local only. Survives Activity/service recreation, not process death. */
final class CompletionQueue {
    static final int LIMIT = 512;
    static final int MAX_BYTES = 16 * 1024 * 1024;
    private int bytes;
    private final LinkedHashMap<String, String> rows = new LinkedHashMap<>();
    synchronized int size() { return rows.size(); }
    synchronized boolean hasRoom() { return rows.size() < LIMIT; }
    synchronized boolean canFit(int size) { return hasRoom() && size <= MAX_BYTES - bytes; }
    synchronized void add(String id, String json) {
        if (rows.containsKey(id)) return;
        int size = json.getBytes(java.nio.charset.StandardCharsets.UTF_8).length;
        if (!canFit(size)) throw new IllegalStateException("Completion queue full; open SR to save progress.");
        rows.put(id, json);
        bytes += size;
    }
    synchronized List<String> batch() { List<String> batch = new ArrayList<>(); for (String row : rows.values()) { batch.add(row); if (batch.size() == 32) break; } return batch; }
    synchronized boolean acknowledge(String id) {
        if (rows.isEmpty() || !rows.keySet().iterator().next().equals(id)) return false;
        bytes -= rows.remove(id).getBytes(java.nio.charset.StandardCharsets.UTF_8).length; return true;
    }
}
