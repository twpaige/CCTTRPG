package com.crownandcall.srproof;

import java.io.*;
import java.text.SimpleDateFormat;
import java.util.*;

/** External document verification, independent of Android for failure-injection tests. */
final class BackupDocument {
    interface Reader { InputStream open() throws IOException; }
    interface Writer { OutputStream open() throws IOException; }
    static String name(Date localTime, int collision) {
        return "SR-Backup-" + new SimpleDateFormat("yyyy-MM-dd-HHmm", Locale.ROOT).format(localTime)
            + (collision == 0 ? "" : "-" + collision) + ".json";
    }
    static void save(byte[] expected, Reader reader, Writer writer) throws IOException {
        // CREATE_DOCUMENT must return a new file. Refuse nonempty output even from a broken provider.
        try (InputStream input = reader.open()) {
            if (input == null || input.read() != -1) throw new IOException("Destination is not a new empty document. Choose a new backup file.");
        }
        try (OutputStream output = writer.open()) {
            if (output == null) throw new IOException("Cannot open backup destination.");
            output.write(expected); output.flush();
        }
        try (InputStream input = reader.open()) {
            if (input == null) throw new IOException("Cannot reopen backup for verification.");
            byte[] buffer = new byte[8192]; int offset = 0, count;
            while ((count = input.read(buffer)) != -1) {
                if (count > expected.length - offset) throw new IOException("Backup verification failed: unexpected data.");
                for (int i = 0; i < count; i++) if (buffer[i] != expected[offset + i]) throw new IOException("Backup verification failed: contents differ.");
                offset += count;
            }
            if (offset != expected.length) throw new IOException("Backup verification failed: incomplete file.");
        }
    }
}
