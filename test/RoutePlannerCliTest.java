import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.PrintStream;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class RoutePlannerCliTest {

  @TempDir
  Path tempDir;

  @Test
  void printsARouteFromTheProjectData() throws IOException {
    ByteArrayOutputStream output = new ByteArrayOutputStream();
    ByteArrayOutputStream errors = new ByteArrayOutputStream();

    int exitCode = RoutePlannerCli.run(new String[] {"library_mall", "memorial_union"},
        Path.of("data/locations.csv"), Path.of("data/roads.csv"),
        new PrintStream(output), new PrintStream(errors));

    assertEquals(0, exitCode);
    assertEquals("Library Mall -> Memorial Union\nDistance: 0.164 miles\n", output.toString());
    assertEquals("", errors.toString());
  }

  @Test
  void printsUsageWhenArgumentsAreMissing() {
    ByteArrayOutputStream errors = new ByteArrayOutputStream();

    int exitCode = RoutePlannerCli.run(new String[0], Path.of("locations.csv"),
        Path.of("roads.csv"), new PrintStream(new ByteArrayOutputStream()),
        new PrintStream(errors));

    assertEquals(2, exitCode);
    assertTrue(errors.toString().contains("Usage: java RoutePlannerCli"));
  }

  @Test
  void reportsAnUnknownLocationWithoutAStackTrace() throws IOException {
    ByteArrayOutputStream errors = new ByteArrayOutputStream();

    int exitCode = RoutePlannerCli.run(new String[] {"missing", "memorial_union"},
        Path.of("data/locations.csv"), Path.of("data/roads.csv"),
        new PrintStream(new ByteArrayOutputStream()), new PrintStream(errors));

    assertEquals(1, exitCode);
    assertTrue(errors.toString().contains("Unknown start location: missing"));
    assertTrue(!errors.toString().contains("Exception"));
  }

  @Test
  void reportsWhenNoRouteExists() throws IOException {
    Path locations = write("locations.csv",
        "id,name,lat,lon,query,source,retrieved_at\n"
            + "start,Start,43.0,-89.0,Start,map,now\n"
            + "end,End,43.1,-89.1,End,map,now\n");
    Path roads = write("roads.csv",
        "from,to,walkMiles,driveMiles,hasSteps,maxInclinePercent,accessibleMiles,busRoute\n");
    ByteArrayOutputStream errors = new ByteArrayOutputStream();

    int exitCode = RoutePlannerCli.run(new String[] {"start", "end"}, locations, roads,
        new PrintStream(new ByteArrayOutputStream()), new PrintStream(errors));

    assertEquals(1, exitCode);
    assertTrue(errors.toString().contains("No walking route from 'start' to 'end'"));
  }

  private Path write(String name, String content) throws IOException {
    Path path = tempDir.resolve(name);
    Files.writeString(path, content);
    return path;
  }
}
