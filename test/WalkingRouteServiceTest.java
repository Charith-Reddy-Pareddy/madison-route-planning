import static org.junit.jupiter.api.Assertions.assertEquals;

import java.io.IOException;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;

class WalkingRouteServiceTest {

  @Test
  void returnsNamedStopsAndDistanceForARouteInTheProjectData() throws IOException {
    RoadDataLoader.Dataset dataset = new RoadDataLoader().load(
        Path.of("data/locations.csv"), Path.of("data/roads.csv"));
    WalkingRouteService service = new WalkingRouteService(dataset);

    WalkingRouteService.Route route = service.findRoute("library_mall", "memorial_union");

    assertEquals(List.of("library_mall", "memorial_union"),
        route.locations().stream().map(RoadDataLoader.Location::id).toList());
    assertEquals(List.of("Library Mall", "Memorial Union"),
        route.locations().stream().map(RoadDataLoader.Location::name).toList());
    assertEquals(0.164, route.distanceMiles());
  }

  @Test
  void returnsAZeroDistanceForTheSameStartAndEnd() throws IOException {
    RoadDataLoader.Dataset dataset = new RoadDataLoader().load(
        Path.of("data/locations.csv"), Path.of("data/roads.csv"));
    WalkingRouteService service = new WalkingRouteService(dataset);

    WalkingRouteService.Route route = service.findRoute("bascom_hill", "bascom_hill");

    assertEquals(List.of("bascom_hill"),
        route.locations().stream().map(RoadDataLoader.Location::id).toList());
    assertEquals(0.0, route.distanceMiles());
  }
}
