import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.file.Path;

/** Starts the route HTTP API on port 8080 or the supplied port. */
public final class RouteApiServer {

  private RouteApiServer() {}

  public static void main(String[] args) throws IOException {
    if (args.length > 1) {
      throw new IllegalArgumentException("Usage: java RouteApiServer [port]");
    }
    int port = args.length == 0 ? 8080 : Integer.parseInt(args[0]);
    if (port < 0 || port > 65535) {
      throw new IllegalArgumentException("Port must be between 0 and 65535.");
    }

    RoadDataLoader.Dataset dataset = new RoadDataLoader().load(
        Path.of("data/locations.csv"), Path.of("data/roads.csv"));
    HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
    server.createContext("/api/route", new RouteApiHandler(new WalkingRouteService(dataset)));
    server.start();
    System.out.println("Route API listening on port " + server.getAddress().getPort());
  }
}
