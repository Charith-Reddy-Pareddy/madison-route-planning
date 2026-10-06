import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.io.IOException;
import java.nio.file.Path;
import java.util.List;
import java.util.OptionalDouble;
import org.junit.jupiter.api.Test;

class RoadGraphBuilderTest {

  @Test
  void loadsTheMadisonDataAndRoutesBetweenConnectedLocations() throws IOException {
    RoadDataLoader.Dataset dataset = new RoadDataLoader().load(
        Path.of("data/locations.csv"), Path.of("data/roads.csv"));
    DijkstraGraph<String, Double> graph = new RoadGraphBuilder().buildWalkingGraph(dataset);

    assertEquals(dataset.locations().size(), graph.getNodeCount());
    assertEquals(dataset.roads().size(), graph.getEdgeCount());
    assertEquals(List.of("library_mall", "memorial_union"),
        graph.shortestPathData("library_mall", "memorial_union"));
    assertEquals(0.164, graph.shortestPathCost("library_mall", "memorial_union"));
  }

  @Test
  void shortestPathUsesWalkingWeightsInsteadOfTheFirstAvailableRoad() {
    RoadDataLoader.Dataset dataset = new RoadDataLoader.Dataset(
        List.of(location("start"), location("direct"), location("nearby"), location("end")),
        List.of(
            road("start", "direct", 5.0),
            road("start", "nearby", 1.0),
            road("nearby", "end", 1.5),
            road("end", "direct", 1.0)));
    DijkstraGraph<String, Double> graph = new RoadGraphBuilder().buildWalkingGraph(dataset);

    assertEquals(List.of("start", "nearby", "end", "direct"),
        graph.shortestPathData("start", "direct"));
    assertEquals(3.5, graph.shortestPathCost("start", "direct"));
  }

  @Test
  void rejectsRoadsThatReferenceUnknownNodes() {
    RoadDataLoader.Dataset dataset = new RoadDataLoader.Dataset(
        List.of(location("start")), List.of(road("start", "missing", 1.0)));

    assertThrows(IllegalArgumentException.class,
        () -> new RoadGraphBuilder().buildWalkingGraph(dataset));
  }

  private RoadDataLoader.Location location(String id) {
    return new RoadDataLoader.Location(id, id, 43.0, -89.0);
  }

  private RoadDataLoader.Road road(String from, String to, double walkMiles) {
    return new RoadDataLoader.Road(from, to, walkMiles, OptionalDouble.empty(), false, 0.0,
        OptionalDouble.of(walkMiles), "");
  }
}
