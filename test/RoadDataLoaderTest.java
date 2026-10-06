import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class RoadDataLoaderTest {

  @TempDir
  Path tempDir;

  @Test
  void readsTheProjectDataFiles() throws IOException {
    RoadDataLoader.Dataset dataset = new RoadDataLoader().load(
        Path.of("data/locations.csv"), Path.of("data/roads.csv"));

    assertEquals(57, dataset.locations().size());
    assertEquals(212, dataset.roads().size());
    RoadDataLoader.Road unionPath = dataset.roads().stream()
        .filter(road -> road.from().equals("library_mall")
            && road.to().equals("memorial_union"))
        .findFirst().orElseThrow();
    assertTrue(unionPath.driveMiles().isPresent());
    assertTrue(unionPath.accessibleMiles().isEmpty());
    assertEquals("Library Mall", dataset.locations().stream()
        .filter(location -> location.id().equals("library_mall"))
        .findFirst().orElseThrow().name());
  }

  @Test
  void keepsCommasInsideQuotedLocationFields() throws IOException {
    Path locations = write("locations.csv",
        "id,name,lat,lon,query,source,retrieved_at\n"
            + "campus,West Campus,43.0,-89.0,\"West Campus, Madison, WI\",map,now\n");
    Path roads = write("roads.csv",
        "from,to,walkMiles,driveMiles,hasSteps,maxInclinePercent,accessibleMiles,busRoute\n");

    RoadDataLoader.Dataset dataset = new RoadDataLoader().load(locations, roads);

    assertEquals(1, dataset.locations().size());
    assertEquals("West Campus", dataset.locations().get(0).name());
  }

  @Test
  void rejectsRoadsThatReferenceUnknownLocations() throws IOException {
    Path locations = write("locations.csv",
        "id,name,lat,lon,query,source,retrieved_at\n"
            + "known,Known,43.0,-89.0,Known,map,now\n");
    Path roads = write("roads.csv",
        "from,to,walkMiles,driveMiles,hasSteps,maxInclinePercent,accessibleMiles,busRoute\n"
            + "known,missing,0.2,0.3,false,0,0.2,\n");

    IOException error = assertThrows(IOException.class,
        () -> new RoadDataLoader().load(locations, roads));

    assertTrue(error.getMessage().contains("unknown location id 'missing'"));
    assertTrue(error.getMessage().contains(":2:"));
  }

  @Test
  void rejectsCoordinatesOutsideTheirValidRanges() throws IOException {
    Path locations = write("locations.csv",
        "id,name,lat,lon,query,source,retrieved_at\n"
            + "bad,Bad,91.0,-89.0,Bad,map,now\n");
    Path roads = write("roads.csv",
        "from,to,walkMiles,driveMiles,hasSteps,maxInclinePercent,accessibleMiles,busRoute\n");

    IOException error = assertThrows(IOException.class,
        () -> new RoadDataLoader().load(locations, roads));

    assertTrue(error.getMessage().contains("latitude must be between -90 and 90"));
  }

  private Path write(String name, String content) throws IOException {
    Path path = tempDir.resolve(name);
    Files.writeString(path, content);
    return path;
  }
}
