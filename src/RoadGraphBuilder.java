import java.util.Objects;

/** Builds a walking graph from the validated road dataset. */
public final class RoadGraphBuilder {

  public DijkstraGraph<String, Double> buildWalkingGraph(RoadDataLoader.Dataset dataset) {
    Objects.requireNonNull(dataset, "dataset");
    DijkstraGraph<String, Double> graph = new DijkstraGraph<>();

    for (RoadDataLoader.Location location : dataset.locations()) {
      if (!graph.insertNode(location.id())) {
        throw new IllegalArgumentException("Duplicate location id: " + location.id());
      }
    }

    for (RoadDataLoader.Road road : dataset.roads()) {
      if (!graph.containsNode(road.from()) || !graph.containsNode(road.to())) {
        throw new IllegalArgumentException(
            "Road references an unknown location: " + road.from() + " to " + road.to());
      }
      graph.insertEdge(road.from(), road.to(), road.walkMiles());
    }
    return graph;
  }
}
