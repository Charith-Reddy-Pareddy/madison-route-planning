import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.NoSuchElementException;
import java.util.Set;

/** Finds walking routes and returns their location details and total distance. */
public final class WalkingRouteService {

  public static final class NoWalkingRouteException extends NoSuchElementException {
    public NoWalkingRouteException(String startId, String endId, Throwable cause) {
      super("No walking route from '" + startId + "' to '" + endId + "'", cause);
    }
  }

  public record Route(List<RoadDataLoader.Location> locations, double distanceMiles) {
    public Route {
      locations = List.copyOf(locations);
    }
  }

  private final DijkstraGraph<String, Double> graph;
  private final RoadDataLoader.Dataset dataset;
  private final Map<String, RoadDataLoader.Location> locationsById;

  private record DirectedRoad(String from, String to) {}

  public WalkingRouteService(RoadDataLoader.Dataset dataset) {
    Objects.requireNonNull(dataset, "dataset");
    this.dataset = dataset;
    this.graph = new RoadGraphBuilder().buildWalkingGraph(dataset);
    Map<String, RoadDataLoader.Location> indexedLocations = new HashMap<>();
    for (RoadDataLoader.Location location : dataset.locations()) {
      indexedLocations.put(location.id(), location);
    }
    this.locationsById = Map.copyOf(indexedLocations);
  }

  public Route findRoute(String startId, String endId) {
    return findRoute(startId, endId, List.of());
  }

  /** Finds a route while excluding the requested directed roads for this search only. */
  public Route findRoute(String startId, String endId, List<RouteRequest.ClosedRoad> closedRoads) {
    requireLocation(startId, "start");
    requireLocation(endId, "destination");
    Objects.requireNonNull(closedRoads, "closedRoads");

    DijkstraGraph<String, Double> routeGraph = graph;
    if (!closedRoads.isEmpty()) {
      Set<DirectedRoad> knownRoads = new HashSet<>();
      for (RoadDataLoader.Road road : dataset.roads()) {
        knownRoads.add(new DirectedRoad(road.from(), road.to()));
      }
      Set<DirectedRoad> closed = new HashSet<>();
      for (RouteRequest.ClosedRoad road : closedRoads) {
        Objects.requireNonNull(road, "closed road");
        DirectedRoad key = new DirectedRoad(road.from(), road.to());
        if (!knownRoads.contains(key)) {
          throw new IllegalArgumentException(
              "Unknown road to close: " + road.from() + " to " + road.to());
        }
        if (!closed.add(key)) {
          throw new IllegalArgumentException(
              "Road is listed for closure more than once: " + road.from() + " to " + road.to());
        }
      }
      List<RoadDataLoader.Road> openRoads = dataset.roads().stream()
          .filter(road -> !closed.contains(new DirectedRoad(road.from(), road.to())))
          .toList();
      routeGraph = new RoadGraphBuilder().buildWalkingGraph(
          new RoadDataLoader.Dataset(dataset.locations(), openRoads));
    }

    List<String> pathIds;
    try {
      pathIds = routeGraph.shortestPathData(startId, endId);
    } catch (NoSuchElementException exception) {
      throw new NoWalkingRouteException(startId, endId, exception);
    }
    List<RoadDataLoader.Location> path = new ArrayList<>(pathIds.size());
    for (String id : pathIds) {
      path.add(locationsById.get(id));
    }

    double distanceMiles = 0.0;
    for (int i = 1; i < pathIds.size(); i++) {
      distanceMiles += routeGraph.getEdge(pathIds.get(i - 1), pathIds.get(i));
    }
    return new Route(path, distanceMiles);
  }

  private void requireLocation(String id, String role) {
    if (id == null || !locationsById.containsKey(id)) {
      throw new IllegalArgumentException("Unknown " + role + " location: " + id);
    }
  }
}
