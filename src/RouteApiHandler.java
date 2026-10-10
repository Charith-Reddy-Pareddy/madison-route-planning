import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import java.io.IOException;
import java.io.OutputStream;
import java.util.Locale;
import java.util.Objects;

/** Serves route searches over the small read-only HTTP API. */
public final class RouteApiHandler implements HttpHandler {

  record ApiResponse(int status, String body, String allow) {}

  private final WalkingRouteService routes;

  public RouteApiHandler(WalkingRouteService routes) {
    this.routes = Objects.requireNonNull(routes, "routes");
  }

  @Override
  public void handle(HttpExchange exchange) throws IOException {
    try {
      ApiResponse response = respond(exchange.getRequestMethod(),
          exchange.getRequestURI().getPath(), exchange.getRequestURI().getRawQuery());
      exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
      if (response.allow() != null) {
        exchange.getResponseHeaders().set("Allow", response.allow());
      }
      byte[] bytes = response.body().getBytes(java.nio.charset.StandardCharsets.UTF_8);
      exchange.sendResponseHeaders(response.status(), bytes.length);
      try (OutputStream output = exchange.getResponseBody()) {
        output.write(bytes);
      }
    } finally {
      exchange.close();
    }
  }

  ApiResponse respond(String method, String path, String query) {
    if (!"/api/route".equals(path)) {
      return new ApiResponse(404, errorJson("Route endpoint not found."), null);
    }
    if (!"GET".equals(method)) {
      return new ApiResponse(405, errorJson("Only GET is supported."), "GET");
    }

    try {
      RouteRequest request = RouteRequest.fromQuery(query);
      WalkingRouteService.Route route = routes.findRoute(request.startId(),
          request.destinationId(), request.closedRoads());
      return new ApiResponse(200, routeJson(route), null);
    } catch (WalkingRouteService.NoWalkingRouteException exception) {
      return new ApiResponse(404, errorJson(exception.getMessage()), null);
    } catch (IllegalArgumentException exception) {
      return new ApiResponse(400, errorJson(exception.getMessage()), null);
    }
  }

  private String routeJson(WalkingRouteService.Route route) {
    StringBuilder json = new StringBuilder("{\"locations\":[");
    for (int i = 0; i < route.locations().size(); i++) {
      if (i > 0) json.append(',');
      RoadDataLoader.Location location = route.locations().get(i);
      json.append("{\"id\":").append(quote(location.id()))
          .append(",\"name\":").append(quote(location.name()))
          .append(",\"latitude\":").append(location.latitude())
          .append(",\"longitude\":").append(location.longitude()).append('}');
    }
    return json.append("],\"distanceMiles\":").append(route.distanceMiles()).append('}')
        .toString();
  }

  private String quote(String value) {
    StringBuilder json = new StringBuilder("\"");
    for (int i = 0; i < value.length(); i++) {
      char ch = value.charAt(i);
      switch (ch) {
        case '"' -> json.append("\\\"");
        case '\\' -> json.append("\\\\");
        case '\b' -> json.append("\\b");
        case '\f' -> json.append("\\f");
        case '\n' -> json.append("\\n");
        case '\r' -> json.append("\\r");
        case '\t' -> json.append("\\t");
        default -> {
          if (ch < 0x20) {
            json.append(String.format(Locale.ROOT, "\\u%04x", (int) ch));
          } else {
            json.append(ch);
          }
        }
      }
    }
    return json.append('"').toString();
  }

  private String errorJson(String message) {
    return "{\"error\":" + quote(message) + "}";
  }
}
