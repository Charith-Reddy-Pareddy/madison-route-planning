import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

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
  void rejectsUnknownStartAndDestinationIds() throws IOException {
    RoadDataLoader.Dataset dataset = new RoadDataLoader().load(
        Path.of("data/locations.csv"), Path.of("data/roads.csv"));
    WalkingRouteService service = new WalkingRouteService(dataset);

    IllegalArgumentException missingStart = assertThrows(IllegalArgumentException.class,
        () -> service.findRoute("not-a-location", "memorial_union"));
    IllegalArgumentException missingDestination = assertThrows(IllegalArgumentException.class,
        () -> service.findRoute("library_mall", "not-a-location"));

    assertTrue(missingStart.getMessage().contains("Unknown start location"));
    assertTrue(missingDestination.getMessage().contains("Unknown destination location"));
  }

  @Test
  void reportsWhenKnownLocationsHaveNoRoute() {
    RoadDataLoader.Dataset dataset = new RoadDataLoader.Dataset(
        List.of(location("start"), location("destination")), List.of());
    WalkingRouteService service = new WalkingRouteService(dataset);

    WalkingRouteService.NoWalkingRouteException error = assertThrows(
        WalkingRouteService.NoWalkingRouteException.class,
        () -> service.findRoute("start", "destination"));

    assertTrue(error.getMessage().contains("No walking route from 'start' to 'destination'"));
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

  private RoadDataLoader.Location location(String id) {
    return new RoadDataLoader.Location(id, id, 43.0, -89.0);
  }
}
