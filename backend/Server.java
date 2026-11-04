import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Tiny dependency-free backend (Java 17+).  Run:  java Server.java
 *   GET  /api/story  -> contents of story.json (edit that file to change the site)
 *   GET  /api/notes  -> love notes left on the site
 *   POST /api/notes  -> {"name": "...", "text": "..."}
 */
public class Server {
    private static final Path STORY = Path.of("story.json");
    private static final List<String> NOTES = new CopyOnWriteArrayList<>();

    public static void main(String[] args) throws IOException {
        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "8080"));
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);

        server.createContext("/api/story", ex -> {
            if (!ex.getRequestMethod().equals("GET")) { send(ex, 405, "{}"); return; }
            send(ex, 200, Files.readString(STORY, StandardCharsets.UTF_8));
        });

        server.createContext("/api/notes", ex -> {
            switch (ex.getRequestMethod()) {
                case "GET" -> send(ex, 200, "[" + String.join(",", NOTES) + "]");
                case "POST" -> {
                    String body = new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
                    String text = field(body, "text");
                    if (text.isBlank() || text.length() > 500) { send(ex, 400, "{\"error\":\"text required (max 500)\"}"); return; }
                    String name = field(body, "name");
                    String note = "{\"name\":\"" + esc(name.isBlank() ? "Someone who loves you" : name)
                            + "\",\"text\":\"" + esc(text) + "\",\"at\":\"" + Instant.now() + "\"}";
                    NOTES.add(0, note);
                    send(ex, 201, note);
                }
                default -> send(ex, 405, "{}");
            }
        });

        server.start();
        System.out.println("Love-site API running on http://localhost:" + port);
    }

    private static void send(HttpExchange ex, int status, String json) throws IOException {
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        ex.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        ex.sendResponseHeaders(status, bytes.length);
        ex.getResponseBody().write(bytes);
        ex.close();
    }

    /** Pulls a string value out of a flat JSON object without needing a JSON library. */
    private static String field(String json, String key) {
        Matcher m = Pattern.compile("\"" + key + "\"\\s*:\\s*\"((?:[^\"\\\\]|\\\\.)*)\"").matcher(json);
        return m.find() ? m.group(1).replace("\\n", "\n").replace("\\\"", "\"").replace("\\\\", "\\") : "";
    }

    private static String esc(String s) {
        return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "");
    }
}
