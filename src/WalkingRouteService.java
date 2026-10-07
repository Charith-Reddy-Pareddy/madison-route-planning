import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/** Finds walking routes and returns their location details and total distance. */
public final class WalkingRouteService {

  public record Route(List<RoadDataLoader.Location> locations, double distanceMiles) {
    public Route {
      locations = List.copyOf(locations);
    }
  }

  private final DijkstraGraph<String, Double> graph;
  private final Map<String, RoadDataLoader.Location> locationsById;

  public WalkingRouteService(RoadDataLoader.Dataset dataset) {
    Objects.requireNonNull(dataset, "dataset");
    this.graph = new RoadGraphBuilder().buildWalkingGraph(dataset);
    Map<String, RoadDataLoader.Location> indexedLocations = new HashMap<>();
    for (RoadDataLoader.Location location : dataset.locations()) {
      indexedLocations.put(location.id(), location);
    }
    this.locationsById = Map.copyOf(indexedLocations);
  }

  public Route findRoute(String startId, String endId) {
    List<String> pathIds = graph.shortestPathData(startId, endId);
    List<RoadDataLoader.Location> path = new ArrayList<>(pathIds.size());
    for (String id : pathIds) {
      path.add(locationsById.get(id));
    }

    double distanceMiles = 0.0;
    for (int i = 1; i < pathIds.size(); i++) {
      distanceMiles += graph.getEdge(pathIds.get(i - 1), pathIds.get(i));
    }
    return new Route(path, distanceMiles);
  }
}
