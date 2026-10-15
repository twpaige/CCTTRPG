package com.crownandcall.srproof;

import java.util.*;
import java.io.*;
import java.nio.charset.StandardCharsets;

/** Process-local only. Survives Activity/service recreation, not process death. */
final class CompletionQueue implements AutoCloseable {
    static final int LIMIT = 512;
    static final int MAX_BYTES = 16 * 1024 * 1024;
    private int bytes;
    private final LinkedHashMap<String, String> rows = new LinkedHashMap<>();
    private RandomAccessFile overflow;
    private long head;
    private int spilled;
    synchronized void enableOverflow(File file) throws IOException { if (overflow == null) { overflow = new RandomAccessFile(file, "rw"); overflow.setLength(0); } }
    synchronized int size() { return rows.size() + spilled; }
    synchronized boolean hasRoom() { return overflow != null || rows.size() < LIMIT; }
    synchronized boolean canFit(int size) { return overflow != null || (hasRoom() && size <= MAX_BYTES - bytes); }
    synchronized void add(String id, String json) {
        if (rows.containsKey(id)) return;
        int size = json.getBytes(java.nio.charset.StandardCharsets.UTF_8).length;
        if (overflow != null && (spilled > 0 || rows.size() >= LIMIT || size > MAX_BYTES - bytes)) {
            long length = 0;
            try {
                length = overflow.length(); overflow.seek(length); write(id); write(json); spilled++; return;
            } catch (IOException error) {
                try { overflow.setLength(length); } catch (IOException ignored) { }
                throw new IllegalStateException("Cannot retain completion; temporary storage failed.", error);
            }
        }
        if (!canFit(size)) throw new IllegalStateException("Completion queue full; open SR to save progress.");
        rows.put(id, json);
        bytes += size;
    }
    private void write(String value) throws IOException { byte[] data = value.getBytes(StandardCharsets.UTF_8); overflow.writeInt(data.length); overflow.write(data); }
    private String read() throws IOException { int size = overflow.readInt(); if (size < 0 || size > overflow.length() - overflow.getFilePointer()) throw new IOException("Incomplete completion file."); byte[] data = new byte[size]; overflow.readFully(data); return new String(data, StandardCharsets.UTF_8); }
    synchronized List<String> batch() {
        List<String> batch = new ArrayList<>(); for (String row : rows.values()) { batch.add(row); if (batch.size() == 32) return batch; }
        if (spilled > 0) try { overflow.seek(head); for (int i = 0; i < spilled && batch.size() < 32; i++) { read(); batch.add(read()); } }
        catch (IOException error) { throw new IllegalStateException("Cannot read pending completions.", error); }
        return batch;
    }
    synchronized boolean acknowledge(String id) {
        if (rows.isEmpty()) {
            if (spilled == 0) return false;
            try {
                overflow.seek(head); if (!read().equals(id)) return false; read();
                long next = overflow.getFilePointer();
                if (spilled == 1) { overflow.setLength(0); next = 0; }
                head = next; spilled--; return true;
            } catch (IOException error) { throw new IllegalStateException("Cannot acknowledge pending completion.", error); }
        }
        if (!rows.keySet().iterator().next().equals(id)) return false;
        bytes -= rows.remove(id).getBytes(java.nio.charset.StandardCharsets.UTF_8).length; return true;
    }
    @Override public synchronized void close() throws IOException { if (overflow != null) overflow.close(); }
}
