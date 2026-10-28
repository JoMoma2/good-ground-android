package local.goodground.training;

import org.json.JSONObject;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

/** Runs only through the explicitly enabled debug smoke-test launch. */
final class StoreChecks {
    static JSONObject run(File cache) throws Exception {
        File folder = new File(cache,"store-smoke-"+System.nanoTime());
        LocalStore store = new LocalStore(folder);
        int checks=0;
        try {
            require(store.boot().isNull("state")); checks++;
            JSONObject one = new JSONObject().put("schema",1).put("revision",1).put("marker","one");
            JSONObject two = new JSONObject().put("schema",1).put("revision",2).put("marker","two");
            store.save(one); store.save(two); checks++;
            require(new JSONObject(store.previousBackup()).getJSONObject("state").getLong("revision")==1); checks++;
            store.save(two);
            require(new JSONObject(store.previousBackup()).getJSONObject("state").getLong("revision")==1); checks++;
            require(new LocalStore(folder).boot().getJSONObject("state").getLong("revision")==2); checks++;
            Files.write(new File(folder,"progress.json").toPath(),"broken json".getBytes(StandardCharsets.UTF_8));
            LocalStore damaged = new LocalStore(folder);
            require(!damaged.boot().isNull("error")); checks++;
            require(new JSONObject(damaged.previousBackup()).getJSONObject("state").getLong("revision")==1); checks++;
            damaged.save(new JSONObject().put("schema",1).put("revision",3));
            require(new LocalStore(folder).boot().getJSONObject("state").getLong("revision")==3); checks++;
            boolean rejected=false;
            try { damaged.save(new JSONObject().put("schema",9).put("revision",4)); }catch(Exception expected){rejected=true;}
            require(rejected); checks++;
            byte[] oversized = new byte[LocalStore.LIMIT+1];
            rejected=false;
            try {LocalStore.readText(new java.io.ByteArrayInputStream(oversized));}catch(Exception expected){rejected=true;}
            require(rejected); checks++;
            return new JSONObject().put("passed",true).put("checks",checks);
        } finally {
            File[] files=folder.listFiles();if(files!=null)for(File file:files)file.delete();folder.delete();
        }
    }
    private static void require(boolean ok) {if(!ok)throw new IllegalStateException("Private file store check failed");}
}
