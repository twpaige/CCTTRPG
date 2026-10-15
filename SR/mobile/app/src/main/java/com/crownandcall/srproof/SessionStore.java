package com.crownandcall.srproof;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.json.*;

/** Disposable prepared material. Disk index, bounded read-ahead, no recovery/checkpoint contract. */
final class SessionStore extends AbstractList<PlaybackEngine.Unit> implements AutoCloseable {
    final JSONObject header;
    final File directory, dataFile, indexFile, transferFile;
    private final RandomAccessFile data, index;
    private int count, first = -1;
    private final List<Plan> cache = new ArrayList<>();
    private OutputStream transfer;
    boolean sealed;
    final BitSet finished;
    SessionStore(File directory, JSONObject header) throws IOException { this(directory, header, new BitSet()); }
    SessionStore(File directory, JSONObject header, BitSet finished) throws IOException {
        this.directory = directory; this.header = header; this.finished = finished;
        if (!directory.isDirectory() && !directory.mkdirs()) throw new IOException("Cannot create temporary session storage.");
        String id = UUID.randomUUID().toString();
        dataFile = new File(directory, id + ".data"); indexFile = new File(directory, id + ".index"); transferFile = new File(directory, id + ".part");
        data = new RandomAccessFile(dataFile, "rw"); index = new RandomAccessFile(indexFile, "rw");
    }
    void part(String text) throws IOException {
        if (sealed) throw new IOException("Session is already prepared.");
        if (text.length() > 65536) throw new IOException("Transfer chunk too large.");
        if (transfer == null) transfer = new FileOutputStream(transferFile);
        transfer.write(text.getBytes(StandardCharsets.UTF_8));
    }
    void finishUnit() throws IOException, JSONException {
        if (transfer == null) throw new IOException("Missing step data.");
        transfer.close(); transfer = null;
        byte[] bytes;
        try (InputStream input = new FileInputStream(transferFile); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[65536]; int n;
            while ((n = input.read(buffer)) != -1) out.write(buffer, 0, n);
            bytes = out.toByteArray();
        }
        JSONObject row = new JSONObject(new String(bytes, StandardCharsets.UTF_8));
        int id = row.getInt("id");
        if (id < 0 || (count > 0 && id <= raw(count - 1).getInt("id"))) throw new JSONException("Step order changed.");
        parse(row); append(bytes);
        if (!transferFile.delete()) throw new IOException("Could not clean step transfer.");
    }
    private Plan parse(JSONObject row) throws JSONException {
        JSONObject root = new JSONObject(header.toString()).put("version", 2).put("units", new JSONArray().put(row));
        return new Plan(root.toString(), true);
    }
    private void append(byte[] bytes) throws IOException {
        long offset = data.length();
        data.seek(offset); data.writeInt(bytes.length); data.write(bytes);
        index.seek((long) count * 8); index.writeLong(offset); count++;
    }
    JSONObject raw(int position) throws IOException, JSONException {
        if (position < 0 || position >= count) throw new IndexOutOfBoundsException();
        index.seek((long) position * 8); data.seek(index.readLong());
        int length = data.readInt();
        if (length < 0 || length > data.length() - data.getFilePointer()) throw new IOException("Incomplete session file.");
        byte[] bytes = new byte[length]; data.readFully(bytes);
        return new JSONObject(new String(bytes, StandardCharsets.UTF_8));
    }
    void seal() throws IOException {
        if (transfer != null || count == 0) throw new IOException("Preparation is incomplete or empty.");
        sealed = true;
    }
    @Override public int size() { return count; }
    int cachedSteps() { return cache.size(); }
    boolean needsCredit(String id, JSONObject unit, long startedAt) throws JSONException {
        if (finished.get(Integer.parseInt(id))) return false;
        if (header.getString("mode").equals("AUDIT") || unit.getLong("nextDueAt") > startedAt) { finished.set(Integer.parseInt(id)); return false; }
        return true;
    }
    void retained(String id) { finished.set(Integer.parseInt(id)); }
    @Override public PlaybackEngine.Unit get(int position) {
        try {
            if (!sealed) throw new IOException("Session is not ready.");
            if (first < 0 || position < first || position >= first + cache.size()) {
                cache.clear(); first = position; int bytes = 0;
                for (int i = position; i < count && cache.size() < 16; i++) {
                    JSONObject row = raw(i); cache.add(parse(row)); bytes += row.toString().length() * 2;
                    if (bytes >= 1024 * 1024) break;
                }
            }
            return cache.get(position - first).units.get(0);
        } catch (IOException | JSONException error) { throw new IllegalStateException("Cannot read prepared session: " + error.getMessage(), error); }
    }
    JSONObject descriptor(int position) { PlaybackEngine.Unit unit = get(position); return cache.get(position - first).descriptors.get(unit.id()); }
    JSONObject manifest(int offset) throws JSONException {
        JSONArray rows = new JSONArray();
        for (int i = offset; i < Math.min(count, offset + 32); i++) rows.put(new JSONObject(descriptor(i).toString()).put("id", get(i).id()));
        return new JSONObject().put("header", header).put("count", count).put("offset", offset).put("units", rows);
    }
    void copyUpdated(SessionStore source, int position, JSONObject patch) throws IOException, JSONException {
        JSONObject row = source.raw(position);
        if (!row.getString("id").equals(patch.getString("id"))) throw new JSONException("Session update order changed.");
        if (!patch.getBoolean("keep")) return;
        for (String key : new String[]{"mastery", "nextDueAt", "progressRevision"}) row.put(key, patch.get(key));
        parse(row); append(row.toString().getBytes(StandardCharsets.UTF_8));
    }
    @Override public void close() throws IOException {
        try { if (transfer != null) transfer.close(); } finally { try { data.close(); } finally { index.close(); } }
        cache.clear();
        for (File file : new File[]{dataFile, indexFile, transferFile}) if (file.exists() && !file.delete()) throw new IOException("Cannot remove temporary session file.");
    }
}
