import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/** Parsed route parameters shared by HTTP handlers and route services. */
public record RouteRequest(String startId, String destinationId, List<ClosedRoad> closedRoads) {

  public record ClosedRoad(String from, String to) {
    public ClosedRoad {
      from = requiredId(from, "closed road start");
      to = requiredId(to, "closed road destination");
      if (from.equals(to)) {
        throw new IllegalArgumentException("A closed road needs two different locations.");
      }
    }
  }

  public RouteRequest {
    startId = requiredId(startId, "start");
    destinationId = requiredId(destinationId, "destination");
    closedRoads = List.copyOf(Objects.requireNonNull(closedRoads, "closedRoads"));
  }

  /** Parse start, destination, and repeated directed closed=from:to query parameters. */
  public static RouteRequest fromQuery(String query) {
    Map<String, List<String>> params = new LinkedHashMap<>();
    if (query != null && !query.isEmpty()) {
      for (String pair : query.split("&", -1)) {
        int separator = pair.indexOf('=');
        if (separator < 1) {
          throw new IllegalArgumentException("Each query parameter needs a name and value.");
        }
        String name = decode(pair.substring(0, separator));
        String value = decode(pair.substring(separator + 1));
        if (!List.of("start", "destination", "closed").contains(name)) {
          throw new IllegalArgumentException("Unknown route parameter: " + name);
        }
        params.computeIfAbsent(name, ignored -> new ArrayList<>()).add(value);
      }
    }

    String start = singleValue(params, "start");
    String destination = singleValue(params, "destination");
    List<ClosedRoad> closures = new ArrayList<>();
    for (String value : params.getOrDefault("closed", List.of())) {
      String[] endpoints = value.split(":", -1);
      if (endpoints.length != 2) {
        throw new IllegalArgumentException("A closed road must use the form from:to.");
      }
      closures.add(new ClosedRoad(endpoints[0], endpoints[1]));
    }
    return new RouteRequest(start, destination, closures);
  }

  private static String singleValue(Map<String, List<String>> params, String name) {
    List<String> values = params.get(name);
    if (values == null || values.size() != 1) {
      throw new IllegalArgumentException("Route query needs exactly one '" + name + "' value.");
    }
    return values.get(0);
  }

  private static String decode(String value) {
    try {
      return URLDecoder.decode(value, StandardCharsets.UTF_8);
    } catch (IllegalArgumentException exception) {
      throw new IllegalArgumentException("Route query contains invalid URL encoding.", exception);
    }
  }

  private static String requiredId(String value, String field) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException("Route query needs a non-empty " + field + " location.");
    }
    return value.trim();
  }
}
