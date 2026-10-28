package local.goodground.training;

import android.util.AtomicFile;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/** Atomic private saves. A failed or unreadable file is retained for recovery. */
final class LocalStore {
    static final int LIMIT = 5 * 1024 * 1024;
    private final AtomicFile current, previous;
    private long lastRevision = -1;
    LocalStore(File directory) throws IOException {
        if (!directory.isDirectory() && !directory.mkdirs()) throw new IOException("Local folder unavailable");
        current = new AtomicFile(new File(directory, "progress.json"));
        previous = new AtomicFile(new File(directory, "previous-progress.json"));
    }
    synchronized JSONObject boot() {
        Object state = JSONObject.NULL, error = JSONObject.NULL;
        try {
            if (current.getBaseFile().exists() || new File(current.getBaseFile()+".bak").exists()) {
                try (InputStream in = current.openRead()) { state = new JSONObject(readText(in)); }
                long revision = ((JSONObject)state).optLong("revision", -1);
                if (revision >= 0 && revision <= 1000000000000L) lastRevision = Math.max(lastRevision, revision);
            }
        } catch (Exception e) {
            error = "Saved records could not be read. Preview the previous local save or import a backup before making changes. Your original file has been kept.";
        }
        JSONObject boot = new JSONObject();
        try {
            boot.put("state", state); boot.put("error", error); boot.put("native", true);
            boot.put("platform", "android"); boot.put("lastRevision", Math.max(0, lastRevision));
        } catch (Exception impossible) { throw new IllegalStateException(impossible); }
        return boot;
    }
    synchronized long save(JSONObject state) throws Exception {
        long revision = state.getLong("revision");
        if (state.getInt("schema") != 1 || revision < 0 || revision > 1000000000000L) throw new IOException("Invalid state");
        if (revision <= lastRevision) return lastRevision;
        byte[] data = state.toString().getBytes(StandardCharsets.UTF_8);
        if (data.length > LIMIT) throw new IOException("Save too large");
        String old = null;
        try {
            if (current.getBaseFile().exists()) {
                try (InputStream in = current.openRead()) { old = readText(in); }
                new JSONObject(old);
            }
        } catch (Exception unreadable) { old = null; }
        // A damaged current file must not prevent an explicitly confirmed restore.
        // A failed recovery-snapshot write still prevents replacing a valid current file.
        if (old != null) atomicWrite(previous, old.getBytes(StandardCharsets.UTF_8));
        atomicWrite(current, data);
        lastRevision = revision;
        return revision;
    }
    synchronized String previousBackup() throws Exception {
        JSONObject backup = new JSONObject();
        try (InputStream in = previous.openRead()) {
            backup.put("format", "good-ground-backup"); backup.put("version", 3);
            backup.put("state", new JSONObject(readText(in)));
        }
        return backup.toString();
    }
    static void atomicWrite(AtomicFile file, byte[] data) throws IOException {
        FileOutputStream out = null;
        try { out = file.startWrite(); out.write(data); file.finishWrite(out); }
        catch (IOException e) { if (out != null) file.failWrite(out); throw e; }
    }
    static String readText(InputStream in) throws IOException {
        if (in == null) throw new IOException("No readable file");
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192]; int count;
        while ((count = in.read(buffer)) != -1) {
            if (bytes.size() + count > LIMIT) throw new IOException("File exceeds 5 MB");
            bytes.write(buffer, 0, count);
        }
        return bytes.toString(StandardCharsets.UTF_8.name());
    }
}
