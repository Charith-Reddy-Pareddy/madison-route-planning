import java.io.IOException;
import java.io.PrintStream;
import java.nio.file.Path;
import java.util.Locale;
import java.util.StringJoiner;

/** Command-line entry point for finding a walking route between two location IDs. */
public final class RoutePlannerCli {

  private RoutePlannerCli() {}

  public static void main(String[] args) {
    int exitCode = run(args, Path.of("data/locations.csv"), Path.of("data/roads.csv"),
        System.out, System.err);
    if (exitCode != 0) {
      System.exit(exitCode);
    }
  }

  public static int run(String[] args, Path locationsFile, Path roadsFile,
      PrintStream out, PrintStream err) {
    if (args == null || args.length != 2) {
      err.println("Usage: java RoutePlannerCli <start-id> <destination-id>");
      return 2;
    }

    RoadDataLoader.Dataset dataset;
    try {
      dataset = new RoadDataLoader().load(locationsFile, roadsFile);
    } catch (IOException exception) {
      err.println("Could not load route data: " + exception.getMessage());
      return 1;
    }

    WalkingRouteService service = new WalkingRouteService(dataset);
    WalkingRouteService.Route route;
    try {
      route = service.findRoute(args[0], args[1]);
    } catch (IllegalArgumentException | WalkingRouteService.NoWalkingRouteException exception) {
      err.println(exception.getMessage());
      return 1;
    }

    StringJoiner stops = new StringJoiner(" -> ");
    for (RoadDataLoader.Location location : route.locations()) {
      stops.add(location.name());
    }
    out.println(stops);
    out.printf(Locale.ROOT, "Distance: %.3f miles%n", route.distanceMiles());
    return 0;
  }
}
